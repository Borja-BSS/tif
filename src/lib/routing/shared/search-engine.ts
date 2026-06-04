import { redis } from '@/lib/redis'

// Photon (Komoot) — geocoder OSM open-source, sans API key, priorité région Genève
// Docs : https://photon.komoot.io
const PHOTON_BASE = 'https://photon.komoot.io/api'

// Bounding box Grand Genève pour les résultats : SW (5.85,46.05) → NE (6.60,46.45)
const GENEVE_CENTER = { lat: 46.2044, lng: 6.1432 }

export interface SearchResult {
  id:        string
  title:     string
  subtitle?: string
  lat:       number
  lng:       number
  type:      'address' | 'place' | 'street' | 'station'
  distance?: number
}

// ── Autocomplete (live search) ────────────────────────────────────────────────
export async function searchPlaces(query: string): Promise<SearchResult[]> {
  if (query.length < 2) return []

  const cacheKey = `tif:geocode:photon:${query.toLowerCase().trim()}`
  try {
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached as string)
  } catch { /* cache miss is fine */ }

  try {
    const url = new URL(`${PHOTON_BASE}/`)
    url.searchParams.set('q',     query)
    url.searchParams.set('lat',   String(GENEVE_CENTER.lat))
    url.searchParams.set('lon',   String(GENEVE_CENTER.lng))
    url.searchParams.set('limit', '8')
    url.searchParams.set('lang',  'fr')
    // Restrict to CH + FR (cross-border frontalier)
    url.searchParams.set('layer', 'house,street,city,district,locality,county,state,country')

    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      signal:  AbortSignal.timeout(6000),
    })
    if (!res.ok) return []

    const data = await res.json() as { features?: PhotonFeature[] }
    const results = (data.features ?? [])
      .filter(f => {
        // Keep only results near Grand Genève area
        const [lng, lat] = f.geometry.coordinates
        return lat > 45.8 && lat < 46.6 && lng > 5.5 && lng < 7.0
      })
      .map(photonToResult)
      .filter((r): r is SearchResult => r !== null)
      .slice(0, 7)

    if (results.length > 0) {
      await redis.setex(cacheKey, 300, JSON.stringify(results)).catch(() => null)
    }
    return results
  } catch {
    return []
  }
}

// ── Direct geocode (address → coords) ────────────────────────────────────────
export async function geocodeAddress(address: string): Promise<SearchResult | null> {
  const results = await searchPlaces(address)
  return results[0] ?? null
}

// ── Photon types ──────────────────────────────────────────────────────────────
interface PhotonFeature {
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    osm_id?:   number
    osm_type?: string
    name?:     string
    street?:   string
    housenumber?: string
    city?:     string
    postcode?: string
    country?:  string
    type?:     string
    state?:    string
  }
}

function photonToResult(f: PhotonFeature): SearchResult | null {
  const p   = f.properties
  const [lng, lat] = f.geometry.coordinates
  if (!lng || !lat) return null

  const type = photonType(p.type ?? '')
  const id   = `photon-${p.osm_type ?? 'N'}-${p.osm_id ?? Math.random()}`

  // Build a clean display title
  let title = ''
  if (p.name && p.name !== p.street) {
    title = p.name
  } else if (p.street) {
    title = p.housenumber ? `${p.street} ${p.housenumber}` : p.street
  } else if (p.city) {
    title = p.city
  } else {
    return null
  }

  // Subtitle: city + country
  const parts = [p.city, p.state, p.country].filter(Boolean)
  const subtitle = parts.slice(0, 2).join(', ') || undefined

  return { id, title, subtitle, lat, lng, type }
}

function photonType(osmType: string): SearchResult['type'] {
  switch (osmType) {
    case 'railway_station':
    case 'station':
    case 'bus_stop':
    case 'stop':
    case 'tram_stop':
    case 'subway_entrance':
      return 'station'
    case 'amenity':
    case 'tourism':
    case 'shop':
      return 'place'
    case 'street':
    case 'highway':
      return 'street'
    default:
      return 'address'
  }
}
