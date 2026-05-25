// GTFS-RT feed opentransportdata.swiss — format JSON (Accept: application/json)
// Même structure que ingest-sbb.ts : { entity: [{ vehicle: {...} }] }

const GTFS_RT_URL = 'https://api.opentransportdata.swiss/gtfs-rt/vehicleposition'

const BBOX = { latMin: 46.05, latMax: 46.45, lngMin: 5.85, lngMax: 6.60 }

type VehicleType = 'train' | 'tram' | 'bus'

type VehicleFeature = {
  type:       'Feature'
  properties: {
    id:          string
    routeId:     string
    vehicleType: VehicleType
    speed:       number
    bearing:     number
    color:       string
    timestamp:   number | null
  }
  geometry: {
    type:        'Point'
    coordinates: [number, number]
  }
}

export type VehicleFeatureCollection = {
  type:        'FeatureCollection'
  features:    VehicleFeature[]
  generatedAt: string
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

function detectVehicleType(routeId: string): VehicleType {
  if (routeId.includes('IC') || routeId.includes('IR') || routeId.includes('RE') || routeId.length > 6) return 'train'
  if (/^(1|2|10|12|14|15|18)$/.test(routeId)) return 'tram'
  return 'bus'
}

const VEHICLE_COLOR: Record<VehicleType, string> = {
  train: '#0040FF',
  tram:  '#FF9500',
  bus:   '#34C759',
}

export async function getVehiclePositions(): Promise<VehicleFeatureCollection> {
  const apiKey = process.env.OPENTRANSPORT_API_KEY

  if (!apiKey) {
    return { type: 'FeatureCollection', features: [], generatedAt: new Date().toISOString() }
  }

  const res = await fetch(GTFS_RT_URL, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept':        'application/json',
    },
    signal: AbortSignal.timeout(10000),
    next:   { revalidate: 15 },
  })

  if (!res.ok) throw new Error(`GTFS-RT ${res.status}`)

  const feed = await res.json() as GtfsFeed

  const features: VehicleFeature[] = (feed.entity ?? []).flatMap(
    (entity): VehicleFeature[] => {
      const pos = entity.vehicle?.position
      if (!pos) return []

      const { latitude: lat, longitude: lng } = pos
      if (lat < BBOX.latMin || lat > BBOX.latMax || lng < BBOX.lngMin || lng > BBOX.lngMax) return []

      const routeId     = entity.vehicle?.trip?.routeId ?? ''
      const vehicleType = detectVehicleType(routeId)

      return [{
        type:       'Feature',
        properties: {
          id:          entity.id,
          routeId,
          vehicleType,
          speed:       pos.speed ?? 0,
          bearing:     pos.bearing ?? 0,
          color:       VEHICLE_COLOR[vehicleType],
          timestamp:   entity.vehicle?.timestamp ?? null,
        },
        geometry: { type: 'Point', coordinates: [lng, lat] },
      }]
    },
  )

  return { type: 'FeatureCollection', features, generatedAt: new Date().toISOString() }
}
