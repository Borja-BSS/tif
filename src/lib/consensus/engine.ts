import type {
  SourceType, SourceSnapshot, ZoneConsensus,
  OfficialStatus, RealityStatus,
} from './types'

// Taux de decay exponentiel λ par source (secondes⁻¹)
// Interprétation : weight × e^(-λ×Δt) — SIG à 10min → decay ~14%
const LAMBDA: Record<SourceType, number> = {
  sig:      0.002,  // données 5min — decay significatif à 10min
  sbb:      0.005,  // données 1min — decay rapide
  gtfs:     0.004,
  mobility: 0.008,  // signaux très frais ou non pertinents
  social:   0.001,
}

const BASE_RELIABILITY: Record<SourceType, number> = {
  sig:      0.85,
  sbb:      0.90,
  gtfs:     0.75,
  mobility: 0.60,
  social:   0.30,
}

const MOBILITY_MIN_DEVICES = 3

function decay(lambda: number, deltaSeconds: number): number {
  return Math.exp(-lambda * Math.max(0, deltaSeconds))
}

function realityStatus(score: number): RealityStatus {
  if (score < 0.15) return 'CLEAR'
  if (score < 0.35) return 'LIGHT'
  if (score < 0.60) return 'MODERATE'
  if (score < 0.80) return 'HEAVY'
  return 'BLOCKED'
}

function officialStatus(sigValue: number | undefined): OfficialStatus {
  if (sigValue === undefined) return 'UNKNOWN'
  if (sigValue < 0.2)        return 'OPEN'
  if (sigValue < 0.6)        return 'DEGRADED'
  return 'CLOSED'
}

function officialNumeric(status: OfficialStatus): number {
  if (status === 'OPEN')     return 0.1
  if (status === 'DEGRADED') return 0.5
  if (status === 'CLOSED')   return 0.9
  return 0.5
}

function buildExplanation(official: OfficialStatus, reality: RealityStatus): string {
  if (official === 'OPEN' && (reality === 'MODERATE' || reality === 'HEAVY' || reality === 'BLOCKED'))
    return 'Trafic officiel normal, mobilité indique ralentissement'
  if (official === 'OPEN' && reality === 'LIGHT')
    return 'Trafic officiel normal, légère décélération détectée'
  if ((official === 'CLOSED' || official === 'DEGRADED') && (reality === 'CLEAR' || reality === 'LIGHT'))
    return 'Restriction officielle, trafic réel fluide'
  return `Statut officiel ${official}, réalité mesurée ${reality}`
}

/**
 * Fusion Bayésienne pondérée avec temporal decay.
 *
 * confidence = Σ(actual_weight_i) / Σ(base_reliability_i)
 *   → 1.0 quand toutes les sources sont fraîches
 *   → diminue proportionnellement à la staleness
 *
 * congestion = Σ(weight_i × value_i) / Σ(weight_i)
 *
 * divergence = true si |officialNumeric - congestion| > 0.25
 */
export function computeConsensus(
  geohash6: string,
  sources:  SourceSnapshot[],
  now:      Date = new Date(),
): ZoneConsensus {
  const weights: Record<SourceType, number> = {
    sig: 0, sbb: 0, gtfs: 0, mobility: 0, social: 0,
  }

  let weightedSum  = 0
  let totalWeight  = 0
  let maxWeightSum = 0

  for (const src of sources) {
    if (src.type === 'mobility' && (src.deviceCount ?? 0) < MOBILITY_MIN_DEVICES) continue

    const deltaS = (now.getTime() - src.updatedAt.getTime()) / 1000
    const w      = BASE_RELIABILITY[src.type] * decay(LAMBDA[src.type], deltaS)

    weights[src.type] = w
    weightedSum  += w * src.value
    totalWeight  += w
    maxWeightSum += BASE_RELIABILITY[src.type]
  }

  const congestionScore = totalWeight  > 0 ? weightedSum / totalWeight  : 0
  const confidenceScore = maxWeightSum > 0 ? totalWeight  / maxWeightSum : 0

  const sigSrc   = sources.find(s => s.type === 'sig')
  const official = officialStatus(sigSrc?.value)
  const reality  = totalWeight > 0 ? realityStatus(congestionScore) : 'UNKNOWN'

  // Pas de divergence si aucune source disponible (pas assez de signal)
  const divergence = totalWeight > 0
    && Math.abs(officialNumeric(official) - congestionScore) > 0.25

  const hasMobility = sources.some(
    s => s.type === 'mobility' && (s.deviceCount ?? 0) >= MOBILITY_MIN_DEVICES,
  )

  const ALL_TYPES: SourceType[] = ['sig', 'sbb', 'gtfs', 'mobility', 'social']
  const usedTypes = sources
    .filter(s => !(s.type === 'mobility' && (s.deviceCount ?? 0) < MOBILITY_MIN_DEVICES))
    .map(s => s.type)

  return {
    geohash6,
    officialStatus:        official,
    realityStatus:         reality,
    dataConfidence:        confidenceScore,
    confidenceScore,
    divergence,
    divergenceExplanation: divergence ? buildExplanation(official, reality) : undefined,
    sourceWeights:         weights,
    sourcesAvailable:      usedTypes,
    sourcesMissing:        ALL_TYPES.filter(t => !usedTypes.includes(t)),
    congestionScore,
    isReliable:            usedTypes.length >= 2 && confidenceScore >= 0.30,
    computedAt:            now,
    ttl:                   hasMobility ? 30 : 120,
  }
}
