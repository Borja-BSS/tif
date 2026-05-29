import { redis }           from '@/lib/redis'
import { logger }          from '@/lib/logger'
import { getTrafficFlow }  from '@/lib/here/traffic-flow'
import type { FlowFeatureCollection } from '@/lib/here/traffic-flow'
import type { FeatureCollection, Feature, Point } from 'geojson'

type BorderStatus   = 'CLEAR' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'BLOCKED'
type Capacity       = 'high' | 'medium' | 'low'
type CrossingType   = 'motorway' | 'main' | 'secondary' | 'tertiary'
type G7Status       = 'open' | 'closed' | 'macaron'

interface Crossing {
  id:           string
  name:         string
  lat:          number
  lng:          number
  type:         CrossingType
  capacity:     Capacity
  hours:        string        // horaires normaux
  vehicles:     string[]      // types de véhicules autorisés
  vignettes:    string[]      // documents/vignettes requis
  g7Info:       string        // info spécifique G7
  nearestOpen?: string        // alternative si fermé G7
}

export interface BorderProperties {
  id:              string
  name:            string
  type:            'border'
  crossingType:    CrossingType
  capacity:        Capacity
  status:          BorderStatus
  jamFactor:       number
  waitTimeMinutes: number
  direction:       'both'
  icon:            string
  color:           string
  lastUpdated:     string
  source:          'here-live' | 'synthetic-calibrated' | 'G7-directive'
  confidence:      number
  dataQuality:     'live' | 'synthetic' | 'g7-directive'
  g7Period:        boolean
  g7Status:        G7Status | null
  hours:           string
  vehicles:        string[]
  vignettes:       string[]
  g7Info:          string
  nearestOpen:     string
}

export type BorderFeatureCollection = FeatureCollection<Point, BorderProperties>

