// Car routing via Mapbox Directions API
// https://docs.mapbox.com/api/navigation/directions/
import { IMPACT_ZONES } from '@/data/impact-zones'

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

// ── G7 / A1 date helpers ──────────────────────────────────────────────────────

function isA1ClosurePeriod(now = new Date()): boolean {
  const d = now.toLocaleDateString('fr-CH', { timeZone: 'Europe/Zurich' })
  return ['14.06.2026','15.06.2026','16.06.2026','17.06.2026'].includes(d)
}

function isManifestationDay(now = new Date()): boolean {
  return now.toLocaleDateString('fr-CH', { timeZone: 'Europe/Zurich' }) === '14.06.2026'
}

function isG7Period(now = new Date()): boolean {
  return now >= new Date('2026-06-11T22:01:00Z') && now <= new Date('2026-06-18T21:59:00Z')
}

// ── Douanes ouvertes pendant G7 ───────────────────────────────────────────────
const G7_OPEN_IDS = new Set([
  'bardonnex','thonex-vallard','moillesulaz','meyrin','ferney-voltaire',
  'perly','anieres','divonne','leaz','la-cure','vallorbe',
  'bois-d-amont','les-hopitaux-neufs','saint-Laurent','douvaine','thonon',
])

const ALL_CROSSINGS_COORDS = [
  { id: 'bardonnex',          lat: 46.14952,    lng: 6.09693   },
  { id: 'thonex-vallard',     lat: 46.18811,    lng: 6.20277   },
  { id: 'moillesulaz',        lat: 46.19224,    lng: 6.20643   },
  { id: 'meyrin',             lat: 46.2347,     lng: 6.0505    },
  { id: 'ferney-voltaire',    lat: 46.25005,    lng: 6.11905   },
  { id: 'perly',              lat: 46.15234,    lng: 6.09103   },
  { id: 'anieres',            lat: 46.26932,    lng: 6.23901   },
  { id: 'croix-de-rozon',     lat: 46.14351,    lng: 6.13836   },
  { id: 'veyrier',            lat: 46.16631,    lng: 6.18840   },
  { id: 'fossard',            lat: 46.18365,    lng: 6.19501   },
  { id: 'mategnin',           lat: 46.24378,    lng: 6.09237   },
  { id: 'mon-idee',           lat: 46.2021,     lng: 6.2242    },
  { id: 'monniaz',            lat: 46.2415,     lng: 6.3083    },
  { id: 'chancy',             lat: 46.14442,    lng: 5.96583   },
  { id: 'avully',             lat: 46.1618,     lng: 5.9778    },
  { id: 'la-plaine',          lat: 46.17737,    lng: 5.99153   },
  { id: 'communaux-ambilly',  lat: 46.1982,     lng: 6.2118    },
  { id: 'hermance',           lat: 46.30283,    lng: 6.24758   },
  { id: 'soral',              lat: 46.1433,     lng: 6.0451    },
  { id: 'mandement',          lat: 46.20189,    lng: 5.97185   },
  { id: 'dardagny',           lat: 46.19006,    lng: 5.98203   },
  { id: 'valleiry',           lat: 46.13365,    lng: 5.97748   },
  { id: 'avusy',              lat: 46.14275,    lng: 6.00882   },
  { id: 'avusy-sezegnin',     lat: 46.14277,    lng: 6.00879   },
  { id: 'soral-mangons',      lat: 46.14263,    lng: 6.04700   },
  { id: 'pas-de-lechelle',    lat: 46.16643,    lng: 6.18843   },
  { id: 'landecy',            lat: 46.1430,     lng: 6.1270    },
  { id: 'bossey',             lat: 46.15483,    lng: 6.16090   },
  { id: 'troinex',            lat: 46.1545,     lng: 6.1613    },
  { id: 'compesieres',        lat: 46.1460,     lng: 6.1195    },
  { id: 'bernex',             lat: 46.15500,    lng: 6.04050   },
  { id: 'ecogia',             lat: 46.2350,     lng: 6.0278    },
  { id: 'veigy',              lat: 46.27652,    lng: 6.24683   },
  { id: 'prevessin-moens',    lat: 46.24578,    lng: 6.08200   },
  { id: 'sauverny',           lat: 46.3114,     lng: 6.1204    },
  { id: 'bois-chaton',        lat: 46.28697,    lng: 6.10456   },
  { id: 'versoix-ferney',     lat: 46.26085,    lng: 6.11977   },
  { id: 'annemasse-gaillard', lat: 46.1930,     lng: 6.2068    },
  { id: 'saint-julien',       lat: 46.15063,    lng: 6.08890   },
  { id: 'collonges',          lat: 46.1400,     lng: 6.1490    },
  { id: 'divonne',            lat: 46.34573,    lng: 6.15228   },
  { id: 'douvaine',           lat: 46.30283,    lng: 6.31200   },
  { id: 'thonon',             lat: 46.37609,    lng: 6.47516   },
]

