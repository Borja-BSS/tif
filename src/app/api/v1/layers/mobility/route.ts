import { NextResponse }      from 'next/server'
import { getTrafficFlow }   from '@/lib/here/traffic-flow'
import { withMetrics }      from '@/lib/route-utils'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

async function handler(_req: NextRequest): Promise<NextResponse> {
  const data = await getTrafficFlow()
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  })
}

export const GET = withMetrics('/api/v1/layers/mobility', handler)
