import ngeohash from 'ngeohash'
import Ably     from 'ably'

import { inngest } from '@/lib/inngest'
import { db }      from '@/lib/db'
import { redis }   from '@/lib/redis'
import {
  calculateImpactScore,
  minutesUntilDeparture,
  buildHeadline,
  scoreToStatus,
} from '@/lib/my-journey/predictor'
import type { UserJourneyData, JourneyStatusResult } from '@/lib/my-journey/types'

let _ably: Ably.Rest | null = null
function getAbly(): Ably.Rest {
  if (!_ably) _ably = new Ably.Rest({ key: process.env.ABLY_API_KEY! })
  return _ably
}

const MODE_MAP: Record<string, 'car' | 'transit' | 'both'> = {
  CAR: 'car', TRANSIT: 'transit', BOTH: 'both',
}

export const predictJourneysJob = inngest.createFunction(
  {
    id:       'predict-journeys',
    name:     'Mon Trajet — prédiction toutes les 5 min',
    triggers: [{ cron: '*/5 * * * *' }],
  },
  async ({ step }) => {
    const now = new Date()

    const journeys = await step.run('fetch-active-journeys', async () => {
      return db.userJourney.findMany({ where: { active: true } })
    })

    const toEvaluate = journeys.filter(j => {
      const jd: UserJourneyData = {
        id:     j.id,
        userId: j.userId,
        name:   j.name,
        from:   { lat: j.fromLat, lng: j.fromLng, label: j.fromLabel },
        to:     { lat: j.toLat,   lng: j.toLng,   label: j.toLabel   },
        schedule: {
          dayOfWeek:       j.dayOfWeek,
          departureHour:   j.departureHour,
          departureMinute: j.departureMinute,
          flexMinutes:     j.flexMinutes,
        },
        preferredMode:       MODE_MAP[j.preferredMode] ?? 'both',
        notifyMinutesBefore: j.notifyMinutesBefore,
        active:              j.active,
      }
      const deptIn = minutesUntilDeparture(jd, now)
      return deptIn > -10 && deptIn <= 60
    })

    let evaluated = 0
    for (const journey of toEvaluate) {
      // eslint-disable-next-line no-await-in-loop
      await step.run(`evaluate-${journey.id}`, async () => {
        const geohash6 = ngeohash.encode(journey.fromLat, journey.fromLng, 6)
        const zone     = await db.trafficZone.findUnique({ where: { geohash6 } })
        const incidents = await db.territorialEvent.count({
          where: {
            resolvedAt: null,
            expiresAt:  { gt: now },
            confidence: { gt: 0.5 },
          },
        })

        const congestion   = zone?.congestionScore ?? 0
        const impactScore  = calculateImpactScore(congestion, incidents, 0)
        const status       = scoreToStatus(impactScore)
        const delayMinutes = Math.round(impactScore * 25)

        const jd: UserJourneyData = {
          id:     journey.id,
          userId: journey.userId,
          name:   journey.name,
          from:   { lat: journey.fromLat, lng: journey.fromLng, label: journey.fromLabel },
          to:     { lat: journey.toLat,   lng: journey.toLng,   label: journey.toLabel   },
          schedule: {
            dayOfWeek:       journey.dayOfWeek,
            departureHour:   journey.departureHour,
            departureMinute: journey.departureMinute,
            flexMinutes:     journey.flexMinutes,
          },
          preferredMode:       MODE_MAP[journey.preferredMode] ?? 'both',
          notifyMinutesBefore: journey.notifyMinutesBefore,
          active:              journey.active,
        }
        const deptIn = minutesUntilDeparture(jd, now)

        const result: JourneyStatusResult = {
          journeyId:   journey.id,
          evaluatedAt: now.toISOString(),
          status,
          confidence:  0.75,
          headline:    buildHeadline(status, deptIn, delayMinutes, journey.departureHour, journey.departureMinute),
          detail:      incidents > 0 ? `${incidents} incident(s) actif(s) sur le trajet` : '',
          delayMinutes,
          newArrivalTime: delayMinutes > 0
            ? new Date(Date.now() + delayMinutes * 60000).toISOString()
            : undefined,
        }

        const prevRaw = await redis.get(`tif:journey:${journey.userId}:status`)
        await redis.set(`tif:journey:${journey.userId}:status`, JSON.stringify(result), { ex: 300 })

        const prev = prevRaw
          ? (typeof prevRaw === 'string' ? JSON.parse(prevRaw) : prevRaw) as JourneyStatusResult
          : null

        if (!prev || prev.status !== status) {
          try {
            await getAbly().channels.get(`tif:journey:${journey.userId}`).publish('status', result)
          } catch {
            // circuit breaker: continuer si Ably indisponible
          }
        }

        evaluated++
      })
    }

    return { evaluated, total: journeys.length }
  },
)
