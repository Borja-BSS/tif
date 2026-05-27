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
  // CEVA / Léman Express (L1-L5)
  if (/^L[1-5]$/.test(r)) return 'ceva'
  // CFF intercity / EC / TGV / RER
  if (/^(IC|IR|RE|EC|TGV|S)\d/.test(r)) return 'train'
  if (r.startsWith('IR ') || r.startsWith('IC ') || r.startsWith('RE ')) return 'train'
  // Long routeId = CFF
  if (r.length > 6) return 'train'
  // TPG trams (Geneva specific lines)
  if (/^(T?)?(12|14|15|18)$/.test(r)) return 'tram'
  // Default: TPG bus
  return 'bus'
}

function emptyFC(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
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
    logger.warn('vehicles:no-api-key')
    const generatedAt = new Date().toISOString()
    return { tpg: emptyFC(), cff: emptyFC(), generatedAt }
  }

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
      },
      geometry: { type: 'Point' as const, coordinates: [lng, lat] },
    }

    if (vehicleType === 'bus' || vehicleType === 'tram') {
      tpgFeatures.push(feature)
    } else {
      cffFeatures.push(feature)
    }
  }

  const result: VehicleSplit = {
    tpg: { type: 'FeatureCollection', features: tpgFeatures },
    cff: { type: 'FeatureCollection', features: cffFeatures },
    generatedAt: new Date().toISOString(),
  }

  try {
    await redis.set(CACHE_KEY, result, { ex: CACHE_TTL })
  } catch (err) {
    logger.warn({ err }, 'vehicles:redis-set-failed')
  }

  logger.debug({ tpg: tpgFeatures.length, cff: cffFeatures.length }, 'vehicles:fetched')
  return result
}
