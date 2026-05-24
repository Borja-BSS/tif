export type RecurringEventType =
  | 'PEAK_TRAFFIC'
  | 'BORDER_CONGESTION'
  | 'TRANSPORT_DISRUPTION'

export interface PatternBaseline {
  avgCongestionScore: number
  avgDeviceCount:     number
  avgSpeedBucket:     number
  p85CongestionScore: number
  p95CongestionScore: number
}

export interface RecurringEvent {
  type:          RecurringEventType
  confidence:    number   // 0–1, fréquence d'occurrence sur 30j
  avgDuration:   number   // minutes
  avgLeadTime:   number   // minutes avant source officielle
}

export interface TemporalPatternRow {
  geohash6:        string
  dayOfWeek:       number
  hourOfDay:       number
  baseline:        PatternBaseline
  recurringEvents: RecurringEvent[]
  sampleCount:     number
  lastUpdated:     Date
}
