import { redis }          from '@/lib/redis'
import { logger }         from '@/lib/logger'
import { fetchWazeData }  from './client'
import type { WazeAlertType } from './types'
import type { FeatureCollection, Feature, Point, LineString } from 'geojson'

const CACHE_KEY = 'tif:waze:incidents:v1'
const CACHE_TTL = 90  // secondes — Waze met à jour ~toutes les 2 min

// ── Dictionnaires ─────────────────────────────────────────────────────────────

const KNOWN_ALERT_TYPES = new Set<string>([
  'ACCIDENT', 'JAM', 'ROAD_CLOSED', 'HAZARD', 'WEATHERHAZARD', 'POLICE', 'CONSTRUCTION', 'MISC',
])

const ALERT_ICON: Record<string, string> = {
  ACCIDENT:      '🚨',
  JAM:           '🚦',
  ROAD_CLOSED:   '🚫',
  HAZARD:        '⚠️',
  WEATHERHAZARD: '🌧️',
  POLICE:        '👮',
  CONSTRUCTION:  '🚧',
  MISC:          '⚠️',
}

const ALERT_COLOR: Record<string, string> = {
  ACCIDENT:      '#FF3B30',
  JAM:           '#FF9500',
  ROAD_CLOSED:   '#FF6B00',
  HAZARD:        '#FF9500',
  WEATHERHAZARD: '#5AC8FA',
  POLICE:        '#5AC8FA',
  CONSTRUCTION:  '#FF9500',
  MISC:          '#8E8E93',
}

function jamLevelColor(level: number): string {
  if (level <= 1) return '#FFCC00'
  if (level <= 2) return '#FF9500'
  if (level <= 3) return '#FF6B00'
  if (level <= 4) return '#FF3B30'
  return '#CC0000'
}

// ── Feature properties ────────────────────────────────────────────────────────

export interface WazeFeatureProperties {
  id:           string
  source:       'Waze'
  wazetype:     'jam' | 'alert'
  type:         string
  subtype:      string
  description:  string
  icon:         string
  color:        string
  level:        number
  speedKMH:     number
  delay:        number
  reliability:  number
  confidence:   number
  thumbsUp:     number
  isRoadClosed: boolean
  pubMillis:    number
}

export type WazeFeature = Feature<Point | LineString, WazeFeatureProperties>
export type WazeFeatureCollection = FeatureCollection<Point | LineString, WazeFeatureProperties>

// ── Parser ────────────────────────────────────────────────────────────────────

export async function getWazeIncidents(): Promise<WazeFeatureCollection> {
  try {
    const cached = await redis.get<WazeFeatureCollection>(CACHE_KEY)
    if (cached) return cached
  } catch (err) {
    logger.warn({ err }, 'waze:redis-get-failed')
  }

  const data = await fetchWazeData()
  const features: WazeFeature[] = []

  // ── Jams → LineStrings ────────────────────────────────────────────────────
  for (const jam of data.jams ?? []) {
    if (jam.line.length < 2) continue

    const isRoadClosed = jam.type === 'ROAD_CLOSED'
    const coords: [number, number][] = jam.line.map(p => [p.x, p.y])

    const streetPart = jam.street ? ` — ${jam.street}` : ''
    const description = isRoadClosed
      ? `Route fermée${streetPart}`
      : `Bouchon niv. ${jam.level}/5 · ${Math.round(jam.speedKMH)} km/h${streetPart}`

    features.push({
      type: 'Feature',
      properties: {
        id:           jam.uuid,
        source:       'Waze',
        wazetype:     'jam',
        type:         jam.type,
        subtype:      '',
        description,
        icon:         isRoadClosed ? '🚫' : '🚦',
        color:        isRoadClosed ? '#FF6B00' : jamLevelColor(jam.level),
        level:        jam.level,
        speedKMH:     Math.round(jam.speedKMH),
        delay:        jam.delay,
        reliability:  0,
        confidence:   0,
        thumbsUp:     0,
        isRoadClosed,
        pubMillis:    jam.pubMillis,
      },
      geometry: { type: 'LineString', coordinates: coords },
    })
  }

  // ── Alerts → Points ───────────────────────────────────────────────────────
  for (const alert of data.alerts ?? []) {
    const rawType  = alert.type
    const safeType = KNOWN_ALERT_TYPES.has(rawType) ? rawType : 'MISC'
    const type     = safeType as WazeAlertType

    const streetPart = alert.street
      ? ` — ${alert.street}${alert.city ? ', ' + alert.city : ''}`
      : ''
    const description = `${type}${streetPart}`

    features.push({
      type: 'Feature',
      properties: {
        id:           alert.uuid,
        source:       'Waze',
        wazetype:     'alert',
        type,
        subtype:      alert.subtype ?? '',
        description,
        icon:         ALERT_ICON[type] ?? '⚠️',
        color:        ALERT_COLOR[type] ?? '#8E8E93',
        level:        0,
        speedKMH:     0,
        delay:        0,
        reliability:  alert.reliability,
        confidence:   alert.confidence,
        thumbsUp:     alert.nThumbsUp ?? 0,
        isRoadClosed: type === 'ROAD_CLOSED',
        pubMillis:    alert.pubMillis,
      },
      geometry: { type: 'Point', coordinates: [alert.location.x, alert.location.y] },
    })
  }

  const result: WazeFeatureCollection = { type: 'FeatureCollection', features }

  try {
    await redis.set(CACHE_KEY, result, { ex: CACHE_TTL })
  } catch (err) {
    logger.warn({ err }, 'waze:redis-set-failed')
  }

  logger.debug(
    { jams: data.jams?.length ?? 0, alerts: data.alerts?.length ?? 0, features: features.length },
    'waze:incidents:parsed',
  )
  return result
}
