export type AnomalyPattern =
  | 'MASS_ROUTE_CHANGE'
  | 'SPEED_DROP_COLLECTIVE'
  | 'DENSITY_SPIKE'
  | 'DENSITY_VOID'
  | 'CONSENSUS_DIVERGENCE'

export type AnomalySeverity = 'WATCH' | 'ALERT' | 'CRITICAL'

export interface EwmaState {
  ewma:        number
  variance:    number
  lastUpdated: string   // ISO
  sampleCount: number
}

export interface DetectedAnomaly {
  geohash6:   string
  pattern:    AnomalyPattern
  zScore:     number
  severity:   AnomalySeverity
  metric:     string
  value:      number    // mesure courante
  baseline:   number    // EWMA avant update (référence)
  detectedAt: Date
}

// Payload de l'événement Inngest tif/anomaly.detect
export interface AnomalyDetectPayload {
  zones: {
    geohash6:       string
    congestionScore: number
    deviceCount:    number
  }[]
  timestamp: string
}
