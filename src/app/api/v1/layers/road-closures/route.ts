import { NextResponse }      from 'next/server'
import { getRoadClosures }  from '@/lib/here/road-closures'
import { getChantiers, fermetures } from '@/lib/sitg/chantiers'
import { withMetrics }      from '@/lib/route-utils'
import { logger }           from '@/lib/logger'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Fermetures de routes. Source par défaut : chantiers officiels du SITG (gratuit, sans clé), PLANIFIÉS, pas du direct.
 * Retour arrière : TIF_CLOSURES_SOURCE=here (ancienne source HERE, clé requise).
 * Une panne rend `etat: "source-indisponible"` avec la raison, jamais une liste vide qui laisserait croire à « aucune fermeture ».
 */
async function handler(_req: NextRequest): Promise<NextResponse> {
  if ((process.env.TIF_CLOSURES_SOURCE ?? '').trim() === 'here') {
    try {
      const data = await getRoadClosures()
      return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } })
    } catch (err) {
      logger.warn({ err }, 'road-closures:here-failed')
      return NextResponse.json(
        { type: 'FeatureCollection', features: [], generatedAt: new Date().toISOString(), etat: 'source-indisponible', raison: 'Source HERE indisponible' },
        { status: 200 },
      )
    }
  }

  const r = await getChantiers()
  const features = fermetures(r)
  return NextResponse.json({
    type: 'FeatureCollection',
    features,
    generatedAt: r.lectureLe,
    etat: r.etat,
    ...(r.raison ? { raison: r.raison } : {}),
    source: r.source,
    lectureLe: r.lectureLe,
    compte: r.compte,
    nature: 'chantiers planifiés (fermetures annoncées), pas des incidents en direct',
  }, {
    headers: { 'Cache-Control': r.etat === 'ok' ? 'public, s-maxage=300, stale-while-revalidate=600' : 'no-store' },
  })
}

export const GET = withMetrics('/api/v1/layers/road-closures', handler)
