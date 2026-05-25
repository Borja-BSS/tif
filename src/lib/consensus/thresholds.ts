import type { SourceType } from './types'

export const THRESHOLDS = {
  /** Nombre minimum de devices pour que le signal mobilité soit pris en compte. */
  MOBILITY_MIN_DEVICES: 3,

  /** Écart officiel vs réalité à partir duquel on déclare une divergence (0-1). */
  DIVERGENCE_MIN: 0.25,

  /** Âge maximal d'un signal avant rejet, par source (secondes). */
  MAX_SIGNAL_AGE: {
    sig:      900,   // 15 minutes
    sbb:      180,   // 3 minutes
    gtfs:     3600,  // 1 heure
    mobility: 300,   // 5 minutes
    social:   1800,  // 30 minutes
  } satisfies Record<SourceType, number>,

  /** dataConfidence minimum pour qu'une zone soit considérée fiable (0-1). */
  RELIABILITY_MIN: 0.30,

  /** Nombre minimum de sources simultanées pour qu'une zone soit fiable. */
  SOURCES_MIN: 2,
} as const
