import { NextResponse }      from 'next/server'
import { getIncidents }     from '@/lib/here/incidents'
import { withMetrics }      from '@/lib/route-utils'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const TERRITORY_TYPES = new Set(['roadClosure', 'construction', 'plannedEvent'])

async function handler(_req: NextRequest): Promise<NextResponse> {
  const all  = await getIncidents()
  const data = {
    ...all,
    features: all.features.filter(f => TERRITORY_TYPES.has(f.properties.type)),
  }
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}

export const GET = withMetrics('/api/v1/layers/territory', handler)