// ── 26 postes de douane Grand Genève (CH-FR) ──────────────────────────────────
// Coordonnées extraites des nœuds de franchissement de la frontière CH-FR dans OSM
// (relation 51701 × routes) + douanes nommées via Overpass/Nominatim
const CROSSINGS: Crossing[] = [

  // ── TIER 1 — Ouverts 24/7 (normalement et pendant G7) ─────────────────────

  {
    id: 'bardonnex', name: 'Bardonnex',
    lat: 46.14856, lng: 6.09561,
    type: 'motorway', capacity: 'high',
    hours: '24h/24, 7j/7',
    vehicles: ['Voitures', 'Camions', 'Cars', 'Motos'],
    vignettes: [
      'CNI ou passeport obligatoire',
      'Permis de conduire + carte grise',
      'Vignette autoroutière CH · CHF 40/an (obligatoire A1)',
      'Assurance RC véhicule',
    ],
    g7Info: '⭐ Poste macaron prioritaire · Voie rapide réservée au personnel indispensable (soins, urgences, services essentiels GE résidant en France) · Délai de dépôt expiré le 27 mai 2026 · Contrôles systématiques CNI/passeport 12-18 juin',
  },
  {
    id: 'thonex-vallard', name: 'Thônex-Vallard',
    lat: 46.18885, lng: 6.20215,
    type: 'main', capacity: 'medium',
    hours: '24h/24, 7j/7',
    vehicles: ['Voitures', 'Camions', 'Cars', 'Motos'],
    vignettes: [
      'CNI ou passeport obligatoire',
      'Permis de conduire + carte grise',
      'Assurance RC véhicule',
    ],
    g7Info: '⭐ Poste macaron prioritaire · Voie rapide réservée au personnel indispensable · Délai de dépôt expiré le 27 mai 2026 · Contrôles systématiques CNI/passeport 12-18 juin',
  },
  {
    id: 'moillesulaz', name: 'Moillesulaz',
    lat: 46.19220, lng: 6.20628,
    type: 'main', capacity: 'medium',
    hours: '24h/24, 7j/7',
    vehicles: ['Voitures', 'Motos', 'Piétons', 'Vélos', 'Tram D'],
    vignettes: [
      'CNI ou passeport obligatoire',
      'Permis de conduire + carte grise',
      'Crit\'Air ou Stick\'AIR (ZFE Annemasse, depuis janv. 2025)',
    ],
    g7Info: '✓ Ouvert 24/7 pendant le G7 · Contrôles renforcés · Délais accrus (+15-30 min attendus)',
  },
  {
    id: 'meyrin', name: 'Meyrin',
    lat: 46.23466, lng: 6.05046,
    type: 'main', capacity: 'medium',
    hours: '24h/24, 7j/7',
    vehicles: ['Voitures', 'Camions', 'Motos'],
    vignettes: [
      'CNI ou passeport obligatoire',
      'Permis de conduire + carte grise',
      'Assurance RC véhicule',
    ],
    g7Info: '✓ Ouvert 24/7 pendant le G7 · Contrôles systématiques · Corridor CERN maintenu',
  },
  {
    id: 'ferney-voltaire', name: 'Ferney-Voltaire',
    lat: 46.25004, lng: 6.11905,
    type: 'main', capacity: 'medium',
    hours: '24h/24, 7j/7',
    vehicles: ['Voitures', 'Motos', 'Cars'],
    vignettes: [
      'CNI ou passeport obligatoire',
      'Permis de conduire + carte grise',
      'Assurance RC véhicule',
    ],
    g7Info: '✓ Ouvert 24/7 pendant le G7 · Contrôles renforcés · Proximité aéroport GVA',
  },
  {
    id: 'perly', name: 'Perly',
    lat: 46.15199, lng: 6.09056,
    type: 'secondary', capacity: 'low',
    hours: '24h/24, 7j/7',
    vehicles: ['Voitures', 'Motos'],
    vignettes: [
      'CNI ou passeport obligatoire',
      'Permis de conduire + carte grise',
    ],
    g7Info: '✓ Ouvert 24/7 pendant le G7 · Route de Saint-Julien-en-Genevois · Délais modérés',
  },
  {
    id: 'anieres', name: 'Anières',
    lat: 46.26925, lng: 6.23907,
    type: 'secondary', capacity: 'low',
    hours: '24h/24, 7j/7',
    vehicles: ['Voitures', 'Motos'],
    vignettes: [
      'CNI ou passeport obligatoire',
      'Permis de conduire + carte grise',
    ],
    g7Info: '✓ Ouvert 24/7 pendant le G7 · Passage est du canton · Faible trafic attendu',
  },

  // ── TIER 2 — Heures restreintes (06:00–20:00), FERMÉS pendant G7 ──────────

  {
    id: 'croix-de-rozon', name: 'Croix-de-Rozon',
    lat: 46.14382, lng: 6.13789,
    type: 'secondary', capacity: 'low',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026 · Base légale : art. 25 Code frontières Schengen',
    nearestOpen: 'Bardonnex (7 km) · Perly (5 km)',
  },
  {
    id: 'veyrier', name: 'Veyrier',
    lat: 46.16940, lng: 6.18803,
    type: 'secondary', capacity: 'low',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos', 'Piétons'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Moillesulaz (5 km) · Bardonnex (9 km)',
  },
  {
    id: 'fossard', name: 'Fossard',
    lat: 46.20654, lng: 6.25008,
    type: 'secondary', capacity: 'low',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Moillesulaz (1 km) · Thônex-Vallard (2 km)',
  },
  {
    id: 'mategnin', name: 'Mategnin',
    lat: 46.24900, lng: 6.08000,
    type: 'secondary', capacity: 'low',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Meyrin (3 km) · Ferney-Voltaire (4 km)',
  },
  {
    id: 'mon-idee', name: 'Mon-Idée',
    lat: 46.15008, lng: 6.08168,
    type: 'secondary', capacity: 'low',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Perly (1 km) · Bardonnex (1.5 km)',
  },
  {
    id: 'monniaz', name: 'Monniaz',
    lat: 46.24155, lng: 6.30836,
    type: 'secondary', capacity: 'low',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Anières (8 km)',
  },
  {
    id: 'chancy', name: 'Chancy',
    lat: 46.14442, lng: 5.96568,
    type: 'secondary', capacity: 'low',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026 · Extrémité ouest du canton',
    nearestOpen: 'Soral (14 km) · Bardonnex (22 km)',
  },
  {
    id: 'avully', name: 'Avully',
    lat: 46.16215, lng: 5.98445,
    type: 'secondary', capacity: 'low',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026 · Barrière levante · Frontière Ain (FR)',
    nearestOpen: 'La Plaine (9 km) · Chancy (8 km)',
  },
  {
    id: 'la-plaine', name: 'La Plaine',
    lat: 46.17765, lng: 5.99194,
    type: 'secondary', capacity: 'low',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026 · Route de Challex · Frontière Ain (FR)',
    nearestOpen: 'Meyrin (20 km) · Écogia (14 km)',
  },
  {
    id: 'communaux-ambilly', name: 'Communaux d\'Ambilly',
    lat: 46.19560, lng: 6.22150,
    type: 'secondary', capacity: 'low',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Riverains'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026 · Barrière levante automatique · Thônex ↔ Ambilly',
    nearestOpen: 'Moillesulaz (2 km) · Thônex-Vallard (2 km)',
  },
  {
    id: 'hermance', name: 'Hermance',
    lat: 46.29605, lng: 6.23890,
    type: 'secondary', capacity: 'low',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Piétons', 'Vélos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026 · Rive sud du lac Léman · Hermance ↔ Douvaine',
    nearestOpen: 'Veigy (8 km) · Anières (12 km)',
  },
  {
    id: 'soral', name: 'Soral',
    lat: 46.13708, lng: 6.03615,
    type: 'secondary', capacity: 'low',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Bardonnex (18 km) · Perly (16 km)',
  },

  // ── TIER 3 — Accès restreint / piétons-vélos, FERMÉS pendant G7 ───────────

  {
    id: 'landecy', name: 'Landecy',
    lat: 46.14550, lng: 6.11720,
    type: 'tertiary', capacity: 'low',
    hours: 'Restreint (locaux)',
    vehicles: ['Voitures', 'Riverains'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Croix-de-Rozon (2 km) · Bardonnex (6 km)',
  },
  {
    id: 'bossey', name: 'Bossey',
    lat: 46.15300, lng: 6.20500,
    type: 'tertiary', capacity: 'low',
    hours: 'Piétons / Vélos uniquement',
    vehicles: ['Piétons', 'Vélos'],
    vignettes: ['CNI ou passeport obligatoire'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026 · Traversée piétonne/vélo',
    nearestOpen: 'Veyrier (3 km) · Moillesulaz (6 km)',
  },
  {
    id: 'troinex', name: 'Troinex',
    lat: 46.16150, lng: 6.17520,
    type: 'tertiary', capacity: 'low',
    hours: 'Restreint (locaux)',
    vehicles: ['Voitures'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Veyrier (2 km) · Croix-de-Rozon (4 km)',
  },
  {
    id: 'compesieres', name: 'Compesières',
    lat: 46.14950, lng: 6.07338,
    type: 'tertiary', capacity: 'low',
    hours: '06:00–18:00 (hors G7)',
    vehicles: ['Voitures'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Mon-Idée (1 km) · Perly (1.5 km)',
  },
  {
    id: 'bernex', name: 'Bernex',
    lat: 46.16040, lng: 6.04523,
    type: 'tertiary', capacity: 'low',
    hours: 'Restreint (locaux)',
    vehicles: ['Voitures'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Perly (5 km) · Mon-Idée (3 km)',
  },
  {
    id: 'ecogia', name: 'Écogia (Satigny)',
    lat: 46.23427, lng: 6.02693,
    type: 'tertiary', capacity: 'low',
    hours: 'Restreint (agricole/local)',
    vehicles: ['Voitures', 'Tracteurs'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Meyrin (8 km) · Ferney-Voltaire (7 km)',
  },
  {
    id: 'veigy', name: 'Veigy',
    lat: 46.27637, lng: 6.24670,
    type: 'tertiary', capacity: 'low',
    hours: 'Restreint (locaux)',
    vehicles: ['Voitures'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Anières (5 km)',
  },
]

// ── Directives G7 ─────────────────────────────────────────────────────────────
const G7_START_UTC = new Date('2026-06-11T22:01:00Z')
const G7_END_UTC   = new Date('2026-06-18T21:59:00Z')

const G7_AUTHORIZED = new Set([
  'bardonnex', 'thonex-vallard', 'moillesulaz', 'meyrin', 'ferney-voltaire', 'perly', 'anieres',
])
const G7_MACARON = new Set(['bardonnex', 'thonex-vallard'])

// ── HERE Traffic flow matching ────────────────────────────────────────────────

function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = (lat1 - lat2) * 111_000
  const dlng = (lng1 - lng2) * 111_000 * Math.cos((lat1 * Math.PI) / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng)
}

// Find the nearest HERE flow segment within maxDistM metres of a given point.
function nearestFlow(
  lat: number, lng: number,
  flow: FlowFeatureCollection,
  maxDistM = 400,
): { jamFactor: number; confidence: number } | null {
  let bestDist = maxDistM
  let best: { jamFactor: number; confidence: number } | null = null

  for (const f of flow.features) {
    for (const [fLng, fLat] of f.geometry.coordinates) {
      const d = distM(lat, lng, fLat, fLng)
      if (d < bestDist) {
        bestDist = d
        best = { jamFactor: f.properties.jamFactor, confidence: f.properties.confidence }
      }
    }
  }
  return best
}

// jamFactor (0–10) → BorderStatus. Never returns BLOCKED — closures come from G7 directives only.
function jamToStatus(jam: number): BorderStatus {
  if (jam < 1.5) return 'CLEAR'
  if (jam < 3.5) return 'LIGHT'
  if (jam < 6.0) return 'MODERATE'
  return 'HEAVY'
}

const STATUS_COLOR: Record<BorderStatus, string> = {
  CLEAR:    '#34C759',
  LIGHT:    '#30D158',
  MODERATE: '#FF9500',
  HEAVY:    '#FF3B30',
  BLOCKED:  '#636366',
}

const G7_CLOSED_COLOR  = '#FF3B30'
const G7_MACARON_COLOR = '#5AC8FA'

function isG7Period(date: Date): boolean {
  return date >= G7_START_UTC && date < G7_END_UTC
}

function estimatedWait(status: BorderStatus, capacity: Capacity): number {
  const base: Record<BorderStatus, number> = { CLEAR: 0, LIGHT: 3, MODERATE: 10, HEAVY: 25, BLOCKED: 60 }
  const mult: Record<Capacity, number>     = { high: 1.2, medium: 1.0, low: 0.8 }
  return Math.round(base[status] * mult[capacity])
}

export function computeCrossingStatus(
  crossing: Crossing,
  now: Date,
): { status: BorderStatus; jamFactor: number } {
  const hour          = now.getHours()
  const day           = now.getDay()
  const isMorningPeak = hour >= 7  && hour <= 9
  const isEveningPeak = hour >= 16 && hour <= 19
  const isFriday      = day === 5
  const isWeekend     = day === 0 || day === 6
  const isNight       = hour >= 22 || hour < 6

  if (crossing.type === 'motorway') {
    if (isNight)                        return { status: 'CLEAR',    jamFactor: 1 }
    if (isWeekend && !isEveningPeak)    return { status: 'LIGHT',    jamFactor: 2 }
    if (isMorningPeak)                  return { status: 'MODERATE', jamFactor: 5 }
    if (isEveningPeak && isFriday)      return { status: 'HEAVY',    jamFactor: 7 }
    if (isEveningPeak)                  return { status: 'MODERATE', jamFactor: 5 }
    return                                     { status: 'LIGHT',    jamFactor: 2 }
  }
  if (crossing.type === 'main') {
    if (isNight)                        return { status: 'CLEAR',    jamFactor: 0 }
    if (isMorningPeak || isEveningPeak) return { status: 'LIGHT',    jamFactor: 3 }
    return                                     { status: 'CLEAR',    jamFactor: 1 }
  }
  // secondary / tertiary
  if (isNight)                          return { status: 'CLEAR',    jamFactor: 0 }
  if (isMorningPeak || isEveningPeak)   return { status: 'LIGHT',    jamFactor: 2 }
  return                                       { status: 'CLEAR',    jamFactor: 0 }
}

const CACHE_KEY = 'tif:layer:border-crossings:v7'
const CACHE_TTL = 120

export async function getBorderCrossings(): Promise<BorderFeatureCollection> {
  try {
    const cached = await redis.get<BorderFeatureCollection>(CACHE_KEY)
    if (cached) return cached
  } catch (err) {
    logger.warn({ err }, 'border-crossings:redis-get-failed')
  }

  const now      = new Date()
  const g7Active = isG7Period(now)

  // Fetch HERE flow once for the full region (already Redis-cached internally)
  let flow: FlowFeatureCollection | null = null
  try {
    flow = await getTrafficFlow()
  } catch (err) {
    logger.warn({ err }, 'border-crossings:here-flow-failed — falling back to synthetic')
  }

  let liveCount = 0

  const features: Feature<Point, BorderProperties>[] = CROSSINGS.map(c => {
    let status: BorderStatus
    let jamFactor: number
    let color: string
    let icon: string
    let source: BorderProperties['source']
    let confidence: number
    let dataQuality: BorderProperties['dataQuality']
    let g7Status: G7Status | null = null

    if (g7Active && !G7_AUTHORIZED.has(c.id)) {
      // Hard G7 closure — directive overrides everything
      status      = 'BLOCKED'
      jamFactor   = 10
      color       = G7_CLOSED_COLOR
      icon        = '🔒'
      g7Status    = 'closed'
      source      = 'G7-directive'
      confidence  = 1.0
      dataQuality = 'g7-directive'
    } else {
      // Try HERE live traffic for the base status
      const live = flow ? nearestFlow(c.lat, c.lng, flow) : null

      if (live) {
        status      = jamToStatus(live.jamFactor)
        jamFactor   = live.jamFactor
        confidence  = live.confidence
        source      = g7Active ? 'G7-directive' : 'here-live'
        dataQuality = g7Active ? 'g7-directive' : 'live'
        liveCount++
      } else {
        const computed = computeCrossingStatus(c, now)
        status      = computed.status
        jamFactor   = computed.jamFactor
        confidence  = 0.3
        source      = g7Active ? 'G7-directive' : 'synthetic-calibrated'
        dataQuality = g7Active ? 'g7-directive' : 'synthetic'
      }

      // Apply G7 adjustments on top of live/synthetic base
      if (g7Active) {
        if (G7_MACARON.has(c.id)) {
          status    = status === 'BLOCKED' ? 'MODERATE' : status
          color     = G7_MACARON_COLOR
          icon      = '🛂'
          g7Status  = 'macaron'
          confidence = 1.0
        } else {
          // Open during G7 but without macaron — minimum LIGHT, G7 penalty +2
          status    = status === 'CLEAR' ? 'LIGHT' : status === 'LIGHT' ? 'MODERATE' : status
          jamFactor = Math.min(jamFactor + 2, 9)
          color     = STATUS_COLOR[status]
          icon      = '🛂'
          g7Status  = 'open'
          confidence = 1.0
        }
      } else {
        color = STATUS_COLOR[status]
        icon  = '🛂'
      }
    }

    return {
      type:       'Feature',
      properties: {
        id:              c.id,
        name:            c.name,
        type:            'border',
        crossingType:    c.type,
        capacity:        c.capacity,
        status,
        jamFactor,
        waitTimeMinutes: estimatedWait(status, c.capacity),
        direction:       'both',
        icon,
        color,
        lastUpdated:     now.toISOString(),
        source,
        confidence,
        dataQuality,
        g7Period:        g7Active,
        g7Status,
        hours:           c.hours,
        vehicles:        c.vehicles,
        vignettes:       c.vignettes,
        g7Info:          c.g7Info,
        nearestOpen:     c.nearestOpen ?? '',
      },
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
    }
  })

  const result: BorderFeatureCollection = { type: 'FeatureCollection', features }

  try {
    await redis.set(CACHE_KEY, result, { ex: CACHE_TTL })
  } catch (err) {
    logger.warn({ err }, 'border-crossings:redis-set-failed')
  }

  logger.debug(
    { count: features.length, liveCount, synthetic: features.length - liveCount, g7Active },
    'border-crossings:computed',
  )
  return result
}

export { CROSSINGS as BORDER_CROSSINGS_STATIC }
