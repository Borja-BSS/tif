import { redis } from '@/lib/redis'

const HERE_GEOCODE_BASE = 'https://geocode.search.hereapi.com/v1'

export interface SearchResult {
  id: string
  title: string
  subtitle?: string
  lat: number
  lng: number
  type: 'address' | 'place' | 'street' | 'station'
  distance?: number
}

export async function searchPlaces(query: string): Promise<SearchResult[]> {
  if (query.length < 2) return []

  const cacheKey = `tif:geocode:${query.toLowerCase().trim()}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached as string)

  const url = new URL(`${HERE_GEOCODE_BASE}/autosuggest`)
  url.searchParams.set('q', query)
  url.searchParams.set('at', '46.2044,6.1432')
  url.searchParams.set('in', 'countryCode:CHE,FRA')
  url.searchParams.set('limit', '7')
  url.searchParams.set('lang', 'fr')
  url.searchParams.set('apiKey', process.env.HERE_API_KEY!)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) })
  if (!res.ok) return []

  const data = await res.json()

  const results: SearchResult[] = (data.items ?? [])
    .filter((item: Record<string, unknown>) => item.position)
    .map((item: Record<string, unknown>) => {
      const position = item.position as { lat: number; lng: number }
      const address = item.address as Record<string, string> | undefined
      return {
        id:       String(item.id ?? ''),
        title:    String(item.title ?? ''),
        subtitle: address?.city
          ? `${address.city}, ${address.countryName}`
          : address?.label,
        lat:  position.lat,
        lng:  position.lng,
        type: item.resultType === 'houseNumber' ? 'address'
            : item.resultType === 'place'       ? 'place'
            : item.resultType === 'transit'     ? 'station'
            : 'street',
      }
    })

  if (results.length > 0) {
    await redis.setex(cacheKey, 300, JSON.stringify(results))
  }

  return results
}

export async function geocodeAddress(address: string): Promise<SearchResult | null> {
  const cacheKey = `tif:geocode:direct:${address.toLowerCase().trim()}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached as string)

  const url = new URL(`${HERE_GEOCODE_BASE}/geocode`)
  url.searchParams.set('q', address)
  url.searchParams.set('in', 'countryCode:CHE,FRA')
  url.searchParams.set('limit', '1')
  url.searchParams.set('apiKey', process.env.HERE_API_KEY!)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) })
  if (!res.ok) return null

  const data = await res.json()
  const item = data.items?.[0]
  if (!item) return null

  const result: SearchResult = {
    id:    String(item.id ?? ''),
    title: String(item.title ?? ''),
    lat:   item.position.lat,
    lng:   item.position.lng,
    type:  'address',
  }

  await redis.setex(cacheKey, 3600, JSON.stringify(result))
  return result
}
