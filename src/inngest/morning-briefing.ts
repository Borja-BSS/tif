import ngeohash from 'ngeohash'

import { inngest }          from '@/lib/inngest'
import { db }               from '@/lib/db'
import { redis }            from '@/lib/redis'
import { sendJourneyAlert } from '@/lib/email'
import {
  calculateImpactScore,
  buildHeadline,
  scoreToStatus,
} from '@/lib/my-journey/predictor'

// Shape of a journey stored in Redis by POST /api/v1/my-journey
interface RedisJourney {
  id:                  string
  emailNotify:         string | null
  name:                string
  dayOfWeek:           number[]
  departureHour:       number
  departureMinute:     number
  notifyMinutesBefore: number
  active:              boolean
  fromLat:             number
  fromLng:             number
}

// Scan all tif:journey:fb:* keys and collect active journeys with an email set.
// Upstash may return values as already-parsed objects or as JSON strings — both handled.
async function loadRedisJourneys(): Promise<RedisJourney[]> {
  const result: RedisJourney[] = []
  let cursor = 0
  do {
    const [next, keys] = await redis.scan(cursor, { match: 'tif:journey:fb:*', count: 100 })
    cursor = Number(next)
    if (keys.length === 0) continue
    const values = await redis.mget<unknown[]>(...keys) as (unknown | null)[]
    for (const val of values) {
      if (!val) continue
      const parsed = typeof val === 'string' ? JSON.parse(val) : val
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      for (const j of arr) {
        if (j && typeof j === 'object' && (j as RedisJourney).active && (j as RedisJourney).emailNotify) {
          result.push(j as RedisJourney)
        }
      }
    }
  } while (cursor !== 0)
  return result
}

export const morningBriefingJob = inngest.createFunction(
  {
    id:       'morning-briefing',
    name:     'Mon Trajet — Briefing matinal',
    triggers: [{ cron: '*/5 * * * *' }],
  },
  async ({ step }) => {
    const now = new Date()

    const journeys = await step.run('fetch-active-journeys', () => loadRedisJourneys())

    const yyyy  = now.getFullYear()
    const mm    = String(now.getMonth() + 1).padStart(2, '0')
    const dd    = String(now.getDate()).padStart(2, '0')
    const today = `${yyyy}-${mm}-${dd}`

    const nowMin = now.getHours() * 60 + now.getMinutes()

    let sent = 0
    for (const journey of journeys) {
      // eslint-disable-next-line no-await-in-loop
      await step.run(`briefing-${journey.id}`, async () => {
        if (!journey.dayOfWeek.includes(now.getDay())) return
        if (!journey.emailNotify) return

        const alertMin = journey.departureHour * 60 + journey.departureMinute - journey.notifyMinutesBefore
        if (nowMin < alertMin || nowMin >= alertMin + 5) return

        // One send per journey per day
        const dedupKey = `tif:briefing:${journey.id}:${today}`
        const set = await redis.set(dedupKey, '1', { ex: 82800, nx: true })
        if (set === null) return

        // Traffic data — filter incidents to geohash4 prefix (~40 km radius)
        const geohash6  = ngeohash.encode(journey.fromLat, journey.fromLng, 6)
        const geohash4  = geohash6.substring(0, 4)
        const zone      = await db.trafficZone.findUnique({ where: { geohash6 } })
        const incidents = await db.territorialEvent.count({
          where: {
            resolvedAt: null,
            expiresAt:  { gt: now },
            confidence: { gt: 0.5 },
            geohash:    { startsWith: geohash4 },
          },
        })

        const congestion   = zone?.congestionScore ?? 0
        const impactScore  = calculateImpactScore(congestion, incidents, 0)
        const status       = scoreToStatus(impactScore)
        const delayMinutes = Math.round(impactScore * 25)
        const deptIn       = journey.departureHour * 60 + journey.departureMinute - nowMin
        const headline     = buildHeadline(status, deptIn, delayMinutes, journey.departureHour, journey.departureMinute)
        const detail       = incidents > 0
          ? `${incidents} incident(s) actif(s) dans votre zone de départ`
          : undefined

        try {
          await sendJourneyAlert({
            to:            journey.emailNotify,
            journeyName:   journey.name,
            status,
            headline,
            detail,
            delayMinutes,
            departureHour: journey.departureHour,
            departureMin:  journey.departureMinute,
          })
          sent++
        } catch {
          // Ne pas bloquer le job si un email échoue
        }
      })
    }

    return { sent, total: journeys.length }
  },
)
