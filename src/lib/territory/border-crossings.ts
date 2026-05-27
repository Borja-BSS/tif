import { redis }  from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { FeatureCollection, Feature, Point } from 'geojson'

type BorderStatus   = 'CLEAR' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'BLOCKED'
type Capacity       = 'high' | 'medium' | 'low'
type CrossingType   = 'motorway' | 'main' | 'secondary'
type G7Status       = 'open' | 'closed' | 'macaron'

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
  source:          'synthetic-calibrated' | 'G7-directive'
  g7Period:        boolean
  g7Status:        G7Status | null
}

export type BorderFeatureCollection = FeatureCollection<Point, BorderProperties>

// ── Postes de douane Grand Genève ─────────────────────────────────────────────
// Inclut Anières (7e passage G7 autorisé) + Croix-de-Rozon + Veyrier (fermés G7)
const CROSSINGS: Crossing[] = [
  // Coordonnées OSM vérifiées — nodes "Douane/border_control" Grand Genève
  { id: 'bardonnex',       name: 'Bardonnex',       lat: 46.1495, lng: 6.0961, type: 'motorway',  capacity: 'high'   },
  { id: 'thonex-vallard',  name: 'Thônex-Vallard',  lat: 46.1889, lng: 6.2021, type: 'main',      capacity: 'medium' },
  { id: 'meyrin',          name: 'Meyrin',           lat: 46.2347, lng: 6.0505, type: 'main',      capacity: 'medium' },
  { id: 'ferney-voltaire', name: 'Ferney-Voltaire',  lat: 46.2500, lng: 6.1190, type: 'secondary', capacity: 'low'    },
  { id: 'moillesulaz',     name: 'Moillesulaz',      lat: 46.1920, lng: 6.2070, type: 'main',      capacity: 'medium' },
  { id: 'perly',           name: 'Perly',            lat: 46.1523, lng: 6.0910, type: 'secondary', capacity: 'low'    },
  { id: 'anieres',         name: 'Anières',          lat: 46.2416, lng: 6.3085, type: 'secondary', capacity: 'low'    },
  { id: 'croix-de-rozon',  name: 'Croix-de-Rozon',  lat: 46.1441, lng: 6.1375, type: 'secondary', capacity: 'low'    },
  { id: 'veyrier',         name: 'Veyrier',          lat: 46.1664, lng: 6.1885, type: 'secondary', capacity: 'low'    },
]

// ── Directives G7 (CF 06.05.2026 + CE GE 13.05.2026) ────────────────────────
// Période officielle : 12 juin 00h01 → 18 juin 23h59 heure locale (UTC+2)
const G7_START_UTC = new Date('2026-06-11T22:01:00Z') // 12 juin 00h01 CEST
const G7_END_UTC   = new Date('2026-06-18T21:59:00Z') // 18 juin 23h59 CEST

// 7 passages autorisés selon arrêté CF/CE GE
const G7_AUTHORIZED = new Set([
  'anieres', 'moillesulaz', 'thonex-vallard', 'bardonnex', 'perly', 'meyrin', 'ferney-voltaire',
])

// Passages prioritaires macarons (Bardonnex + Thônex-Vallard)
const G7_MACARON = new Set(['bardonnex', 'thonex-vallard'])

const STATUS_COLOR: Record<BorderStatus, string> = {
  CLEAR:    '#34C759',
  LIGHT:    '#30D158',
  MODERATE: '#FF9500',
  HEAVY:    '#FF3B30',
  BLOCKED:  '#8E8E93',
}

const G7_CLOSED_COLOR = '#FF3B30'  // rouge vif — fermé par directive officielle
const G7_MACARON_COLOR = '#5AC8FA' // bleu — macarons uniquement

function isG7Period(date: Date): boolean {
  return date >= G7_START_UTC && date < G7_END_UTC
}

function estimatedWait(status: BorderStatus, capacity: Capacity): number {
  const base: Record<BorderStatus, number> = { CLEAR: 0, LIGHT: 3, MODERATE: 10, HEAVY: 25, BLOCKED: 60 }
  const mult: Record<Capacity, number>     = { high: 1.2, medium: 1.0, low: 0.8 }
  return Math.round(base[status] * mult[capacity])
}

