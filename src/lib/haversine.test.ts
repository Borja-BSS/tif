import { describe, it, expect } from 'vitest'
import { haversineMeters } from './haversine'

describe('haversineMeters', () => {
  it('retourne 0 pour deux points identiques', () => {
    expect(haversineMeters(46.2044, 6.1432, 46.2044, 6.1432)).toBe(0)
  })
  it('retourne ~111km pour 1° de latitude', () => {
    const d = haversineMeters(46.0, 6.0, 47.0, 6.0)
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })
  it('retourne < 100m pour deux points très proches', () => {
    // ~55m
    expect(haversineMeters(46.2044, 6.1432, 46.2049, 6.1432)).toBeLessThan(100)
  })
  it('retourne > 100m pour points éloignés', () => {
    // ~560m
    expect(haversineMeters(46.2044, 6.1432, 46.2094, 6.1432)).toBeGreaterThan(100)
  })
})
