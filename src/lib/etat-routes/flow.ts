import { getTrafficFlow } from '@/lib/here/traffic-flow'
import type { FlowFeatureCollection } from '@/lib/here/traffic-flow'
import { lireToutes } from './index'

/**
 * Point d'entrée unique du flux de trafic pour l'algorithme des douanes et pour la couche /layers/mobility.
 * TIF_TRAFFIC_SOURCE=here : ancien comportement HERE exact (retour arrière immédiat).
 * Sinon : flux construit depuis les sources internes ; sans source active, lève une erreur claire
 * (les douanes retombent alors sur leur estimation étiquetée « synthetic », comme avant).
 */
export async function getFlow(): Promise<FlowFeatureCollection> {
  const liste = (process.env.TIF_TRAFFIC_SOURCE ?? '').split(',').map(s => s.trim())
  if (liste.includes('here') && !liste.includes('tomtom')) return getTrafficFlow()

  const { lectures, sources } = await lireToutes()
  if (sources.length === 0) throw new Error('Aucune source de flux active (TIF_TRAFFIC_SOURCE, clé manquante)')
  const features = lectures.filter(l => l.coordinates.length > 1 && l.speed > 0 && l.freeFlow > 0).map(l => ({
    type: 'Feature' as const,
    properties: {
      jamFactor: l.jamFactor, speed: l.speed, freeFlow: l.freeFlow, confidence: l.confidence,
      color: '', speedRatio: l.freeFlow > 0 ? l.speed / l.freeFlow : 0,
    },
    geometry: { type: 'LineString' as const, coordinates: l.coordinates },
  }))
  return { type: 'FeatureCollection', features, generatedAt: new Date().toISOString() }
}
