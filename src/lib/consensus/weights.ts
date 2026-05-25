import type { SourceType } from './types'

/** Fiabilité de base par source (0-1). Multiplicateur de freshness. */
export const BASE_RELIABILITY: Record<SourceType, number> = {
  sig:      0.85,  // SIG Genève — haute fiabilité institutionnelle, latence ~5min
  sbb:      0.90,  // SBB RT — très fiable, périmètre transport public
  gtfs:     0.70,  // Horaires théoriques — moins fiable que RT
  mobility: 0.65,  // Signaux users — puissant mais bruité, nécessite volume
  social:   0.25,  // Placeholder — calibration après 90j de données
}

/** λ = taux de decay exponentiel en secondes⁻¹ (EWMA temporel). */
export const DECAY_PARAMS: Record<SourceType, number> = {
  sig:      0.0020, // à 10min → decay ~11% · à 20min → decay ~21%
  sbb:      0.0050, // à 5min  → decay ~22% · à 10min → decay ~39%
  gtfs:     0.0008, // décroît lentement (horaires persistent)
  mobility: 0.0080, // à 5min  → decay ~21% · stale très vite
  social:   0.0005, // persiste longtemps (post visible des heures)
}
