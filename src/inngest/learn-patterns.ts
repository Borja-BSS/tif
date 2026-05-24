import { inngest } from '@/lib/inngest'
import { db }     from '@/lib/db'
import { redis }  from '@/lib/redis'
import { computeBaseline, baselineChanged } from '@/lib/memory/stats'
import type { PatternBaseline } from '@/lib/memory/types'

const ACTIVE_WINDOW_H  = 24
const HISTORY_DAYS     = 30
const MIN_SAMPLES      = 14
const STALE_DAYS       = 30   // patterns non mis à jour → purge
const BATCH            = 30

interface SnapshotRow {
  geohash6:    string
  consensus:   unknown
  computed_at: Date
}

interface ConsensusData {
  congestionScore: number
}

export const learnPatterns = inngest.createFunction(
  {
    id:       'learn-patterns',
    name:     'Territorial Memory Engine — apprentissage horaire',
    triggers: [{ cron: '5 * * * *' }],  // 5min après le consensus (qui run à 0)
  },
  async ({ step }) => {
    const now       = new Date()
    const dayOfWeek = now.getDay()
    const hourOfDay = now.getHours()

    // ── 1. Zones actives (signaux dans les 24 dernières heures) ───────────────
    const activeGeohashes = await step.run('fetch-active-zones', async () => {
      const cutoff = new Date(now.getTime() - ACTIVE_WINDOW_H * 60 * 60 * 1000)
      const zones  = await db.trafficZone.findMany({
        where:  { updatedAt: { gte: cutoff } },
        select: { geohash6: true },
      })
      return zones.map(z => z.geohash6)
    })

    if (!activeGeohashes.length) return { patterns: 0, purged: 0 }

    // ── 2. Snapshots consensus — même bucket horaire — 30 derniers jours ──────
    const cutoff30d = new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000)

    const snapshots = await step.run('fetch-snapshots', async () => {
      return db.$queryRaw<SnapshotRow[]>`
        SELECT geohash6, consensus, "computedAt" AS computed_at
        FROM "ZoneConsensusSnapshot"
        WHERE geohash6 = ANY(${activeGeohashes}::varchar[])
          AND "computedAt" >= ${cutoff30d}
          AND EXTRACT(dow  FROM "computedAt") = ${dayOfWeek}
          AND EXTRACT(hour FROM "computedAt") = ${hourOfDay}
      `
    })

    // ── 3. Agrégation par zone ────────────────────────────────────────────────
    const byZone = new Map<string, number[]>()
    for (const row of snapshots) {
      const data = row.consensus as ConsensusData
      const score = data?.congestionScore ?? 0
      const arr   = byZone.get(row.geohash6) ?? []
      arr.push(score)
      byZone.set(row.geohash6, arr)
    }

    // ── 4. Mobility aggregation pour deviceCount + speedBucket ────────────────
    const mobilityRows = await step.run('fetch-mobility-agg', async () => {
      return db.$queryRaw<
        { geohash6: string; avg_count: number | null; avg_bucket: number | null }[]
      >`
        SELECT
          "geohash6",
          AVG(device_counts.cnt)            AS avg_count,
          AVG("speedBucket"::float)         AS avg_bucket
        FROM "MobilitySignal"
        JOIN LATERAL (
          SELECT COUNT(DISTINCT "deviceHash")::float AS cnt
          FROM "MobilitySignal" m2
          WHERE m2."geohash6" = "MobilitySignal"."geohash6"
            AND m2."datePartition" = "MobilitySignal"."datePartition"
        ) device_counts ON true
        WHERE "geohash6" = ANY(${activeGeohashes}::varchar[])
          AND "timestamp" >= ${cutoff30d}
          AND EXTRACT(dow  FROM "timestamp") = ${dayOfWeek}
          AND EXTRACT(hour FROM "timestamp") = ${hourOfDay}
        GROUP BY "geohash6"
      `
    })

    const mobilityByZone = new Map(
      mobilityRows.map(r => [r.geohash6, {
        avgDeviceCount: r.avg_count  ?? 0,
        avgSpeedBucket: r.avg_bucket ?? 2.5,
      }])
    )

    // ── 5. Upsert TemporalPattern par lots ────────────────────────────────────
    let patternsUpdated = 0
    const zones = Array.from(byZone.entries())

    for (let i = 0; i < zones.length; i += BATCH) {
      const batch = zones.slice(i, i + BATCH)

      // eslint-disable-next-line no-await-in-loop
      await step.run(`upsert-patterns-${i}`, async () => {
        for (const [geohash6, scores] of batch) {
          if (scores.length < MIN_SAMPLES) continue

          const mob      = mobilityByZone.get(geohash6)
          const baseline = computeBaseline(
            scores,
            mob ? Array(scores.length).fill(mob.avgDeviceCount) : Array(scores.length).fill(0),
            mob ? Array(scores.length).fill(mob.avgSpeedBucket) : Array(scores.length).fill(2.5),
          )

          const existing = await db.temporalPattern.findUnique({
            where: { geohash6_dayOfWeek_hourOfDay: { geohash6, dayOfWeek, hourOfDay } },
            select: { baseline: true },
          })

          await db.temporalPattern.upsert({
            where:  { geohash6_dayOfWeek_hourOfDay: { geohash6, dayOfWeek, hourOfDay } },
            update: { baseline: baseline as object, sampleCount: scores.length, lastUpdated: now },
            create: {
              geohash6, dayOfWeek, hourOfDay,
              baseline:   baseline as object,
              sampleCount: scores.length,
              lastUpdated: now,
            },
          })

          // Invalider le cache Redis EWMA si la baseline a changé de > 15%
          if (existing) {
            const prev = existing.baseline as unknown as PatternBaseline
            if (baselineChanged(prev, baseline)) {
              await redis.del(`tif:ewma:${geohash6}:congestion:${dayOfWeek * 24 + hourOfDay}`)
              await redis.del(`tif:ewma:${geohash6}:density:${dayOfWeek * 24 + hourOfDay}`)
            }
          }

          patternsUpdated++
        }
      })
    }

    // ── 6. Purge patterns stales (> 30j sans mise à jour) ────────────────────
    const purged = await step.run('purge-stale-patterns', async () => {
      const staleDate = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000)
      const result    = await db.$executeRaw`
        DELETE FROM "TemporalPattern" WHERE "lastUpdated" < ${staleDate}
      `
      return result
    })

    return { patterns: patternsUpdated, zones: byZone.size, purged }
  },
)
