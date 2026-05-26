import { redis }  from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { FeatureCollection, Feature, Point } from 'geojson'

const RSS_URL   = 'https://www.tcs.ch/fr/tools/routenplaner/verkehrsmeldungen.php'
const CACHE_KEY = 'tif:ofrou:incidents'
const CACHE_TTL = 300
const TIMEOUT   = 8_000

const BBOX = { latMin: 46.05, latMax: 46.45, lngMin: 5.85, lngMax: 6.60 }

const GE_KEYWORDS = [
  'genève', 'geneve', 'gex', 'annemasse', 'bardonnex', 'meyrin',
  'ferney', 'carouge', 'thônex', 'thonex', 'lancy', 'onex',
  'a40', 'a1 genève', 'mont-blanc', 'arve',
]

export interface OfrouProperties {
  id:          string
  type:        'ofrou'
  criticality: 'major' | 'minor' | 'lowImpact'
  description: string
  icon:        string
  color:       string
  startTime:   string
  endTime:     string | null
  source:      'OFROU'
}

export type OfrouFeatureCollection = FeatureCollection<Point, OfrouProperties>

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`,
    'i',
  )
  const m = re.exec(xml)
  return (m?.[1] ?? m?.[2] ?? '').trim()
}

function extractAllItems(rss: string): string[] {
  const items: string[] = []
  const re = /<item>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(rss)) !== null) items.push(m[1])
  return items
}

function isGenevaRelated(text: string): boolean {
  const lower = text.toLowerCase()
  return GE_KEYWORDS.some(k => lower.includes(k))
}

function parseSeverity(title: string, desc: string): OfrouProperties['criticality'] {
  const t = (title + desc).toLowerCase()
  if (t.includes('fermée') || t.includes('fermeture') || t.includes('accident')) return 'major'
  if (t.includes('ralentissement') || t.includes('travaux'))                      return 'minor'
  return 'lowImpact'
}

function severityColor(c: OfrouProperties['criticality']): string {
  return c === 'major' ? '#FF3B30' : c === 'minor' ? '#FF9500' : '#FFCC00'
}

function extractCoords(text: string): { lat: number; lng: number } | null {
  const geoRe = /<georss:point>([\d.]+)\s+([\d.]+)<\/georss:point>/i.exec(text)
  if (geoRe) return { lat: parseFloat(geoRe[1]), lng: parseFloat(geoRe[2]) }

  const latRe = /lat[=:\s"']+([\d.]+)/i.exec(text)
  const lngRe = /lo?ng?[=:\s"']+([\d.]+)/i.exec(text)
  if (latRe && lngRe) return { lat: parseFloat(latRe[1]), lng: parseFloat(lngRe[1]) }
  return null
}

function inBbox(lat: number, lng: number): boolean {
  return lat >= BBOX.latMin && lat <= BBOX.latMax && lng >= BBOX.lngMin && lng <= BBOX.lngMax
}

function fallbackCoords(text: string): { lat: number; lng: number } {
  const lower = text.toLowerCase()
  if (lower.includes('bardonnex') || lower.includes('a40')) return { lat: 46.1547, lng: 6.0890 }
  if (lower.includes('meyrin'))                              return { lat: 46.2156, lng: 6.0721 }
  if (lower.includes('ferney'))                              return { lat: 46.2567, lng: 6.1079 }
  return { lat: 46.2044, lng: 6.1432 }
}

function parseRss(rss: string): Feature<Point, OfrouProperties>[] {
  return extractAllItems(rss).flatMap((item, i): Feature<Point, OfrouProperties>[] => {
    const title   = extractTag(item, 'title')
    const desc    = extractTag(item, 'description')
    const pubDate = extractTag(item, 'pubDate')
    const guid    = extractTag(item, 'guid') || `ofrou-${i}`

    const combined = `${title} ${desc}`
    if (!isGenevaRelated(combined)) return []

    const raw    = extractCoords(item)
    let coords: { lat: number; lng: number }

    if (raw && inBbox(raw.lat, raw.lng)) {
      coords = raw
    } else if (raw) {
      return []
    } else {
      coords = fallbackCoords(combined)
    }

    const criticality = parseSeverity(title, desc)

    return [{
      type:       'Feature',
      properties: {
        id:          guid,
        type:        'ofrou',
        criticality,
        description: title || desc,
        icon:        criticality === 'major' ? '🚨' : '🚧',
        color:       severityColor(criticality),
        startTime:   pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        endTime:     null,
        source:      'OFROU',
      },
      geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
    }]
  })
}

export async function getOfrouIncidents(): Promise<OfrouFeatureCollection> {
  const cached = await redis.get<OfrouFeatureCollection>(CACHE_KEY)
  if (cached) return cached

  try {
    const res = await fetch(RSS_URL, {
      signal:  AbortSignal.timeout(TIMEOUT),
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    })

    if (!res.ok) {
      logger.warn({ status: res.status }, 'ofrou:rss:http-error')
      return { type: 'FeatureCollection', features: [] }
    }

    const xml      = await res.text()
    const features = parseRss(xml)
    const result: OfrouFeatureCollection = { type: 'FeatureCollection', features }

    await redis.set(CACHE_KEY, result, { ex: CACHE_TTL })
    logger.debug({ count: features.length }, 'ofrou:incidents:fetched')
    return result

  } catch (err) {
    logger.warn({ err }, 'ofrou:rss:fetch-failed')
    return { type: 'FeatureCollection', features: [] }
  }
}
