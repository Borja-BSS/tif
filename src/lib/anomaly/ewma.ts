import { redis } from '@/lib/redis'
import type { EwmaState } from './types'

const EMPTY: EwmaState = { ewma: 0, variance: 0, lastUpdated: '', sampleCount: 0 }

// Key : tif:ewma:{geohash6}:{metric}:{hour_of_week}
// 168 buckets par zone par métrique (7j × 24h)
function key(geohash6: string, metric: string, hourOfWeek: number): string {
  return `tif:ewma:${geohash6}:${metric}:${hourOfWeek}`
}

export function hourOfWeek(date: Date = new Date()): number {
  return date.getDay() * 24 + date.getHours()  // 0–167
}

export async function getEwmaState(
  geohash6:    string,
  metric:      string,
  hourOfWeek_: number,
): Promise<EwmaState> {
  const cached = await redis.get(key(geohash6, metric, hourOfWeek_))
  if (!cached) return { ...EMPTY }
  return (typeof cached === 'string' ? JSON.parse(cached) : cached) as EwmaState
}

export async function setEwmaState(
  geohash6:    string,
  metric:      string,
  hourOfWeek_: number,
  state:       EwmaState,
): Promise<void> {
  await redis.set(key(geohash6, metric, hourOfWeek_), JSON.stringify(state), {
    ex: 24 * 60 * 60,  // TTL 24h — reset si zone inactive
  })
}

/**
 * Met à jour l'état EWMA avec une nouvelle mesure.
 *
 * Z-score calculé sur l'état PRÉCÉDENT (baseline avant update)
 * pour mesurer l'écart par rapport à la normale.
 *
 * EWMA_t   = α × M_t + (1-α) × EWMA_{t-1}
 * variance_t = α × (M_t - EWMA_t)² + (1-α) × variance_{t-1}
 * Z = |M_t - EWMA_{t-1}| / max(√variance_{t-1}, ε)
 */
export function updateEwma(
  prev:        EwmaState,
  measurement: number,
  alpha:       number,
): { state: EwmaState; zScore: number } {
  if (prev.sampleCount === 0) {
    return {
      state: {
        ewma:        measurement,
        variance:    0,
        lastUpdated: new Date().toISOString(),
        sampleCount: 1,
      },
      zScore: 0,
    }
  }

  // Z-score avant update (déviation par rapport à la baseline actuelle)
  const sigma  = Math.sqrt(Math.max(prev.variance, 1e-9))
  const zScore = Math.abs(measurement - prev.ewma) / sigma

  const newEwma     = alpha * measurement + (1 - alpha) * prev.ewma
  const newVariance = alpha * Math.pow(measurement - newEwma, 2) + (1 - alpha) * prev.variance

  return {
    state: {
      ewma:        newEwma,
      variance:    newVariance,
      lastUpdated: new Date().toISOString(),
      sampleCount: prev.sampleCount + 1,
    },
    zScore,
  }
}
