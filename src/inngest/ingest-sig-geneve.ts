import { inngest } from '@/lib/inngest'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { latLngToCell } from 'h3-js'
import { broadcastSignals } from './broadcast-signals'
import { createHmac } from 'crypto'

// NOTE: ge.ch/sitg migrated to sitg.ge.ch with a different API structure — MapServer/1036 no longer exists.
// Pending: find the new SITG traffic endpoint. Until then, function falls back to no-op.
const SIG_TRAFFIC_URL =
  'https://ge.ch/sitg/rest/services/SITG/MapServer/1036/query?f=json&where=1%3D1&outFields=*&resultRecordCount=200'

type SigSignal = { lat: number; lng: number; geohash6: string; congestion: number; speedBucket: number; deviceHash: string; datePartition: string }

interface SigFeature {
  attributes: {
    VITESSE_MESUREE?: number
    VITESSE_LIBRE?:   number
    OBJECTID:         number
  }
  geometry?: { x: number; y: number }
}

export const ingestSigGeneve = inngest.createFunction(
  {
    id:       'ingest-sig-geneve',
    name:     'SIG Genève — trafic 5min',
    triggers: [{ cron: '*/5 * * * *' }],
  },
  async ({ step }) => {
    const raw = await step.run('fetch-sig-api', async () => {
      try {
        const res = await fetch(SIG_TRAFFIC_URL, {
          signal:  AbortSignal.timeout(8000),
          headers: { Accept: 'application/json' },
          redirect: 'follow',
        })
        if (!res.ok) return null
        return res.json() as Promise<{ features: SigFeature[] }>
      } catch {
        return null
      }
    })

    if (!raw) return { ingested: 0, source: 'unavailable' }

    const signals: SigSignal[] = await step.run('process-quantify', async () => {
      const daily = new Date().toISOString().slice(0, 10)
      const salt  = process.env.NEXTAUTH_SECRET ?? 'dev-salt'

      return (raw.features ?? []).flatMap((f) => {
        const lng = f.geometry?.x
        const lat = f.geometry?.y
        if (!lat || !lng || lat < 45.8 || lat > 46.6 || lng < 5.9 || lng > 6.4) return []

        const geohash6   = latLngToCell(lat, lng, 6)
        const speed      = f.attributes.VITESSE_MESUREE ?? 50
        const freeSpeed  = f.attributes.VITESSE_LIBRE   ?? 70
        const congestion = Math.max(0, Math.min(1, 1 - speed / freeSpeed))
        const speedBucket = speed < 5 ? 0 : speed < 15 ? 1 : speed < 30 ? 2 : speed < 60 ? 3 : speed < 90 ? 4 : 5
        const deviceHash  = createHmac('sha256', salt)
          .update(String(f.attributes.OBJECTID) + daily)
          .digest('hex')

        return [{ lat, lng, geohash6, congestion, speedBucket, deviceHash, datePartition: daily }]
      })
    })

    if (!signals.length) return { ingested: 0 }

    await step.run('store-traffic-zones', async () => {
      await Promise.all(signals.map(s =>
        db.trafficZone.upsert({
          where:  { geohash6: s.geohash6 },
          update: { congestionScore: s.congestion, updatedAt: new Date() },
          create: { geohash6: s.geohash6, congestionScore: s.congestion },
        })
      ))
    })

    await step.run('cache-redis', async () => {
      const zones = signals.map(s => ({ h: s.geohash6, c: Math.round(s.congestion * 100) }))
      await redis.set('tif:traffic:zones', JSON.stringify(zones), { ex: 360 })
    })

    await step.run('broadcast-ably', async () => {
      await broadcastSignals(signals.map(s => ({
        lat: s.lat, lng: s.lng, weight: s.congestion, type: 'traffic',
      })))
    })

    return { ingested: signals.length }
  }
)
