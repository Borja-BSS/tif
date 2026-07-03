// Car routing via Mapbox Directions API
// https://docs.mapbox.com/api/navigation/directions/

const MAPBOX_BASE = 'https://api.mapbox.com/directions/v5/mapbox/driving'

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
    duration:          number
    durationInTraffic: number
    distance:          number
    arrivalTime:       string
  }
  steps:        RouteStep[]
  geometry:     [number, number][]
  trafficDelay: number
  alternative:  boolean
  warnings:     string[]
  blockedCrossing?: string
}

interface MapboxRoute {
  duration: number
  distance: number
  geometry: { type: 'LineString'; coordinates: number[][] }
  legs:     unknown[]
}

interface MapboxResponse {
  code:    string
  routes?: MapboxRoute[]
}

// ── Genève Triathlon — routes fermées (samedi 4 → dimanche 5 juillet 2026) ────
// Rampe de Cologny, Chemin du Petray, Quai de Cologny — fermées dans les deux sens.
// On les EXCLUT du calcul d'itinéraire (Mapbox exclude=point) sans rien dessiner
// sur la carte : le routage évite ces axes, aucune trace de route fermée n'est ajoutée.
const TRIATHLON_CLOSURE_START = new Date('2026-07-04T02:00:00Z') // samedi 04h00 (CEST)
const TRIATHLON_CLOSURE_END   = new Date('2026-07-05T15:00:00Z') // dimanche 17h00 (CEST)

function isTriathlonClosure(now = new Date()): boolean {
  return now >= TRIATHLON_CLOSURE_START && now <= TRIATHLON_CLOSURE_END
}

// Points à éviter, sur les routes fermées (lng, lat)
const TRIATHLON_CLOSURE_POINTS: [number, number][] = [
  [6.1735, 46.2080], // Quai de Cologny
  [6.1710, 46.2065], // Rampe de Cologny
  [6.1725, 46.2120], // Chemin du Petray
]

// ── Geometry utilities ────────────────────────────────────────────────────────

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R    = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const x    = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

// Returns a waypoint perpendicular to the from→to midpoint.
// side=1 shifts left, side=-1 shifts right (relative to travel direction).
function perpendicularWaypoint(
  from: { lat: number; lng: number },
  to:   { lat: number; lng: number },
  side: 1 | -1,
): { lat: number; lng: number } {
  const dist        = haversine(from, to)
  const offsetM     = Math.min(Math.max(dist * 0.18, 1200), 6000) * side

  const midLat      = (from.lat + to.lat) / 2
  const midLng      = (from.lng + to.lng) / 2
  const cosLat      = Math.cos(midLat * Math.PI / 180)

  const dLat        = to.lat - from.lat
  const dLng        = (to.lng - from.lng) * cosLat
  const len         = Math.sqrt(dLat * dLat + dLng * dLng) || 1

  const perpLat     = (-dLng / len) * (offsetM / 111320)
  const perpLng     = ( dLat / len) * (offsetM / 111320) / cosLat

  return { lat: midLat + perpLat, lng: midLng + perpLng }
}

// Returns true if two geometries share roughly the same midpoint (< ~250 m apart).
function geometrySimilar(a: [number, number][], b: [number, number][]): boolean {
  const aMid = a[Math.floor(a.length / 2)]
  const bMid = b[Math.floor(b.length / 2)]
  if (!aMid || !bMid) return true
  return haversine({ lat: aMid[1], lng: aMid[0] }, { lat: bMid[1], lng: bMid[0] }) < 250
}

// ── Mapbox Directions API call ────────────────────────────────────────────────

