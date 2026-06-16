import { describe, it, expect } from 'vitest'
import { computeExpiresAt, computeCredibility, TTL_SECONDS } from './signalement-categories'

describe('TTL_SECONDS', () => {
  it('couvre toutes les priorités', () => {
    for (const p of ['info','vigilance','perturbation','important','urgent','critique']) {
      expect(TTL_SECONDS[p]).toBeGreaterThan(0)
    }
  })
  it('info > urgent > critique', () => {
    expect(TTL_SECONDS.info).toBeGreaterThan(TTL_SECONDS.urgent)
    expect(TTL_SECONDS.urgent).toBeGreaterThan(TTL_SECONDS.critique)
  })
})

describe('computeExpiresAt', () => {
  it('retourne une date future selon la priorité', () => {
    const now = Date.now()
    const exp = new Date(computeExpiresAt('urgent')).getTime()
    expect(exp).toBeGreaterThan(now)
    expect(exp).toBeLessThan(now + TTL_SECONDS.urgent * 1000 + 1000)
  })
  it('fallback sur info si priorité inconnue', () => {
    const exp = new Date(computeExpiresAt('unknown')).getTime()
    expect(exp).toBeGreaterThan(Date.now())
  })
})

describe('computeCredibility', () => {
  it('neutral si moins de 2 votes total', () => {
    expect(computeCredibility(1, 0)).toBe('neutral')
    expect(computeCredibility(0, 0)).toBe('neutral')
  })
  it('confirmed si ≥ 70% de confirms', () => {
    expect(computeCredibility(7, 3)).toBe('confirmed')
    expect(computeCredibility(10, 0)).toBe('confirmed')
  })
  it('false si ≥ 70% de deny', () => {
    expect(computeCredibility(1, 9)).toBe('false')
    expect(computeCredibility(0, 5)).toBe('false')
  })
  it('contested sinon', () => {
    expect(computeCredibility(5, 5)).toBe('contested')
    expect(computeCredibility(6, 4)).toBe('contested')
  })
})
