import { redis }  from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { FeatureCollection, Feature, Point } from 'geojson'

const METEO_URL = 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/VQHA80.csv'
const CACHE_KEY = 'tif:weather:alerts'
const CACHE_TTL = 600
const TIMEOUT   = 8_000

// Geneva-Cointrin station
const STATION_ID = 'GVE'
const GE_CENTER  = { lat: 46.2044, lng: 6.1432 }

export interface WeatherProperties {
  id:          string
  type:        'weather'
  criticality: 'major' | 'minor' | 'lowImpact'
  description: string
  icon:        string
  color:       string
  startTime:   string
  endTime:     string | null
  source:      'MétéoSuisse'
}

export type WeatherFeatureCollection = FeatureCollection<Point, WeatherProperties>

interface StationObs {
  precip:  number | null   // mm/10min
  temp:    number | null   // °C
  wind:    number | null   // km/h
}

function parseCsv(csv: string): StationObs | null {
  const lines  = csv.split('\n')
  const header = lines.findIndex(l => l.startsWith('stn;') || l.startsWith('Station;'))
  if (header < 0) return null

  const cols = lines[header].split(';').map(c => c.trim().toLowerCase())
  const stnIdx   = cols.findIndex(c => c === 'stn' || c === 'station')
  const precipIdx = cols.findIndex(c => c.includes('rre') || c.includes('precip') || c.includes('precipitation'))
  const tempIdx   = cols.findIndex(c => c.includes('tre') || c === 'temp' || c.includes('temperature'))
  const windIdx   = cols.findIndex(c => c.includes('ffu') || c.includes('wind') || c.includes('vent'))

  const dataLine = lines.slice(header + 1).find(l => {
    const parts = l.split(';')
    return parts[stnIdx]?.trim().toUpperCase() === STATION_ID
  })

  if (!dataLine) return null

  const parts = dataLine.split(';')
  const parse = (i: number): number | null => {
    if (i < 0) return null
    const v = parseFloat(parts[i]?.trim() ?? '')
    return isNaN(v) ? null : v
  }

  return {
    precip: parse(precipIdx),
    temp:   parse(tempIdx),
    wind:   parse(windIdx),
  }
}

function buildAlerts(obs: StationObs): Feature<Point, WeatherProperties>[] {
  const features: Feature<Point, WeatherProperties>[] = []
  const now = new Date().toISOString()

  const precip10min = obs.precip ?? 0
  const precipPerHour = precip10min * 6

  if (precipPerHour >= 2) {
    const criticality = precipPerHour >= 10 ? 'major' : 'minor'
    features.push({
      type:       'Feature',
      properties: {
        id:          `weather-rain-${Date.now()}`,
        type:        'weather',
        criticality,
        description: `Chaussée mouillée — ${precipPerHour.toFixed(1)} mm/h · Ralentissements probables`,
        icon:        '🌧️',
        color:       criticality === 'major' ? '#FF9500' : '#FFCC00',
        startTime:   now,
        endTime:     null,
        source:      'MétéoSuisse',
      },
      geometry: { type: 'Point', coordinates: [GE_CENTER.lng, GE_CENTER.lat] },
    })
  }

  if ((obs.temp ?? 10) < 2 && precipPerHour > 0) {
    features.push({
      type:       'Feature',
      properties: {
        id:          `weather-ice-${Date.now()}`,
        type:        'weather',
        criticality: 'major',
        description: `Risque verglas — Température ${obs.temp?.toFixed(1) ?? '?'}°C · Extrême prudence`,
        icon:        '🧊',
        color:       '#FF3B30',
        startTime:   now,
        endTime:     null,
        source:      'MétéoSuisse',
      },
      geometry: { type: 'Point', coordinates: [GE_CENTER.lng, GE_CENTER.lat] },
    })
  }

  if ((obs.wind ?? 0) >= 50) {
    features.push({
      type:       'Feature',
      properties: {
        id:          `weather-wind-${Date.now()}`,
        type:        'weather',
        criticality: 'minor',
        description: `Vent fort — ${obs.wind?.toFixed(0) ?? '?'} km/h · Prudence pont du Mont-Blanc`,
        icon:        '💨',
        color:       '#FF9500',
        startTime:   now,
        endTime:     null,
        source:      'MétéoSuisse',
      },
      geometry: { type: 'Point', coordinates: [GE_CENTER.lng, GE_CENTER.lat] },
    })
  }

  return features
}

export async function getWeatherImpactAlerts(): Promise<WeatherFeatureCollection> {
  const cached = await redis.get<WeatherFeatureCollection>(CACHE_KEY)
  if (cached) return cached

  try {
    const res = await fetch(METEO_URL, { signal: AbortSignal.timeout(TIMEOUT) })

    if (!res.ok) {
      logger.warn({ status: res.status }, 'weather:meteosuisse:http-error')
      return { type: 'FeatureCollection', features: [] }
    }

    const csv  = await res.text()
    const obs  = parseCsv(csv)

    if (!obs) {
      logger.warn({ station: STATION_ID }, 'weather:meteosuisse:station-not-found')
      return { type: 'FeatureCollection', features: [] }
    }

    const features = buildAlerts(obs)
    const result: WeatherFeatureCollection = { type: 'FeatureCollection', features }

    await redis.set(CACHE_KEY, result, { ex: CACHE_TTL })
    logger.debug({ count: features.length, temp: obs.temp, wind: obs.wind }, 'weather:alerts:computed')
    return result

  } catch (err) {
    logger.warn({ err }, 'weather:meteosuisse:fetch-failed')
    return { type: 'FeatureCollection', features: [] }
  }
}
