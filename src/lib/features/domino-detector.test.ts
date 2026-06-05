import { describe, it, expect } from 'vitest'
import { predictDominoEffect } from './domino-detector'

describe('predictDominoEffect', () => {
  it('zone à 80% capacité + incident → alerte domino', () => {
    const result = predictDominoEffect({
      incidentGeohash:     'u0k2j5',
      neighborGeohashes:   ['u0k2j6', 'u0k2j7'],
      neighborCapacities:  { 'u0k2j6': 0.8, 'u0k2j7': 0.3 },
      divertedFlowRatio:   0.4,
    })
    expect(result).not.toBeNull()
    expect(result!.targetGeohash).toBe('u0k2j6')
    expect(result!.estimatedMinutes).toBeGreaterThan(0)
  })

  it("zones sous-chargées → pas d'alerte", () => {
    const result = predictDominoEffect({
      incidentGeohash:    'u0k2j5',
      neighborGeohashes:  ['u0k2j6'],
      neighborCapacities: { 'u0k2j6': 0.2 },
      divertedFlowRatio:  0.3,
    })
    expect(result).toBeNull()
  })
})
