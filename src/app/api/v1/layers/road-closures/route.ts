import { NextResponse }      from 'next/server'
import { getRoadClosures }  from '@/lib/here/road-closures'
import { withMetrics }      from '@/lib/route-utils'
import { logger }           from '@/lib/logger'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

async function handler(_req: NextRequest): Promise<NextResponse> {
  try {
    const data = await getRoadClosures()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (err) {
    logger.warn({ err }, 'road-closures:handler-failed')
    return NextResponse.json(
      { type: 'FeatureCollection', features: [], generatedAt: new Date().toISOString() },
      { status: 200 },
    )
  }
}

export const GET = withMetrics('/api/v1/layers/road-closures', handler)
