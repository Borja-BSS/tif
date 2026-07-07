import { NextResponse }         from 'next/server'
import { redis }               from '@/lib/redis'
import { getVehiclePositions } from '@/lib/transport/vehicle-positions'
import { getTpgDisruptions }   from '@/lib/transport/tpg-disruptions'
import { getCffDisruptions }   from '@/lib/transport/cff-disruptions'
import { withMetrics }         from '@/lib/route-utils'
import type { NextRequest }    from 'next/server'
import type { TransportLayerResponse } from '@/lib/transport/types'

export const dynamic = 'force-dynamic'

const CACHE_KEY = 'tif:layer:transport:v2'
const CACHE_TTL = 15

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] }

async function handler(_req: NextRequest): Promise<NextResponse> {
  try {
    const cached = await redis.get<TransportLayerResponse>(CACHE_KEY)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=15', 'X-Cache': 'HIT' },
      })
    }
  } catch { /* redis miss — continue */ }

  const [vehiclesResult, tpgResult, cffResult] = await Promise.allSettled([
    getVehiclePositions(),
    getTpgDisruptions(),
    getCffDisruptions(),
  ])

  const vehicles = vehiclesResult.status === 'fulfilled'
    ? vehiclesResult.value
    : { tpg: EMPTY_FC, cff: EMPTY_FC, generatedAt: new Date().toISOString() }

  const response: TransportLayerResponse = {
    vehicles: {
      tpg: vehicles.tpg,
      cff: vehicles.cff,
    },
    disruptions: {
      tpg: tpgResult.status === 'fulfilled' ? tpgResult.value : [],
      cff: cffResult.status === 'fulfilled' ? cffResult.value : [],
    },
    generatedAt: new Date().toISOString(),
    sources: {
      vehicles: vehiclesResult.status,
      tpg:      tpgResult.status,
      cff:      cffResult.status,
    },
  }

  try {
    await redis.set(CACHE_KEY, response, { ex: CACHE_TTL })
  } catch { /* ignore */ }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
  })
}

export const GET = withMetrics('/api/v1/layers/transport', handler)
