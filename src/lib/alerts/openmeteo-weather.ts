/**
 * Weather alerts from OpenMeteo — free, no API key, ultra-fiable
 */
import type { FeatureCollection, Feature, Point } from 'geojson'

// WMO weather codes → description + icon
const WMO_LABEL: Record<number, { label: string; icon: string; severity: 'major' | 'minor' | 'lowImpact' }> = {
  51:  { label: 'Bruine légère',              icon: '🌦️', severity: 'lowImpact' },
  53:  { label: 'Bruine modérée',             icon: '🌦️', severity: 'minor' },
  55:  { label: 'Bruine dense',               icon: '🌧️', severity: 'minor' },
  61:  { label: 'Pluie faible',               icon: '🌧️', severity: 'lowImpact' },
  63:  { label: 'Pluie modérée',              icon: '🌧️', severity: 'minor' },
  65:  { label: 'Pluie forte',                icon: '🌧️', severity: 'major' },
  71:  { label: 'Chute de neige faible',      icon: '❄️', severity: 'minor' },
  73:  { label: 'Chute de neige modérée',     icon: '❄️', severity: 'major' },
  75:  { label: 'Chute de neige forte',       icon: '❄️', severity: 'major' },
  77:  { label: 'Grêle',                      icon: '🌨️', severity: 'major' },
  80:  { label: 'Averses faibles',            icon: '🌦️', severity: 'lowImpact' },
  81:  { label: 'Averses modérées',           icon: '🌧️', severity: 'minor' },
  82:  { label: 'Averses violentes',          icon: '⛈️', severity: 'major' },
  85:  { label: 'Averses de neige',           icon: '❄️', severity: 'major' },
  95:  { label: 'Orage',                      icon: '⛈️', severity: 'major' },
  96:  { label: 'Orage avec grêle',           icon: '⛈️', severity: 'major' },
  99:  { label: 'Orage violent avec grêle',   icon: '⛈️', severity: 'major' },
}

interface OpenMeteoResponse {
  hourly: {
    time:                     string[]
    precipitation_probability: number[]
    weather_code:             number[]
  }
  daily: {
    time:             string[]
    precipitation_sum: number[]
    wind_speed_10m_max: number[]
  }
}

export interface WeatherProperties {
  id:          string
  type:        'weather'
  criticality: 'major' | 'minor' | 'lowImpact'
  description: string
  icon:        string
  color:       string
  startTime:   string
  endTime:     string | null
  source:      'OpenMeteo'
}

export type WeatherFeatureCollection = FeatureCollection<Point, WeatherProperties>

// Coordonnées Genève-ville pour ancrer les alertes météo
const GE_CENTER: [number, number] = [6.1432, 46.2044]

export async function getWeatherAlerts(): Promise<WeatherFeatureCollection> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude',   '46.2044')
  url.searchParams.set('longitude',  '6.1432')
  url.searchParams.set('hourly',     'precipitation_probability,weather_code')
  url.searchParams.set('daily',      'precipitation_sum,wind_speed_10m_max')
  url.searchParams.set('forecast_days', '2')
  url.searchParams.set('timezone',   'Europe/Zurich')

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error(`OpenMeteo HTTP ${res.status}`)

  const data = await res.json() as OpenMeteoResponse
  const features: Feature<Point, WeatherProperties>[] = []
  const now = new Date()

  // Alertes horaires — 12 prochaines heures uniquement
  const times = data.hourly.time
  for (let i = 0; i < Math.min(times.length, 12); i++) {
    const t       = new Date(times[i])
    if (t < now) continue

    const prob    = data.hourly.precipitation_probability[i]
    const wmo     = data.hourly.weather_code[i]
    const info    = WMO_LABEL[wmo]

    // Alerter si risque de précipitation > 60% ou code météo significatif
    if (prob < 60 && (!info || info.severity === 'lowImpact')) continue

    const label = info?.label ?? 'Conditions météo'
    const icon  = info?.icon  ?? '⛅'
    const sev   = info?.severity ?? 'minor'

    const hh = t.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })
    const dd = t.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Zurich' })

    features.push({
      type: 'Feature',
      properties: {
        id:          `meteo-${i}`,
        type:        'weather',
        criticality: sev,
        description: `${label} prévu — ${dd} à ${hh} · Risque ${prob}%`,
        icon,
        color:       sev === 'major' ? '#5856D6' : '#007AFF',
        startTime:   t.toISOString(),
        endTime:     null,
        source:      'OpenMeteo',
      },
      geometry: { type: 'Point', coordinates: GE_CENTER },
    })

    if (features.length >= 3) break  // max 3 alertes météo
  }

  // Alerte vent si > 50 km/h
  const wind = data.daily.wind_speed_10m_max[0]
  if (wind > 50) {
    features.push({
      type: 'Feature',
      properties: {
        id:          'meteo-wind',
        type:        'weather',
        criticality: wind > 70 ? 'major' : 'minor',
        description: `💨 Rafales jusqu'à ${Math.round(wind)} km/h prévues sur le Grand Genève`,
        icon:        '💨',
        color:       '#5856D6',
        startTime:   new Date().toISOString(),
        endTime:     null,
        source:      'OpenMeteo',
      },
      geometry: { type: 'Point', coordinates: GE_CENTER },
    })
  }

  return { type: 'FeatureCollection', features }
}
