import type { Lecture, PointObservation } from '../types'

const R = 150

// etat : 1 fluide, 2 dense, 3 saturé, 0 indéterminé. Mesuré le 04.11.2026 sur 866 segments, temps de parcours
// médian rapporté au temps fluide : 1,23 / 2,0 / 4,27 ; négatif pour 0.
export function jamDepuisEtat(etat: unknown): number | null {
  if (etat === 1) return 1
  if (etat === 2) return 3
  if (etat === 3) return 6
  return null // 0, null ou inconnu : pas de lecture
}

interface Seg {
  attributes: { etat?: number | null; dateheure?: number | null; indiceconfiance?: number | null }
  geometry?: { paths?: number[][][] }
}

function dist(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dy = (lat1 - lat2) * 111_000
  const dx = (lng1 - lng2) * 111_000 * Math.cos(lat1 * Math.PI / 180)
  return Math.hypot(dx, dy)
}

export function lecturesDepuisSegments(segs: Seg[], points: PointObservation[]): Lecture[] {
  const out: Lecture[] = []
  for (const p of points) {
    let best: { s: Seg; d: number } | null = null
    for (const s of segs) {
      for (const path of s.geometry?.paths ?? []) for (const [lng, lat] of path) {
        const d = dist(p.lat, p.lng, lat, lng)
        if (d <= R && (!best || d < best.d)) best = { s, d }
      }
    }
    if (!best) continue
    const jam = jamDepuisEtat(best.s.attributes.etat)
    const maj = best.s.attributes.dateheure
    if (jam === null || typeof maj !== 'number') continue
    out.push({
      source: 'sitg-trafic', pointId: p.id, at: new Date(maj).toISOString(), speed: 0, freeFlow: 0,
      jamFactor: jam, confidence: (best.s.attributes.indiceconfiance ?? 100) / 100, fermee: false,
      coordinates: (best.s.geometry?.paths?.[0] ?? []).map(c => [c[0], c[1]] as [number, number]),
    })
  }
  return out
}

