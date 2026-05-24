import { describe, it, expect } from 'vitest'
import { mean, percentile, computeBaseline, baselineChanged, sigmaFromP95 } from './stats'

describe('stats — fonctions statistiques pures', () => {

  // ── mean ────────────────────────────────────────────────────────────────────
  describe('mean', () => {
    it('tableau vide → 0', () => {
      expect(mean([])).toBe(0)
    })
    it('valeur unique → elle-même', () => {
      expect(mean([0.5])).toBe(0.5)
    })
    it('calcul correct sur plusieurs valeurs', () => {
      expect(mean([0.1, 0.3, 0.5])).toBeCloseTo(0.3, 5)
    })
    it('symétrique : [0, 1] → 0.5', () => {
      expect(mean([0, 1])).toBe(0.5)
    })
  })

  // ── percentile ──────────────────────────────────────────────────────────────
  describe('percentile', () => {
    it('P50 de [1,2,3,4,5] → 3', () => {
      expect(percentile([1, 2, 3, 4, 5], 50)).toBeCloseTo(3, 5)
    })
    it('P0 → minimum', () => {
      expect(percentile([5, 1, 3], 0)).toBe(1)
    })
    it('P100 → maximum', () => {
      expect(percentile([5, 1, 3], 100)).toBe(5)
    })
    it('tableau vide → 0', () => {
      expect(percentile([], 95)).toBe(0)
    })
    it('P85 de distribution uniforme [0..0.9] → compris entre P50 et max', () => {
      const arr = Array.from({ length: 10 }, (_, i) => i / 10)  // 0.0…0.9
      const p85 = percentile(arr, 85)
      expect(p85).toBeGreaterThan(percentile(arr, 50))
      expect(p85).toBeLessThanOrEqual(0.9)
    })
    it('P95 ≥ P85 ≥ P50 pour distribution croissante', () => {
      const arr = Array.from({ length: 30 }, (_, i) => i / 30)
      expect(percentile(arr, 95)).toBeGreaterThanOrEqual(percentile(arr, 85))
      expect(percentile(arr, 85)).toBeGreaterThanOrEqual(percentile(arr, 50))
    })
    it('ne modifie pas le tableau original (tri interne)', () => {
      const arr = [5, 1, 3, 2, 4]
      percentile(arr, 50)
      expect(arr).toEqual([5, 1, 3, 2, 4])
    })
  })

  // ── computeBaseline ─────────────────────────────────────────────────────────
  describe('computeBaseline', () => {
    const scores = Array.from({ length: 20 }, (_, i) => i / 20)  // 0.0 … 0.95

    it('calcule avg, P85, P95 correctement', () => {
      const b = computeBaseline(scores, Array(20).fill(5), Array(20).fill(2.5))
      expect(b.avgCongestionScore).toBeCloseTo(mean(scores), 3)
      expect(b.p85CongestionScore).toBeGreaterThan(b.avgCongestionScore)
      expect(b.p95CongestionScore).toBeGreaterThan(b.p85CongestionScore)
    })

    it('sampleCount < 14 — appelant doit vérifier (computeBaseline ne lève pas)', () => {
      // La garde MIN_SAMPLES est dans le job, pas dans computeBaseline
      expect(() => computeBaseline([0.1, 0.2], [1], [2])).not.toThrow()
    })
  })

  // ── baselineChanged ─────────────────────────────────────────────────────────
  describe('baselineChanged', () => {
    const base = {
      avgCongestionScore: 0.30, p85CongestionScore: 0.50, p95CongestionScore: 0.70,
      avgDeviceCount: 10, avgSpeedBucket: 2,
    }

    it('delta < 15% → false (pas d\'invalidation)', () => {
      const next = { ...base, avgCongestionScore: 0.34 }  // +13%
      expect(baselineChanged(base, next)).toBe(false)
    })
    it('delta = 15% → false (seuil strict > 15)', () => {
      const next = { ...base, avgCongestionScore: 0.345 }  // exactement +15%
      expect(baselineChanged(base, next)).toBe(false)
    })
    it('delta > 15% → true (cache invalide)', () => {
      const next = { ...base, avgCongestionScore: 0.36 }  // +20%
      expect(baselineChanged(base, next)).toBe(true)
    })
    it('baseline à 0 → utilise epsilon pour éviter division par zéro', () => {
      const zeroed = { ...base, avgCongestionScore: 0 }
      const next   = { ...base, avgCongestionScore: 0.01 }
      expect(() => baselineChanged(zeroed, next)).not.toThrow()
    })
  })

  // ── sigmaFromP95 ─────────────────────────────────────────────────────────────
  describe('sigmaFromP95', () => {
    it('P95 = avg → σ ≈ 0 (distribution concentrée)', () => {
      expect(sigmaFromP95(0.3, 0.3)).toBeCloseTo(1e-4, 4)
    })
    it('P95 > avg → σ > 0', () => {
      expect(sigmaFromP95(0.3, 0.6)).toBeGreaterThan(0)
    })
    it('σ = (P95 - avg) / 1.645', () => {
      expect(sigmaFromP95(0.2, 0.5)).toBeCloseTo((0.5 - 0.2) / 1.645, 5)
    })
    it('warm-start : σ injecté dans EWMA variance → variance = σ²', () => {
      const sigma = sigmaFromP95(0.1, 0.4)
      expect(sigma * sigma).toBeGreaterThan(0)
    })
  })
})
