import { logger } from '@/lib/logger'
import type { SourceEtat } from '../types'

/**
 * Service « état du trafic » de la carte officielle du canton (SEGMENTS_INFOMOBILITE_LAST_RELATIONAL, 866 segments,
 * relevé le 04.11.2026). INACTIF PAR DÉFAUT : service non catalogué, sans licence, et les conditions générales de
 * ge.ch exigent une autorisation écrite pour un usage public ou commercial. Ne pas activer avant cette autorisation.
 * Activation : TIF_SITG_TRAFIC=1.
 * Les lectures portent l'heure `dateheure` : la règle des 20 minutes de `decide.ts` les écarte si le flux s'arrête
 * (« inconnu », jamais une couleur ancienne).
 * Les vitesses ne sont pas fournies : speed et freeFlow valent 0, et cette source est exclue du flux des douanes.
 */
const URL_TRAFIC = 'https://app2.ge.ch/tergeoservices/rest/services/Hosted/SEGMENTS_INFOMOBILITE_LAST_RELATIONAL/FeatureServer/0/query'
import { lecturesDepuisSegments } from './sitg-trafic-core'

export const sourceSitgTrafic: SourceEtat = {
  id: 'sitg-trafic',
  libelle: 'Canton de Genève, état du trafic (carte Infomobilité), inactif par défaut',
  licence: 'https://www.ge.ch/conditions-generales',
  active: () => process.env.TIF_SITG_TRAFIC === '1',
  async lire(points) {
    try {
      const url = new URL(URL_TRAFIC)
      url.searchParams.set('where', '1=1'); url.searchParams.set('outFields', 'etat,dateheure,indiceconfiance')
      url.searchParams.set('outSR', '4326'); url.searchParams.set('resultRecordCount', '2000'); url.searchParams.set('f', 'json')
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000), cache: 'no-store' })
      if (!res.ok) return []
      const raw = await res.json() as { features?: Parameters<typeof lecturesDepuisSegments>[0] }
      return lecturesDepuisSegments(raw.features ?? [], points)
    } catch (err) {
      logger.warn({ err }, 'sitg-trafic:echec')
      return []
    }
  },
}
