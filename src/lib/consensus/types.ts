export type SourceType = 'sig' | 'sbb' | 'gtfs' | 'mobility' | 'social'

export type OfficialStatus = 'OPEN' | 'DEGRADED' | 'CLOSED' | 'UNKNOWN'
export type RealityStatus  = 'CLEAR' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'BLOCKED' | 'UNKNOWN'

export interface SourceSnapshot {
  type:         SourceType
  value:        number     // congestion [0,1] : 0=libre, 1=bloqué
  updatedAt:    Date
  deviceCount?: number     // mobility uniquement : nombre de devices dans la zone
}

export interface ZoneConsensus {
  geohash6: string

  officialStatus: OfficialStatus
  realityStatus:  RealityStatus

  /** Fraction de fraîcheur des sources disponibles (0-1). Alias : confidenceScore. */
  dataConfidence:  number
  /** @deprecated utiliser dataConfidence */
  confidenceScore: number

  divergence:             boolean
  divergenceExplanation?: string

  sourceWeights:    Record<SourceType, number>
  sourcesAvailable: SourceType[]
  sourcesMissing:   SourceType[]

  /** Score de congestion pondéré brut [0,1] (pour affichage ÷100). */
  congestionScore: number

  /** true si ≥ SOURCES_MIN sources et dataConfidence ≥ RELIABILITY_MIN */
  isReliable: boolean

  computedAt: Date
  ttl:        number  // secondes avant recompute
}
