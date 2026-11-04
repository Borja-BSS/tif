import { NextResponse }      from 'next/server'
import { getFlow }          from '@/lib/etat-routes/flow'
import { withMetrics }      from '@/lib/route-utils'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

async function handler(_req: NextRequest): Promise<NextResponse> {
  try {
    const data = await getFlow()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
  } catch (err) {
    // Aucune source de flux active : on le dit, sans données inventées et sans plantage.
    return NextResponse.json(
      { etat: 'inconnu', raison: err instanceof Error ? err.message : 'source de flux indisponible', features: [] },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}

export const GET = withMetrics('/api/v1/layers/mobility', handler)
