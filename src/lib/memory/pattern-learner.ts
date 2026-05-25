/**
 * Apprentissage des patterns temporels par zone (buckets horaires 0-167).
 * Appelé par l'Inngest cron `learn-patterns` toutes les heures.
 */
import { db }    from '@/lib/db'
import { redis } from '@/lib/redis'
import { computeBaseline } from './stats'

const HISTORY_DAYS = 30
const MIN_SAMPLES  = 14

interface ConsensusData {
  congestionScore: number
}

/**
 * Apprend les patterns temporels pour une zone sur les 30 derniers jours.
 * Met à jour TemporalPattern + baseline Redis pour l'anomaly detector.
 */
export async function learnPatternsForZone(geohash6: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - HISTORY_DAYS * 24 * 3600 * 1000)

  const snapshots = await db.zoneConsensusSnapshot.findMany({
    where:  { geohash6, computedAt: { gte: thirtyDaysAgo } },
    select: { consensus: true, computedAt: true },
  })

  if (snapshots.length < MIN_SAMPLES) return 0

  // Regrouper par bucket horaire (dayOfWeek × 24 + hourOfDay)
  const buckets = new Map<number, number[]>()
  for (const s of snapshots) {
    const d          = new Date(s.computedAt)
    const hourOfWeek = d.getDay() * 24 + d.getHours()
    const score      = ((s.consensus as unknown) as ConsensusData)?.congestionScore ?? 0
    const arr        = buckets.get(hourOfWeek) ?? []
    arr.push(score)
    buckets.set(hourOfWeek, arr)
  }

  let updated = 0

  for (const [hourOfWeek, scores] of buckets) {
    if (scores.length < MIN_SAMPLES) continue

    const dayOfWeek = Math.floor(hourOfWeek / 24)
    const hourOfDay = hourOfWeek % 24

    const baseline = computeBaseline(
      scores,
      Array(scores.length).fill(0),
      Array(scores.length).fill(2.5),
    )

    await db.temporalPattern.upsert({
      where:  { geohash6_dayOfWeek_hourOfDay: { geohash6, dayOfWeek, hourOfDay } },
      update: { baseline: baseline as object, sampleCount: scores.length, lastUpdated: new Date() },
      create: {
        geohash6, dayOfWeek, hourOfDay,
        baseline:   baseline as object,
        sampleCount: scores.length,
        lastUpdated: new Date(),
      },
    })

    // Mettre à jour la baseline Redis pour l'anomaly detector
    await redis.setex(
      `tif:baseline:${geohash6}:congestionScore:${hourOfWeek}`,
      90 * 3600,
      JSON.stringify({
        ewma:        baseline.avgCongestionScore,
        variance:    Math.pow(baseline.p85CongestionScore - baseline.avgCongestionScore, 2),
        sampleCount: scores.length,
      }),
    )

    updated++
  }

  return updated
}
