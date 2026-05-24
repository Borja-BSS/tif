/**
 * Initialise l'état EWMA depuis le TemporalPattern historique.
 * Sans warm-start, la baseline EWMA nécessite MIN_SAMPLES mesures
 * avant de pouvoir alerter — la mémoire territoriale permet de démarrer calibré.
 */
import { db }          from '@/lib/db'
import { sigmaFromP95 } from './stats'
import type { PatternBaseline }  from './types'
import type { EwmaState }        from '@/lib/anomaly/types'

const MIN_SAMPLES_VALID = 14

export async function getWarmStartState(
  geohash6:    string,
  metric:      'congestion' | 'density',
  dayOfWeek:   number,
  hourOfDay:   number,
): Promise<EwmaState | null> {
  const pattern = await db.temporalPattern.findUnique({
    where: { geohash6_dayOfWeek_hourOfDay: { geohash6, dayOfWeek, hourOfDay } },
    select: { baseline: true, sampleCount: true, lastUpdated: true },
  })

  if (!pattern || pattern.sampleCount < MIN_SAMPLES_VALID) return null

  const b = pattern.baseline as unknown as PatternBaseline

  if (metric === 'congestion') {
    const sigma    = sigmaFromP95(b.avgCongestionScore, b.p95CongestionScore)
    return {
      ewma:        b.avgCongestionScore,
      variance:    sigma * sigma,
      lastUpdated: pattern.lastUpdated.toISOString(),
      sampleCount: pattern.sampleCount,
    }
  }

  if (metric === 'density') {
    // Poisson approximation : σ ≈ √μ → variance ≈ μ
    const mu = Math.max(b.avgDeviceCount, 1)
    return {
      ewma:        mu,
      variance:    mu,
      lastUpdated: pattern.lastUpdated.toISOString(),
      sampleCount: pattern.sampleCount,
    }
  }

  return null
}
