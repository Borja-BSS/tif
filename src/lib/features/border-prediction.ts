export type BorderTrend = 'improving' | 'stable' | 'worsening'

export interface BorderPrediction {
  crossingId:     string
  name:           string
  currentWait:    number
  predictions:    { in15min: number; in30min: number; in45min: number }
  trend:          BorderTrend
  recommendation: string
  sparkline:      number[]
  confidence:     number
}

export function buildSparkline(current: number, slope: number): number[] {
  return Array.from({ length: 12 }, (_, i) => {
    const val = current + slope * i * 2
    return Math.min(60, Math.max(0, val))
  })
}

export function getTrend(slope: number): BorderTrend {
  if (slope < -0.1) return 'improving'
  if (slope > 0.1)  return 'worsening'
  return 'stable'
}

export function buildRecommendation(trend: BorderTrend, currentWait: number): string {
  if (trend === 'improving') {
    const freeIn = Math.round(currentWait * 0.6)
    return freeIn < 5 ? 'Passage fluide maintenant' : `Sera libre dans ~${freeIn} min`
  }
  if (trend === 'worsening') {
    return currentWait < 8 ? 'Partez maintenant — pire dans 20 min' : `${currentWait} min d'attente · Tendance à la hausse`
  }
  return `${currentWait} min · Situation stable`
}

export function computeBorderPrediction(params: {
  crossingId:    string
  name:          string
  currentWait:   number
  congestionNow: number
  peakPattern:   number
}): BorderPrediction {
  const { crossingId, name, currentWait, congestionNow, peakPattern } = params
  const slope    = (peakPattern - 1) * 0.8 * congestionNow
  const sparkline = buildSparkline(currentWait, slope)
  const trend     = getTrend(slope)
  return {
    crossingId, name, currentWait,
    predictions: {
      in15min: Math.max(0, Math.round(sparkline[2])),
      in30min: Math.max(0, Math.round(sparkline[5])),
      in45min: Math.max(0, Math.round(sparkline[8])),
    },
    trend,
    recommendation: buildRecommendation(trend, currentWait),
    sparkline,
    confidence: 0.72,
  }
}
