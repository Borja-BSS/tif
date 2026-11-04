import { logger } from '@/lib/logger'
import type { SourceEtat } from '../types'

/**
 * Service « état du trafic » du canton de Genève (INFOMOB_TRAFIC_TEMPS_REEL, 614 segments).
 * INACTIF PAR DÉFAUT : aucune fiche de licence retrouvée au catalogue SITG pour ce service, et le champ
 * DATE_MAJ_ETAT est figé au 13.09.2022 (mesuré le 04.11.2026). Activation : TIF_SITG_TRAFIC=1, sous la
 * responsabilité du fondateur.
 * Les lectures portent l'heure DATE_MAJ_ETAT : la règle des 20 minutes de `decide.ts` les écarte tant que le
 * canton ne remet pas le service à jour (« inconnu », jamais une couleur de 2022). S'il le réactive, la source
 * redevient utile sans changer le code.
 * Les vitesses ne sont pas fournies : speed et freeFlow valent 0, et cette source est exclue du flux des douanes.
 */
const URL_TRAFIC = 'https://ge.ch/terags/rest/services/SITG/INFOMOB_TRAFIC_TEMPS_REEL/MapServer/0/query'
import { lecturesDepuisSegments } from './sitg-trafic-core'

export const sourceSitgTrafic: SourceEtat = {
  id: 'sitg-trafic',
  libelle: 'SITG, état du trafic (INFOMOB_TRAFIC_TEMPS_REEL), inactif par défaut',
  licence: 'https://sitg.ge.ch/ressources/conditions-utilisation-donnees',
  active: () => process.env.TIF_SITG_TRAFIC === '1',
  async lire(points) {
    try {
      const url = new URL(URL_TRAFIC)
      url.searchParams.set('where', '1=1'); url.searchParams.set('outFields', 'NOM,ETAT,DATE_MAJ_ETAT')
      url.searchParams.set('outSR', '4326'); url.searchParams.set('f', 'json')
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
