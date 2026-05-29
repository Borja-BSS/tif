import { NextResponse }        from 'next/server'
import { getWazeIncidents }   from '@/lib/waze/incidents'
import { withMetrics }        from '@/lib/route-utils'
import { logger }             from '@/lib/logger'
import type { NextRequest }   from 'next/server'

export const dynamic = 'force-dynamic'

async function handler(_req: NextRequest): Promise<NextResponse> {
  try {
    const data = await getWazeIncidents()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=90, stale-while-revalidate=180' },
    })
  } catch (err) {
    // L'endpoint Waze étant non officiel, on failsafe silencieusement
    logger.warn({ err }, 'waze:route:failed — returning empty collection')
    return NextResponse.json(
      { type: 'FeatureCollection', features: [] },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}

export const GET = withMetrics('/api/v1/layers/waze', handler)
