import { inngest } from '@/lib/inngest'
import { db }     from '@/lib/db'
import { redis }  from '@/lib/redis'

/**
 * Auto-résolution des TerritorialEvents expirés.
 * Calcule le lead time = (resolvedAt - detectedAt) en minutes.
 *
 * En production, officialSourceAt serait renseigné manuellement par un opérateur
 * ou via feed SIG/SBB quand la source officielle confirme l'incident.
 * Ici : proxy = resolvedAt (TTL expiry).
 */
export const resolveEvents = inngest.createFunction(
  {
    id:       'resolve-events',
    name:     'Lead Time Tracker — résolution événements toutes 2min',
    triggers: [{ cron: '*/2 * * * *' }],
  },
  async ({ step }) => {
    const now = new Date()

    // Événements expirés non encore résolus
    type ExpiredEvent = { id: string; type: string; geohash: string; severity: string; detectedAt: Date | string; expiresAt: Date | string }
    const expired: ExpiredEvent[] = await step.run('fetch-expired-events', async () => {
      return db.territorialEvent.findMany({
        where: {
          expiresAt:  { lt: now },
          resolvedAt: null,
        },
        select: {
          id: true, type: true, geohash: true, severity: true,
          detectedAt: true, expiresAt: true,
        },
        take: 200,  // traitement par lot maximal
      })
    })

    if (!expired.length) return { resolved: 0 }

    const resolved = await step.run('resolve-and-track', async () => {
      let count = 0

      for (const event of expired) {
        const resolvedAt       = new Date(event.expiresAt)
        const leadTimeMinutes  = (resolvedAt.getTime() - new Date(event.detectedAt).getTime()) / 60_000

        // Marquer l'événement résolu
        await db.territorialEvent.update({
          where: { id: event.id },
          data:  { resolvedAt },
        })

        // Enregistrer la résolution avec lead time
        await db.eventResolution.create({
          data: {
            eventId:        event.id,
            eventType:      event.type,
            geohash6:       event.geohash.slice(0, 6),
            severity:       event.severity,
            detectedAt:     event.detectedAt,
            resolvedAt,
            leadTimeMinutes,
          },
        })

        // Invalider cache Redis consensus pour la zone résolue
        await redis.del(`tif:consensus:${event.geohash.slice(0, 6)}`)

        count++
      }

      return count
    })

    return { resolved }
  },
)
