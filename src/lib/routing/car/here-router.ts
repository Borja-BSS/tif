// Car routing via OSRM (Open Source Routing Machine / OpenStreetMap)
// Public demo server — no API key needed, real road geometry
// https://project-osrm.org
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

export interface CarRouteRequest {
  from: { lat: number; lng: number }
  to:   { lat: number; lng: number }
  departureTime?: string
  avoidAreas?:    string[]
}

export interface RouteStep {
  instruction: string
  duration:    number
  distance:    number
  coordinates: [number, number][]
}

export interface CarRoute {
  id:      string
  summary: {
    duration:          number   // secondes
    durationInTraffic: number
    distance:          number   // mètres
    arrivalTime:       string
  }
  steps:        RouteStep[]
  geometry:     [number, number][]  // [lng, lat] pour Mapbox
  trafficDelay: number
  alternative:  boolean
  warnings:     string[]
}

export async function calculateCarRoute(req: CarRouteRequest): Promise<CarRoute[]> {
  // OSRM: coords are lng,lat
  const coords = `${req.from.lng},${req.from.lat};${req.to.lng},${req.to.lat}`
  const url     = new URL(`${OSRM_BASE}/${coords}`)
  url.searchParams.set('overview',     'full')
  url.searchParams.set('geometries',   'geojson')
  url.searchParams.set('steps',        'false')
  url.searchParams.set('alternatives', 'true')

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
  if (!res.ok) return fallback(req)

  const data = await res.json() as OsrmResponse
  if (data.code !== 'Ok' || !data.routes?.length) return fallback(req)

  return data.routes.map((route, idx) => {
    const duration = Math.round(route.duration)
    const distance = Math.round(route.distance)
    return {
      id:      `route-${idx}`,
      summary: {
        duration,
        durationInTraffic: duration,  // OSRM ne donne pas le trafic live
        distance,
        arrivalTime: new Date(Date.now() + duration * 1000).toISOString(),
      },
      steps:        [],
      geometry:     route.geometry.coordinates as [number, number][],
      trafficDelay: 0,
      alternative:  idx > 0,
      warnings:     [],
    }
  })
}

// Gardé pour les routes qui évitent des zones — sans impact visuel
export async function getActiveIncidentAreas(): Promise<string[]> {
  return []
}

// ── Fallback ligne droite si OSRM down ───────────────────────────────────────
function fallback(req: CarRouteRequest): CarRoute[] {
  const dist = haversine(req.from, req.to)
  const dur  = Math.round((dist / 1000 / 40) * 3600)  // estimation 40 km/h
  return [{
    id:      'fallback-0',
    summary: {
      duration: dur, durationInTraffic: dur, distance: dist,
      arrivalTime: new Date(Date.now() + dur * 1000).toISOString(),
    },
    steps:        [],
    geometry:     [[req.from.lng, req.from.lat], [req.to.lng, req.to.lat]],
    trafficDelay: 0,
    alternative:  false,
    warnings:     ['Service de routage temporairement indisponible'],
  }]
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R    = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const x    = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

// ── OSRM response types ───────────────────────────────────────────────────────
interface OsrmResponse {
  code:    string
  routes?: OsrmRoute[]
}

interface OsrmRoute {
  duration: number
  distance: number
  geometry: { type: 'LineString'; coordinates: number[][] }
  legs:     { duration: number; distance: number }[]
}
