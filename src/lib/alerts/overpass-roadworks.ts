/**
 * Roadworks & construction data from OpenStreetMap via Overpass API
 * Free, no API key required, community-maintained
 */
import type { FeatureCollection, Feature, Point } from 'geojson'

const BBOX = '46.05,5.75,46.95,7.00'  // Grand Genève étendu

const QUERY = `
[out:json][timeout:12];
(
  way["highway"="construction"](${BBOX});
  way["construction"~"."](${BBOX});
  node["highway"="construction"](${BBOX});
  way["access"="no"]["temporary"="yes"](${BBOX});
);
out center tags 30;
`.trim()

export interface OverpassProperties {
  id:          string
  type:        'construction'
  criticality: 'major' | 'minor'
  description: string
  icon:        string
  color:       string
  startTime:   string
  endTime:     string | null
  source:      'OSM'
}

export type OverpassFeatureCollection = FeatureCollection<Point, OverpassProperties>

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id:   number
  lat?: number   // nodes
  lon?: number
  center?: { lat: number; lon: number }  // ways
  tags?: Record<string, string>
}

export async function getOverpassRoadworks(): Promise<OverpassFeatureCollection> {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `data=${encodeURIComponent(QUERY)}`,
    signal:  AbortSignal.timeout(14000),
  })

  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)

  const data = await res.json() as { elements: OverpassElement[] }

  const features: Feature<Point, OverpassProperties>[] = data.elements
    .filter(el => el.lat != null || el.center != null)
    .map(el => {
      const lat = el.lat ?? el.center!.lat
      const lon = el.lon ?? el.center!.lon
      const tags = el.tags ?? {}

      const name    = tags['name'] ?? tags['description'] ?? tags['ref'] ?? ''
      const highway = tags['highway'] ?? ''
      const constr  = tags['construction'] ?? ''

      const what = constr || highway || 'travaux'
      const desc  = name
        ? `🚧 Travaux — ${name}`
        : `🚧 Chantier en cours (${what})`

      return {
        type: 'Feature' as const,
        properties: {
          id:          `osm-${el.id}`,
          type:        'construction' as const,
          criticality: 'minor' as const,
          description: desc,
          icon:        '🚧',
          color:       '#FF9500',
          startTime:   new Date().toISOString(),
          endTime:     null,
          source:      'OSM' as const,
        },
        geometry: { type: 'Point' as const, coordinates: [lon, lat] },
      }
    })

  return { type: 'FeatureCollection', features }
}
