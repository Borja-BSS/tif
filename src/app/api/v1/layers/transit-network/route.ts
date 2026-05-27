import { NextResponse }      from 'next/server'
import { getTransitNetwork } from '@/lib/transit/network'
import { withMetrics }       from '@/lib/route-utils'
import type { NextRequest }  from 'next/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

// Long max-age: routes change rarely, Redis handles freshness
const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
}

async function handler(_req: NextRequest): Promise<NextResponse> {
  const network = await getTransitNetwork()
  return NextResponse.json(network, { headers: CACHE_HEADERS })
}

export const GET = withMetrics('/api/v1/layers/transit-network', handler)
