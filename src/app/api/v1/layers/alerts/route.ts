import { NextResponse }              from 'next/server'
import { getIncidents }             from '@/lib/here/incidents'
import { getChantiers, fermetures } from '@/lib/sitg/chantiers'
import { getTpgDisruptions }        from '@/lib/alerts/tpg-disruptions'
import { getWeatherAlerts }         from '@/lib/alerts/openmeteo-weather'
import { withMetrics }              from '@/lib/route-utils'
import { redis }                    from '@/lib/redis'
import { logger }                   from '@/lib/logger'
import type { NextRequest }         from 'next/server'
import type { FeatureCollection, Feature, Point } from 'geojson'

export const dynamic = 'force-dynamic'

const CACHE_KEY = 'tif:layer:alerts:merged'
const CACHE_TTL = 60

// Two features are duplicates only if: same source type AND within ~200m
// Weather features (multiple per location) are never deduplicated against each other
function areDuplicates(a: Feature<Point>, b: Feature<Point>): boolean {
  const typeA = (a.properties as Record<string, unknown>)?.type as string | undefined
  const typeB = (b.properties as Record<string, unknown>)?.type as string | undefined

  // Never deduplicate weather or tpg features — multiple per location are intentional
  if (typeA === 'weather' || typeB === 'weather') return false
  if (typeA === 'tpg'     || typeB === 'tpg')     return false
  if (typeA === 'chantier-planifie' || typeB === 'chantier-planifie') return false

  // For road/traffic features: deduplicate if within ~200m and same type
  if (typeA !== typeB) return false

  const [lngA, latA] = a.geometry.coordinates
  const [lngB, latB] = b.geometry.coordinates
  const dlat = (latA - latB) * 111_000
  const dlng = (lngA - lngB) * 111_000 * Math.cos((latA * Math.PI) / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng) < 200
}

function deduplicateFeatures(features: Feature<Point>[]): Feature<Point>[] {
  const out: Feature<Point>[] = []
  for (const f of features) {
    if (!out.some(existing => areDuplicates(existing, f))) {
      out.push(f)
    }
  }
  return out
}

async function handler(_req: NextRequest): Promise<NextResponse> {
  try {
    const cached = await redis.get<FeatureCollection>(CACHE_KEY)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      })
    }
  } catch (err) {
    logger.warn({ err }, 'alerts:redis-get-failed — skipping cache')
  }

  // 3 sources serveur en parallèle — Overpass et Waze retirés (bloqués côté Vercel)
  const [sitgResult, hereResult, tpgResult, weatherResult] = await Promise.allSettled([
    getChantiers(),        // SITG : fermetures de chantiers PLANIFIÉS (jamais un incident en direct)
    getIncidents(),        // HERE Maps accidents/congestion
    getTpgDisruptions(),   // opendata.ch — retards TPG/CFF
    getWeatherAlerts(),    // OpenMeteo — météo 48h (gratuit)
  ])

  const allFeatures: Feature<Point>[] = []

  if (hereResult.status === 'fulfilled') {
    allFeatures.push(...hereResult.value.features as Feature<Point>[])
    logger.info({ count: hereResult.value.features.length }, 'alerts:here-ok')
  } else {
    logger.warn({ err: hereResult.reason }, 'alerts:here-failed')
  }

  if (sitgResult.status === 'fulfilled' && sitgResult.value.etat === 'ok') {
    const r = sitgResult.value
    for (const f of fermetures(r)) {
      const p = f.properties
      allFeatures.push({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: p.id, type: 'chantier-planifie', criticality: 'minor', planifie: true,
          description: `Chantier planifié · ${p.adresse} : ${p.description.replace(/\s+/g, ' ')}`,
          icon: '🚧', color: '#FF9500', startTime: p.startTime, endTime: p.endTime,
          source: 'Données SITG', lectureLe: r.lectureLe,
        },
      } as Feature<Point>)
    }
    logger.info({ count: r.compte.fermetures }, 'alerts:sitg-ok')
  } else {
    logger.warn({ raison: sitgResult.status === 'fulfilled' ? sitgResult.value.raison : sitgResult.reason }, 'alerts:sitg-indisponible')
  }

  if (tpgResult.status === 'fulfilled') {
    allFeatures.push(...tpgResult.value.features as Feature<Point>[])
    logger.info({ count: tpgResult.value.features.length }, 'alerts:tpg-ok')
  } else {
    logger.warn({ err: tpgResult.reason }, 'alerts:tpg-failed')
  }

  if (weatherResult.status === 'fulfilled') {
    allFeatures.push(...weatherResult.value.features as Feature<Point>[])
    logger.info({ count: weatherResult.value.features.length }, 'alerts:weather-ok')
  } else {
    logger.warn({ err: weatherResult.reason }, 'alerts:weather-failed')
  }

  const features = deduplicateFeatures(allFeatures)
  const data: FeatureCollection = { type: 'FeatureCollection', features }

  try {
    await redis.set(CACHE_KEY, data, { ex: CACHE_TTL })
  } catch (err) {
    logger.warn({ err }, 'alerts:redis-set-failed — skipping cache write')
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}

export const GET = withMetrics('/api/v1/layers/alerts', handler)
