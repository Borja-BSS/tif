import { redis }       from '@/lib/redis'
import { logger }      from '@/lib/logger'
import { geocodeStop } from './stop-geocoder'
import type { TpgDisruption } from './types'

const CACHE_KEY = 'tif:tpg:disruptions'
const CACHE_TTL = 120  // 2 minutes

const TPG_URLS = [
  'https://www.tpg.ch/fr/info-trafic-en-live',
  'https://www.tpg.ch/fr/node/4056',
]

const TYPE_MAP: Record<string, TpgDisruption['type']> = {
  travaux:      'travaux',
  deviation:    'deviation',
  suppression:  'suppression',
  retard:       'retard',
  perturbation: 'perturbation',
}

function normalizeType(raw: string): TpgDisruption['type'] {
  const key = raw
    .toLowerCase()
    .replace(/é|è|ê/g, 'e')
    .replace(/[̀-ͯ]/g, '')
  return TYPE_MAP[key] ?? 'perturbation'
}

function extractStops(description: string): string[] {
  const stops: string[] = []
  const patterns = [
    /arr[eê]t\s+([A-ZÀ-Ÿa-zà-ÿ0-9\s\-']{3,35}?)(?=\s+(?:en|est|ne|n'|dans|,|\.))/gi,
    /station\s+([A-ZÀ-Ÿa-zà-ÿ0-9\s\-']{3,35}?)(?=\s+(?:en|est|ne|n'|dans|,|\.))/gi,
  ]
  for (const pattern of patterns) {
    for (const m of description.matchAll(pattern)) {
      const stop = m[1].trim()
      if (stop.length >= 3) stops.push(stop)
    }
  }
  return [...new Set(stops)]
}

function parseHtmlDisruptions(html: string): Omit<TpgDisruption, 'coordinates'>[] {
  const disruptions: Omit<TpgDisruption, 'coordinates'>[] = []
  let idCounter = 0

  // Pattern: "2 - Travaux - Description..." or "Ligne 5 - Déviation - ..."
  const linePattern =
    /(?:Ligne\s+)?(\d+[A-Z]?|[A-Z])\s*[-–]\s*(Travaux|D[eé]viation|Suppression|Retard|Perturbation)\s*[-–]\s*([^<\n]{5,300})/gi

  for (const m of html.matchAll(linePattern)) {
    const lineNumber  = m[1].trim()
    const typeRaw     = m[2]
    const description = m[3].trim()
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

    // Only include valid bus/tram line numbers (1–25 or letter codes)
    if (/^(\d{1,2}[A-Z]?|[A-Z])$/.test(lineNumber)) {
      disruptions.push({
        id:            `tpg-${lineNumber}-${++idCounter}`,
        lineNumber,
        type:          normalizeType(typeRaw),
        description,
        affectedStops: extractStops(description),
        direction:     undefined,
      })
    }
  }

  return disruptions
}

export async function getTpgDisruptions(): Promise<TpgDisruption[]> {
  try {
    const cached = await redis.get<TpgDisruption[]>(CACHE_KEY)
    if (cached) return cached
  } catch (err) {
    logger.warn({ err }, 'tpg-disruptions:redis-get-failed')
  }

  let html = ''
  for (const url of TPG_URLS) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'TIF-Monitor/1.0 (G7 Geneva 2026)' },
        signal:  AbortSignal.timeout(10_000),
        cache:   'no-store',
      })
      if (res.ok) {
        html = await res.text()
        break
      }
    } catch (err) {
      logger.warn({ err, url }, 'tpg-disruptions:fetch-failed')
    }
  }

  if (!html) {
    logger.warn('tpg-disruptions:no-html — returning empty')
    return []
  }

  const raw = parseHtmlDisruptions(html)
  logger.debug({ count: raw.length }, 'tpg-disruptions:parsed')

  // Geocode first available stop for each disruption
  const withCoords: TpgDisruption[] = await Promise.all(
    raw.map(async (d) => {
      let coordinates: [number, number] | undefined
      for (const stop of d.affectedStops) {
        const coords = await geocodeStop(stop)
        if (coords) { coordinates = coords; break }
      }
      return { ...d, coordinates }
    })
  )

  try {
    await redis.set(CACHE_KEY, withCoords, { ex: CACHE_TTL })
  } catch (err) {
    logger.warn({ err }, 'tpg-disruptions:redis-set-failed')
  }

  return withCoords
}