const BLOCKED_CROSSINGS = ALL_CROSSINGS_COORDS.filter(c => !G7_OPEN_IDS.has(c.id))
const OPEN_CROSSINGS    = ALL_CROSSINGS_COORDS.filter(c =>  G7_OPEN_IDS.has(c.id))

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

  // Direction vector in degrees, latitude-corrected
  const dLat        = to.lat - from.lat
  const dLng        = (to.lng - from.lng) * cosLat
  const len         = Math.sqrt(dLat * dLat + dLng * dLng) || 1

  // Perpendicular (rotate 90°)
  const perpLat     = (-dLng / len) * (offsetM / 111320)
  const perpLng     = ( dLat / len) * (offsetM / 111320) / cosLat

  return { lat: midLat + perpLat, lng: midLng + perpLng }
}

// Returns true if two geometries share roughly the same midpoint (< ~200 m apart).
function geometrySimilar(a: [number, number][], b: [number, number][]): boolean {
  const aMid = a[Math.floor(a.length / 2)]
  const bMid = b[Math.floor(b.length / 2)]
  if (!aMid || !bMid) return true
  return haversine({ lat: aMid[1], lng: aMid[0] }, { lat: bMid[1], lng: bMid[0] }) < 250
}

// ── Point-in-polygon (ray casting) ───────────────────────────────────────────
function pointInPolygon(pt: [number, number], poly: [number, number][]): boolean {
  const [x, y] = pt
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

// ── Constraint checks ─────────────────────────────────────────────────────────

function findBlockedCrossing(
  geometry:        [number, number][],
  blocked:         typeof BLOCKED_CROSSINGS,
  excludeNearOpen?: { lat: number; lng: number },  // open crossing we're routing via
): (typeof BLOCKED_CROSSINGS)[0] | null {
  // When routing via a known open crossing, ignore blocked crossings within 1 km of it
  // (some open/closed crossings share the same physical location with different names)
  const effectiveBlocked = excludeNearOpen
    ? blocked.filter(c => haversine(c, excludeNearOpen) >= 1000)
    : blocked

  for (const pt of geometry) {
    for (const c of effectiveBlocked) {
      if (haversine({ lat: pt[1], lng: pt[0] }, c) < 500) return c
    }
  }
  return null
}

// Returns true if the STRAIGHT LINE from→to passes within 5 km of any known
// border crossing. This is the reliable cross-border detector: it works even
// when the actual road geometry takes a detour away from crossing coordinates.
function journeyLikelyCrossesBorder(
  from: { lat: number; lng: number },
  to:   { lat: number; lng: number },
): boolean {
  const dLat = to.lat - from.lat
  const dLng = to.lng - from.lng
  const lenSq = dLat * dLat + dLng * dLng
  if (lenSq === 0) return false

  for (const c of ALL_CROSSINGS_COORDS) {
    // Project c onto the segment from→to (t clamped to [0,1])
    const t    = Math.max(0, Math.min(1,
      ((c.lat - from.lat) * dLat + (c.lng - from.lng) * dLng) / lenSq,
    ))
    const proj = { lat: from.lat + t * dLat, lng: from.lng + t * dLng }
    if (haversine(c, proj) < 5000) return true  // within 5 km of direct path
  }
  return false
}

// Returns the N open crossings that add the least detour for a given journey.
function bestOpenCrossings(
  from: { lat: number; lng: number },
  to:   { lat: number; lng: number },
  n:    number,
): typeof OPEN_CROSSINGS {
  const direct = haversine(from, to)
  return [...OPEN_CROSSINGS]
    .map(c => ({ c, extra: haversine(from, c) + haversine(c, to) - direct }))
    .sort((a, b) => a.extra - b.extra)
    .slice(0, n)
    .map(x => x.c)
}

function routePassesThroughManifestationZone(geometry: [number, number][]): boolean {
  const zone = IMPACT_ZONES.find(z => z.id === 'no-g7-manifestation')
  if (!zone) return false
  for (let i = 0; i < geometry.length; i += 5) {
    if (pointInPolygon(geometry[i], zone.coordinates)) return true
  }
  return false
}

function buildWarnings(
  geometry:        [number, number][],
  g7:              boolean,
  a1Closed:        boolean,
  manifestation:   boolean,
  excludeNearOpen?: { lat: number; lng: number },
): { warnings: string[]; blockedCrossing?: string } {
  const warnings: string[] = []
  let blockedCrossing: string | undefined

  if (g7) {
    const blocked = findBlockedCrossing(geometry, BLOCKED_CROSSINGS, excludeNearOpen)
    if (blocked) {
      blockedCrossing = blocked.id
      warnings.push(`🚫 Route via "${blocked.id}" — douane fermée 12–18 juin`)
    }
  }

  if (a1Closed) {
    warnings.push('⛔ A1 fermée 14–17 juin — Itinéraire sans autoroute')
  }

  if (manifestation && routePassesThroughManifestationZone(geometry)) {
    warnings.push('⚠️ Traverse la zone de manifestation NO-G7 — perturbations importantes attendues')
  }

  return { warnings, blockedCrossing }
}

// ── Mapbox Directions API call ────────────────────────────────────────────────

async function fetchMapboxRoutes(
  from:      { lat: number; lng: number },
  to:        { lat: number; lng: number },
  token:     string,
  a1Closed:  boolean,
  waypoints: { lat: number; lng: number }[],
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
  if (a1Closed) url.searchParams.set('exclude', 'motorway')

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'TIF-G7-App/1.0' },
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
function fallback(req: CarRouteRequest, a1Closed: boolean): CarRoute[] {
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
    warnings: [
      ...(a1Closed ? ['⛔ A1 fermée 14–17 juin — Vérifiez votre itinéraire'] : []),
      'Service de routage temporairement indisponible',
    ],
  }]
}

