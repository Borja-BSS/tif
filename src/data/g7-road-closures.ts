import type { Feature, LineString } from 'geojson'

export interface G7RoadClosureProps {
  id:           string
  description:  string
  section:      string
  criticality:  'critical' | 'major'
  startTime:    string  // ISO UTC
  endTime:      string  // ISO UTC
}

// A1 principal Vaud → Bardonnex (direction France, fermée 15–17 juin)
const A1_MAIN: [number, number][] = [
  [6.190, 46.366],
  [6.170, 46.342],
  [6.156, 46.308],
  [6.142, 46.280],
  [6.119, 46.252],
  [6.107, 46.237],
  [6.089, 46.222],
  [6.072, 46.217],
  [6.083, 46.207],
  [6.094, 46.197],
  [6.118, 46.188],
  [6.132, 46.182],
  [6.115, 46.167],
  [6.098, 46.151],
]

// Bretelle A1aP La Praille → Bardonnex (fermée 15–17 juin)
const A1AP: [number, number][] = [
  [6.133, 46.182],
  [6.120, 46.170],
  [6.098, 46.151],
]

// Sortie Vengeron / Genève-Lac (fermée 14 juin 06h–24h)
const VENGERON: [number, number][] = [
  [6.107, 46.265],
  [6.119, 46.271],
  [6.136, 46.274],
]

export const G7_ROAD_CLOSURES: Feature<LineString, G7RoadClosureProps>[] = [
  {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: A1_MAIN },
    properties: {
      id:          'a1-bardonnex-15-17',
      description: 'A1 fermée direction Bardonnex · Sorties forcées : Meyrin, Vernier, Genève-Centre · Bernex et Perly/Plan-les-Ouates fermés',
      section:     'A1 Vaud → Bardonnex',
      criticality: 'critical',
      startTime:   '2026-06-15T04:00:00Z',
      endTime:     '2026-06-17T22:00:00Z',
    },
  },
  {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: A1AP },
    properties: {
      id:          'a1ap-praille-15-17',
      description: 'Bretelle A1aP La Praille → Bardonnex fermée · Utiliser A1 direction Vernier puis RN1',
      section:     'A1aP La Praille → Bardonnex',
      criticality: 'critical',
      startTime:   '2026-06-15T04:00:00Z',
      endTime:     '2026-06-17T22:00:00Z',
    },
  },
  {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: VENGERON },
    properties: {
      id:          'vengeron-14-juin',
      description: 'Sortie Vengeron / Genève-Lac fermée · 14 juin 06h–24h · Manifestation No-G7',
      section:     'Sortie Vengeron',
      criticality: 'major',
      startTime:   '2026-06-14T04:00:00Z',
      endTime:     '2026-06-14T22:00:00Z',
    },
  },
]
