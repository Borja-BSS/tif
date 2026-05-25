import { NextResponse }       from 'next/server'
import { getIncidents }      from '@/lib/here/incidents'
import { redis }             from '@/lib/redis'
import { withMetrics }       from '@/lib/route-utils'
import type { NextRequest }  from 'next/server'

export const dynamic = 'force-dynamic'

const CACHE_KEY     = 'tif:layer:territory'
const CACHE_TTL     = 60
const TERRITORY_TYPES = new Set(['roadClosure', 'construction', 'plannedEvent'])

async function handler(_req: NextRequest): Promise<NextResponse> {
  const cached = await redis.get<string>(CACHE_KEY)
  if (cached) {
    const data: unknown = typeof cached === 'string' ? JSON.parse(cached) : cached
    return NextResponse.json(data, { headers: { 'X-Cache': 'HIT' } })
  }

  const all  = await getIncidents()
  const data = {
    ...all,
    features: all.features.filter(f => TERRITORY_TYPES.has(f.properties.type)),
  }

  await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(data))

  return NextResponse.json(data, { headers: { 'X-Cache': 'MISS' } })
}

export const GET = withMetrics('/api/v1/layers/territory', handler)
