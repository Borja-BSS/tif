import { redis }  from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { TpgDisruption } from './types'

const CACHE_KEY = 'tif:transport:tpg:v2'  // v2 — corrected stop IDs
const CACHE_TTL = 120  // 2 minutes

const STATIONBOARD_URL = 'https://transport.opendata.ch/v1/stationboard'
const DELAY_THRESHOLD  = 3  // minutes

// Verified TPG stop IDs from transport.opendata.ch/v1/locations
const TPG_STOPS = [
  { id: '8587057', name: 'Cornavin',        lat: 46.209742, lng: 6.142420 },
  { id: '8587387', name: 'Bel-Air',         lat: 46.204747, lng: 6.143032 },
  { id: '8587061', name: 'Rive',            lat: 46.201872, lng: 6.152792 },
  { id: '8587907', name: 'Plainpalais',     lat: 46.198051, lng: 6.142789 },
  { id: '8592775', name: 'Aéroport-Term.', lat: 46.230831, lng: 6.109871 },
]

interface StationboardDep {
  stop:      { delay?: number | null; departure?: string }
  number?:   string
  category?: string
  name?:     string
  operator?: string
}

interface StationboardResp {
  stationboard?: StationboardDep[]
}

async function fetchStopDelays(
  stop: (typeof TPG_STOPS)[number],
): Promise<TpgDisruption[]> {
  const url = new URL(STATIONBOARD_URL)
  url.searchParams.set('id', stop.id)
  url.searchParams.set('limit', '20')
  url.searchParams.append('transportations[]', 'tram')
  url.searchParams.append('transportations[]', 'bus')

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(7_000), cache: 'no-store' })
  if (!res.ok) return []

  const data = await res.json() as StationboardResp
  const disruptions: TpgDisruption[] = []

  for (const dep of data.stationboard ?? []) {
    const delay     = dep.stop.delay ?? 0
    const lineNum   = dep.number ?? dep.category ?? '?'
    // Only TPG-operated services
    if ((dep.operator ?? '').toUpperCase() !== 'TPG') continue
    if (delay < DELAY_THRESHOLD) continue

    const type: TpgDisruption['type'] = delay >= 15 ? 'suppression' : 'retard'

    disruptions.push({
      id:            `tpg-${stop.id}-${lineNum}-${dep.stop.departure ?? Date.now()}`,
      lineNumber:    lineNum,
      type,
      description:   `Ligne ${lineNum} — retard ${delay} min (${stop.name})`,
      affectedStops: [stop.name],
      direction:     undefined,
      coordinates:   [stop.lat, stop.lng],
      detectedAt:    dep.stop.departure ?? new Date().toISOString(),
    })
  }

  return disruptions
}

export async function getTpgDisruptions(): Promise<TpgDisruption[]> {
  try {
    const cached = await redis.get<TpgDisruption[]>(CACHE_KEY)
    if (cached) return cached
  } catch (err) {
    logger.warn({ err }, 'tpg-disruptions:redis-get-failed')
  }

  try {
    const results = await Promise.allSettled(TPG_STOPS.map(s => fetchStopDelays(s)))

    const seen = new Set<string>()
    const disruptions: TpgDisruption[] = results.flatMap(r => {
      if (r.status !== 'fulfilled') return []
      return r.value.filter(d => {
        const key = `${d.lineNumber}-${d.affectedStops[0]}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    })

    logger.debug({ count: disruptions.length }, 'tpg-disruptions:fetched')

    try {
      await redis.set(CACHE_KEY, disruptions, { ex: CACHE_TTL })
    } catch (err) {
      logger.warn({ err }, 'tpg-disruptions:redis-set-failed')
    }

    return disruptions
  } catch (err) {
    logger.warn({ err }, 'tpg-disruptions:fetch-failed')
    return []
  }
}
