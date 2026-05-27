import { redis }  from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { FeatureCollection, Feature, MultiLineString } from 'geojson'

const CACHE_KEY = 'tif:transit:network:v1'
const CACHE_TTL = 86_400  // 24h — routes change infrequently

// Grand Genève bounding box: south,west,north,east
const BBOX = '46.05,5.85,46.45,6.60'

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

// Overpass QL — all bus/tram/train routes in Grand Genève
const OVERPASS_QUERY = `
[out:json][timeout:45][bbox:${BBOX}];
(
  relation["type"="route"]["route"~"^(bus|tram|trolleybus|share_taxi)$"];
  relation["type"="route"]["route"~"^(train|rail|light_rail|subway|monorail)$"];
);
out geom;
`.trim()

export interface TransitRouteProperties {
  id:        number
  ref:       string      // line number e.g. "12", "IC 1", "L1"
  name:      string
  routeType: string      // tram, bus, train, light_rail
  operator:  string
  color:     string
  isCEVA:    boolean
  isRail:    boolean
}

export type TransitNetwork = FeatureCollection<MultiLineString, TransitRouteProperties>

interface OverpassWayMember {
  type:      'way'
  ref:       number
  role?:     string
  geometry?: { lat: number; lon: number }[]
}

interface OverpassRelation {
  type:    'relation'
  id:      number
  tags:    Record<string, string>
  members: ({ type: 'node'; ref: number } | OverpassWayMember)[]
}

interface OverpassResponse {
  elements: OverpassRelation[]
}

function defaultColor(routeType: string, name: string, ref: string): string {
  const combined = `${routeType} ${name} ${ref}`.toLowerCase()
  if (/léman|ceva|l[1-5]$/.test(combined)) return '#AF52DE'
  switch (routeType) {
    case 'tram':       return '#FF9500'
    case 'light_rail': return '#AF52DE'
    case 'train':
    case 'rail':
    case 'subway':     return '#0040FF'
    default:           return '#34C759'  // bus
  }
}

function parseOverpass(response: OverpassResponse): TransitNetwork {
  const features: Feature<MultiLineString, TransitRouteProperties>[] = []
  const seenIds = new Set<number>()

  for (const el of response.elements) {
    if (el.type !== 'relation') continue
    if (seenIds.has(el.id)) continue
    seenIds.add(el.id)

    const routeType = el.tags.route ?? 'bus'
    const ref       = el.tags.ref ?? el.tags.name ?? ''
    const name      = el.tags.name ?? ref
    const operator  = el.tags.operator ?? el.tags.network ?? ''
    const colour    = el.tags.colour ?? el.tags.color ?? ''
    const combined  = `${name} ${operator} ${ref}`.toLowerCase()
    const isCEVA    = /léman|ceva/.test(combined) || /^l[1-5]$/i.test(ref.trim())
    const isRail    = ['train', 'rail', 'light_rail', 'subway'].includes(routeType)
    const color     = colour || defaultColor(routeType, name, ref)

    // Collect way geometries → MultiLineString
    const coordinates: [number, number][][] = []
    for (const member of el.members) {
      if (member.type !== 'way') continue
      const way = member as OverpassWayMember
      if (!way.geometry?.length) continue
      coordinates.push(way.geometry.map(pt => [pt.lon, pt.lat]))
    }

    if (coordinates.length === 0) continue

    features.push({
      type: 'Feature',
      properties: { id: el.id, ref, name, routeType, operator, color, isCEVA, isRail },
      geometry:   { type: 'MultiLineString', coordinates },
    })
  }

  logger.debug({ count: features.length }, 'transit:network:parsed')
  return { type: 'FeatureCollection', features }
}

async function fetchFromOverpass(): Promise<TransitNetwork> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `data=${encodeURIComponent(OVERPASS_QUERY)}`,
        signal:  AbortSignal.timeout(50_000),
        cache:   'no-store',
      })
      if (!res.ok) throw new Error(`Overpass ${res.status}`)
      const data = await res.json() as OverpassResponse
      return parseOverpass(data)
    } catch (err) {
      logger.warn({ err, endpoint }, 'transit:network:overpass-failed — trying next')
    }
  }
  throw new Error('All Overpass endpoints failed')
}

export async function getTransitNetwork(): Promise<TransitNetwork> {
  try {
    const cached = await redis.get<TransitNetwork>(CACHE_KEY)
    if (cached) {
      logger.debug({ features: cached.features.length }, 'transit:network:cache-hit')
      return cached
    }
  } catch (err) {
    logger.warn({ err }, 'transit:network:redis-get-failed')
  }

  const network = await fetchFromOverpass()

  try {
    await redis.set(CACHE_KEY, network, { ex: CACHE_TTL })
  } catch (err) {
    logger.warn({ err }, 'transit:network:redis-set-failed')
  }

  return network
}
