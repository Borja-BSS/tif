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

export const morningBriefingJob = inngest.createFunction(
  {
    id:       'morning-briefing',
    name:     'Mon Trajet — Briefing matinal',
    triggers: [{ cron: '*/5 * * * *' }],
  },
  async ({ step }) => {
    const now = new Date()

    const journeys = await step.run('fetch-active-journeys', async () => {
      return db.userJourney.findMany({
        where: { active: true, emailNotify: { not: null } },
      })
    })

    const yyyy = now.getFullYear()
    const mm   = String(now.getMonth() + 1).padStart(2, '0')
    const dd   = String(now.getDate()).padStart(2, '0')
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

        const dedupKey = `tif:briefing:${journey.id}:${today}`
        const set = await redis.set(dedupKey, '1', { ex: 82800, nx: true })
        if (set === null) return

        const geohash6   = ngeohash.encode(journey.fromLat, journey.fromLng, 6)
        const zone       = await db.trafficZone.findUnique({ where: { geohash6 } })
        const incidents  = await db.territorialEvent.count({
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
        const deptIn       = journey.departureHour * 60 + journey.departureMinute - nowMin
        const headline     = buildHeadline(status, deptIn, delayMinutes, journey.departureHour, journey.departureMinute)
        const detail       = incidents > 0 ? `${incidents} incident(s) actif(s) sur le trajet` : undefined

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
          // Ne pas bloquer le job si l'email échoue
        }
      })
    }

    return { sent, total: journeys.length }
  },
)
