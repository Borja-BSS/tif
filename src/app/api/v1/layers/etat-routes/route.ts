import { NextResponse }      from 'next/server'
import { getEtatRoutes }    from '@/lib/etat-routes'
import { withMetrics }      from '@/lib/route-utils'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/** État de chaque point d'observation, calculé par nous. Chaque couleur garde sa source et son heure ; « inconnu » si les sources manquent ou se contredisent. */
async function handler(_req: NextRequest): Promise<NextResponse> {
  const { decisions, sourcesActives, calculeLe } = await getEtatRoutes()
  return NextResponse.json({
    type: 'FeatureCollection',
    sourcesActives,
    calculeLe,
    features: decisions.map(d => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
      properties: { id: d.id, nom: d.nom, etat: d.etat, couleur: d.couleur, raison: d.raison, jamFactor: d.jamFactor, sources: d.sources, calculeLe: d.calculeLe },
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export const GET = withMetrics('/api/v1/layers/etat-routes', handler)
