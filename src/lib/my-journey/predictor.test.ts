import { describe, it, expect } from 'vitest'
import { calculateImpactScore, minutesUntilDeparture, buildHeadline } from './predictor'
import type { UserJourneyData } from './types'

const baseJourney: UserJourneyData = {
  id: 'j1', userId: 'u1', name: 'Test',
  from: { lat: 46.2, lng: 6.1, label: 'Domicile' },
  to:   { lat: 46.3, lng: 6.2, label: 'Travail'  },
  schedule: { dayOfWeek: [1,2,3,4,5], departureHour: 7, departureMinute: 45, flexMinutes: 15 },
  preferredMode: 'both',
  notifyMinutesBefore: 15,
  active: true,
}

describe('calculateImpactScore', () => {
  it('0 incidents, 0 congestion → score < 0.3', () => {
    const score = calculateImpactScore(0, 0, 0)
    expect(score).toBeLessThan(0.3)
  })

  it('max congestion + divergence → score > 0.7', () => {
    const score = calculateImpactScore(1, 1, 5)
    expect(score).toBeGreaterThan(0.7)
  })

  it('moderate congestion → 0.3–0.6', () => {
    const score = calculateImpactScore(0.5, 0, 0)
    expect(score).toBeGreaterThanOrEqual(0.3)
    expect(score).toBeLessThan(0.6)
  })
})

describe('minutesUntilDeparture', () => {
  it('departure in 30min → returns ~30', () => {
    const j = { ...baseJourney }
    const now = new Date()
    j.schedule = {
      ...j.schedule,
      dayOfWeek: [now.getDay()],
      departureHour:   (now.getHours() + Math.floor((now.getMinutes() + 30) / 60)) % 24,
      departureMinute: (now.getMinutes() + 30) % 60,
    }
    const result = minutesUntilDeparture(j, now)
    expect(Math.abs(result - 30)).toBeLessThan(2)
  })
})

describe('buildHeadline', () => {
  it('normal → partez à heure', () => {
    const h = buildHeadline('normal', 30, 0, 7, 45)
    expect(h).toContain('7h45')
  })

  it('disrupted → mentionne perturbé', () => {
    const h = buildHeadline('disrupted', 20, 12, 7, 45)
    expect(h.toLowerCase()).toContain('perturb')
  })
})
