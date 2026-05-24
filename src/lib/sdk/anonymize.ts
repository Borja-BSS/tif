/**
 * Transforms d'anonymisation — fonctions pures, aucune I/O.
 * Utilisables côté serveur ET dans un Web Worker navigateur.
 */
import { latLngToCell, cellToLatLng } from 'h3-js'

// Bounding-box Grand Genève (serveur : validation indépendante)
const BBOX = { latMin: 46.1, latMax: 46.4, lngMin: 5.9, lngMax: 6.5 }

export function toGeohash6(lat: number, lng: number): string {
  return latLngToCell(lat, lng, 6)
}

/** Décode un H3 cell → lat/lng (validation bbox serveur-side) */
export function geohash6LatLng(cell: string): [number, number] {
  return cellToLatLng(cell) as [number, number]
}

/**
 * Vitesse m/s → bucket [0–5]
 *   0 = arrêt (<2 km/h)
 *   1 = <15 km/h
 *   2 = 15–30 km/h
 *   3 = 30–60 km/h
 *   4 = 60–90 km/h
 *   5 = 90+ km/h
 */
export function toSpeedBucket(speedMs: number): 0 | 1 | 2 | 3 | 4 | 5 {
  const kmh = speedMs * 3.6
  if (kmh < 2)   return 0
  if (kmh < 15)  return 1
  if (kmh < 30)  return 2
  if (kmh < 60)  return 3
  if (kmh < 90)  return 4
  return 5
}

/**
 * Heading degrés [0–360) → octant [0–7]
 *   0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW
 */
export function toDirectionOctant(heading: number): 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const norm = ((heading % 360) + 360) % 360
  return (Math.round(norm / 45) % 8) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
}

/** Arrondit un timestamp epoch-ms à la minute (k-anonymité temporelle) */
export function toMinuteTimestamp(epochMs: number): number {
  return Math.floor(epochMs / 60_000) * 60_000
}

/** Filtre qualité — à appliquer AVANT anonymisation */
export function isValidRaw(speedMs: number, accuracyM: number): boolean {
  const kmh = speedMs * 3.6
  return accuracyM <= 50 && kmh >= 0 && kmh <= 200
}

/** Vérifie qu'une paire lat/lng est dans le Grand Genève */
export function inBbox(lat: number, lng: number): boolean {
  return lat >= BBOX.latMin && lat <= BBOX.latMax
    && lng >= BBOX.lngMin && lng <= BBOX.lngMax
}

/** Vérifie qu'un H3 cell (geohash6) couvre le Grand Genève */
export function cellInBbox(cell: string): boolean {
  try {
    const [lat, lng] = geohash6LatLng(cell)
    return inBbox(lat, lng)
  } catch {
    return false
  }
}
