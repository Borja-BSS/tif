import { cellToLatLng } from 'h3-js'

/** Bounding box Grand Genève — légèrement étendue pour couvrir les zones frontalières. */
export const GRAND_GENEVE_BBOX = {
  latMin: 46.05,
  latMax: 46.45,
  lngMin:  5.85,
  lngMax:  6.60,
} as const

/** Vérifie qu'une paire lat/lng est dans le Grand Genève. */
export function isInBbox(lat: number, lng: number): boolean {
  return (
    lat >= GRAND_GENEVE_BBOX.latMin && lat <= GRAND_GENEVE_BBOX.latMax &&
    lng >= GRAND_GENEVE_BBOX.lngMin && lng <= GRAND_GENEVE_BBOX.lngMax
  )
}

/** Vérifie qu'une cellule H3 (geohash6) est dans le Grand Genève. */
export function isCellInBbox(geohash6: string): boolean {
  try {
    const [lat, lng] = cellToLatLng(geohash6)
    return isInBbox(lat, lng)
  } catch {
    return false
  }
}
