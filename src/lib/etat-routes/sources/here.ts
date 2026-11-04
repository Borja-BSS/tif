import { getTrafficFlow } from '@/lib/here/traffic-flow'
import type { Lecture, PointObservation, SourceEtat } from '../types'

/** Ancienne source HERE, conservée pour un retour arrière immédiat : TIF_TRAFFIC_SOURCE=here (ou here,tomtom) et HERE_API_KEY. */
const R = 150
function dist(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dy = (lat1 - lat2) * 111_000
  const dx = (lng1 - lng2) * 111_000 * Math.cos(lat1 * Math.PI / 180)
  return Math.hypot(dx, dy)
}

export const sourceHere: SourceEtat = {
  id: 'here',
  libelle: 'HERE Traffic v7 (ancienne source, payante)',
  licence: 'https://www.here.com/terms',
  active: () => Boolean(process.env.HERE_API_KEY) && (process.env.TIF_TRAFFIC_SOURCE ?? '').split(',').map(s => s.trim()).includes('here'),
  async lire(points: PointObservation[]): Promise<Lecture[]> {
    const flow = await getTrafficFlow()
    const out: Lecture[] = []
    for (const p of points) {
      let best: { f: typeof flow.features[number]; d: number } | null = null
      for (const f of flow.features) {
        for (const [lng, lat] of f.geometry.coordinates) {
          const d = dist(p.lat, p.lng, lat, lng)
          if (d <= R && (!best || d < best.d)) best = { f, d }
        }
      }
      if (best) out.push({
        source: 'here', pointId: p.id, at: flow.generatedAt, speed: best.f.properties.speed,
        freeFlow: best.f.properties.freeFlow, jamFactor: best.f.properties.jamFactor,
        confidence: best.f.properties.confidence, fermee: false, coordinates: best.f.geometry.coordinates,
      })
    }
    return out
  },
}
