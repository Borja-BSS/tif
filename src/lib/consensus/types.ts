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

  confidenceScore:        number   // fraction de fraîcheur des sources disponibles
  divergence:             boolean
  divergenceExplanation?: string

  sourceWeights:   Record<SourceType, number>
  congestionScore: number          // score pondéré brut [0,1]

  computedAt: Date
  ttl:        number               // secondes avant recompute
}
