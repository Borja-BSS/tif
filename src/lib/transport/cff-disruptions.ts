import { redis }  from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { CffDisruption } from './types'

const CACHE_KEY = 'tif:cff:disruptions'
const CACHE_TTL = 300  // 5 minutes

const CEVA_CATEGORIES = new Set(['L', 'L1', 'L2', 'L3', 'L4', 'L5'])

// Grand Genève stations to query — covers CEVA + CFF intercity + RER
const QUERY_STATIONS = ['Genève', 'Genève-Aéroport', 'Annemasse']

// Hardcoded station coordinates — [lat, lng]
const STATION_COORDS: Record<string, [number, number]> = {
  'Genève':              [46.2101, 6.1425],
  'Genève-Aéroport':     [46.2325, 6.1094],
  'Lancy-Pont-Rouge':    [46.1847, 6.1358],
  'Carouge-Bachet':      [46.1778, 6.1433],
  'Chêne-Bourg':         [46.1956, 6.2047],
  'Genève-Sécheron':     [46.2231, 6.1383],
  'Vernier-Meyrin':      [46.2194, 6.0869],
  'Annemasse':           [46.1936, 6.2378],
  'Coppet':              [46.3167, 6.1833],
  'Nyon':                [46.3833, 6.2333],
  'Lausanne':            [46.5167, 6.6333],
  'Bellegarde':          [46.1078, 5.8261],
}

interface StationboardEntry {
  category?: string
  number?:   string
  to?:       string
  stop?: {
    delay?:     number | null
    departure?: string | null
  }
}

interface StationboardResponse {
  stationboard?: StationboardEntry[]
}

function stationCoords(name: string): [number, number] {
  if (STATION_COORDS[name]) return STATION_COORDS[name]
  for (const [k, v] of Object.entries(STATION_COORDS)) {
    if (name.includes(k) || k.includes(name)) return v
  }
  return [46.2101, 6.1425]  // fallback: Cornavin
}

export async function getCffDisruptions(): Promise<CffDisruption[]> {
  try {
    const cached = await redis.get<CffDisruption[]>(CACHE_KEY)
    if (cached) return cached
  } catch (err) {
    logger.warn({ err }, 'cff-disruptions:redis-get-failed')
  }

  const results = await Promise.allSettled(
    QUERY_STATIONS.map(async (station) => {
      const url = `https://transport.opendata.ch/v1/stationboard?station=${encodeURIComponent(station)}&limit=20`
      const res  = await fetch(url, { signal: AbortSignal.timeout(8_000), cache: 'no-store' })
      if (!res.ok) throw new Error(`stationboard:${station}:${res.status}`)
      return { station, data: await res.json() as StationboardResponse }
    })
  )

  const disruptions: CffDisruption[] = []
  let idCounter = 0

  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const { station, data } = result.value

    for (const entry of data.stationboard ?? []) {
      const delay = entry.stop?.delay
      if (!delay || delay < 3) continue  // only meaningful delays

      const category = (entry.category ?? '').trim()
      const number   = (entry.number ?? '').trim()
      const line     = number ? `${category} ${number}` : category
      const isCEVA   = CEVA_CATEGORIES.has(category) || /^L[1-5]$/.test(category)

      disruptions.push({
        id:           `cff-${station}-${++idCounter}`,
        line,
        type:         delay > 30 ? 'suppression' : 'retard',
        from:         station,
        to:           entry.to ?? '—',
        delayMinutes: delay,
        description:  `Départ retardé de ${delay} min · ${line} → ${entry.to ?? '?'}`,
        coordinates:  stationCoords(station),
        isCEVA,
        detectedAt:   entry.stop?.departure ?? new Date().toISOString(),
      })
    }
  }

  logger.debug({ count: disruptions.length }, 'cff-disruptions:fetched')

  try {
    await redis.set(CACHE_KEY, disruptions, { ex: CACHE_TTL })
  } catch (err) {
    logger.warn({ err }, 'cff-disruptions:redis-set-failed')
  }

  return disruptions
}