async function fetchMapboxRoutes(
  from:          { lat: number; lng: number },
  to:            { lat: number; lng: number },
  token:         string,
  waypoints:     { lat: number; lng: number }[],
  excludePoints: [number, number][],
): Promise<MapboxRoute[]> {
  const points = [
    `${from.lng},${from.lat}`,
    ...waypoints.map(w => `${w.lng},${w.lat}`),
    `${to.lng},${to.lat}`,
  ]

  const url = new URL(`${MAPBOX_BASE}/${points.join(';')}`)
  url.searchParams.set('alternatives', waypoints.length === 0 ? 'true' : 'false')
  url.searchParams.set('geometries',   'geojson')
  url.searchParams.set('overview',     'full')
  url.searchParams.set('steps',        'false')
  url.searchParams.set('access_token', token)
  // Évite les routes fermées du triathlon (max 50 points côté Mapbox)
  if (excludePoints.length) {
    url.searchParams.set('exclude', excludePoints.map(p => `point(${p[0]} ${p[1]})`).join(','))
  }

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'TIF-App/1.0' },
    })
    if (!res.ok) return []
    const data = await res.json() as MapboxResponse
    if (data.code !== 'Ok' || !data.routes?.length) return []
    return data.routes
  } catch {
    return []
  }
}

// ── Fallback: straight line when all APIs fail ────────────────────────────────
function fallback(req: CarRouteRequest): CarRoute[] {
  const dist = haversine(req.from, req.to)
  const dur  = Math.round((dist / 1000 / 40) * 3600)
  return [{
    id: 'fallback-0',
    summary: {
      duration: dur, durationInTraffic: dur, distance: dist,
      arrivalTime: new Date(Date.now() + dur * 1000).toISOString(),
    },
    steps: [],
    geometry: [[req.from.lng, req.from.lat], [req.to.lng, req.to.lat]],
    trafficDelay: 0, alternative: false,
    warnings: ['Service de routage temporairement indisponible'],
  }]
}

// ── Build a CarRoute from a MapboxRoute ───────────────────────────────────────
function toCarRoute(
  r:            MapboxRoute,
  id:           string,
  alternative:  boolean,
  extraWarning?: string,
): CarRoute {
  const geometry = r.geometry.coordinates as [number, number][]
  const warnings: string[] = []
  if (extraWarning) warnings.unshift(extraWarning)
  return {
    id,
    summary: {
      duration:          Math.round(r.duration),
      durationInTraffic: Math.round(r.duration),
      distance:          Math.round(r.distance),
      arrivalTime:       new Date(Date.now() + r.duration * 1000).toISOString(),
    },
    steps: [], geometry, trafficDelay: 0,
    alternative, warnings,
  }
}

// ── Main export ────────────────────────────────────────────────────────────────
export async function calculateCarRoute(req: CarRouteRequest): Promise<CarRoute[]> {
  const now           = new Date()
  const excludePoints = isTriathlonClosure(now) ? TRIATHLON_CLOSURE_POINTS : []

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) return fallback(req)

  // Primary call (alternatives) — les routes fermées triathlon sont exclues.
  const primary = await fetchMapboxRoutes(req.from, req.to, token, [], excludePoints)
  if (!primary.length) return fallback(req)

  const valid: CarRoute[] = primary.map((r, idx) => toCarRoute(r, `route-${idx}`, idx > 0))

  // Complète jusqu'à 3 itinéraires via des waypoints perpendiculaires.
  if (valid.length < 2) {
    const wp      = perpendicularWaypoint(req.from, req.to, 1)
    const altData = await fetchMapboxRoutes(req.from, req.to, token, [wp], excludePoints)
    if (altData.length) {
      const candidate = toCarRoute(altData[0], 'route-alt-1', true, 'Via centre-ville')
      if (!geometrySimilar(candidate.geometry, valid[0].geometry)) valid.push(candidate)
    }
  }

  if (valid.length < 3) {
    const wp      = perpendicularWaypoint(req.from, req.to, -1)
    const altData = await fetchMapboxRoutes(req.from, req.to, token, [wp], excludePoints)
    if (altData.length) {
      const candidate = toCarRoute(altData[0], 'route-alt-2', true, 'Itinéraire alternatif')
      if (!valid.some(v => geometrySimilar(candidate.geometry, v.geometry))) valid.push(candidate)
    }
  }

  if (valid.length === 0) return fallback(req)

  return valid.map((r, i) => ({ ...r, alternative: i > 0 }))
}

export async function getActiveIncidentAreas(): Promise<string[]> {
  return isTriathlonClosure() ? ['triathlon-closure'] : []
}
