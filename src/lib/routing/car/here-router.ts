// Car routing via OSRM (Open Source Routing Machine / OpenStreetMap)
// Public demo server — no API key needed, real road geometry
// https://project-osrm.org
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

// Bardonnex crossing center — used for proximity detection
const BARDONNEX = { lat: 46.1618, lng: 6.0972 }

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

// ── G7 date helpers ────────────────────────────────────────────────────────────
function isNOG7Day(now = new Date()): boolean {
  const d = new Date(now).toLocaleDateString('fr-CH', { timeZone: 'Europe/Zurich' })
  return d === '14.06.2026'
}

function isG7Period(now = new Date()): boolean {
  return now >= new Date('2026-06-12T00:00:00Z') && now <= new Date('2026-06-18T23:59:59Z')
}

// Détection approximative si la destination est côté France (Bardonnex area)
function passesProbablyViaBardonnex(from: { lat: number; lng: number }, to: { lat: number; lng: number }): boolean {
  // Si l'une des extrémités est dans la zone franco-genevoise au sud
  const inZone = (p: { lat: number; lng: number }) =>
    p.lat < 46.18 && p.lat > 45.90 && p.lng > 5.90 && p.lng < 6.15
  return inZone(from) || inZone(to)
}

export async function calculateCarRoute(req: CarRouteRequest): Promise<CarRoute[]> {
  const now     = new Date()
  const nog7    = isNOG7Day(now)
  const g7      = isG7Period(now)
  const bardonnexRisk = passesProbablyViaBardonnex(req.from, req.to)

  // OSRM: coords are lng,lat
  const coords = `${req.from.lng},${req.from.lat};${req.to.lng},${req.to.lat}`
  const url     = new URL(`${OSRM_BASE}/${coords}`)
  url.searchParams.set('overview',     'full')
  url.searchParams.set('geometries',   'geojson')
  url.searchParams.set('steps',        'false')
  url.searchParams.set('alternatives', 'true')

  // Le 14.06 : exclure les autoroutes → évite la A1 et Bardonnex
  if (nog7) {
    url.searchParams.set('exclude', 'motorway')
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
  if (!res.ok) return fallback(req)

  const data = await res.json() as OsrmResponse
  if (data.code !== 'Ok' || !data.routes?.length) return fallback(req)

  return data.routes.map((route, idx) => {
    const duration = Math.round(route.duration)
    const distance = Math.round(route.distance)

    const warnings: string[] = []
    if (nog7) {
      warnings.push('⛔ A1 fermée — Itinéraire via routes alternatives')
      if (bardonnexRisk) warnings.push('🚫 Douane de Bardonnex fermée')
    } else if (g7 && bardonnexRisk) {
      warnings.push('⚠️ Contrôles renforcés — Prévoir +30 min')
    }

    return {
      id:      `route-${idx}`,
      summary: {
        duration,
        durationInTraffic: duration,
        distance,
        arrivalTime: new Date(Date.now() + duration * 1000).toISOString(),
      },
      steps:        [],
      geometry:     route.geometry.coordinates as [number, number][],
      trafficDelay: 0,
      alternative:  idx > 0,
      warnings,
    }
  })
}

export async function getActiveIncidentAreas(): Promise<string[]> {
  const now = new Date()
  if (!isNOG7Day(now)) return []
  // Retourne les zones bloquées comme identifiants pour le frontend
  return ['a1-bardonnex', 'no-g7-perimeter']
}

// ── Fallback ligne droite si OSRM down ───────────────────────────────────────
function fallback(req: CarRouteRequest): CarRoute[] {
  const dist = haversine(req.from, req.to)
  const dur  = Math.round((dist / 1000 / 40) * 3600)
  const warnings: string[] = isNOG7Day()
    ? ['⛔ A1 fermée — Vérifiez votre itinéraire manuellement', 'Service de routage temporairement indisponible']
    : ['Service de routage temporairement indisponible']
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
    warnings,
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
