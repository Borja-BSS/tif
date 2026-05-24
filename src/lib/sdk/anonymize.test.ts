import { describe, it, expect } from 'vitest'
import {
  toGeohash6, toSpeedBucket, toDirectionOctant,
  toMinuteTimestamp, isValidRaw, inBbox, cellInBbox,
} from './anonymize'

describe('anonymize — transforms pures SDK mobilité', () => {

  // ── toSpeedBucket ───────────────────────────────────────────────────────────
  describe('toSpeedBucket', () => {
    it('0 m/s (arrêt) → bucket 0', () => {
      expect(toSpeedBucket(0)).toBe(0)
    })
    it('0.5 m/s (1.8 km/h, quasi arrêt) → bucket 0', () => {
      expect(toSpeedBucket(0.5)).toBe(0)
    })
    it('3 m/s (10.8 km/h) → bucket 1 (<15 km/h)', () => {
      expect(toSpeedBucket(3)).toBe(1)
    })
    it('5 m/s (18 km/h) → bucket 2 (15–30 km/h)', () => {
      expect(toSpeedBucket(5)).toBe(2)
    })
    it('12 m/s (43.2 km/h) → bucket 3', () => {
      expect(toSpeedBucket(12)).toBe(3)
    })
    it('22 m/s (79.2 km/h) → bucket 4', () => {
      expect(toSpeedBucket(22)).toBe(4)
    })
    it('30 m/s (108 km/h) → bucket 5', () => {
      expect(toSpeedBucket(30)).toBe(5)
    })
  })

  // ── toDirectionOctant ───────────────────────────────────────────────────────
  describe('toDirectionOctant', () => {
    it('0° (Nord) → octant 0', () => {
      expect(toDirectionOctant(0)).toBe(0)
    })
    it('360° = 0° → octant 0', () => {
      expect(toDirectionOctant(360)).toBe(0)
    })
    it('45° (NE) → octant 1', () => {
      expect(toDirectionOctant(45)).toBe(1)
    })
    it('90° (Est) → octant 2', () => {
      expect(toDirectionOctant(90)).toBe(2)
    })
    it('180° (Sud) → octant 4', () => {
      expect(toDirectionOctant(180)).toBe(4)
    })
    it('270° (Ouest) → octant 6', () => {
      expect(toDirectionOctant(270)).toBe(6)
    })
    it('315° (NW) → octant 7', () => {
      expect(toDirectionOctant(315)).toBe(7)
    })
    it('heading négatif → géré correctement (-90° = 270° → octant 6)', () => {
      expect(toDirectionOctant(-90)).toBe(6)
    })
  })

  // ── toMinuteTimestamp ───────────────────────────────────────────────────────
  describe('toMinuteTimestamp', () => {
    it('arrondit à la minute inférieure', () => {
      // Utiliser une base sur une frontière exacte de minute
      const base = Math.floor(Date.now() / 60_000) * 60_000
      const t    = base + 37_000  // +37s dans la même minute
      expect(toMinuteTimestamp(t)).toBe(base)
    })
    it('milieu de minute → même minute', () => {
      const t = 1_716_544_030_000 // +30s
      expect(toMinuteTimestamp(t) % 60_000).toBe(0)
    })
    it('résultat toujours multiple de 60000', () => {
      expect(toMinuteTimestamp(Date.now()) % 60_000).toBe(0)
    })
  })

  // ── isValidRaw ──────────────────────────────────────────────────────────────
  describe('isValidRaw', () => {
    it('vitesse normale + précision ok → valide', () => {
      expect(isValidRaw(10, 15)).toBe(true)
    })
    it('accuracy > 50m → invalide', () => {
      expect(isValidRaw(10, 51)).toBe(false)
    })
    it('vitesse > 200 km/h → invalide (GPS artifact)', () => {
      expect(isValidRaw(60, 10)).toBe(false) // 60 m/s = 216 km/h
    })
    it('vitesse négative → invalide', () => {
      expect(isValidRaw(-1, 10)).toBe(false)
    })
    it('arrêt complet (0 m/s) + précision 10m → valide', () => {
      expect(isValidRaw(0, 10)).toBe(true)
    })
  })

  // ── inBbox ──────────────────────────────────────────────────────────────────
  describe('inBbox', () => {
    it('Genève centre [46.204, 6.143] → dans la bbox', () => {
      expect(inBbox(46.204, 6.143)).toBe(true)
    })
    it('Annemasse [46.195, 6.237] → dans la bbox', () => {
      expect(inBbox(46.195, 6.237)).toBe(true)
    })
    it('Paris [48.856, 2.347] → hors bbox', () => {
      expect(inBbox(48.856, 2.347)).toBe(false)
    })
    it('Zurich [47.376, 8.541] → hors bbox', () => {
      expect(inBbox(47.376, 8.541)).toBe(false)
    })
    it('bord supérieur lat=46.4 → dans bbox', () => {
      expect(inBbox(46.4, 6.1)).toBe(true)
    })
    it('hors bord lat=46.41 → hors bbox', () => {
      expect(inBbox(46.41, 6.1)).toBe(false)
    })
  })

  // ── toGeohash6 + cellInBbox ─────────────────────────────────────────────────
  describe('toGeohash6 / cellInBbox', () => {
    it('coordonnées Genève → H3 cell valide (15 chars hex)', () => {
      const cell = toGeohash6(46.204, 6.143)
      expect(cell).toMatch(/^[0-9a-f]{15}$/)
    })
    it('cellInBbox : cell Genève → true', () => {
      const cell = toGeohash6(46.204, 6.143)
      expect(cellInBbox(cell)).toBe(true)
    })
    it('cellInBbox : cell Paris → false', () => {
      const cell = toGeohash6(48.856, 2.347)
      expect(cellInBbox(cell)).toBe(false)
    })
    it('cellInBbox : string invalide → false (pas d\'exception)', () => {
      expect(cellInBbox('invalid')).toBe(false)
    })
    it('deux points proches → même cell H3-6 (±800m)', () => {
      const a = toGeohash6(46.2040, 6.1430)
      const b = toGeohash6(46.2045, 6.1435)
      expect(a).toBe(b)
    })
    it('deux points éloignés → cells différentes', () => {
      const a = toGeohash6(46.204, 6.143)
      const b = toGeohash6(46.300, 6.200)
      expect(a).not.toBe(b)
    })
  })
})
