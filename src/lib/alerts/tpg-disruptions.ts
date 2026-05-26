import { redis }  from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { FeatureCollection, Feature, Point } from 'geojson'

const STATIONBOARD_URL = 'https://transport.opendata.ch/v1/stationboard'
const CACHE_KEY        = 'tif:tpg:disruptions'
const CACHE_TTL        = 120
const TIMEOUT          = 8_000
const DELAY_THRESHOLD  = 3 // minutes

// Priority TPG lines (trams + main buses in Geneva)
const TPG_LINES = ['1', '2', '3', '5', '6', '7', '8', '9', '10', '12', '15', '18', '19', '25']

// Key TPG stops with approx coordinates for alert placement
const TPG_STOPS: Array<{ id: string; name: string; lat: number; lng: number }> = [
  { id: '8587020', name: 'Genève, Bel-Air',        lat: 46.2021, lng: 6.1454 },
  { id: '8587016', name: 'Genève, Cornavin',        lat: 46.2103, lng: 6.1416 },
  { id: '8587057', name: 'Genève, Rive',             lat: 46.1999, lng: 6.1513 },
  { id: '8587019', name: 'Genève, Plainpalais',      lat: 46.1986, lng: 6.1404 },
]

export interface TpgProperties {
  id:          string
  type:        'tpg'
  criticality: 'minor' | 'lowImpact'
  description: string
  icon:        string
  color:       string
  startTime:   string
  endTime:     string | null
  source:      'TPG'
  lineNumber:  string
  delayMin:    number
}

export type TpgFeatureCollection = FeatureCollection<Point, TpgProperties>

interface StationboardDeparture {
  stop: { delay?: number | null; departure?: string }
  number?: string
  category?: string
  name?: string
}

interface StationboardResponse {
  station?: { coordinate?: { x: number; y: number }; name?: string }
  stationboard?: StationboardDeparture[]
}

async function fetchStopDisruptions(
  stop: (typeof TPG_STOPS)[number],
): Promise<Feature<Point, TpgProperties>[]> {
  const url = new URL(STATIONBOARD_URL)
  url.searchParams.set('id',    stop.id)
  url.searchParams.set('limit', '20')
  url.searchParams.set('transportations[]', 'tram')
  url.searchParams.set('transportations[]', 'bus')

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT) })
  if (!res.ok) return []

  const data = await res.json() as StationboardResponse
  const departures = data.stationboard ?? []

  return departures.flatMap((dep): Feature<Point, TpgProperties>[] => {
    const delay     = dep.stop.delay ?? 0
    const lineNum   = dep.number ?? dep.name ?? '?'
    if (delay < DELAY_THRESHOLD)          return []
    if (!TPG_LINES.includes(lineNum))     return []

    const criticality: TpgProperties['criticality'] = delay >= 10 ? 'minor' : 'lowImpact'

    return [{
      type:       'Feature',
      properties: {
        id:          `tpg-${stop.id}-${lineNum}-${dep.stop.departure ?? Date.now()}`,
        type:        'tpg',
        criticality,
        description: `Ligne ${lineNum} — retard ${delay} min (${stop.name})`,
        icon:        '🚌',
        color:       criticality === 'minor' ? '#FF9500' : '#FFCC00',
        startTime:   new Date().toISOString(),
        endTime:     null,
        source:      'TPG',
        lineNumber:  lineNum,
        delayMin:    delay,
      },
      geometry: { type: 'Point', coordinates: [stop.lng, stop.lat] },
    }]
  })
}

export async function getTpgDisruptions(): Promise<TpgFeatureCollection> {
  const cached = await redis.get<TpgFeatureCollection>(CACHE_KEY)
  if (cached) return cached

  const apiKey = process.env.OPENTRANSPORT_API_KEY
  if (!apiKey) {
    logger.warn('tpg:disruptions:OPENTRANSPORT_API_KEY missing — using public endpoint')
  }

  try {
    const results = await Promise.allSettled(TPG_STOPS.map(s => fetchStopDisruptions(s)))

    const features: Feature<Point, TpgProperties>[] = results.flatMap(r =>
      r.status === 'fulfilled' ? r.value : [],
    )

    // Deduplicate: same line + stop within 200m
    const seen = new Set<string>()
    const deduped = features.filter(f => {
      const key = `${f.properties.lineNumber}-${f.properties.description.slice(0, 40)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const result: TpgFeatureCollection = { type: 'FeatureCollection', features: deduped }
    await redis.set(CACHE_KEY, result, { ex: CACHE_TTL })
    logger.debug({ count: deduped.length }, 'tpg:disruptions:fetched')
    return result

  } catch (err) {
    logger.warn({ err }, 'tpg:disruptions:fetch-failed')
    return { type: 'FeatureCollection', features: [] }
  }
}
