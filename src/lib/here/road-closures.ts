import { hereGet, BBOX_IN } from './client'
import { redis }            from '@/lib/redis'
import { logger }           from '@/lib/logger'
import type { HereIncidentsResponse, HereIncidentDetails, HereCriticality } from './types'

const CACHE_KEY = 'tif:here:road-closures:v1'
const CACHE_TTL = 60

export interface RoadClosureProperties {
  id:          string
  description: string
  source:      'HERE'
  criticality: HereCriticality
  startTime:   string
  endTime:     string | null
}

export type RoadClosureFeature = {
  type:       'Feature'
  properties: RoadClosureProperties
  geometry: {
    type:        'LineString'
    coordinates: [number, number][]
  }
}

export type RoadClosureFeatureCollection = {
  type:         'FeatureCollection'
  features:     RoadClosureFeature[]
  generatedAt:  string
}

function extractCoords(inc: HereIncidentDetails): [number, number][] {
  const coords: [number, number][] = []
  for (const link of inc.location.shape.links) {
    for (const p of link.points) {
      coords.push([p.lng, p.lat])
    }
  }
  return coords
}

export async function getRoadClosures(): Promise<RoadClosureFeatureCollection> {
  try {
    const cached = await redis.get<RoadClosureFeatureCollection>(CACHE_KEY)
    if (cached) return cached
  } catch (err) {
    logger.warn({ err }, 'road-closures:redis-get-failed')
  }

  const data = await hereGet<HereIncidentsResponse>('/incidents', {
    locationReferencing: 'shape',
    in:                  BBOX_IN,
  })

  const features: RoadClosureFeature[] = []

  for (const { incidentDetails: inc } of data.results) {
    if (inc.type !== 'roadClosure') continue

    const coords = extractCoords(inc)
    if (coords.length < 2) continue

    features.push({
      type:       'Feature',
      properties: {
        id:          inc.id,
        description: inc.description?.value ?? 'Route fermée',
        source:      'HERE',
        criticality: inc.criticality,
        startTime:   inc.startTime,
        endTime:     inc.endTime ?? null,
      },
      geometry: { type: 'LineString', coordinates: coords },
    })
  }

  const result: RoadClosureFeatureCollection = {
    type:        'FeatureCollection',
    features,
    generatedAt: new Date().toISOString(),
  }

  try {
    await redis.set(CACHE_KEY, result, { ex: CACHE_TTL })
  } catch (err) {
    logger.warn({ err }, 'road-closures:redis-set-failed')
  }

  logger.debug({ count: features.length }, 'road-closures:fetched')
  return result
}
