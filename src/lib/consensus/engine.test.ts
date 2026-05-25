import { describe, it, expect } from 'vitest'
import { computeConsensus } from './engine'

const NOW = new Date('2026-05-24T10:00:00.000Z')

function ago(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60 * 1000)
}

describe('Reality Consensus Engine — Phase 3 CASE gates', () => {

  // CASE 1 — source unique SIG : consensus cohérent
  it('CASE 1 : SIG seul, zone libre → CLEAR, isReliable false (1 source)', () => {
    const result = computeConsensus(
      'u0h6t2',
      [{ type: 'sig', value: 0.1, updatedAt: ago(0) }],
      NOW,
    )
    expect(result.realityStatus).toBe('CLEAR')
    expect(result.isReliable).toBe(false)  // 1 source < minimum 2
    expect(result.divergence).toBe(false)
  })

  // CASE 2 — GATE : TIF dépasse Google Maps
  // SIG=OPEN + mobility congestionné → MODERATE + divergence true
  it('CASE 2 : SIG=OPEN + mobility congestionné (23 devices) → MODERATE + divergence [GATE]', () => {
    const mobilityValue = 1 - 0.8 / 5  // speedBucket 0.8 → congestion 0.84

    const result = computeConsensus(
      'u0h6t2',
      [
        { type: 'sig',      value: 0.08,          updatedAt: ago(8) },
        { type: 'mobility', value: mobilityValue,  updatedAt: ago(0), deviceCount: 23 },
        { type: 'sbb',      value: 0.05,           updatedAt: ago(2) },
      ],
      NOW,
    )

    // GATE : ce test prouve que TIF détecte avant les sources officielles
    expect(result.officialStatus).toBe('OPEN')
    expect(result.realityStatus).toBe('MODERATE')
    expect(result.divergence).toBe(true)
    expect(result.dataConfidence).toBeGreaterThan(0.50)
    expect(result.divergenceExplanation).toContain('ralentissement')
    expect(result.isReliable).toBe(true)  // 3 sources ≥ 2
  })

  // CASE 3 — mobility sous seuil : ignorée
  it('CASE 3 : mobility < 3 devices → signal ignoré, résultat sur SIG seul', () => {
    const result = computeConsensus(
      'u0h6t2',
      [
        { type: 'sig',      value: 0.1, updatedAt: ago(0) },
        { type: 'mobility', value: 0.9, updatedAt: ago(0), deviceCount: 2 },  // < 3
      ],
      NOW,
    )
    expect(result.sourcesAvailable).not.toContain('mobility')
    expect(result.realityStatus).toBe('CLEAR')  // SIG seul → libre
  })

  // CASE 4 — temporal decay
  it('CASE 4 : SIG à 12 minutes → dataConfidence nettement réduit', () => {
    const fresh = computeConsensus(
      'u0h6t2',
      [{ type: 'sig', value: 0.5, updatedAt: ago(0) }],
      NOW,
    )
    const stale = computeConsensus(
      'u0h6t2',
      [{ type: 'sig', value: 0.5, updatedAt: ago(12) }],
      NOW,
    )
    expect(stale.dataConfidence).toBeLessThan(fresh.dataConfidence * 0.80)
  })

  // CASE 5 — 0 signaux valides : UNKNOWN gracieux
  it('CASE 5 : 0 signaux → UNKNOWN, dataConfidence 0, isReliable false', () => {
    const result = computeConsensus('u0h6t2', [], NOW)
    expect(result.realityStatus).toBe('UNKNOWN')
    expect(result.isReliable).toBe(false)
    expect(result.dataConfidence).toBe(0)
    expect(result.divergence).toBe(false)
  })
})

describe('computeConsensus — scénarios existants (non-régression)', () => {

  it('scénario 1 : sources officielles concordantes, mobility absente → CLEAR sans divergence', () => {
    const result = computeConsensus(
      'u0hbp9',
      [
        { type: 'sig', value: 0.1, updatedAt: ago(0) },
        { type: 'sbb', value: 0.0, updatedAt: ago(0) },
        { type: 'mobility', value: 0.9, updatedAt: ago(0), deviceCount: 0 },
      ],
      NOW,
    )
    expect(result.realityStatus).toBe('CLEAR')
    expect(result.officialStatus).toBe('OPEN')
    expect(result.divergence).toBe(false)
    expect(result.confidenceScore).toBeGreaterThan(0.8)
  })

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

  it('source SIG à 12 minutes → weight réduit d\'au moins 20%', () => {
    const fresh = computeConsensus('u0hbp9', [{ type: 'sig', value: 0.5, updatedAt: ago(0) }], NOW)
    const stale = computeConsensus('u0hbp9', [{ type: 'sig', value: 0.5, updatedAt: ago(12) }], NOW)
    expect(stale.confidenceScore).toBeLessThan(fresh.confidenceScore * 0.80)
  })

  it('< 3 devices mobility → signal ignoré (MOBILITY_MIN_DEVICES)', () => {
    const withMob = computeConsensus(
      'u0hbp9',
      [{ type: 'mobility', value: 1.0, updatedAt: ago(0), deviceCount: 2 }],
      NOW,
    )
    expect(withMob.realityStatus).toBe('UNKNOWN')
    expect(withMob.sourceWeights.mobility).toBe(0)
  })
})
