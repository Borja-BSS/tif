import { NextResponse }    from 'next/server'
import { withMetrics }     from '@/lib/route-utils'
import { redis }           from '@/lib/redis'
import { logger }          from '@/lib/logger'
import type { NextRequest } from 'next/server'
import type { FeatureCollection, Feature, Point } from 'geojson'

export const dynamic = 'force-dynamic'

const CACHE_KEY = 'tif:layer:construction:v1'
const CACHE_TTL = 300  // 5 min

// Grand Genève + Vaud + Haute-Savoie
const BBOX = '45.85,5.70,46.60,7.10'

const QUERY = `
[out:json][timeout:12];
(
  way["highway"="construction"](${BBOX});
  way["construction"~"."](${BBOX});
  node["highway"="construction"](${BBOX});
  relation["construction"~"."](${BBOX});
);
out center tags 100;
`.trim()

export interface ConstructionProperties {
  id:          string
  name:        string
  type:        string
  description: string
  source:      'OSM'
  startTime:   string
}

async function handler(_req: NextRequest): Promise<NextResponse> {
  try {
    const cached = await redis.get<FeatureCollection>(CACHE_KEY)
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'public, s-maxage=300' } })
  } catch { /* redis miss */ }

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    `data=${encodeURIComponent(QUERY)}`,
      signal:  AbortSignal.timeout(16000),
    })

    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)

    const data = await res.json() as { elements: Array<{
      type: string; id: number
      lat?: number; lon?: number
      center?: { lat: number; lon: number }
      tags?: Record<string, string>
    }> }

    const features: Feature<Point, ConstructionProperties>[] = data.elements
      .filter(el => el.lat != null || el.center != null)
      .map(el => {
        const lat  = el.lat ?? el.center!.lat
        const lng  = el.lon ?? el.center!.lon
        const tags = el.tags ?? {}
        const name = tags.name ?? tags.description ?? tags.ref ?? ''
        const constrType = tags.construction ?? tags.highway ?? 'travaux'
        const desc = name
          ? `🚧 Travaux — ${name}`
          : `🚧 Chantier en cours (${constrType})`

        return {
          type: 'Feature' as const,
          properties: {
            id:          `osm-${el.id}`,
            name:        name || 'Chantier',
            type:        constrType,
            description: desc,
            source:      'OSM' as const,
            startTime:   new Date().toISOString(),
          },
          geometry: { type: 'Point' as const, coordinates: [lng, lat] },
        }
      })

    const fc: FeatureCollection = { type: 'FeatureCollection', features }

    try { await redis.set(CACHE_KEY, fc, { ex: CACHE_TTL }) } catch { /* ignore */ }

    logger.info({ count: features.length }, 'construction:fetched')
    return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })

  } catch (err) {
    logger.warn({ err }, 'construction:overpass-failed')
    return NextResponse.json({ type: 'FeatureCollection', features: [] })
  }
}

export const GET = withMetrics('/api/v1/layers/construction', handler)
