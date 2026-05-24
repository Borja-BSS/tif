import { inngest } from '@/lib/inngest'
import { db }     from '@/lib/db'
import { computeConsensus }                                         from '@/lib/consensus/engine'
import { getConsensus, saveConsensus, broadcastTerritorySnapshot } from '@/lib/consensus/store'
import { computeTerritoryScore }                                    from '@/lib/scoring/territory-score'
import type { SourceSnapshot }                                      from '@/lib/consensus/types'
import type { ZoneTerritorySnapshot }                               from '@/lib/consensus/store'

// Fenêtre d'activité : zones ayant reçu des données SIG dans les 10 dernières minutes
const ACTIVE_WINDOW_MS = 10 * 60 * 1000

// Fenêtre mobility : signaux des 5 dernières minutes
const MOBILITY_WINDOW_MS = 5 * 60 * 1000

export const computeConsensusJob = inngest.createFunction(
  {
    id:       'compute-consensus',
    name:     'Reality Consensus Engine — toutes 2min',
    triggers: [{ cron: '*/2 * * * *' }],
  },
  async ({ step }) => {
    const now = new Date()

    // ── 1. Zones actives depuis TrafficZone ───────────────────────────────────
    const activeZones = await step.run('fetch-active-zones', async () => {
      const cutoff = new Date(now.getTime() - ACTIVE_WINDOW_MS)
      return db.trafficZone.findMany({
        where:  { updatedAt: { gte: cutoff } },
        select: { geohash6: true, congestionScore: true, updatedAt: true },
      })
    })

    if (!activeZones.length) return { computed: 0, divergent: 0 }

    // ── 2. Agrégation mobility par zone (batch SQL) ───────────────────────────
    const mobilityWindow = new Date(now.getTime() - MOBILITY_WINDOW_MS)
    const geohashes      = activeZones.map(z => z.geohash6)

    const mobilityRows = await step.run('fetch-mobility-agg', async () => {
      // Agrégation brute : count + avg speedBucket par geohash6
      const rows = await db.$queryRaw<
        { geohash6: string; device_count: bigint; avg_bucket: number | null }[]
      >`
        SELECT
          "geohash6",
          COUNT(DISTINCT "deviceHash") AS device_count,
          AVG("speedBucket"::float)    AS avg_bucket
        FROM "MobilitySignal"
        WHERE "geohash6" = ANY(${geohashes}::varchar[])
          AND "timestamp" >= ${mobilityWindow}
        GROUP BY "geohash6"
      `
      return rows.map(r => ({
        geohash6:    r.geohash6,
        deviceCount: Number(r.device_count),
        avgBucket:   r.avg_bucket ?? 0,
      }))
    })

    const mobilityByZone = new Map(mobilityRows.map(r => [r.geohash6, r]))

    // ── 3. Compute consensus pour chaque zone (par lots de 50) ───────────────
    let computed  = 0
    let divergent = 0
    const territorySnapshots: ZoneTerritorySnapshot[] = []

    const BATCH = 50
    for (let i = 0; i < activeZones.length; i += BATCH) {
      const batch = activeZones.slice(i, i + BATCH)

      // eslint-disable-next-line no-await-in-loop
      const results = await step.run(`compute-batch-${i}`, async () => {
        return Promise.all(batch.map(async zone => {
          const sources: SourceSnapshot[] = []

          if (zone.congestionScore !== null) {
            sources.push({
              type:      'sig',
              value:     zone.congestionScore,
              updatedAt: new Date(zone.updatedAt),
            })
          }

          const mob = mobilityByZone.get(zone.geohash6)
          if (mob) {
            const mobilityValue = Math.max(0, Math.min(1, 1 - mob.avgBucket / 5))
            sources.push({
              type:        'mobility',
              value:       mobilityValue,
              updatedAt:   now,
              deviceCount: mob.deviceCount,
            })
          }

          const prev           = await getConsensus(zone.geohash6)
          const consensus      = computeConsensus(zone.geohash6, sources, now)
          const territoryScore = computeTerritoryScore(
            consensus.congestionScore,
            consensus.divergence,
          )
          const { broadcast } = await saveConsensus(consensus, prev, territoryScore)

          return {
            divergent:  consensus.divergence,
            broadcast,
            snapshot:   {
              geohash6:   zone.geohash6,
              score:      territoryScore.score,
              level:      territoryScore.level,
              congestion: consensus.congestionScore,
              divergence: consensus.divergence,
              computedAt: now.toISOString(),
            } satisfies ZoneTerritorySnapshot,
          }
        }))
      })

      computed  += results.length
      divergent += results.filter(r => r.divergent).length
      territorySnapshots.push(...results.map(r => r.snapshot))
    }

    // ── 4. Broadcast snapshot territorial pour la carte ───────────────────────
    await step.run('broadcast-territory-snapshot', () =>
      broadcastTerritorySnapshot(territorySnapshots),
    )

    // ── 4. Déclenche le détecteur d'anomalies (event-driven) ─────────────────
    const zonePayload = activeZones.map(zone => ({
      geohash6:       zone.geohash6,
      congestionScore: zone.congestionScore ?? 0,
      deviceCount:    mobilityByZone.get(zone.geohash6)?.deviceCount ?? 0,
    }))

    await step.sendEvent('trigger-anomaly-detection', {
      name: 'tif/anomaly.detect',
      data: { zones: zonePayload, timestamp: now.toISOString() },
    })

    return { computed, divergent, activeZones: activeZones.length }
  },
)
