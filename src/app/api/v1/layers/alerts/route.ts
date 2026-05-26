import { NextResponse }           from 'next/server'
import { getIncidents }          from '@/lib/here/incidents'
import { getOfrouIncidents }     from '@/lib/alerts/ofrou-fetcher'
import { getTpgDisruptions }     from '@/lib/alerts/tpg-disruptions'
import { getWeatherImpactAlerts }from '@/lib/alerts/weather-impact'
import { withMetrics }           from '@/lib/route-utils'
import { redis }                 from '@/lib/redis'
import { logger }                from '@/lib/logger'
import type { NextRequest }      from 'next/server'
import type { FeatureCollection, Feature, Point } from 'geojson'

export const dynamic = 'force-dynamic'

const CACHE_KEY = 'tif:layer:alerts:merged'
const CACHE_TTL = 60

// Two features are considered duplicates if they're within ~200m
function areDuplicates(
  a: Feature<Point>,
  b: Feature<Point>,
): boolean {
  const [lngA, latA] = a.geometry.coordinates
  const [lngB, latB] = b.geometry.coordinates
  const dlat = (latA - latB) * 111_000
  const dlng = (lngA - lngB) * 111_000 * Math.cos((latA * Math.PI) / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng) < 200
}

function deduplicateFeatures(features: Feature<Point>[]): Feature<Point>[] {
  const out: Feature<Point>[] = []
  for (const f of features) {
    if (!out.some(existing => areDuplicates(existing, f))) {
      out.push(f)
    }
  }
  return out
}

async function handler(_req: NextRequest): Promise<NextResponse> {
  try {
    const cached = await redis.get<FeatureCollection>(CACHE_KEY)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      })
    }
  } catch (err) {
    logger.warn({ err }, 'alerts:redis-get-failed — skipping cache')
  }

  const [hereResult, ofrouResult, tpgResult, weatherResult] = await Promise.allSettled([
    getIncidents(),
    getOfrouIncidents(),
    getTpgDisruptions(),
    getWeatherImpactAlerts(),
  ])

  const allFeatures: Feature<Point>[] = []

  if (hereResult.status === 'fulfilled') {
    allFeatures.push(...hereResult.value.features as Feature<Point>[])
  } else {
    logger.warn({ err: hereResult.reason }, 'alerts:merge:here-failed')
  }

  if (ofrouResult.status === 'fulfilled') {
    allFeatures.push(...ofrouResult.value.features as Feature<Point>[])
  } else {
    logger.warn({ err: ofrouResult.reason }, 'alerts:merge:ofrou-failed')
  }

  if (tpgResult.status === 'fulfilled') {
    allFeatures.push(...tpgResult.value.features as Feature<Point>[])
  } else {
    logger.warn({ err: tpgResult.reason }, 'alerts:merge:tpg-failed')
  }

  if (weatherResult.status === 'fulfilled') {
    allFeatures.push(...weatherResult.value.features as Feature<Point>[])
  } else {
    logger.warn({ err: weatherResult.reason }, 'alerts:merge:weather-failed')
  }

  const features = deduplicateFeatures(allFeatures)
  const data: FeatureCollection = { type: 'FeatureCollection', features }

  try {
    await redis.set(CACHE_KEY, data, { ex: CACHE_TTL })
  } catch (err) {
    logger.warn({ err }, 'alerts:redis-set-failed — skipping cache write')
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}

export const GET = withMetrics('/api/v1/layers/alerts', handler)
