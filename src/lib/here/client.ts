export const GENEVE_BBOX = {
  north: 46.45,
  south: 46.05,
  east:  6.60,
  west:  5.85,
} as const

// Format HERE API v7 : bbox:minLon,minLat,maxLon,maxLat
export const BBOX_IN = `bbox:${GENEVE_BBOX.west},${GENEVE_BBOX.south},${GENEVE_BBOX.east},${GENEVE_BBOX.north}`

const HERE_BASE = 'https://data.traffic.hereapi.com/v7'

export async function hereGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`${HERE_BASE}${path}`)
  url.searchParams.set('apiKey', process.env.HERE_API_KEY!)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(8000),
    next:   { revalidate: 30 },
  })

  if (!res.ok) throw new Error(`HERE API ${res.status}: ${path}`)
  return res.json() as Promise<T>
}
