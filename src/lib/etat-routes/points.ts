import type { PointObservation } from './types'

/** Axes urbains : points d'observation approximatifs (à confirmer sur la carte avant mise en ligne). */
const AXES: PointObservation[] = [
  { id: 'axe-mont-blanc',     nom: 'Pont du Mont-Blanc',        lat: 46.2072, lng: 6.1494, type: 'axe' },
  { id: 'axe-coulouvreniere', nom: 'Pont de la Coulouvrenière', lat: 46.2057, lng: 6.1400, type: 'axe' },
  { id: 'axe-cornavin',       nom: 'Gare de Cornavin',          lat: 46.2102, lng: 6.1424, type: 'axe' },
]

/**
 * Premier jeu : les douanes de capacité haute ou moyenne (réutilise leurs coordonnées) et trois axes du centre.
 * Chargement paresseux de border-crossings pour éviter un import circulaire.
 */
export async function pointsObservation(): Promise<PointObservation[]> {
  const { listCrossingPoints } = await import('@/lib/territory/border-crossings')
  const douanes: PointObservation[] = listCrossingPoints()
    .filter(c => c.capacity === 'high' || c.capacity === 'medium')
    .map(c => ({ id: `douane-${c.id}`, nom: c.name, lat: c.lat, lng: c.lng, type: 'douane' as const }))
  return [...douanes, ...AXES]
}
