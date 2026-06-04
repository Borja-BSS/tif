import type { CarRoute } from './here-router'

export interface RecalcTrigger {
  reason:           'new_incident' | 'congestion_increase' | 'faster_alternative'
  severity:         'low' | 'medium' | 'high'
  affectedGeohash:  string
  timeSavedSeconds?: number
}

interface ZoneConsensus {
  geohash6:      string
  realityStatus: string
  confidence:    number
  divergence:    boolean
}

export function checkRouteImpact(
  currentRoute: CarRoute,
  newConsensus: ZoneConsensus,
): RecalcTrigger | null {
  const routeGeohashes = getRouteGeohashes(currentRoute.geometry)
  const isOnRoute = routeGeohashes.includes(newConsensus.geohash6)

  if (!isOnRoute) return null

  if (newConsensus.realityStatus === 'BLOCKED') {
    return { reason: 'new_incident', severity: 'high', affectedGeohash: newConsensus.geohash6 }
  }

  if (newConsensus.realityStatus === 'HEAVY' && newConsensus.divergence) {
    return { reason: 'congestion_increase', severity: 'medium', affectedGeohash: newConsensus.geohash6 }
  }

  return null
}

function getRouteGeohashes(geometry: [number, number][]): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ngeohash = require('ngeohash') as { encode: (lat: number, lng: number, precision: number) => string }
    const hashes   = new Set<string>()
    for (let i = 0; i < geometry.length; i += 5) {
      const [lng, lat] = geometry[i]
      hashes.add(ngeohash.encode(lat, lng, 6))
    }
    return Array.from(hashes)
  } catch {
    return []
  }
}
