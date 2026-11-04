import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'

import { SITG_CAMERAS_SOURCE, parseCameras, type RawCam, type CamerasResult } from './cameras-core'

const URL_CAMERAS = 'https://vector.sitg.ge.ch/arcgis/rest/services/INFOMOB_CAMERA/FeatureServer/0/query'
const CACHE_KEY = 'tif:sitg:cameras:v1'
const CACHE_TTL = 60


/** Heure de la dernière image, lue dans l'en-tête Last-Modified (requête HEAD, rien n'est téléchargé). */
async function heureImage(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000), cache: 'no-store' })
    const lm = r.headers.get('last-modified')
    const t = lm ? Date.parse(lm) : NaN
    return Number.isFinite(t) ? new Date(t).toISOString() : null
  } catch { return null }
}

export async function getCameras(): Promise<CamerasResult> {
  try {
    const cached = await redis.get<CamerasResult>(CACHE_KEY)
    if (cached && cached.etat === 'ok') return cached
  } catch { /* cache absent */ }
  const ko = (raison: string): CamerasResult => ({ etat: 'source-indisponible', raison, source: SITG_CAMERAS_SOURCE, lectureLe: new Date().toISOString(), features: [] })
  try {
    const url = new URL(URL_CAMERAS)
    url.searchParams.set('where', '1=1'); url.searchParams.set('outFields', '*'); url.searchParams.set('outSR', '4326'); url.searchParams.set('f', 'json')
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000), cache: 'no-store' })
    if (!res.ok) return ko(`SITG a répondu ${res.status}`)
    const raw = await res.json() as { features?: RawCam[]; error?: { message?: string } }
    if (raw.error || !Array.isArray(raw.features)) return ko(`SITG : ${raw.error?.message ?? 'réponse sans caméras'}`)
    const feats = parseCameras(raw)
    const heures = await Promise.all(feats.map(f => heureImage(f.properties.imageUrl)))
    feats.forEach((f, i) => { f.properties.imageAt = heures[i] })
    const result: CamerasResult = { etat: 'ok', source: SITG_CAMERAS_SOURCE, lectureLe: new Date().toISOString(), features: feats }
    try { await redis.set(CACHE_KEY, result, { ex: CACHE_TTL }) } catch { /* idem */ }
    return result
  } catch (err) {
    logger.warn({ err }, 'sitg:cameras:echec')
    return ko(err instanceof Error ? err.message : 'service SITG injoignable')
  }
}
