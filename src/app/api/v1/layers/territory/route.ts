import { NextResponse }        from 'next/server'
import { getIncidents }       from '@/lib/here/incidents'
import { getBorderCrossings } from '@/lib/territory/border-crossings'
import { withMetrics }        from '@/lib/route-utils'
import { redis }              from '@/lib/redis'
import { logger }             from '@/lib/logger'
import type { NextRequest }   from 'next/server'
import type { FeatureCollection, Feature, Point } from 'geojson'

export const dynamic = 'force-dynamic'

const CACHE_KEY     = 'tif:layer:territory:merged'
const CACHE_TTL     = 60
const TERRITORY_TYPES = new Set(['roadClosure', 'construction', 'plannedEvent'])

async function handler(_req: NextRequest): Promise<NextResponse> {
  const cached = await redis.get<FeatureCollection>(CACHE_KEY)
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  }

  const [hereResult, borderResult] = await Promise.allSettled([
    getIncidents(),
    getBorderCrossings(),
  ])

  const features: Feature<Point>[] = []

  if (borderResult.status === 'fulfilled') {
    features.push(...borderResult.value.features as Feature<Point>[])
  } else {
    logger.warn({ err: borderResult.reason }, 'territory:merge:border-failed')
  }

  if (hereResult.status === 'fulfilled') {
    const hereFeatures = hereResult.value.features.filter(
      f => TERRITORY_TYPES.has(f.properties.type),
    )
    features.push(...hereFeatures as Feature<Point>[])
  } else {
    logger.warn({ err: hereResult.reason }, 'territory:merge:here-failed')
  }

  const data: FeatureCollection = {
    type:        'FeatureCollection',
    features,
    generatedAt: new Date().toISOString(),
  } as FeatureCollection & { generatedAt: string }

  await redis.set(CACHE_KEY, data, { ex: CACHE_TTL })

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}

export const GET = withMetrics('/api/v1/layers/territory', handler)
