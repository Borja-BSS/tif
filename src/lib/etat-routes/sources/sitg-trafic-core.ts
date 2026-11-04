import type { Lecture, PointObservation } from '../types'

const R = 150

// ETAT : 1 Fluide, 2 Dense, 3 Saturé, 0 Indéterminé (valeurs mesurées le 04.11.2026)
export function jamDepuisEtat(etat: unknown): number | null {
  if (etat === 1) return 1
  if (etat === 2) return 3
  if (etat === 3) return 6
  return null // 0, null ou inconnu : pas de lecture
}

interface Seg {
  attributes: { ETAT?: number | null; DATE_MAJ_ETAT?: number | null; NOM?: string }
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
    const jam = jamDepuisEtat(best.s.attributes.ETAT)
    const maj = best.s.attributes.DATE_MAJ_ETAT
    if (jam === null || typeof maj !== 'number') continue
    out.push({
      source: 'sitg-trafic', pointId: p.id, at: new Date(maj).toISOString(), speed: 0, freeFlow: 0,
      jamFactor: jam, confidence: 1, fermee: false,
      coordinates: (best.s.geometry?.paths?.[0] ?? []).map(c => [c[0], c[1]] as [number, number]),
    })
  }
  return out
}