export function computeCrossingStatus(
  crossing: Crossing,
  now: Date,
): { status: BorderStatus; jamFactor: number } {
  const hour          = now.getHours()
  const day           = now.getDay()
  const isMorningPeak = hour >= 7  && hour <= 9
  const isEveningPeak = hour >= 16 && hour <= 19
  const isFriday      = day === 5
  const isWeekend     = day === 0 || day === 6
  const isNight       = hour >= 22 || hour < 6

  if (crossing.type === 'motorway') {
    if (isNight)                        return { status: 'CLEAR',    jamFactor: 1 }
    if (isWeekend && !isEveningPeak)    return { status: 'LIGHT',    jamFactor: 2 }
    if (isMorningPeak)                  return { status: 'MODERATE', jamFactor: 5 }
    if (isEveningPeak && isFriday)      return { status: 'HEAVY',    jamFactor: 7 }
    if (isEveningPeak)                  return { status: 'MODERATE', jamFactor: 5 }
    return                                     { status: 'LIGHT',    jamFactor: 2 }
  }

  if (crossing.type === 'main') {
    if (isNight)                        return { status: 'CLEAR',    jamFactor: 0 }
    if (isMorningPeak || isEveningPeak) return { status: 'LIGHT',    jamFactor: 3 }
    return                                     { status: 'CLEAR',    jamFactor: 1 }
  }

  // secondary
  if (isNight)                          return { status: 'CLEAR',    jamFactor: 0 }
  if (isMorningPeak || isEveningPeak)   return { status: 'LIGHT',    jamFactor: 2 }
  return                                       { status: 'CLEAR',    jamFactor: 0 }
}

const CACHE_KEY = 'tif:layer:border-crossings'
const CACHE_TTL = 120

export async function getBorderCrossings(): Promise<BorderFeatureCollection> {
  try {
    const cached = await redis.get<BorderFeatureCollection>(CACHE_KEY)
    if (cached) return cached
  } catch (err) {
    logger.warn({ err }, 'border-crossings:redis-get-failed — recomputing')
  }

  const now        = new Date()
  const g7Active   = isG7Period(now)

  const features: Feature<Point, BorderProperties>[] = CROSSINGS.map(c => {
    let status: BorderStatus
    let jamFactor: number
    let color: string
    let icon: string
    let source: BorderProperties['source']
    let g7Status: G7Status | null = null

    if (g7Active) {
      // ── Override G7 : directive officielle prime sur les patterns synthétiques ──
      source = 'G7-directive'

      if (!G7_AUTHORIZED.has(c.id)) {
        // Fermé par décision CF + CE GE
        status    = 'BLOCKED'
        jamFactor = 10
        color     = G7_CLOSED_COLOR
        icon      = '🔒'
        g7Status  = 'closed'
      } else if (G7_MACARON.has(c.id)) {
        // Ouvert avec macarons uniquement (accès prioritaire personnel critique)
        const { status: synth, jamFactor: jf } = computeCrossingStatus(c, now)
        status    = synth === 'BLOCKED' ? 'MODERATE' : synth
        jamFactor = jf
        color     = G7_MACARON_COLOR
        icon      = '🛂⭐'
        g7Status  = 'macaron'
      } else {
        // Ouvert (contrôles renforcés, délais d'attente accrus)
        const { status: synth, jamFactor: jf } = computeCrossingStatus(c, now)
        // Penalité G7 : trafic plus dense que normal pendant le sommet
        status    = synth === 'CLEAR' ? 'LIGHT' : synth === 'LIGHT' ? 'MODERATE' : synth
        jamFactor = Math.min(jf + 2, 9)
        color     = STATUS_COLOR[status]
        icon      = '🛂'
        g7Status  = 'open'
      }
    } else {
      // Mode normal — patterns synthétiques calibrés
      const computed = computeCrossingStatus(c, now)
      status    = computed.status
      jamFactor = computed.jamFactor
      color     = STATUS_COLOR[status]
      icon      = '🛂'
      source    = 'synthetic-calibrated'
    }

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
        icon,
        color,
        lastUpdated:     now.toISOString(),
        source,
        g7Period:        g7Active,
        g7Status,
      },
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
    }
  })

  const result: BorderFeatureCollection = { type: 'FeatureCollection', features }

  try {
    await redis.set(CACHE_KEY, result, { ex: CACHE_TTL })
  } catch (err) {
    logger.warn({ err }, 'border-crossings:redis-set-failed')
  }

  logger.debug({ count: features.length, g7Active }, 'border-crossings:computed')
  return result
}

export { CROSSINGS as BORDER_CROSSINGS_STATIC }
