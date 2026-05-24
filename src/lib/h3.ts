// Quantification géo RGPD — ADR-002
// Jamais de coordonnées GPS brutes stockées

export type H3Cell = string // résolution 9 ≈ 200m²

/**
 * Quantifie lat/lng en cellule H3 résolution 9.
 * Import dynamique car h3-js est lourd côté client.
 */
export async function toH3Cell(lat: number, lng: number, resolution = 9): Promise<H3Cell> {
  const { latLngToCell } = await import('h3-js')
  return latLngToCell(lat, lng, resolution)
}

/**
 * Centre approximatif d'une cellule H3 (pour affichage carte uniquement).
 */
export async function h3ToCenter(cell: H3Cell): Promise<[number, number]> {
  const { cellToLatLng } = await import('h3-js')
  return cellToLatLng(cell) as [number, number]
}
