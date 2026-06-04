import { redis } from '@/lib/redis'

// Photon (Komoot/OSM) — geocoder sans API key, optimisé Grand Genève
// https://photon.komoot.io
const PHOTON_BASE  = 'https://photon.komoot.io/api'
const GENEVE       = { lat: 46.2044, lng: 6.1432 }
// Bbox Grand Genève filtre les résultats hors zone
const BBOX = { minLat: 45.8, maxLat: 46.7, minLng: 5.5, maxLng: 7.2 }

export interface SearchResult {
  id:        string
  title:     string
  subtitle?: string
  lat:       number
  lng:       number
  type:      'address' | 'place' | 'street' | 'station'
}

// Valeurs osm_value qui indiquent un arrêt/gare de transport
const TRANSIT_VALUES = new Set([
  'bus_stop','tram_stop','station','halt','stop_position',
  'platform','subway_entrance','ferry_terminal','aerodrome',
])

export async function searchPlaces(query: string): Promise<SearchResult[]> {
  if (query.trim().length < 2) return []

  const key = `tif:geocode:v3:${query.toLowerCase().trim()}`
  try {
    const hit = await redis.get(key)
    if (hit) return JSON.parse(hit as string)
  } catch { /* cache miss OK */ }

  try {
    // Photon: les layers doivent être passés séparément, pas en virgule
    const url = new URL(PHOTON_BASE + '/')
    url.searchParams.set('q',     query.trim())
    url.searchParams.set('lat',   String(GENEVE.lat))
    url.searchParams.set('lon',   String(GENEVE.lng))
    url.searchParams.set('limit', '8')
    url.searchParams.set('lang',  'fr')
    // Append layers individuellement (format correct Photon)
    for (const l of ['house', 'street', 'city', 'district', 'locality', 'county']) {
      url.searchParams.append('layer', l)
    }

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'TIF-G7-LiveView/1.0 (contact@borja-swiss-solutions.ch)' },
      signal:  AbortSignal.timeout(6000),
    })
    if (!res.ok) return []

    const data = await res.json() as { features?: PhotonFeature[] }

    const results = (data.features ?? [])
      .filter(inGeneva)
      .map(toResult)
      .filter((r): r is SearchResult => r !== null)
      .slice(0, 7)

    if (results.length > 0) {
      await redis.setex(key, 300, JSON.stringify(results)).catch(() => null)
    }
    return results
  } catch {
    return []
  }
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

function str(v: unknown): string  { return typeof v === 'string' ? v : '' }
function num(v: unknown): number  { return typeof v === 'number' ? v : 0  }

function toResult(f: PhotonFeature): SearchResult | null {
  const p        = f.properties
  const [lng, lat] = f.geometry.coordinates
  if (!lng || !lat) return null

  const osmId    = num(p.osm_id)
  const osmType  = str(p.osm_type)
  const osmValue = str(p.osm_value)
  const name     = str(p.name)
  const street   = str(p.street)
  const houseNo  = str(p.housenumber)
  const city     = str(p.city)
  const state    = str(p.state)
  const country  = str(p.country)

  // Build title — même logique que Waze : "nom connu" > "rue n°" > "ville"
  let title = ''
  if (name && name !== street) {
    // Lieu nommé (gare, commerce, quartier, commune)
    title = name
  } else if (street) {
    title = houseNo ? `${street} ${houseNo}` : street
    if (city && title !== city) title = `${title}, ${city}`
  } else if (city) {
    title = city
  } else {
    return null
  }

  // Subtitle : ville + pays
  const subtitleParts = [city !== title ? city : '', country].filter(Boolean)
  const subtitle = subtitleParts.join(', ') || undefined

  // Type : transport > place > street > address
  const type: SearchResult['type'] = TRANSIT_VALUES.has(osmValue)
    ? 'station'
    : (osmValue === 'city' || osmValue === 'village' || osmValue === 'town' || osmValue === 'district')
      ? 'place'
      : street && !houseNo
        ? 'street'
        : 'address'

  const id = `photon-${osmType}-${osmId || Math.random().toString(36).slice(2)}`
  return { id, title, subtitle, lat, lng, type }
}
