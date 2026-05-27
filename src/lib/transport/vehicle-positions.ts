import { redis }  from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { FeatureCollection } from 'geojson'
import type { ExtendedVehicleType, VehicleSplit } from './types'

const GTFS_RT_URL = 'https://api.opentransportdata.swiss/gtfs-rt/vehicleposition'
const BBOX        = { latMin: 46.05, latMax: 46.45, lngMin: 5.85, lngMax: 6.60 }
const CACHE_KEY   = 'tif:layer:vehicles:v2'
const CACHE_TTL   = 15

const VEHICLE_COLOR: Record<ExtendedVehicleType, string> = {
  train: '#0040FF',
  tram:  '#FF9500',
  bus:   '#34C759',
  ceva:  '#AF52DE',
}

interface GtfsVehiclePosition {
  vehicle?: {
    position?: { latitude: number; longitude: number; speed?: number; bearing?: number }
    trip?:     { routeId?: string; tripId?: string }
    vehicle?:  { id?: string }
    timestamp?: number
  }
}

interface GtfsFeed {
  entity?: ({ id: string } & GtfsVehiclePosition)[]
}

function detectVehicleType(routeId: string): ExtendedVehicleType {
  const r = routeId.trim().toUpperCase()
  if (/^L[1-5]$/.test(r)) return 'ceva'
  if (/^(IC|IR|RE|EC|TGV|S)\d/.test(r)) return 'train'
  if (r.startsWith('IR ') || r.startsWith('IC ') || r.startsWith('RE ')) return 'train'
  if (r.length > 6) return 'train'
  if (/^(T?)?(12|14|15|18)$/.test(r)) return 'tram'
  return 'bus'
}

function emptyFC(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}

// ── Simulated vehicles for demo / when GTFS-RT unavailable ───────────────────
// Mirrors the axes used in ingest-sbb.ts for consistency
const SIM_AXES: [number, number, ExtendedVehicleType, string][] = [
  // Tram 12 : Annemasse ↔ Cornavin
  [46.1942, 6.2234, 'tram', '12'], [46.2020, 6.2050, 'tram', '12'],
  [46.2080, 6.1900, 'tram', '12'], [46.2180, 6.1420, 'tram', '12'],
  // Tram 15 : Palettes ↔ Nations
  [46.1750, 6.1100, 'tram', '15'], [46.1900, 6.1300, 'tram', '15'],
  [46.2300, 6.1450, 'tram', '15'],
  // Bus 10 : Rive ↔ Aéroport
  [46.2010, 6.1510, 'bus', '10'], [46.2200, 6.1100, 'bus', '10'],
  [46.2380, 6.1090, 'bus', '10'],
  // Bus 5 : Genève ↔ Onex
  [46.1980, 6.1500, 'bus', '5'], [46.1880, 6.1300, 'bus', '5'],
  // CEVA L1 : Coppet ↔ Annemasse
  [46.2180, 6.1420, 'ceva', 'L1'], [46.2050, 6.1300, 'ceva', 'L1'],
  [46.1870, 6.1150, 'ceva', 'L1'], [46.2310, 6.1090, 'ceva', 'L1'],
  // CFF IC 1
  [46.2101, 6.1425, 'train', 'IC 1'], [46.3167, 6.1833, 'train', 'IC 1'],
  // RE 1 : Genève ↔ Lausanne
  [46.2101, 6.1425, 'train', 'RE 1'], [46.2600, 6.1800, 'train', 'RE 1'],
]

