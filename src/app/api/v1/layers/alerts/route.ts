import { NextResponse }       from 'next/server'
import { getIncidents }      from '@/lib/here/incidents'
import { redis }             from '@/lib/redis'
import { withMetrics }       from '@/lib/route-utils'
import type { NextRequest }  from 'next/server'

export const dynamic = 'force-dynamic'

const CACHE_KEY = 'tif:layer:alerts'
const CACHE_TTL = 60

async function handler(_req: NextRequest): Promise<NextResponse> {
  const cached = await redis.get<string>(CACHE_KEY)
  if (cached) {
    const data: unknown = typeof cached === 'string' ? JSON.parse(cached) : cached
    return NextResponse.json(data, { headers: { 'X-Cache': 'HIT' } })
  }

  const data = await getIncidents()
  await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(data))

  return NextResponse.json(data, { headers: { 'X-Cache': 'MISS' } })
}

export const GET = withMetrics('/api/v1/layers/alerts', handler)
