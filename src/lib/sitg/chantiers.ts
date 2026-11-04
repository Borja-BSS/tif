import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { lireChantiers, indisponible, type ChantiersResult } from './chantiers-core'

export * from './chantiers-core'

const CACHE_KEY = 'tif:sitg:chantiers:v1'
const CACHE_TTL = 3600 // au moins une heure : le jeu ne change qu'une fois par jour

/** Lit le service SITG (cache 1 h). Panne = « source-indisponible », jamais « aucune fermeture ». */
export async function getChantiers(): Promise<ChantiersResult> {
  try {
    const cached = await redis.get<ChantiersResult>(CACHE_KEY)
    if (cached && cached.etat === 'ok') return cached
  } catch (err) { logger.warn({ err }, 'sitg:chantiers:cache-lecture') }

  const result = await lireChantiers()
  if (result.etat === 'ok') {
    try { await redis.set(CACHE_KEY, result, { ex: CACHE_TTL }) } catch (err) { logger.warn({ err }, 'sitg:chantiers:cache-ecriture') }
  } else {
    logger.warn({ raison: result.raison }, 'sitg:chantiers:indisponible')
  }
  return result
}

export { indisponible }
