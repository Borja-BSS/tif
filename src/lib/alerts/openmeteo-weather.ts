/**
 * Weather alerts from OpenMeteo — free, no API key, ultra-fiable
 */
import type { FeatureCollection, Feature, Point } from 'geojson'

// WMO weather codes → description + icon (codes complets 0-99)
const WMO_LABEL: Record<number, { label: string; icon: string; severity: 'major' | 'minor' | 'lowImpact' }> = {
  0:   { label: 'Ciel dégagé',               icon: '☀️',  severity: 'lowImpact' },
  1:   { label: 'Principalement dégagé',     icon: '🌤️', severity: 'lowImpact' },
  2:   { label: 'Partiellement nuageux',     icon: '⛅',  severity: 'lowImpact' },
  3:   { label: 'Couvert',                   icon: '☁️',  severity: 'lowImpact' },
  45:  { label: 'Brouillard',                icon: '🌫️', severity: 'minor' },
  48:  { label: 'Brouillard givrant',        icon: '🌫️', severity: 'minor' },
  51:  { label: 'Bruine légère',             icon: '🌦️', severity: 'lowImpact' },
  53:  { label: 'Bruine modérée',            icon: '🌦️', severity: 'minor' },
  55:  { label: 'Bruine dense',              icon: '🌧️', severity: 'minor' },
  61:  { label: 'Pluie faible',              icon: '🌧️', severity: 'lowImpact' },
  63:  { label: 'Pluie modérée',             icon: '🌧️', severity: 'minor' },
  65:  { label: 'Pluie forte',               icon: '🌧️', severity: 'major' },
  71:  { label: 'Chute de neige faible',     icon: '❄️',  severity: 'minor' },
  73:  { label: 'Chute de neige modérée',    icon: '❄️',  severity: 'major' },
  75:  { label: 'Chute de neige forte',      icon: '❄️',  severity: 'major' },
  77:  { label: 'Grêle',                     icon: '🌨️', severity: 'major' },
  80:  { label: 'Averses faibles',           icon: '🌦️', severity: 'lowImpact' },
  81:  { label: 'Averses modérées',          icon: '🌧️', severity: 'minor' },
  82:  { label: 'Averses violentes',         icon: '⛈️', severity: 'major' },
  85:  { label: 'Averses de neige',          icon: '❄️',  severity: 'major' },
  95:  { label: 'Orage',                     icon: '⛈️', severity: 'major' },
  96:  { label: 'Orage avec grêle',          icon: '⛈️', severity: 'major' },
  99:  { label: 'Orage violent avec grêle',  icon: '⛈️', severity: 'major' },
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

interface OpenMeteoFull {
  current: {
    weather_code:    number
    precipitation:   number
    wind_speed_10m:  number
  }
  hourly: {
    time:                      string[]
    precipitation_probability: number[]
    weather_code:              number[]
  }
  daily: {
    time:                        string[]
    precipitation_probability_max: number[]
    wind_speed_10m_max:          number[]
    weather_code:                number[]
  }
}

export async function getWeatherAlerts(): Promise<WeatherFeatureCollection> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude',      '46.2044')
  url.searchParams.set('longitude',     '6.1432')
  url.searchParams.set('current',       'weather_code,precipitation,wind_speed_10m')
  url.searchParams.set('hourly',        'precipitation_probability,weather_code')
  url.searchParams.set('daily',         'precipitation_probability_max,wind_speed_10m_max,weather_code')
  url.searchParams.set('forecast_days', '3')
  url.searchParams.set('timezone',      'Europe/Zurich')

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error(`OpenMeteo HTTP ${res.status}`)

  const data = await res.json() as OpenMeteoFull
  const features: Feature<Point, WeatherProperties>[] = []

  // --- 1. Conditions actuelles — toujours affichées (fallback si code inconnu) ---
  const curWmo  = data.current.weather_code
  const curInfo = WMO_LABEL[curWmo] ?? { label: 'Conditions météo', icon: '⛅', severity: 'lowImpact' as const }
  const precip  = data.current.precipitation
  const curWind = data.current.wind_speed_10m
  let curDesc = `${curInfo.icon} ${curInfo.label} à Genève`
  if (precip > 0)   curDesc += ` · ${precip.toFixed(1)} mm`
  if (curWind > 40) curDesc += ` · Vent ${Math.round(curWind)} km/h`

  features.push({
    type: 'Feature',
    properties: {
      id:          'meteo-now',
      type:        'weather',
      criticality: curInfo.severity,
      description: curDesc,
      icon:        curInfo.icon,
      color:       curInfo.severity === 'major' ? '#5856D6' : curInfo.severity === 'minor' ? '#007AFF' : '#8E8E93',
      startTime:   new Date().toISOString(),
      endTime:     null,
      source:      'OpenMeteo',
    },
    geometry: { type: 'Point', coordinates: GE_CENTER },
  })

  // --- 2. Prévisions journalières — aujourd'hui + 2 prochains jours ---
  const dailyTimes = data.daily.time

  for (let i = 0; i < dailyTimes.length; i++) {
    const prob = data.daily.precipitation_probability_max[i]
    const wmo  = data.daily.weather_code[i]
    const wind = data.daily.wind_speed_10m_max[i]
    const info = WMO_LABEL[wmo] ?? { label: 'Conditions variables', icon: '⛅', severity: 'lowImpact' as const }

    const dayLabel = new Date(dailyTimes[i] + 'T12:00:00').toLocaleDateString('fr-CH', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Zurich',
    })

    let desc = `${info.icon} ${info.label} — ${dayLabel}`
    if (prob > 0)  desc += ` · Risque pluie ${prob}%`
    if (wind > 50) desc += ` · Rafales ${Math.round(wind)} km/h`

    features.push({
      type: 'Feature',
      properties: {
        id:          `meteo-day-${i}`,
        type:        'weather',
        criticality: prob >= 60 ? 'minor' : info.severity,
        description: desc,
        icon:        info.icon,
        color:       prob >= 60 ? '#007AFF' : '#8E8E93',
        startTime:   new Date(dailyTimes[i] + 'T06:00:00').toISOString(),
        endTime:     new Date(dailyTimes[i] + 'T22:00:00').toISOString(),
        source:      'OpenMeteo',
      },
      geometry: { type: 'Point', coordinates: GE_CENTER },
    })
  }

  return { type: 'FeatureCollection', features }
}
