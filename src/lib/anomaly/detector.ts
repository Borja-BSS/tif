import { getEwmaState, setEwmaState, updateEwma, hourOfWeek } from './ewma'
import { getWarmStartState } from '@/lib/memory/warm-start'
import type { AnomalyPattern, AnomalySeverity, DetectedAnomaly } from './types'

// Seuils Z-score
const Z_WATCH    = 2.0
const Z_ALERT    = 2.5
const Z_CRITICAL = 3.5

// Nombre minimal de samples avant de pouvoir alerter (baseline fiable)
const MIN_SAMPLES = 5

type MetricDef = {
  name:    string
  alpha:   number
  pattern: AnomalyPattern
  // Filtre directionnel : 'up' = seulement si mesure > baseline, 'both' = toujours
  direction: 'up' | 'down' | 'both'
}

const METRICS: MetricDef[] = [
  // Vitesse / congestion : α lisse (évite faux positifs) — alerte si congestion monte
  { name: 'congestion', alpha: 0.15, pattern: 'SPEED_DROP_COLLECTIVE', direction: 'up'  },
  // Densité devices : α intermédiaire — alerte sur spike ET void
  { name: 'density',    alpha: 0.20, pattern: 'DENSITY_SPIKE',         direction: 'both' },
]

function severity(z: number): AnomalySeverity | null {
  if (z > Z_CRITICAL) return 'CRITICAL'
  if (z > Z_ALERT)    return 'ALERT'
  if (z > Z_WATCH)    return 'WATCH'
  return null
}

/**
 * Détecte les anomalies statistiques pour une zone géographique.
 *
 * Filtre de base :
 * - Zone sans signal mobility (deviceCount=0) → density silencieuse
 * - Moins de MIN_SAMPLES dans la baseline → pas d'alerte
 */
export async function detectZoneAnomalies(
  geohash6:       string,
  congestionScore: number,
  deviceCount:    number,
  now:            Date = new Date(),
): Promise<DetectedAnomaly[]> {
  const hw       = hourOfWeek(now)
  const anomalies: DetectedAnomaly[] = []

  const measurements: Record<string, number> = {
    congestion: congestionScore,
    density:    deviceCount,
  }

  for (const def of METRICS) {
    const value = measurements[def.name]

    // Pas de signal density sans devices → détecteur silencieux
    if (def.name === 'density' && deviceCount === 0) continue

    let prev = await getEwmaState(geohash6, def.name, hw)

    // Warm-start depuis la mémoire territoriale si baseline froide
    if (prev.sampleCount === 0 && (def.name === 'congestion' || def.name === 'density')) {
      const warmed = await getWarmStartState(
        geohash6, def.name,
        Math.floor(hw / 24), // dayOfWeek
        hw % 24,             // hourOfDay
      )
      if (warmed) prev = warmed
    }

    const { state, zScore } = updateEwma(prev, value, def.alpha)
    await setEwmaState(geohash6, def.name, hw, state)

    // Pas assez de données pour une baseline fiable
    if (state.sampleCount < MIN_SAMPLES) continue

    // Filtre directionnel
    const goingUp = value > prev.ewma
    if (def.direction === 'up'   && !goingUp)  continue
    if (def.direction === 'down' && goingUp)   continue

    const level = severity(zScore)
    if (!level) continue

    // Pour density : distinguer spike vs void selon direction
    let pattern: AnomalyPattern = def.pattern
    if (def.name === 'density' && !goingUp) pattern = 'DENSITY_VOID'

    anomalies.push({
      geohash6,
      pattern,
      zScore,
      severity: level,
      metric:   def.name,
      value,
      baseline: prev.ewma,
      detectedAt: now,
    })
  }

  return anomalies
}
