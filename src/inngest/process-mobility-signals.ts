import { inngest } from '@/lib/inngest'
import { db }     from '@/lib/db'
import { cellInBbox } from '@/lib/sdk/anonymize'

interface IncomingSignal {
  geohash6:        string
  speedBucket:     number
  direction:       number
  minuteTimestamp: number
  sessionToken:    string
}

interface SignalsPayload {
  signals: IncomingSignal[]
  userId:  string
}

interface ZoneAgg {
  geohash6:     string
  deviceTokens: Set<string>
  speedSum:     number
  count:        number
}

export const processMobilitySignals = inngest.createFunction(
  {
    id:       'process-mobility-signals',
    name:     'Human Sensor Network — traitement batch',
    triggers: [{ event: 'tif/signals.mobility' }],
  },
  async ({ event, step }) => {
    const { signals } = event.data as SignalsPayload
    const now         = new Date()

    // ── 1. Re-validation bbox serveur-side (défense en profondeur) ───────────
    const valid = await step.run('filter-bbox', async () =>
      signals.filter(s => cellInBbox(s.geohash6)),
    )

    if (!valid.length) return { stored: 0, zones: 0 }

    // ── 2. Agrégation par geohash6 ────────────────────────────────────────────
    const aggregated = await step.run('aggregate', async () => {
      const zones = new Map<string, ZoneAgg>()

      for (const sig of valid) {
        let agg = zones.get(sig.geohash6)
        if (!agg) {
          agg = { geohash6: sig.geohash6, deviceTokens: new Set(), speedSum: 0, count: 0 }
          zones.set(sig.geohash6, agg)
        }
        if (sig.sessionToken) agg.deviceTokens.add(sig.sessionToken)
        agg.speedSum += sig.speedBucket
        agg.count++
      }

      return Array.from(zones.values()).map(z => ({
        geohash6:      z.geohash6,
        deviceCount:   z.deviceTokens.size,
        avgSpeedBucket: z.count > 0 ? z.speedSum / z.count : 0,
      }))
    })

    // ── 3. Upsert TrafficZone (deviceCount + avgSpeedBucket) ─────────────────
    await step.run('upsert-traffic-zones', async () => {
      await Promise.all(
        aggregated.map(z =>
          db.trafficZone.upsert({
            where:  { geohash6: z.geohash6 },
            update: {
              deviceCount:    z.deviceCount,
              avgSpeedBucket: z.avgSpeedBucket,
              updatedAt:      now,
            },
            create: {
              geohash6:      z.geohash6,
              deviceCount:   z.deviceCount,
              avgSpeedBucket: z.avgSpeedBucket,
            },
          }),
        ),
      )
    })

    // ── 4. Bulk insert MobilitySignal ─────────────────────────────────────────
    const stored = await step.run('insert-signals', async () => {
      const datePartition = now.toISOString().slice(0, 10)
      await db.mobilitySignal.createMany({
        data: valid.map(s => ({
          geohash6:      s.geohash6,
          deviceHash:    s.sessionToken || 'anon',
          speedBucket:   s.speedBucket,
          direction:     s.direction,
          timestamp:     new Date(s.minuteTimestamp),
          datePartition,
        })),
        skipDuplicates: false,
      })
      return valid.length
    })

    return { stored, zones: aggregated.length }
  },
)
