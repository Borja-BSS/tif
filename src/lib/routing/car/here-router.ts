import { redis } from '@/lib/redis'

const HERE_ROUTING_BASE = 'https://router.hereapi.com/v8'

export interface CarRouteRequest {
  from: { lat: number; lng: number }
  to:   { lat: number; lng: number }
  departureTime?: string
  avoidAreas?: string[]
}

export interface RouteStep {
  instruction: string
  duration:    number
  distance:    number
  coordinates: [number, number][]
}

export interface CarRoute {
  id: string
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
}

export async function calculateCarRoute(req: CarRouteRequest): Promise<CarRoute[]> {
  const url = new URL(`${HERE_ROUTING_BASE}/routes`)
  url.searchParams.set('apiKey', process.env.HERE_API_KEY!)
  url.searchParams.set('origin',        `${req.from.lat},${req.from.lng}`)
  url.searchParams.set('destination',   `${req.to.lat},${req.to.lng}`)
  url.searchParams.set('transportMode', 'car')
  url.searchParams.set('routingMode',   'fast')
  url.searchParams.set('departureTime', req.departureTime ?? 'now')
  url.searchParams.set('return',        'polyline,summary,actions,instructions')
  url.searchParams.set('alternatives',  '2')

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })

  if (!res.ok) return calculateCarRouteFallback(req)

  const data = await res.json()

  return (data.routes ?? []).map((route: Record<string, unknown>, idx: number) => {
    const sections = route.sections as Record<string, unknown>[] | undefined
    const section  = sections?.[0] ?? {}
    const summary  = (section.summary as Record<string, unknown>) ?? {}

    return {
      id: `route-${idx}`,
      summary: {
        duration:          Number(summary.duration ?? 0),
        durationInTraffic: Number(summary.duration ?? 0),
        distance:          Number(summary.length   ?? 0),
        arrivalTime:       String(summary.arrivalTime ?? new Date().toISOString()),
      },
      steps:        parseHereActions((section.actions as Record<string, unknown>[]) ?? []),
      geometry:     decodeHerePolyline(String(section.polyline ?? '')),
      trafficDelay: Number((summary as Record<string, unknown>).delay ?? 0),
      alternative:  idx > 0,
      warnings:     extractWarnings((section.notices as Record<string, unknown>[]) ?? []),
    }
  })
}

export async function getActiveIncidentAreas(): Promise<string[]> {
  const keys = await redis.keys('tif:consensus:*')
  const incidentZones: string[] = []

  for (const key of keys.slice(0, 20)) {
    const raw = await redis.get(key)
    if (!raw) continue
    const consensus = JSON.parse(raw as string) as Record<string, unknown>
    if (
      (consensus.realityStatus === 'HEAVY' || consensus.realityStatus === 'BLOCKED')
      && Number(consensus.confidence ?? 0) > 0.65
    ) {
      incidentZones.push(String(consensus.geohash6 ?? ''))
    }
  }

  return incidentZones.filter(Boolean)
}

function calculateCarRouteFallback(req: CarRouteRequest): CarRoute[] {
  const duration = estimateDuration(req.from, req.to)
  return [{
    id: 'fallback-0',
    summary: {
      duration,
      durationInTraffic: duration,
      distance:          estimateDistance(req.from, req.to),
      arrivalTime:       new Date(Date.now() + duration * 1000).toISOString(),
    },
    steps:        [],
    geometry:     [[req.from.lng, req.from.lat], [req.to.lng, req.to.lat]],
    trafficDelay: 0,
    alternative:  false,
    warnings:     ['Données trafic temps réel indisponibles'],
  }]
}

function estimateDuration(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  return Math.round((estimateDistance(from, to) / 1000 / 40) * 3600)
}

function estimateDistance(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const R    = 6371000
  const dLat = (to.lat - from.lat) * Math.PI / 180
  const dLng = (to.lng - from.lng) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function parseHereActions(actions: Record<string, unknown>[]): RouteStep[] {
  return actions.map(action => ({
    instruction: String(action.instruction ?? ''),
    duration:    Number(action.duration   ?? 0),
    distance:    Number(action.length     ?? 0),
    coordinates: [],
  }))
}

function decodeHerePolyline(encoded: string): [number, number][] {
  if (!encoded) return []
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { decode } = require('@here/flexpolyline') as { decode: (s: string) => { polyline: [number, number][] } }
    const { polyline } = decode(encoded)
    return polyline.map(([lat, lng]: [number, number]) => [lng, lat])
  } catch {
    return []
  }
}

function extractWarnings(notices: Record<string, unknown>[]): string[] {
  return notices
    .filter(n => n.code !== 'violation')
    .map(n => String(n.title ?? ''))
    .filter(Boolean)
}
