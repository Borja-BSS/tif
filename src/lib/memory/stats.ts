/**
 * Fonctions statistiques pures — aucune I/O, entièrement testables.
 * Pas de ML, statistiques robustes uniquement.
 */
import type { PatternBaseline } from './types'

export function mean(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * Percentile par interpolation linéaire.
 * @param values tableau NON trié (copie interne)
 * @param p      [0, 100]
 */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx    = Math.max(0, Math.min(sorted.length - 1, (p / 100) * (sorted.length - 1)))
  const lo     = Math.floor(idx)
  const hi     = Math.min(Math.ceil(idx), sorted.length - 1)
  const frac   = idx - lo
  return sorted[lo] * (1 - frac) + sorted[hi] * frac
}

/**
 * Calcule la baseline d'une zone à partir d'un échantillon de congestion scores.
 * Nécessite sampleCount ≥ 14 pour être valide (appelant à vérifier).
 */
export function computeBaseline(
  congestionScores: number[],
  deviceCounts:     number[],
  speedBuckets:     number[],
): PatternBaseline {
  return {
    avgCongestionScore: mean(congestionScores),
    avgDeviceCount:     mean(deviceCounts),
    avgSpeedBucket:     mean(speedBuckets),
    p85CongestionScore: percentile(congestionScores, 85),
    p95CongestionScore: percentile(congestionScores, 95),
  }
}

/**
 * Retourne true si la nouvelle baseline s'écarte de plus de 15% de l'ancienne.
 * Déclenche l'invalidation du cache Redis.
 */
export function baselineChanged(prev: PatternBaseline, next: PatternBaseline): boolean {
  const ref = Math.max(prev.avgCongestionScore, 1e-4)
  return Math.abs(prev.avgCongestionScore - next.avgCongestionScore) / ref > 0.15
}

/**
 * Approxime σ à partir de la moyenne et du P95 (inverse de la loi normale).
 * Utilisé pour synthétiser une variance EWMA depuis une baseline historique.
 */
export function sigmaFromP95(avg: number, p95: number): number {
  return Math.max((p95 - avg) / 1.645, 1e-4)
}