function buildSimulatedVehicles(): VehicleSplit {
  const tpgFeatures: FeatureCollection['features'] = []
  const cffFeatures: FeatureCollection['features'] = []

  SIM_AXES.forEach(([baseLat, baseLng, type, routeId], i) => {
    const lat = baseLat + (Math.random() - 0.5) * 0.004
    const lng = baseLng + (Math.random() - 0.5) * 0.004
    const speed = 10 + Math.random() * 50

    const feature = {
      type: 'Feature' as const,
      properties: {
        id:          `sim-${i}`,
        routeId,
        vehicleType: type,
        speed,
        bearing:     Math.random() * 360,
        color:       VEHICLE_COLOR[type],
        timestamp:   null,
        isCEVA:      type === 'ceva',
        source:      'simulated',
      },
      geometry: { type: 'Point' as const, coordinates: [lng, lat] },
    }

    if (type === 'bus' || type === 'tram') tpgFeatures.push(feature)
    else cffFeatures.push(feature)
  })

  return {
    tpg: { type: 'FeatureCollection', features: tpgFeatures },
    cff: { type: 'FeatureCollection', features: cffFeatures },
    generatedAt: new Date().toISOString(),
  }
}

export async function getVehiclePositions(): Promise<VehicleSplit> {
  try {
    const cached = await redis.get<VehicleSplit>(CACHE_KEY)
    if (cached) return cached
  } catch (err) {
    logger.warn({ err }, 'vehicles:redis-get-failed')
  }

  const apiKey = process.env.OPENTRANSPORT_API_KEY

  if (!apiKey) {
    logger.warn('vehicles:no-api-key — using simulated positions')
    const result = buildSimulatedVehicles()
    try { await redis.set(CACHE_KEY, result, { ex: CACHE_TTL }) } catch { /* ignore */ }
    return result
  }

  try {
    const res = await fetch(GTFS_RT_URL, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept':        'application/json',
      },
      signal: AbortSignal.timeout(10_000),
      cache:  'no-store',
    })

    if (!res.ok) throw new Error(`GTFS-RT ${res.status}`)

    const feed = await res.json() as GtfsFeed
    const tpgFeatures: FeatureCollection['features'] = []
    const cffFeatures: FeatureCollection['features'] = []

    for (const entity of feed.entity ?? []) {
      const pos = entity.vehicle?.position
      if (!pos) continue

      const { latitude: lat, longitude: lng } = pos
      if (lat < BBOX.latMin || lat > BBOX.latMax || lng < BBOX.lngMin || lng > BBOX.lngMax) continue

      const routeId     = entity.vehicle?.trip?.routeId ?? ''
      const vehicleType = detectVehicleType(routeId)

      const feature = {
        type: 'Feature' as const,
        properties: {
          id:          entity.id,
          routeId:     routeId || '?',
          vehicleType,
          speed:       pos.speed ?? 0,
          bearing:     pos.bearing ?? 0,
          color:       VEHICLE_COLOR[vehicleType],
          timestamp:   entity.vehicle?.timestamp ?? null,
          isCEVA:      vehicleType === 'ceva',
          source:      'gtfs-rt',
        },
        geometry: { type: 'Point' as const, coordinates: [lng, lat] },
      }

      if (vehicleType === 'bus' || vehicleType === 'tram') tpgFeatures.push(feature)
      else cffFeatures.push(feature)
    }

    // Fallback to simulated if GTFS-RT returned nothing in the area
    if (tpgFeatures.length === 0 && cffFeatures.length === 0) {
      logger.warn('vehicles:gtfs-rt-empty — using simulated positions')
      const result = buildSimulatedVehicles()
      try { await redis.set(CACHE_KEY, result, { ex: CACHE_TTL }) } catch { /* ignore */ }
      return result
    }

    const result: VehicleSplit = {
      tpg: { type: 'FeatureCollection', features: tpgFeatures },
      cff: { type: 'FeatureCollection', features: cffFeatures },
      generatedAt: new Date().toISOString(),
    }

    try { await redis.set(CACHE_KEY, result, { ex: CACHE_TTL }) } catch (err) {
      logger.warn({ err }, 'vehicles:redis-set-failed')
    }

    logger.debug({ tpg: tpgFeatures.length, cff: cffFeatures.length }, 'vehicles:gtfs-rt-fetched')
    return result

  } catch (err) {
    logger.warn({ err }, 'vehicles:fetch-failed — using simulated positions')
    const result = buildSimulatedVehicles()
    try { await redis.set(CACHE_KEY, result, { ex: CACHE_TTL }) } catch { /* ignore */ }
    return result
  }
}
