// Car routing via OSRM (Open Source Routing Machine / OpenStreetMap)
// https://project-osrm.org
import { IMPACT_ZONES } from '@/data/impact-zones'

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

// ── G7 / A1 date helpers ──────────────────────────────────────────────────────

// A1 fermée du 14 au 17 juin inclus (minuit CH)
function isA1ClosurePeriod(now = new Date()): boolean {
  const d = now.toLocaleDateString('fr-CH', { timeZone: 'Europe/Zurich' })
  return ['14.06.2026','15.06.2026','16.06.2026','17.06.2026'].includes(d)
}

// Manifestation NO-G7 : uniquement le 14 juin
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

// ── Point-dans-polygone (ray casting) ────────────────────────────────────────
// Coordonnées en [lng, lat] — cohérent avec GeoJSON et OSRM
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

// ── Vérification douane bloquée ───────────────────────────────────────────────
function findBlockedCrossing(
  geometry: [number, number][],
  blocked:  typeof BLOCKED_CROSSINGS,
): (typeof BLOCKED_CROSSINGS)[0] | null {
  for (const pt of geometry) {
    for (const c of blocked) {
      if (haversine({ lat: pt[1], lng: pt[0] }, c) < 350) return c
    }
  }
  return null
}

// ── Vérification zone manifestation ──────────────────────────────────────────
function routePassesThroughManifestationZone(geometry: [number, number][]): boolean {
  const zone = IMPACT_ZONES.find(z => z.id === 'no-g7-manifestation')
  if (!zone) return false
  // Vérifie 1 point sur 5 pour des performances (zone large, précision suffisante)
  for (let i = 0; i < geometry.length; i += 5) {
    if (pointInPolygon(geometry[i], zone.coordinates)) return true
  }
  return false
}

// ── Calcul du trajet ──────────────────────────────────────────────────────────
export async function calculateCarRoute(req: CarRouteRequest): Promise<CarRoute[]> {
  const now          = new Date()
  const a1Closed     = isA1ClosurePeriod(now)
  const manifestation = isManifestationDay(now)
  const g7           = isG7Period(now)

  const coords = `${req.from.lng},${req.from.lat};${req.to.lng},${req.to.lat}`
  const url    = new URL(`${OSRM_BASE}/${coords}`)
  url.searchParams.set('overview',     'full')
  url.searchParams.set('geometries',   'geojson')
  url.searchParams.set('steps',        'false')
  url.searchParams.set('alternatives', 'true')

  // 14–17 juin : exclure autoroutes → évite la A1 dès le calcul
  if (a1Closed) url.searchParams.set('exclude', 'motorway')

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
  if (!res.ok) return fallback(req, a1Closed)

  const data = await res.json() as OsrmResponse
  if (data.code !== 'Ok' || !data.routes?.length) return fallback(req, a1Closed)

  const routes: CarRoute[] = data.routes.map((route, idx) => {
    const duration = Math.round(route.duration)
    const distance = Math.round(route.distance)
    const geometry = route.geometry.coordinates as [number, number][]
    const warnings: string[] = []
    let blockedCrossing: string | undefined

    if (g7) {
      // Douane bloquée sur le tracé ?
      const blocked = findBlockedCrossing(geometry, BLOCKED_CROSSINGS)
      if (blocked) {
        blockedCrossing = blocked.id
        warnings.push(`🚫 Route via "${blocked.id}" — douane fermée 12–18 juin`)
      }
    }

    if (a1Closed) {
      warnings.push('⛔ A1 fermée 14–17 juin — Itinéraire sans autoroute')
    }

    // Zone manifestation (14 juin uniquement)
    if (manifestation && routePassesThroughManifestationZone(geometry)) {
      warnings.push('⚠️ Itinéraire traverse la zone de manifestation NO-G7 — perturbations importantes attendues')
    }

    return {
      id: `route-${idx}`,
      summary: {
        duration, durationInTraffic: duration, distance,
        arrivalTime: new Date(Date.now() + duration * 1000).toISOString(),
      },
      steps: [], geometry, trafficDelay: 0,
      alternative: idx > 0, warnings, blockedCrossing,
    }
  })

  // Filtrer les routes passant par une douane fermée
  const validRoutes = routes.filter(r => !r.blockedCrossing)

  if (validRoutes.length === 0) {
    return routes.map(r => ({
      ...r,
      warnings: ['🚫 Aucun itinéraire libre — toutes les douanes sur ce trajet sont fermées', ...r.warnings],
    }))
  }

  return validRoutes
}

export async function getActiveIncidentAreas(): Promise<string[]> {
  return isG7Period() ? ['g7-active'] : []
}

// ── Fallback ligne droite si OSRM down ────────────────────────────────────────
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

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R    = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const x    = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

interface OsrmResponse {
  code:    string
  routes?: { duration: number; distance: number; geometry: { type: 'LineString'; coordinates: number[][] }; legs: unknown[] }[]
}
