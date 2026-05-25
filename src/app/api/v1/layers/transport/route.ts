import { NextResponse }             from 'next/server'
import { getVehiclePositions }      from '@/lib/transport/vehicle-positions'
import { withMetrics }              from '@/lib/route-utils'
import type { NextRequest }         from 'next/server'

export const dynamic = 'force-dynamic'

async function handler(_req: NextRequest): Promise<NextResponse> {
  const data = await getVehiclePositions()
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
  })
}

export const GET = withMetrics('/api/v1/layers/transport', handler)
