/**
 * Score territorial composite — pure function, aucune I/O.
 *
 * Composition :
 *   70% congestionScore (réalité mesurée)
 *   25% divergence (officiel ≠ réalité → signal fort)
 *    5% bonus si anomalie confirmée (Z-score passé en option)
 */

export type TerritoryLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'CRITICAL'

export interface TerritoryScore {
  score:     number          // 0–100
  level:     TerritoryLevel
  components: {
    congestion: number       // 0–1
    divergence: number       // 0 ou 1
    anomaly:    number       // 0–1 (Z normalisé, optionnel)
  }
}

const LEVEL_THRESHOLDS: [number, TerritoryLevel][] = [
  [20,  'GREEN'],
  [40,  'YELLOW'],
  [65,  'ORANGE'],
  [85,  'RED'],
  [101, 'CRITICAL'],
]

function toLevel(score: number): TerritoryLevel {
  return LEVEL_THRESHOLDS.find(([t]) => score < t)![1]
}

export function computeTerritoryScore(
  congestionScore: number,
  divergence:      boolean,
  maxZScore?:      number,  // Z-score maximal de la zone (Composant 2)
): TerritoryScore {
  const cong    = Math.max(0, Math.min(1, congestionScore))
  const div     = divergence ? 1 : 0
  const anomaly = maxZScore !== undefined ? Math.min(1, maxZScore / 5) : 0

  const raw   = cong * 70 + div * 25 + anomaly * 5
  const score = Math.min(100, Math.round(raw))

  return {
    score,
    level: toLevel(score),
    components: { congestion: cong, divergence: div, anomaly },
  }
}

/** Couleur CSS associée à un niveau territorial */
export const LEVEL_COLOR: Record<TerritoryLevel, string> = {
  GREEN:    '#22c55e',
  YELLOW:   '#eab308',
  ORANGE:   '#f97316',
  RED:      '#ef4444',
  CRITICAL: '#ffffff',
}

/** Opacité de l'alerte map selon le niveau */
export const LEVEL_OPACITY: Record<TerritoryLevel, number> = {
  GREEN:    0,
  YELLOW:   0.35,
  ORANGE:   0.55,
  RED:      0.75,
  CRITICAL: 1.0,
}
