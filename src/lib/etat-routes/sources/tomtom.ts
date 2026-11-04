import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { jamDepuisVitesses } from '../decide'
import type { Lecture, PointObservation, SourceEtat } from '../types'

/**
 * TomTom Traffic, Flow Segment Data. Palier gratuit annoncé : 20 000 requêtes par mois, sans carte bancaire
 * (https://docs.tomtom.com/pricing, relevé du 04.11.2026). Les CONDITIONS d'usage (cache, usage commercial du
 * palier gratuit) n'ont PAS été lues : ne pas activer en production avant validation par le fondateur.
 * Inactive sans TOMTOM_API_KEY. Un compteur mensuel plafonne les appels pour ne jamais dépasser le palier.
 */
const BUDGET_MENSUEL = Number(process.env.TOMTOM_MONTHLY_BUDGET) || 18_000
const SECURITE = 0.9

function autoriseParVariable(): boolean {
  const liste = (process.env.TIF_TRAFFIC_SOURCE ?? 'tomtom').split(',').map(s => s.trim())
  return liste.includes('tomtom')
}

function cleMois() {
  const d = new Date()
  return `tif:tomtom:budget:${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Durée de validité d'une lecture, en secondes, pour tenir dans le budget avec N points. */
export function ttlPourBudget(nbPoints: number): number {
  const minutesMois = 30 * 24 * 60
  const secondes = (nbPoints * minutesMois * 60) / (BUDGET_MENSUEL * SECURITE)
  return Math.max(300, Math.ceil(secondes))
}

interface TomTomReponse {
  flowSegmentData?: {
    currentSpeed: number; freeFlowSpeed: number; confidence: number; roadClosure?: boolean
    coordinates?: { coordinate?: Array<{ latitude: number; longitude: number }> }
  }
}

async function lirePoint(p: PointObservation, ttl: number): Promise<Lecture | null> {
  const cle = `tif:tomtom:pt:${p.id}`
  const cache = await redis.get<Lecture>(cle)
  if (cache) return cache

  const compte = await redis.incr(cleMois())
  if (compte > BUDGET_MENSUEL) { logger.warn({ compte }, 'tomtom:budget-mensuel-atteint'); return null }

  const url = new URL('https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json')
  url.searchParams.set('point', `${p.lat},${p.lng}`)
  url.searchParams.set('unit', 'KMPH')
  url.searchParams.set('key', process.env.TOMTOM_API_KEY!)
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000), cache: 'no-store' })
  if (!res.ok) { logger.warn({ status: res.status, point: p.id }, 'tomtom:http'); return null }
  const d = (await res.json() as TomTomReponse).flowSegmentData
  if (!d || typeof d.currentSpeed !== 'number' || typeof d.freeFlowSpeed !== 'number') return null

  const lecture: Lecture = {
    source: 'tomtom', pointId: p.id, at: new Date().toISOString(),
    speed: d.currentSpeed, freeFlow: d.freeFlowSpeed,
    jamFactor: jamDepuisVitesses(d.currentSpeed, d.freeFlowSpeed),
    confidence: typeof d.confidence === 'number' ? d.confidence : 0,
    fermee: d.roadClosure === true,
    coordinates: (d.coordinates?.coordinate ?? []).map(c => [c.longitude, c.latitude] as [number, number]),
  }
  await redis.set(cle, lecture, { ex: ttl })
  return lecture
}

export const sourceTomTom: SourceEtat = {
  id: 'tomtom',
  libelle: 'TomTom Traffic (Flow Segment Data)',
  licence: 'https://docs.tomtom.com/legal/terms-and-conditions',
  active: () => Boolean(process.env.TOMTOM_API_KEY) && autoriseParVariable(),
  async lire(points) {
    const ttl = ttlPourBudget(points.length)
    const out: Lecture[] = []
    for (const p of points) {
      try { const l = await lirePoint(p, ttl); if (l) out.push(l) } catch (err) { logger.warn({ err, point: p.id }, 'tomtom:erreur') }
    }
    return out
  },
}
