import { redis }  from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { FeatureCollection, Feature, Point } from 'geojson'

type BorderStatus   = 'CLEAR' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'BLOCKED'
type Capacity       = 'high' | 'medium' | 'low'
type CrossingType   = 'motorway' | 'main' | 'secondary'

interface Crossing {
  id:       string
  name:     string
  lat:      number
  lng:      number
  type:     CrossingType
  capacity: Capacity
}

export interface BorderProperties {
  id:              string
  name:            string
  type:            'border'
  crossingType:    CrossingType
  capacity:        Capacity
  status:          BorderStatus
  jamFactor:       number
  waitTimeMinutes: number
  direction:       'both'
  icon:            string
  color:           string
  lastUpdated:     string
  source:          'synthetic-calibrated'
}

export type BorderFeatureCollection = FeatureCollection<Point, BorderProperties>

const CROSSINGS: Crossing[] = [
  { id: 'bardonnex',       name: 'Bardonnex',       lat: 46.1547, lng: 6.0890, type: 'motorway',  capacity: 'high'   },
  { id: 'thonex-vallard',  name: 'Thônex-Vallard',  lat: 46.1991, lng: 6.2081, type: 'main',      capacity: 'medium' },
  { id: 'meyrin',          name: 'Meyrin',           lat: 46.2156, lng: 6.0721, type: 'main',      capacity: 'medium' },
  { id: 'ferney-voltaire', name: 'Ferney-Voltaire',  lat: 46.2567, lng: 6.1079, type: 'secondary', capacity: 'low'    },
  { id: 'moillesulaz',     name: 'Moillesulaz',      lat: 46.1934, lng: 6.2156, type: 'main',      capacity: 'medium' },
  { id: 'perly',           name: 'Perly',            lat: 46.1547, lng: 6.0512, type: 'secondary', capacity: 'low'    },
  { id: 'croix-de-rozon',  name: 'Croix-de-Rozon',  lat: 46.1234, lng: 6.1023, type: 'secondary', capacity: 'low'    },
  { id: 'veyrier',         name: 'Veyrier',          lat: 46.1789, lng: 6.1934, type: 'secondary', capacity: 'low'    },
]

const STATUS_COLOR: Record<BorderStatus, string> = {
  CLEAR:   '#34C759',
  LIGHT:   '#30D158',
  MODERATE:'#FF9500',
  HEAVY:   '#FF3B30',
  BLOCKED: '#8E8E93',
}

function estimatedWait(status: BorderStatus, capacity: Capacity): number {
  const base: Record<BorderStatus, number>  = { CLEAR: 0, LIGHT: 3, MODERATE: 10, HEAVY: 25, BLOCKED: 60 }
  const mult: Record<Capacity, number>      = { high: 1.2, medium: 1.0, low: 0.8 }
  return Math.round(base[status] * mult[capacity])
}

export function computeCrossingStatus(
  crossing: Crossing,
  now: Date,
): { status: BorderStatus; jamFactor: number } {
  const hour           = now.getHours()
  const day            = now.getDay()
  const isMorningPeak  = hour >= 7  && hour <= 9
  const isEveningPeak  = hour >= 16 && hour <= 19
  const isFriday       = day === 5
  const isWeekend      = day === 0 || day === 6
  const isNight        = hour >= 22 || hour < 6

  if (crossing.type === 'motorway') {
    if (isNight)                         return { status: 'CLEAR',    jamFactor: 1 }
    if (isWeekend && !isEveningPeak)     return { status: 'LIGHT',    jamFactor: 2 }
    if (isMorningPeak)                   return { status: 'MODERATE', jamFactor: 5 }
    if (isEveningPeak && isFriday)       return { status: 'HEAVY',    jamFactor: 7 }
    if (isEveningPeak)                   return { status: 'MODERATE', jamFactor: 5 }
    return                                      { status: 'LIGHT',    jamFactor: 2 }
  }

  if (crossing.type === 'main') {
    if (isNight)                         return { status: 'CLEAR',    jamFactor: 0 }
    if (isMorningPeak || isEveningPeak)  return { status: 'LIGHT',    jamFactor: 3 }
    return                                      { status: 'CLEAR',    jamFactor: 1 }
  }

  // secondary
  if (isNight)                           return { status: 'CLEAR',    jamFactor: 0 }
  if (isMorningPeak || isEveningPeak)    return { status: 'LIGHT',    jamFactor: 2 }
  return                                        { status: 'CLEAR',    jamFactor: 0 }
}

const CACHE_KEY = 'tif:layer:border-crossings'
const CACHE_TTL = 120

export async function getBorderCrossings(): Promise<BorderFeatureCollection> {
  const cached = await redis.get<BorderFeatureCollection>(CACHE_KEY)
  if (cached) return cached

  const now      = new Date()
  const features: Feature<Point, BorderProperties>[] = CROSSINGS.map(c => {
    const { status, jamFactor } = computeCrossingStatus(c, now)
    return {
      type:       'Feature',
      properties: {
        id:              c.id,
        name:            c.name,
        type:            'border',
        crossingType:    c.type,
        capacity:        c.capacity,
        status,
        jamFactor,
        waitTimeMinutes: estimatedWait(status, c.capacity),
        direction:       'both',
        icon:            '🛂',
        color:           STATUS_COLOR[status],
        lastUpdated:     now.toISOString(),
        source:          'synthetic-calibrated',
      },
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
    }
  })

  const result: BorderFeatureCollection = { type: 'FeatureCollection', features }

  await redis.set(CACHE_KEY, result, { ex: CACHE_TTL })
  logger.debug({ count: features.length }, 'border-crossings:computed')
  return result
}

export { CROSSINGS as BORDER_CROSSINGS_STATIC }
