import { describe, it, expect } from 'vitest'
import { computeConsensus } from './engine'

const NOW = new Date('2026-05-24T10:00:00.000Z')

// Helpers pour construire des snapshots avec un âge explicite
function ago(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60 * 1000)
}

describe('computeConsensus — Reality Consensus Engine', () => {

  // ── Scénario 1 ──────────────────────────────────────────────────────────────
  // SIG : OPEN (score 0.1) — frais
  // SBB : ON TIME (score 0.0) — frais
  // Mobility : 0 devices (volume insuffisant → ignoré)
  // Expected : CLEAR, divergence false
  it('scénario 1 : sources officielles concordantes, mobility absente → CLEAR sans divergence', () => {
    const result = computeConsensus(
      'u0hbp9',
      [
        { type: 'sig', value: 0.1, updatedAt: ago(0) },
        { type: 'sbb', value: 0.0, updatedAt: ago(0) },
        { type: 'mobility', value: 0.9, updatedAt: ago(0), deviceCount: 0 }, // < MIN_DEVICES → ignoré
      ],
      NOW,
    )

    expect(result.realityStatus).toBe('CLEAR')
    expect(result.officialStatus).toBe('OPEN')
    expect(result.divergence).toBe(false)
    expect(result.confidenceScore).toBeGreaterThan(0.8)
    expect(result.ttl).toBe(120) // zone calme
  })

  // ── Scénario 2 ──────────────────────────────────────────────────────────────
  // SIG : OPEN (score 0.1) — données vieilles de 8 minutes
  // SBB : ON TIME (score 0.0) — données vieilles de ~2 minutes (1min cron)
  // Mobility : 23 devices, speedBucket moyen 0.8 (quasi arrêtés)
  //   → mobilityValue = 1 - 0.8/5 = 0.84
  // Expected : MODERATE, divergence true
  it('scénario 2 : mobility contredisant les sources officielles → MODERATE + divergence', () => {
    const mobilityValue = 1 - 0.8 / 5 // bucket 0.8 → congestion 0.84

    const result = computeConsensus(
      'u0hbp9',
      [
        { type: 'sig',      value: 0.1,           updatedAt: ago(8) },
        { type: 'sbb',      value: 0.0,           updatedAt: ago(2) },
        { type: 'mobility', value: mobilityValue, updatedAt: ago(0), deviceCount: 23 },
      ],
      NOW,
    )

    expect(result.realityStatus).toBe('MODERATE')
    expect(result.officialStatus).toBe('OPEN')
    expect(result.divergence).toBe(true)
    expect(result.divergenceExplanation).toContain('ralentissement')
    // confidence ≈ 0.60–0.65 (sources fraîcheur réduite)
    expect(result.confidenceScore).toBeGreaterThan(0.55)
    expect(result.confidenceScore).toBeLessThan(0.70)
    expect(result.ttl).toBe(30) // zone active avec mobility
  })

  // ── Dégradé gracieux ────────────────────────────────────────────────────────
  it('0 sources disponibles → UNKNOWN, confidenceScore 0', () => {
    const result = computeConsensus('u0hbp9', [], NOW)
    expect(result.realityStatus).toBe('UNKNOWN')
    expect(result.confidenceScore).toBe(0)
    expect(result.divergence).toBe(false)
  })

  it('1 seule source (SIG uniquement) → fusionne correctement', () => {
    const result = computeConsensus(
      'u0hbp9',
      [{ type: 'sig', value: 0.7, updatedAt: ago(1) }],
      NOW,
    )
    expect(result.realityStatus).toBe('HEAVY')
    expect(result.officialStatus).toBe('CLOSED')
    expect(result.confidenceScore).toBeGreaterThan(0)
  })

  // ── Temporal decay ──────────────────────────────────────────────────────────
  it('source SIG à 12 minutes → weight réduit d\'au moins 20%', () => {
    // λ_sig = 0.002 ; e^(-0.002×720) = e^(-1.44) ≈ 0.237
    // Réduction ≈ 1 - 0.237 = 76% (nettement > 20%)
    const fresh = computeConsensus('u0hbp9', [{ type: 'sig', value: 0.5, updatedAt: ago(0) }], NOW)
    const stale = computeConsensus('u0hbp9', [{ type: 'sig', value: 0.5, updatedAt: ago(12) }], NOW)
    expect(stale.confidenceScore).toBeLessThan(fresh.confidenceScore * 0.80)
  })

  // ── Mobility volume check ────────────────────────────────────────────────────
  it('< 3 devices mobility → signal ignoré (MOBILITY_MIN_DEVICES)', () => {
    const withMob = computeConsensus(
      'u0hbp9',
      [{ type: 'mobility', value: 1.0, updatedAt: ago(0), deviceCount: 2 }],
      NOW,
    )
    expect(withMob.realityStatus).toBe('UNKNOWN') // mobility ignorée → rien
    expect(withMob.sourceWeights.mobility).toBe(0)
  })
})