// ── Human-readable labels for open crossings ──────────────────────────────────
const CROSSING_LABELS: Record<string, string> = {
  'bardonnex':       'Via Bardonnex',
  'thonex-vallard':  'Via Thônex-Vallard',
  'moillesulaz':     'Via Moillesulaz',
  'meyrin':          'Via Meyrin',
  'ferney-voltaire': 'Via Ferney-Voltaire',
  'perly':           'Via Perly',
  'anieres':         'Via Anières',
  'divonne':         'Via Divonne',
  'leaz':            'Via Léaz',
  'la-cure':         'Via La Cure',
  'vallorbe':        'Via Vallorbe',
  'bois-d-amont':    'Via Bois-d\'Amont',
  'les-hopitaux-neufs': 'Via Les Hôpitaux-Neufs',
  'saint-Laurent':   'Via Saint-Laurent',
  'douvaine':        'Via Douvaine',
  'thonon':          'Via Thonon',
}

// ── Build a CarRoute from a MapboxRoute ───────────────────────────────────────
function toCarRoute(
  r:               MapboxRoute,
  id:              string,
  alternative:     boolean,
  g7:              boolean,
  a1Closed:        boolean,
  manifestation:   boolean,
  extraWarning?:   string,
  excludeNearOpen?: { lat: number; lng: number },
): CarRoute {
  const geometry = r.geometry.coordinates as [number, number][]
  const { warnings, blockedCrossing } = buildWarnings(geometry, g7, a1Closed, manifestation, excludeNearOpen)
  if (extraWarning && !warnings.includes(extraWarning)) warnings.unshift(extraWarning)
  return {
    id,
    summary: {
      duration:          Math.round(r.duration),
      durationInTraffic: Math.round(r.duration),
      distance:          Math.round(r.distance),
      arrivalTime:       new Date(Date.now() + r.duration * 1000).toISOString(),
    },
    steps: [], geometry, trafficDelay: 0,
    alternative, warnings, blockedCrossing,
  }
}

