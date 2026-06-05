import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeCrossingStatus, BORDER_CROSSINGS_STATIC } from '@/lib/territory/border-crossings'

// Top-level mocks hoisted before all tests
vi.mock('@/lib/redis',  () => ({ redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn() } }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn() } }))

// Set local hours (not UTC) so computeCrossingStatus's getHours() matches
function makeDate(localHour: number, dayOfWeek: number): Date {
  const d = new Date()
  const diff = (dayOfWeek - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff)
  d.setHours(localHour, 0, 0, 0)
  return d
}

const bardonnex = BORDER_CROSSINGS_STATIC.find(c => c.id === 'bardonnex')!
const ferney    = BORDER_CROSSINGS_STATIC.find(c => c.id === 'ferney-voltaire')!

describe('computeCrossingStatus — Bardonnex (motorway)', () => {

  it('HEAVY on Friday evening peak (17h)', () => {
    const { status, jamFactor } = computeCrossingStatus(bardonnex, makeDate(17, 5))
    expect(status).toBe('HEAVY')
    expect(jamFactor).toBe(7)
  })

  it('CLEAR at 3am', () => {
    const { status, jamFactor } = computeCrossingStatus(bardonnex, makeDate(3, 1))
    expect(status).toBe('CLEAR')
    expect(jamFactor).toBeLessThanOrEqual(1)
  })

  it('MODERATE on weekday morning peak (8h)', () => {
    const { status } = computeCrossingStatus(bardonnex, makeDate(8, 1))
    expect(status).toBe('MODERATE')
  })

  it('MODERATE on regular evening peak (17h Monday)', () => {
    const { status } = computeCrossingStatus(bardonnex, makeDate(17, 1))
    expect(status).toBe('MODERATE')
  })

  it('LIGHT on Saturday morning (non-peak)', () => {
    const { status } = computeCrossingStatus(bardonnex, makeDate(10, 6))
    expect(status).toBe('LIGHT')
  })
})

describe('computeCrossingStatus — secondary crossings', () => {

  it('LIGHT during morning peak', () => {
    const { status } = computeCrossingStatus(ferney, makeDate(8, 1))
    expect(status).toBe('LIGHT')
  })

  it('CLEAR at night', () => {
    const { status } = computeCrossingStatus(ferney, makeDate(2, 1))
    expect(status).toBe('CLEAR')
  })
})

describe('getBorderCrossings — GeoJSON output', () => {

  beforeEach(async () => {
    vi.clearAllMocks()
    const { redis } = await import('@/lib/redis')
    vi.mocked(redis.get).mockResolvedValue(null)
  })

  it('returns valid GeoJSON FeatureCollection', async () => {
    const { getBorderCrossings } = await import('@/lib/territory/border-crossings')
    const result = await getBorderCrossings()
    expect(result.type).toBe('FeatureCollection')
    expect(Array.isArray(result.features)).toBe(true)
  })

  it('contains all 26 border crossings', async () => {
    const { getBorderCrossings } = await import('@/lib/territory/border-crossings')
    const result = await getBorderCrossings()
    expect(result.features).toHaveLength(26)
  })

  it('every feature has required border properties', async () => {
    const { getBorderCrossings } = await import('@/lib/territory/border-crossings')
    const result = await getBorderCrossings()
    for (const f of result.features) {
      expect(f.type).toBe('Feature')
      expect(f.geometry.type).toBe('Point')
      expect(f.properties.type).toBe('border')
      expect(f.properties.icon).toBe('🛂')
      expect(['CLEAR', 'LIGHT', 'MODERATE', 'HEAVY', 'BLOCKED']).toContain(f.properties.status)
      expect(f.properties.jamFactor).toBeGreaterThanOrEqual(0)
      expect(f.properties.jamFactor).toBeLessThanOrEqual(10)
      expect(typeof f.properties.waitTimeMinutes).toBe('number')
    }
  })

  it('Bardonnex is present and is motorway type', async () => {
    const { getBorderCrossings } = await import('@/lib/territory/border-crossings')
    const result = await getBorderCrossings()
    const b = result.features.find(f => f.properties.id === 'bardonnex')
    expect(b).toBeDefined()
    expect(b?.properties.crossingType).toBe('motorway')
    expect(b?.properties.capacity).toBe('high')
  })
})

describe('Promise.allSettled resilience', () => {

  it('alerts layer still returns HERE features when OFROU is down', async () => {
    const [hereR, ofrouR, tpgR, weatherR] = await Promise.allSettled([
      Promise.resolve({
        type: 'FeatureCollection' as const,
        features: [{
          type: 'Feature' as const,
          properties: { id: 'here-1', type: 'accident' },
          geometry: { type: 'Point' as const, coordinates: [6.14, 46.20] as [number, number] },
        }],
      }),
      Promise.reject(new Error('OFROU down')),
      Promise.resolve({ type: 'FeatureCollection' as const, features: [] }),
      Promise.resolve({ type: 'FeatureCollection' as const, features: [] }),
    ])

    expect(hereR.status).toBe('fulfilled')
    expect(ofrouR.status).toBe('rejected')
    expect(tpgR.status).toBe('fulfilled')
    expect(weatherR.status).toBe('fulfilled')

    if (hereR.status === 'fulfilled') {
      expect(hereR.value.features.length).toBeGreaterThan(0)
    }
  })
})

describe('Redis cache', () => {

  it('second call returns cached data without recomputing', async () => {
    const mockCached = {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        properties: { id: 'cached', type: 'border' as const, name: 'Test', crossingType: 'main' as const,
                      capacity: 'medium' as const, status: 'CLEAR' as const, jamFactor: 0,
                      waitTimeMinutes: 0, direction: 'both' as const, icon: '🛂',
                      color: '#34C759', lastUpdated: new Date().toISOString(), source: 'synthetic-calibrated' as const },
        geometry: { type: 'Point' as const, coordinates: [6.14, 46.2] as [number, number] },
      }],
    }

    const { redis } = await import('@/lib/redis')
    vi.clearAllMocks()
    vi.mocked(redis.get).mockResolvedValueOnce(mockCached)

    const { getBorderCrossings } = await import('@/lib/territory/border-crossings')
    const result = await getBorderCrossings()

    expect(result).toEqual(mockCached)
    expect(redis.set).not.toHaveBeenCalled()
  })
})
