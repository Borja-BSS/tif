const PHOTON_BASE = 'https://photon.komoot.io/api'
const GENEVE      = { lat: 46.2044, lng: 6.1432 }
const BBOX        = { minLat: 46.05, maxLat: 46.45, minLng: 5.85, maxLng: 6.60 }

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

  const url = new URL(PHOTON_BASE + '/')
  url.searchParams.set('q',     query.trim())
  url.searchParams.set('lat',   String(GENEVE.lat))
  url.searchParams.set('lon',   String(GENEVE.lng))
  url.searchParams.set('limit', '8')
  url.searchParams.set('lang',  'fr')
  url.searchParams.set('location_bias_scale', '1.4')
  for (const l of ['house', 'street', 'city', 'district', 'locality', 'county']) {
    url.searchParams.append('layer', l)
  }

  const finalUrl = url.toString()
  console.log('[search-engine] fetching:', finalUrl)

  const res = await fetch(finalUrl, {
    headers: { 'User-Agent': 'TIF-App/1.0' },
    cache:   'no-store',
  })

  console.log('[search-engine] Photon status:', res.status)
  if (!res.ok) {
    console.error('[search-engine] Photon error:', res.status, res.statusText)
    return []
  }

  const data = await res.json() as { features?: PhotonFeature[] }
  const total = data.features?.length ?? 0
  console.log('[search-engine] Photon features:', total)

  const results = (data.features ?? [])
    .filter(inGeneva)
    .map(toResult)
    .filter((r): r is SearchResult => r !== null)
    .sort((a, b) => scoreResult(b) - scoreResult(a))
    .slice(0, 7)

  console.log('[search-engine] filtered results:', results.length)
  return results
}

export async function geocodeAddress(address: string): Promise<SearchResult | null> {
  const res = await searchPlaces(address)
  return res[0] ?? null
}

interface PhotonFeature {
  geometry:   { type: 'Point'; coordinates: [number, number] }
  properties: Record<string, unknown>
}

function scoreResult(r: SearchResult): number {
  let score = 0
  const text = `${r.title} ${r.subtitle ?? ''}`.toLowerCase()
  if (/gen[eè]ve|geneva/i.test(text)) score += 2
  if (/tpg/i.test(text)) score += 1
  return score
}

function inGeneva(f: PhotonFeature): boolean {
  const [lng, lat] = f.geometry.coordinates
  const pass = lat > BBOX.minLat && lat < BBOX.maxLat && lng > BBOX.minLng && lng < BBOX.maxLng
  if (!pass) console.log('[search-engine] filtered OUT:', f.properties.name, [lng,lat])
  return pass
}

function str(v: unknown): string { return typeof v === 'string' ? v : '' }
function num(v: unknown): number { return typeof v === 'number' ? v : 0  }

function toResult(f: PhotonFeature): SearchResult | null {
  const p          = f.properties
  const [lng, lat] = f.geometry.coordinates

  const osmId    = num(p.osm_id)
  const osmType  = str(p.osm_type)
  const osmValue = str(p.osm_value)
  const name     = str(p.name)
  const street   = str(p.street)
  const houseNo  = str(p.housenumber)
  const city     = str(p.city)
  const country  = str(p.country)

  let title = ''
  if (name && name !== street) {
    title = name
  } else if (street) {
    title = houseNo ? `${street} ${houseNo}` : street
    if (city && !title.includes(city)) title += `, ${city}`
  } else if (city) {
    title = city
  } else {
    console.log('[search-engine] toResult returning null for:', p)
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