// ── Main export ────────────────────────────────────────────────────────────────
export async function calculateCarRoute(req: CarRouteRequest): Promise<CarRoute[]> {
  const now          = new Date()
  const a1Closed     = isA1ClosurePeriod(now)
  const manifestation = isManifestationDay(now)
  const g7           = isG7Period(now)

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) return fallback(req, a1Closed)

  // ── Step 1: primary call ──────────────────────────────────────────────────────
  const primary = await fetchMapboxRoutes(req.from, req.to, token, a1Closed, [])
  if (!primary.length) return fallback(req, a1Closed)

  const candidates = primary.map((r, idx) =>
    toCarRoute(r, `route-${idx}`, idx > 0, g7, a1Closed, manifestation),
  )

  // Is this a cross-border journey? (straight line from→to passes near any crossing)
  const isCrossBorder = g7 && journeyLikelyCrossesBorder(req.from, req.to)

  // ── Step 2a: cross-border — route via open crossings ─────────────────────────
  if (isCrossBorder) {
    // Always route via explicit open crossings — never pre-populate from primary routes.
    // Primary Mapbox routes (no waypoint) may pass via unverified paths, won't carry
    // "Via Perly" labels, and can fill valid[] to 3 before any explicit crossing is tried.
    const valid: CarRoute[] = []
    const targets = bestOpenCrossings(req.from, req.to, 5)
    for (const crossing of targets) {
      if (valid.length >= 3) break

      const viaData = await fetchMapboxRoutes(req.from, req.to, token, a1Closed, [
        { lat: crossing.lat, lng: crossing.lng },
      ])
      if (!viaData.length) continue

      const label = CROSSING_LABELS[crossing.id] ?? `Via ${crossing.id}`
      const geo   = viaData[0].geometry.coordinates as [number, number][]

      // ⚠️ Do NOT run findBlockedCrossing on via-crossing routes.
      // Roads near the Franco-Swiss border run parallel to it and inevitably
      // pass close to other crossing coordinates, causing false positives.
      // Mapbox already guarantees the route passes through our chosen open
      // crossing when we supply it as a waypoint.
      const warnings: string[] = [label]
      if (a1Closed) warnings.push('⛔ A1 fermée 14–17 juin — Itinéraire sans autoroute')
      if (manifestation && routePassesThroughManifestationZone(geo)) {
        warnings.push('⚠️ Traverse la zone de manifestation NO-G7 — perturbations importantes attendues')
      }

      if (valid.some(v => geometrySimilar(geo, v.geometry))) continue

      valid.push({
        id:      `route-via-${crossing.id}`,
        summary: {
          duration:          Math.round(viaData[0].duration),
          durationInTraffic: Math.round(viaData[0].duration),
          distance:          Math.round(viaData[0].distance),
          arrivalTime:       new Date(Date.now() + viaData[0].duration * 1000).toISOString(),
        },
        steps: [], geometry: geo, trafficDelay: 0,
        alternative: valid.length > 0, warnings,
      })
    }

    if (valid.length === 0) {
      // All open-crossing routes failed — return primary Mapbox route with a warning
      // rather than a straight line. The route may pass through a closed crossing
      // but is far better than no route at all.
      const best = candidates[0]
      return [{
        ...best,
        id: 'route-0',
        alternative: false,
        warnings: [
          '⚠️ Itinéraire direct — vérifiez les conditions aux douanes avant de partir',
          ...best.warnings,
        ],
        blockedCrossing: undefined,
      }]
    }

    return valid.map((r, i) => ({ ...r, alternative: i > 0 }))
  }

  // ── Step 2b: domestic — perpendicular alternatives ───────────────────────────
  const valid: CarRoute[] = candidates.filter(r => !r.blockedCrossing)

  if (valid.length < 2) {
    const wp      = perpendicularWaypoint(req.from, req.to, 1)
    const altData = await fetchMapboxRoutes(req.from, req.to, token, a1Closed, [wp])
    if (altData.length) {
      const candidate = toCarRoute(
        altData[0], 'route-alt-1', true, g7, a1Closed, manifestation, 'Via centre-ville',
      )
      if (!candidate.blockedCrossing && !geometrySimilar(candidate.geometry, valid[0].geometry)) {
        valid.push(candidate)
      }
    }
  }

  if (valid.length < 3) {
    const wp      = perpendicularWaypoint(req.from, req.to, -1)
    const altData = await fetchMapboxRoutes(req.from, req.to, token, a1Closed, [wp])
    if (altData.length) {
      const candidate = toCarRoute(
        altData[0], 'route-safe', true, g7, a1Closed, manifestation, 'Évite les zones G7',
      )
      if (!candidate.blockedCrossing && !valid.some(v => geometrySimilar(candidate.geometry, v.geometry))) {
        valid.push(candidate)
      }
    }
  }

  if (valid.length === 0) {
    // Return the primary Mapbox route rather than a straight line
    return [{ ...candidates[0], id: 'route-0', alternative: false, blockedCrossing: undefined }]
  }

  return valid.map((r, i) => ({ ...r, alternative: i > 0 }))
}

export async function getActiveIncidentAreas(): Promise<string[]> {
  return isG7Period() ? ['g7-active'] : []
}
