import { describe, it, expect } from 'vitest'
import { buildSparkline, getTrend, buildRecommendation } from './border-prediction'

describe('buildSparkline', () => {
  it('retourne 12 points pour 60 minutes', () => {
    expect(buildSparkline(10, 0.3)).toHaveLength(12)
  })

  it('trending up — dernier point > premier', () => {
    const pts = buildSparkline(5, 0.5)
    expect(pts[11]).toBeGreaterThan(pts[0])
  })

  it('trending down — dernier point < premier', () => {
    const pts = buildSparkline(20, -0.4)
    expect(pts[11]).toBeLessThan(pts[0])
  })

  it('valeurs entre 0 et 60', () => {
    buildSparkline(10, 0.2).forEach(p => {
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(60)
    })
  })
})

describe('getTrend', () => {
  it('improving quand slope négatif', () => expect(getTrend(-0.3)).toBe('improving'))
  it('worsening quand slope positif', () => expect(getTrend(0.3)).toBe('worsening'))
  it('stable quand slope proche de 0', () => expect(getTrend(0.05)).toBe('stable'))
})

describe('buildRecommendation', () => {
  it('improving → contient libre', () => {
    expect(buildRecommendation('improving', 15).toLowerCase()).toContain('libre')
  })
  it('worsening → contient partez', () => {
    expect(buildRecommendation('worsening', 5).toLowerCase()).toContain('partez')
  })
})
