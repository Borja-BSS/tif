import { redis }  from '@/lib/redis'
import { logger } from '@/lib/logger'

const CACHE_PREFIX = 'tif:stop:'
const CACHE_TTL    = 604_800  // 7 days

// Hardcoded TPG stops + Grand Genève landmarks — [lat, lng]
export const KNOWN_STOPS: Record<string, [number, number]> = {
  'Place des Eaux-Vives':  [46.2003, 6.1672],
  'Genève-Plage':          [46.2089, 6.1731],
  'Grand-Saconnex':        [46.2378, 6.1108],
  'Cornavin':              [46.2101, 6.1425],
  'Gare de Cornavin':      [46.2101, 6.1425],
  'Rive':                  [46.2022, 6.1583],
  'Bachet-de-Pesay':       [46.1778, 6.1433],
  'Lancy-Pont-Rouge':      [46.1847, 6.1358],
  'Thônex-Vallard':        [46.1991, 6.2081],
  'Meyrin-Village':        [46.2278, 6.0808],
  'Aéroport':              [46.2325, 6.1094],
  'Genève-Aéroport':       [46.2325, 6.1094],
  'Onex':                  [46.1833, 6.1083],
  'Carouge':               [46.1833, 6.1333],
  'Chêne-Bougeries':       [46.1978, 6.2056],
  'Chêne-Bourg':           [46.1956, 6.2047],
  'Champel':               [46.1933, 6.1500],
  'Nations':               [46.2256, 6.1417],
  'Palais des Nations':    [46.2267, 6.1394],
  'Plainpalais':           [46.1978, 6.1408],
  'Saint-Jean':            [46.2067, 6.1178],
  'Vernier':               [46.2167, 6.0833],
  'Meyrin':                [46.2331, 6.0783],
  'Praille':               [46.1833, 6.1250],
  'Moillesulaz':           [46.1889, 6.2194],
  'Genève-Sécheron':       [46.2231, 6.1383],
  'Annemasse':             [46.1936, 6.2378],
  'Coppet':                [46.3167, 6.1833],
  'Nyon':                  [46.3833, 6.2333],
  'Lausanne':              [46.5167, 6.6333],
  'Bellegarde':            [46.1078, 5.8261],
  'Carouge-Bachet':        [46.1778, 6.1433],
  'Vernier-Meyrin':        [46.2194, 6.0869],
}

interface OpenDataLocation {
  coordinate?: { x?: number; y?: number }
}

interface OpenDataResponse {
  stations?: OpenDataLocation[]
}

export async function geocodeStop(name: string): Promise<[number, number] | null> {
  const normalized = name.trim()

  // 1. Exact match
  if (KNOWN_STOPS[normalized]) return KNOWN_STOPS[normalized]

  // 2. Partial match (case-insensitive)
  const lower = normalized.toLowerCase()
  for (const [key, coords] of Object.entries(KNOWN_STOPS)) {
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
      return coords
    }
  }

  // 3. Redis cache for previously resolved stops
  const cacheKey = `${CACHE_PREFIX}${normalized.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '')}`
  try {
    const cached = await redis.get<[number, number]>(cacheKey)
    if (cached) return cached
  } catch { /* ignore */ }

  // 4. transport.opendata.ch fallback
  try {
    const url = `https://transport.opendata.ch/v1/locations?query=${encodeURIComponent(normalized)}&type=station`
    const res  = await fetch(url, { signal: AbortSignal.timeout(5_000), cache: 'no-store' })
    if (res.ok) {
      const data = await res.json() as OpenDataResponse
      const loc  = data.stations?.[0]
      if (loc?.coordinate?.x && loc?.coordinate?.y) {
        // transport.opendata.ch: x = latitude, y = longitude
        const coords: [number, number] = [loc.coordinate.x, loc.coordinate.y]
        try {
          await redis.set(cacheKey, coords, { ex: CACHE_TTL })
        } catch { /* ignore */ }
        return coords
      }
    }
  } catch (err) {
    logger.warn({ err, name }, 'stop-geocoder:api-failed')
  }

  return null
}
