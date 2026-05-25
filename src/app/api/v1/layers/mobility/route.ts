import { NextResponse }       from 'next/server'
import { getTrafficFlow }    from '@/lib/here/traffic-flow'
import { redis }             from '@/lib/redis'
import { withMetrics }       from '@/lib/route-utils'
import type { NextRequest }  from 'next/server'

export const dynamic = 'force-dynamic'

const CACHE_KEY = 'tif:layer:mobility'
const CACHE_TTL = 30

async function handler(_req: NextRequest): Promise<NextResponse> {
  const cached = await redis.get<string>(CACHE_KEY)
  if (cached) {
    const data: unknown = typeof cached === 'string' ? JSON.parse(cached) : cached
    return NextResponse.json(data, { headers: { 'X-Cache': 'HIT' } })
  }

  const data = await getTrafficFlow()
  await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(data))

  return NextResponse.json(data, { headers: { 'X-Cache': 'MISS' } })
}

export const GET = withMetrics('/api/v1/layers/mobility', handler)
