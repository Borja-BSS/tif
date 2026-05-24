import { describe, it, expect } from 'vitest'
import { computeTerritoryScore, LEVEL_COLOR, LEVEL_OPACITY } from './territory-score'

describe('computeTerritoryScore', () => {

  // ── score formula ────────────────────────────────────────────────────────────
  it('congestion=0, no divergence, no anomaly → score 0, GREEN', () => {
    const r = computeTerritoryScore(0, false)
    expect(r.score).toBe(0)
    expect(r.level).toBe('GREEN')
  })

  it('congestion=1, divergence=true, no anomaly → score 95, CRITICAL', () => {
    const r = computeTerritoryScore(1, true)
    expect(r.score).toBe(95)
    expect(r.level).toBe('CRITICAL')
  })

  it('congestion=1, divergence=true, maxZScore=5 → score 100, CRITICAL', () => {
    const r = computeTerritoryScore(1, true, 5)
    expect(r.score).toBe(100)
    expect(r.level).toBe('CRITICAL')
  })

  it('congestion=0.5 → contributes 35 pts', () => {
    const r = computeTerritoryScore(0.5, false)
    expect(r.score).toBe(35)
  })

  it('divergence alone (cong=0) → 25 pts → YELLOW', () => {
    const r = computeTerritoryScore(0, true)
    expect(r.score).toBe(25)
    expect(r.level).toBe('YELLOW')
  })

  it('anomaly maxZScore=2.5 → 2.5pts (half bonus)', () => {
    const r = computeTerritoryScore(0, false, 2.5)
    expect(r.score).toBe(3)  // round(2.5) = 3
    expect(r.level).toBe('GREEN')
  })

  it('maxZScore > 5 → capped at 5 pts', () => {
    const r = computeTerritoryScore(0, false, 999)
    expect(r.score).toBe(5)
  })

  it('congestionScore clamped to [0,1]', () => {
    expect(computeTerritoryScore(-0.5, false).score).toBe(0)
    expect(computeTerritoryScore(1.5, false).score).toBe(70)
  })

  // ── level thresholds ─────────────────────────────────────────────────────────
  it('score 19 → GREEN', () => {
    expect(computeTerritoryScore(0.271, false).level).toBe('GREEN')  // ~19
  })

  it('score 20 → YELLOW (threshold exclusive)', () => {
    const r = computeTerritoryScore(0, true)  // 25 pts → YELLOW
    expect(r.level).toBe('YELLOW')
  })

  it('score 40 → ORANGE', () => {
    const r = computeTerritoryScore(0.571, false)  // ~40
    expect(r.level).toBe('ORANGE')
  })

  it('score 65 → RED', () => {
    const r = computeTerritoryScore(0.929, false)  // ~65
    expect(r.level).toBe('RED')
  })

  it('score 85 → CRITICAL (at threshold)', () => {
    // 0.857*70 ≈ 59.99 + 25 (div) ≈ 84.99 → rounds to 85 → CRITICAL (≥85)
    const r = computeTerritoryScore(0.857, true)
    expect(r.score).toBe(85)
    expect(r.level).toBe('CRITICAL')
  })

  it('score 84 → RED (just below threshold)', () => {
    // 0.84*70 = 58.8 + 25 = 83.8 → rounds to 84 → RED (<85)
    const r = computeTerritoryScore(0.84, true)
    expect(r.score).toBe(84)
    expect(r.level).toBe('RED')
  })

  // ── components returned ──────────────────────────────────────────────────────
  it('components reflect inputs correctly', () => {
    const r = computeTerritoryScore(0.6, true, 3)
    expect(r.components.congestion).toBeCloseTo(0.6)
    expect(r.components.divergence).toBe(1)
    expect(r.components.anomaly).toBeCloseTo(0.6)  // 3/5
  })

  it('anomaly = 0 when maxZScore omitted', () => {
    const r = computeTerritoryScore(0.5, false)
    expect(r.components.anomaly).toBe(0)
  })
})

// ── LEVEL_COLOR ──────────────────────────────────────────────────────────────
describe('LEVEL_COLOR', () => {
  it('all five levels have a hex color', () => {
    for (const [, v] of Object.entries(LEVEL_COLOR)) {
      expect(v).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
  it('CRITICAL → white (#ffffff)', () => {
    expect(LEVEL_COLOR.CRITICAL).toBe('#ffffff')
  })
})

// ── LEVEL_OPACITY ────────────────────────────────────────────────────────────
describe('LEVEL_OPACITY', () => {
  it('GREEN has opacity 0 (transparent)', () => {
    expect(LEVEL_OPACITY.GREEN).toBe(0)
  })
  it('CRITICAL has opacity 1 (opaque)', () => {
    expect(LEVEL_OPACITY.CRITICAL).toBe(1.0)
  })
  it('opacities increase with severity', () => {
    expect(LEVEL_OPACITY.YELLOW).toBeLessThan(LEVEL_OPACITY.ORANGE)
    expect(LEVEL_OPACITY.ORANGE).toBeLessThan(LEVEL_OPACITY.RED)
    expect(LEVEL_OPACITY.RED).toBeLessThan(LEVEL_OPACITY.CRITICAL)
  })
})
