// Photon (Komoot/OSM) — geocoder open-source, sans API key
// https://photon.komoot.io
const PHOTON_BASE = 'https://photon.komoot.io/api'
const GENEVE      = { lat: 46.2044, lng: 6.1432 }
const BBOX        = { minLat: 45.8, maxLat: 46.7, minLng: 5.5, maxLng: 7.2 }

export interface SearchResult {
  id:        string
  title:     string
  subtitle?: string
  lat:       number
  lng:       number
  type:      'address' | 'place' | 'street' | 'station'
}

const TRANSIT_VALUES = new Set([
  'bus_stop', 'tram_stop', 'station', 'halt', 'stop_position',
  'platform', 'subway_entrance', 'ferry_terminal',
])

export async function searchPlaces(query: string): Promise<SearchResult[]> {
  if (query.trim().length < 2) return []

  // Photon: layers must be appended individually (comma-separated breaks the param)
  const url = new URL(PHOTON_BASE + '/')
  url.searchParams.set('q',     query.trim())
  url.searchParams.set('lat',   String(GENEVE.lat))
  url.searchParams.set('lon',   String(GENEVE.lng))
  url.searchParams.set('limit', '8')
  url.searchParams.set('lang',  'fr')
  for (const l of ['house', 'street', 'city', 'district', 'locality', 'county']) {
    url.searchParams.append('layer', l)
  }

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'TIF-G7-LiveView/1.0' },
    // No AbortSignal — let Vercel handle the timeout natively
  })

  if (!res.ok) return []

  const data = await res.json() as { features?: PhotonFeature[] }

  return (data.features ?? [])
    .filter(inGeneva)
    .map(toResult)
    .filter((r): r is SearchResult => r !== null)
    .slice(0, 7)
}

export async function geocodeAddress(address: string): Promise<SearchResult | null> {
  const res = await searchPlaces(address)
  return res[0] ?? null
}

// ── Photon internals ──────────────────────────────────────────────────────────
interface PhotonFeature {
  geometry:   { type: 'Point'; coordinates: [number, number] }
  properties: Record<string, unknown>
}

function inGeneva(f: PhotonFeature): boolean {
  const [lng, lat] = f.geometry.coordinates
  return lat > BBOX.minLat && lat < BBOX.maxLat && lng > BBOX.minLng && lng < BBOX.maxLng
}

function str(v: unknown): string { return typeof v === 'string' ? v : '' }
function num(v: unknown): number { return typeof v === 'number' ? v : 0  }

function toResult(f: PhotonFeature): SearchResult | null {
  const p             = f.properties
  const [lng, lat]    = f.geometry.coordinates
  if (!lng || !lat)   return null

  const osmId    = num(p.osm_id)
  const osmType  = str(p.osm_type)
  const osmValue = str(p.osm_value)
  const name     = str(p.name)
  const street   = str(p.street)
  const houseNo  = str(p.housenumber)
  const city     = str(p.city)
  const country  = str(p.country)

  // Build title — named place > street + number > city
  let title = ''
  if (name && name !== street) {
    title = name
  } else if (street) {
    title = houseNo ? `${street} ${houseNo}` : street
    if (city && !title.includes(city)) title += `, ${city}`
  } else if (city) {
    title = city
  } else {
    return null
  }

  const subtitleParts = [city !== title ? city : '', country].filter(Boolean)
  const subtitle      = subtitleParts.join(', ') || undefined

  const type: SearchResult['type'] = TRANSIT_VALUES.has(osmValue) ? 'station'
    : (osmValue === 'city' || osmValue === 'village' || osmValue === 'town') ? 'place'
    : street && !houseNo ? 'street'
    : 'address'

  const id = `photon-${osmType}-${osmId || Math.random().toString(36).slice(2)}`
  return { id, title, subtitle, lat, lng, type }
}
