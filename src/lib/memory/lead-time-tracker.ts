/**
 * Lead Time Tracker — mesure l'avance TIF vs sources officielles.
 * Phase 3 : officialSourceAt = null (non encore trackée).
 * Phase 4 : populer officialSourceAt depuis les feeds SIG/SBB.
 */
import { db } from '@/lib/db'

/**
 * Calcule et enregistre le lead time d'un événement résolu.
 * Lead time = temps entre détection TIF et confirmation officielle.
 * Retourne null si officialSourceAt n'est pas encore disponible.
 */
export async function trackEventResolution(eventId: string): Promise<number | null> {
  const event = await db.territorialEvent.findUnique({
    where:  { id: eventId },
    select: { detectedAt: true, resolvedAt: true },
  })
  if (!event?.resolvedAt) return null

  // Phase 4 : officialSourceAt viendra des feeds SIG/SBB
  // Pour l'instant : pas de lead time calculable sans source officielle datée
  return null
}

/** Stats lead time agrégées pour le dashboard admin. */
export async function getLeadTimeStats(days = 7) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000)

  const [count, byType] = await Promise.all([
    db.eventResolution.count({ where: { detectedAt: { gte: since } } }),
    db.$queryRaw<{ event_type: string; avg_lead: number; count: bigint }[]>`
      SELECT
        "eventType"            AS event_type,
        AVG("leadTimeMinutes") AS avg_lead,
        COUNT(*)               AS count
      FROM "EventResolution"
      WHERE "detectedAt" >= ${since}
      GROUP BY "eventType"
      ORDER BY avg_lead DESC
    `,
  ])

  if (count === 0) return { count: 0, avgMinutes: null, targetMet: false, byType: {} }

  const allRows = await db.eventResolution.findMany({
    where:  { detectedAt: { gte: since } },
    select: { leadTimeMinutes: true },
  })
  const avg = allRows.reduce((s, e) => s + e.leadTimeMinutes, 0) / allRows.length

  return {
    count,
    avgMinutes: Math.round(avg),
    target:     4,
    targetMet:  avg > 4,
    byType:     Object.fromEntries(
      byType.map(r => [r.event_type, {
        count: Number(r.count),
        avgMinutes: Math.round(r.avg_lead),
      }]),
    ),
  }
}
