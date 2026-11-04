import { NextResponse }      from 'next/server'
import { getCameras }       from '@/lib/sitg/cameras'
import { withMetrics }      from '@/lib/route-utils'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/** Caméras de trafic SITG (jeu INFOMOB_CAMERA). Aucune image n'est stockée : seules les adresses et l'heure de dernière image sont rendues. */
async function handler(_req: NextRequest): Promise<NextResponse> {
  const r = await getCameras()
  return NextResponse.json({
    type: 'FeatureCollection', features: r.features, etat: r.etat, ...(r.raison ? { raison: r.raison } : {}),
    source: r.source, lectureLe: r.lectureLe,
  }, { headers: { 'Cache-Control': r.etat === 'ok' ? 'public, s-maxage=60' : 'no-store' } })
}

export const GET = withMetrics('/api/v1/layers/cameras', handler)
