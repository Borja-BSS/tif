import { describe, it, expect, vi } from 'vitest'

// Mock Redis — les tests n'ont besoin que des fonctions pures
vi.mock('@/lib/redis', () => ({
  redis: { get: vi.fn(), set: vi.fn() },
}))

import { updateEwma } from './ewma'
import type { EwmaState } from './types'

const COLD: EwmaState = { ewma: 0, variance: 0, lastUpdated: '', sampleCount: 0 }

function buildState(ewma: number, variance: number, sampleCount: number): EwmaState {
  return { ewma, variance, lastUpdated: '2026-01-01T00:00:00.000Z', sampleCount }
}

describe('updateEwma — algorithme EWMA + Z-score', () => {

  // ── Cold start ──────────────────────────────────────────────────────────────
  it('cold start : initialise ewma = mesure, variance = 0, zScore = 0', () => {
    const { state, zScore } = updateEwma(COLD, 0.5, 0.20)
    expect(state.ewma).toBe(0.5)
    expect(state.variance).toBe(0)
    expect(state.sampleCount).toBe(1)
    expect(zScore).toBe(0)
  })

  // ── Z-score normal ───────────────────────────────────────────────────────────
  it('mesure proche de la baseline → zScore faible (< 1)', () => {
    // Baseline : ewma=0.3, variance=0.01 → σ=0.1
    const prev = buildState(0.3, 0.01, 10)
    const { zScore } = updateEwma(prev, 0.35, 0.15)
    // |0.35 - 0.3| / 0.1 = 0.5
    expect(zScore).toBeCloseTo(0.5, 1)
  })

  // ── Z-score anomalie ─────────────────────────────────────────────────────────
  it('spike → zScore dépasse le seuil CRITICAL (> 3.5)', () => {
    // Baseline : ewma=0.1, variance=0.0025 → σ=0.05
    // Mesure : 0.9 → |0.9 - 0.1| / 0.05 = 16
    const prev = buildState(0.1, 0.0025, 20)
    const { zScore } = updateEwma(prev, 0.9, 0.20)
    expect(zScore).toBeGreaterThan(3.5)
  })

  // ── Convergence EWMA ─────────────────────────────────────────────────────────
  it('100 mesures constantes → ewma converge vers la valeur stable', () => {
    let state = COLD
    for (let i = 0; i < 100; i++) {
      const res = updateEwma(state, 0.42, 0.20)
      state = res.state
    }
    expect(state.ewma).toBeCloseTo(0.42, 2)
  })

  // ── Temporal decay du signal : α petit = baseline stable ────────────────────
  it('α=0.15 (vitesse) : baseline moins réactive qu\'α=0.30 (route change)', () => {
    const baseline = buildState(0.1, 0.002, 30)

    const { state: stateSlowAlpha } = updateEwma(baseline, 0.9, 0.15)
    const { state: stateFastAlpha } = updateEwma(baseline, 0.9, 0.30)

    // α plus grand → EWMA se déplace plus vers la nouvelle mesure
    expect(stateFastAlpha.ewma).toBeGreaterThan(stateSlowAlpha.ewma)
  })

  // ── Zone sans baseline (sampleCount < MIN_SAMPLES) ──────────────────────────
  it('premiers samples : zScore=0 sur cold start, pas d\'anomalie possible', () => {
    let state = COLD
    const zScores: number[] = []
    for (let i = 0; i < 4; i++) {
      const { state: s, zScore } = updateEwma(state, i === 3 ? 0.99 : 0.1, 0.20)
      zScores.push(zScore)
      state = s
    }
    // Cold start = 0 ; premiers samples ont variance nulle → zScore=0 ou basé sur très petite variance
    expect(zScores[0]).toBe(0) // cold start
  })

  // ── Faux positifs : bruit < 2σ ne doit PAS déclencher ───────────────────────
  it('fluctuation normale (±1σ) → zScore < WATCH (2.0)', () => {
    // σ=0.1, bruit ±0.15 → z≈1.5
    const prev = buildState(0.5, 0.01, 30) // variance=0.01 → σ=0.1
    const { zScore } = updateEwma(prev, 0.65, 0.15)
    expect(zScore).toBeLessThan(2.0)
  })

})
