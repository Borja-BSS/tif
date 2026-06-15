import { redis }           from '@/lib/redis'
import { logger }          from '@/lib/logger'
import { getTrafficFlow }  from '@/lib/here/traffic-flow'
import type { FlowFeatureCollection } from '@/lib/here/traffic-flow'
import type { FeatureCollection, Feature, Point } from 'geojson'

type BorderStatus   = 'CLEAR' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'BLOCKED'
type Capacity       = 'high' | 'medium' | 'low'
type CrossingType   = 'motorway' | 'main' | 'secondary' | 'tertiary'
type G7Status       = 'open' | 'closed' | 'macaron'
type FranceSide     = 'north' | 'south' | 'east' | 'west'
type WaitDirection  = 'fr-ch' | 'ch-fr' | 'both' | null

interface Crossing {
  id:           string
  name:         string
  lat:          number
  lng:          number
  type:         CrossingType
  capacity:     Capacity
  hours:        string
  vehicles:     string[]
  vignettes:    string[]
  g7Info:       string
  nearestOpen?: string
  franceSide:   FranceSide   // geographic direction from crossing toward France
}

export interface BorderProperties {
  id:              string
  name:            string
  type:            'border'
  crossingType:    CrossingType
  capacity:        Capacity
  status:          BorderStatus
  jamFactor:       number
  waitTimeMinutes:  number
  waitFrChMinutes:  number   // wait France → Suisse (based on French-side queue)
  waitChFrMinutes:  number   // wait Suisse → France (based on Swiss-side queue)
  waitDirection:    WaitDirection
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
    lat: 46.14952, lng: 6.09693,
    type: 'motorway', capacity: 'high',
    franceSide: 'south',
    hours: '24h/24, 7j/7',
    vehicles: ['Voitures', 'Camions', 'Cars', 'Motos'],
    vignettes: [
      'CNI ou passeport obligatoire',
      'Permis de conduire + carte grise',
      'Vignette autoroutière CH · CHF 40/an (obligatoire A1)',
      'Assurance RC véhicule',
    ],
    g7Info: '⭐ Poste macaron prioritaire · Accès prioritaire réservé au personnel essentiel des services critiques · Douanes secondaires ouvertes sur plages horaires dédiées · Pièce d\'identité obligatoire · Contrôles systématiques 12–18 juin · Des temps d\'attente sont à prévoir',
  },
  {
    id: 'thonex-vallard', name: 'Thônex-Vallard',
    lat: 46.1881120, lng: 6.2027720,
    type: 'main', capacity: 'medium',
    franceSide: 'east',
    hours: '24h/24, 7j/7',
    vehicles: ['Voitures', 'Camions', 'Cars', 'Motos'],
    vignettes: [
      'CNI ou passeport obligatoire',
      'Permis de conduire + carte grise',
      'Assurance RC véhicule',
    ],
    g7Info: '⭐ Poste macaron prioritaire · Accès prioritaire réservé au personnel essentiel des services critiques · Douanes secondaires ouvertes sur plages horaires dédiées · Pièce d\'identité obligatoire · Contrôles systématiques 12–18 juin · Des temps d\'attente sont à prévoir',
  },
  {
    id: 'moillesulaz', name: 'Moillesulaz',
    lat: 46.1922427, lng: 6.2064349,
    type: 'main', capacity: 'medium',
    franceSide: 'east',
    hours: '24h/24, 7j/7',
    vehicles: ['Voitures', 'Motos', 'Piétons', 'Vélos', 'Tram D'],
    vignettes: [
      'CNI ou passeport obligatoire',
      'Permis de conduire + carte grise',
      'Crit\'Air ou Stick\'AIR (ZFE Annemasse, depuis janv. 2025)',
    ],
    g7Info: '✓ Ouvert 24/7 pendant le G7 · Pièce d\'identité obligatoire · Contrôles renforcés · Des temps d\'attente sont à prévoir',
  },
  {
    id: 'meyrin', name: 'Meyrin',
    lat: 46.23466, lng: 6.05046,
    type: 'main', capacity: 'medium',
    franceSide: 'west',
    hours: '24h/24, 7j/7',
    vehicles: ['Voitures', 'Camions', 'Motos'],
    vignettes: [
      'CNI ou passeport obligatoire',
      'Permis de conduire + carte grise',
      'Assurance RC véhicule',
    ],
    g7Info: '✓ Ouvert 24/7 pendant le G7 · Pièce d\'identité obligatoire · Contrôles systématiques · Corridor CERN maintenu',
  },
  {
    id: 'ferney-voltaire', name: 'Ferney-Voltaire',
    lat: 46.25005, lng: 6.11905,
    type: 'main', capacity: 'medium',
    franceSide: 'north',
    hours: '24h/24, 7j/7',
    vehicles: ['Voitures', 'Motos', 'Cars'],
    vignettes: [
      'CNI ou passeport obligatoire',
      'Permis de conduire + carte grise',
      'Assurance RC véhicule',
    ],
    g7Info: '✓ Ouvert 24/7 pendant le G7 · Pièce d\'identité obligatoire · Contrôles renforcés · Proximité aéroport GVA',
  },
  {
    id: 'perly', name: 'Perly',
    lat: 46.15234, lng: 6.09103,
    type: 'secondary', capacity: 'low',
    franceSide: 'south',
    hours: '24h/24, 7j/7',
    vehicles: ['Voitures', 'Motos'],
    vignettes: [
      'CNI ou passeport obligatoire',
      'Permis de conduire + carte grise',
    ],
    g7Info: '✓ Ouvert 24/7 pendant le G7 · Pièce d\'identité obligatoire · Route de Saint-Julien-en-Genevois · Des temps d\'attente sont à prévoir',
  },
  {
    id: 'anieres', name: 'Anières',
    lat: 46.26932, lng: 6.23901,
    type: 'secondary', capacity: 'low',
    franceSide: 'east',
    hours: '24h/24, 7j/7',
    vehicles: ['Voitures', 'Motos'],
    vignettes: [
      'CNI ou passeport obligatoire',
      'Permis de conduire + carte grise',
    ],
    g7Info: '✓ Ouvert 24/7 pendant le G7 · Pièce d\'identité obligatoire · Passage est du canton · Des temps d\'attente sont à prévoir',
  },

  // ── TIER 2 — Heures restreintes (06:00–20:00), FERMÉS pendant G7 ──────────

  {
    id: 'croix-de-rozon', name: 'Croix-de-Rozon',
    lat: 46.14351, lng: 6.13836,
    type: 'secondary', capacity: 'low',
    franceSide: 'south',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026 · Base légale : art. 25 Code frontières Schengen',
    nearestOpen: 'Bardonnex (7 km) · Perly (5 km)',
  },
  {
    id: 'veyrier', name: 'Veyrier',
    lat: 46.16631, lng: 6.18840,
    type: 'secondary', capacity: 'low',
    franceSide: 'east',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos', 'Piétons'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Moillesulaz (5 km) · Bardonnex (9 km)',
  },
  {
    id: 'fossard', name: 'Fossard',
    lat: 46.1836465, lng: 6.1950107,
    type: 'secondary', capacity: 'low',
    franceSide: 'east',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Moillesulaz (2 km) · Thônex-Vallard (3 km)',
  },
  {
    id: 'mategnin', name: 'Mategnin',
    lat: 46.2437796, lng: 6.0923679,
    type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Meyrin (3 km) · Ferney-Voltaire (4 km)',
  },
  {
    id: 'mon-idee', name: 'Mon-Idée',
    lat: 46.20654, lng: 6.25008,
    type: 'secondary', capacity: 'low',
    franceSide: 'east',
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
    franceSide: 'east',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Anières (8 km)',
  },
  {
    id: 'chancy', name: 'Chancy',
    lat: 46.14442, lng: 5.96583,
    type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026 · Extrémité ouest du canton',
    nearestOpen: 'Soral (14 km) · Bardonnex (22 km)',
  },
  {
    id: 'avully', name: 'Avully',
    lat: 46.1618, lng: 5.9778,
    type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026 · Barrière levante · Frontière Ain (FR)',
    nearestOpen: 'La Plaine (9 km) · Chancy (8 km)',
  },
  {
    id: 'la-plaine', name: 'La Plaine',
    lat: 46.17737, lng: 5.99153,
    type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026 · Route de Challex · Frontière Ain (FR)',
    nearestOpen: 'Meyrin (20 km) · Écogia (14 km)',
  },
  {
    id: 'communaux-ambilly', name: 'Communaux d\'Ambilly',
    lat: 46.1958, lng: 6.2180,
    type: 'secondary', capacity: 'low',
    franceSide: 'east',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Riverains'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026 · Barrière levante automatique · Thônex ↔ Ambilly',
    nearestOpen: 'Moillesulaz (2 km) · Thônex-Vallard (2 km)',
  },
  {
    id: 'hermance', name: 'Hermance',
    lat: 46.30283, lng: 6.24758,
    type: 'secondary', capacity: 'low',
    franceSide: 'east',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Piétons', 'Vélos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026 · Rive sud du lac Léman · Hermance ↔ Douvaine',
    nearestOpen: 'Veigy (8 km) · Anières (12 km)',
  },
  {
    id: 'soral', name: 'Soral',
    lat: 46.13712, lng: 6.03616,
    type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Bardonnex (18 km) · Perly (16 km)',
  },
  {
    id: 'mandement', name: 'Mandement (Satigny)',
    lat: 46.2018913, lng: 5.9718478,
    type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Meyrin (12 km)',
  },
  {
    id: 'dardagny', name: 'Dardagny',
    lat: 46.1900628, lng: 5.9820292,
    type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Meyrin (11 km)',
  },
  {
    id: 'valleiry', name: 'Valleiry',
    lat: 46.1336524, lng: 5.9774808,
    type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Perly (18 km) · Bardonnex (19 km)',
  },
  {
    id: 'avusy', name: 'Avusy',
    lat: 46.1427496, lng: 6.0088161,
    type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Perly (12 km) · Bardonnex (12 km)',
  },
  {
    id: 'avusy-sezegnin', name: 'Avusy Sézegnin',
    lat: 46.1427656, lng: 6.0087949,
    type: 'tertiary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Perly (12 km) · Bardonnex (12 km)',
  },
  {
    id: 'soral-mangons', name: 'Soral — Rte des Mangons',
    lat: 46.1426323, lng: 6.0470017,
    type: 'secondary', capacity: 'low',
    franceSide: 'south',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Perly (7 km) · Bardonnex (8 km)',
  },
  {
    id: 'pas-de-lechelle', name: 'Pas-de-l\'Échelle',
    lat: 46.1664299, lng: 6.1884322,
    type: 'secondary', capacity: 'low',
    franceSide: 'east',
    hours: '06:00–20:00 (hors G7)',
    vehicles: ['Voitures', 'Motos', 'Piétons'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Thônex-Vallard (4 km) · Moillesulaz (4 km)',
  },

  // ── TIER 3 — Accès restreint / piétons-vélos, FERMÉS pendant G7 ───────────

  {
    id: 'landecy', name: 'Landecy',
    lat: 46.1395, lng: 6.0756,
    type: 'tertiary', capacity: 'low',
    franceSide: 'south',
    hours: 'Restreint (locaux)',
    vehicles: ['Voitures', 'Riverains'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Croix-de-Rozon (2 km) · Bardonnex (6 km)',
  },
  {
    id: 'bossey', name: 'Bossey',
    lat: 46.1548324, lng: 6.1608997,
    type: 'tertiary', capacity: 'low',
    franceSide: 'south',
    hours: 'Piétons / Vélos uniquement',
    vehicles: ['Piétons', 'Vélos'],
    vignettes: ['CNI ou passeport obligatoire'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026 · Traversée piétonne/vélo',
    nearestOpen: 'Bardonnex (9 km) · Perly (8 km)',
  },
  {
    id: 'troinex', name: 'Troinex',
    lat: 46.1616, lng: 6.1530,
    type: 'tertiary', capacity: 'low',
    franceSide: 'south',
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
    franceSide: 'south',
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
    franceSide: 'west',
    hours: 'Restreint (locaux)',
    vehicles: ['Voitures'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Perly (5 km) · Mon-Idée (3 km)',
  },
  {
    id: 'ecogia', name: 'Écogia (Satigny)',
    lat: 46.23400, lng: 6.00800,
    type: 'tertiary', capacity: 'low',
    franceSide: 'west',
    hours: 'Restreint (agricole/local)',
    vehicles: ['Voitures', 'Tracteurs'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Meyrin (8 km) · Ferney-Voltaire (7 km)',
  },
  {
    id: 'veigy', name: 'Veigy',
    lat: 46.27652, lng: 6.24683,
    type: 'tertiary', capacity: 'low',
    franceSide: 'east',
    hours: 'Restreint (locaux)',
    vehicles: ['Voitures'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026',
    nearestOpen: 'Anières (5 km)',
  },

  // ── Extension Grand Genève — Pays de Gex ────────────────────────────────────
  {
    id: 'prevessin-moens', name: 'Prévessin-Moëns',
    lat: 46.2457785, lng: 6.0820011, type: 'main', capacity: 'medium',
    franceSide: 'west',
    hours: '24h/24', vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '✓ Ouvert · Zone CERN · Contrôles fréquents',
  },
  {
    id: 'sauverny', name: 'Sauverny',
    lat: 46.3114, lng: 6.1204, type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–22:00 (hors G7)', vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026', nearestOpen: 'Meyrin (5 km) · Ferney-Voltaire (7 km)',
  },
  {
    id: 'bois-chaton', name: 'Bois-Châton',
    lat: 46.2869728, lng: 6.1045552, type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–22:00 (hors G7)', vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026', nearestOpen: 'Meyrin (4 km)',
  },
  {
    id: 'versoix-ferney', name: 'Versoix / Ferney',
    lat: 46.2608456, lng: 6.1197727, type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–22:00 (hors G7)', vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '🔒 Fermé du 12 au 18 juin 2026', nearestOpen: 'Ferney-Voltaire (1 km) · Meyrin (5 km)',
  },
  {
    id: 'thoiry', name: 'Thoiry / Saint-Jean-de-Gonville',
    lat: 46.25000, lng: 5.98850, type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '⚠️ Contrôles renforcés pendant G7', nearestOpen: 'La Plaine (12 km)',
  },
  {
    id: 'peron', name: 'Péron',
    lat: 46.17900, lng: 5.91050, type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–20:00', vehicles: ['Voitures'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '⚠️ Contrôles renforcés pendant G7', nearestOpen: 'La Plaine (15 km)',
  },
  {
    id: 'divonne', name: 'Divonne-les-Bains',
    lat: 46.34573, lng: 6.15228, type: 'main', capacity: 'medium',
    franceSide: 'west',
    hours: '24h/24', vehicles: ['Voitures', 'Motos', 'Piétons'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '✓ Ouvert 24/7 · Accès lac et casino',
  },
  {
    id: 'leaz', name: 'Léaz / Longeray',
    lat: 45.93400, lng: 5.81200, type: 'main', capacity: 'medium',
    franceSide: 'west',
    hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '✓ Ouvert · Entrée A40 côté français',
  },

  // ── Extension Grand Genève — Vaud-France ────────────────────────────────────
  {
    id: 'la-cure', name: 'La Cure / Les Rousses',
    lat: 46.46478, lng: 6.07300, type: 'main', capacity: 'medium',
    franceSide: 'west',
    hours: '24h/24 (sauf neige)', vehicles: ['Voitures', 'Motos', 'Piétons', 'Vélos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '✓ Ouvert · Route D1084 ↔ Givrine · Fermé si neige abondante',
  },
  {
    id: 'saint-cergue', name: 'Saint-Cergue (Col de la Givrine)',
    lat: 46.4200, lng: 6.0820, type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '24h/24 (saison)', vehicles: ['Voitures', 'Motos', 'Vélos', 'Piétons'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '✓ Ouvert · Passage Nyon ↔ Morez FR', nearestOpen: 'La Cure (15 km)',
  },
  {
    id: 'vallorbe', name: 'Vallorbe',
    lat: 46.7282, lng: 6.4018, type: 'main', capacity: 'high',
    franceSide: 'west',
    hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Train', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise', 'Vignette CH recommandée'],
    g7Info: '✓ Ouvert · Douane principale Vaud · Ligne CFF Lausanne-Paris',
  },
  {
    id: 'bois-d-amont', name: "Bois-d'Amont (Les Rousses)",
    lat: 46.54842, lng: 6.15903, type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '24h/24 (saison ski)', vehicles: ['Voitures', 'Motos', 'Piétons'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '✓ Ouvert · Zone ski transfrontalière Les Rousses ↔ Suisse',
  },
  {
    id: 'saint-Laurent', name: 'Saint-Laurent-en-Grandvaux',
    lat: 46.5810, lng: 6.1150, type: 'secondary', capacity: 'low',
    franceSide: 'west',
    hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '✓ Ouvert · Jura ↔ Vaud · Vers Champagnole', nearestOpen: 'La Cure (20 km)',
  },
  {
    id: 'les-hopitaux-neufs', name: 'Les Hôpitaux-Neufs / Pontarlier',
    lat: 46.7735, lng: 6.3715, type: 'main', capacity: 'medium',
    franceSide: 'west',
    hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '✓ Ouvert · Axe RN57 Pontarlier ↔ Vallorbe (CH)',
  },

  // ── Extension Grand Genève — Haute-Savoie ───────────────────────────────────
  {
    id: 'douvaine', name: 'Douvaine',
    lat: 46.30283, lng: 6.31200, type: 'main', capacity: 'medium',
    franceSide: 'east',
    hours: '24h/24', vehicles: ['Voitures', 'Motos', 'Camions'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '✓ Ouvert · Axe Annemasse ↔ Thonon · Surveillance renforcée G7',
  },
  {
    id: 'sciez', name: 'Sciez / Ballaison',
    lat: 46.34158, lng: 6.39015, type: 'secondary', capacity: 'low',
    franceSide: 'east',
    hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '⚠️ Contrôles pendant G7', nearestOpen: 'Douvaine (8 km)',
  },
  {
    id: 'excenevex', name: 'Excenevex / Yvoire',
    lat: 46.37162, lng: 6.32362, type: 'tertiary', capacity: 'low',
    franceSide: 'east',
    hours: 'Piétons / Vélos / Riverains', vehicles: ['Piétons', 'Vélos', 'Voitures riverains'],
    vignettes: ['CNI ou passeport obligatoire'],
    g7Info: '⚠️ Contrôles renforcés G7 · Rive lac Léman', nearestOpen: 'Douvaine (9 km)',
  },
  {
    id: 'thonon', name: 'Thonon-les-Bains',
    lat: 46.37609, lng: 6.47516, type: 'main', capacity: 'medium',
    franceSide: 'south',
    hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '✓ Ouvert · Axe vers Évian et Valais · Renforcé G7',
  },
  {
    id: 'evian', name: 'Évian-les-Bains',
    lat: 46.40163, lng: 6.59467, type: 'main', capacity: 'medium',
    franceSide: 'south',
    hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise', 'Pass G7 requis 12-18 juin'],
    g7Info: '🏛️ SITE G7 · Contrôles maximaux 8-18 juin · Accès très restreint sans accréditation',
    nearestOpen: 'Thonon (15 km)',
  },
  {
    id: 'annemasse-gaillard', name: 'Annemasse / Gaillard',
    lat: 46.1944, lng: 6.2278, type: 'main', capacity: 'high',
    franceSide: 'east',
    hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos', 'Piétons', 'Tram'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise', "Crit'Air / Stick'AIR (ZFE Annemasse)"],
    g7Info: '✓ Ouvert · Axe principal Genève ↔ Annecy · Contrôles renforcés G7',
  },
  {
    id: 'saint-julien', name: 'Saint-Julien-en-Genevois',
    lat: 46.15063, lng: 6.08890, type: 'main', capacity: 'high',
    franceSide: 'south',
    hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Cars', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '✓ Ouvert · Axe A41 vers Annecy · Contrôles renforcés G7 · Pièce d\'identité obligatoire',
  },
  {
    id: 'collonges', name: 'Collonges-sous-Salève',
    lat: 46.13300, lng: 6.14900, type: 'secondary', capacity: 'medium',
    franceSide: 'south',
    hours: '24h/24', vehicles: ['Voitures', 'Motos'],
    vignettes: ['CNI ou passeport', 'Permis de conduire + carte grise'],
    g7Info: '✓ Ouvert · A40 direction Annecy / Sallanches',
  },
]

// ── Directives G7 ─────────────────────────────────────────────────────────────
const G7_START_UTC = new Date('2026-06-11T22:01:00Z')
const G7_END_UTC   = new Date('2026-06-18T21:59:00Z')

// Synchronized with border-crossings-client.ts G7_OPEN set
const G7_AUTHORIZED = new Set([
  'bardonnex', 'thonex-vallard', 'moillesulaz', 'meyrin', 'ferney-voltaire', 'perly', 'anieres',
  'saint-julien',
  'divonne', 'leaz', 'la-cure', 'vallorbe', 'bois-d-amont',
  'les-hopitaux-neufs', 'saint-Laurent', 'douvaine', 'thonon',
])
const G7_MACARON = new Set(['bardonnex', 'thonex-vallard'])

// ── HERE Traffic flow — queue-length algorithm ────────────────────────────────

function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = (lat1 - lat2) * 111_000
  const dlng = (lng1 - lng2) * 111_000 * Math.cos((lat1 * Math.PI) / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng)
}

function segmentLengthM(coords: [number, number][]): number {
  let len = 0
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1]
    const [lng2, lat2] = coords[i]
    len += distM(lat1, lng1, lat2, lng2)
  }
  return len
}

interface QueueAnalysis {
  frDelayS:      number   // delay seconds on French approach (FR→CH queue)
  chDelayS:      number   // delay seconds on Swiss approach (CH→FR queue)
  frPeakJam:     number
  chPeakJam:     number
  peakJamFactor: number
  confidence:    number
  segmentCount:  number
}

// jam < 3.5 = normal variation (rush hour), not an actual border queue
const FLOW_JAM_THRESHOLD     = 3.5
// 500m — tight enough to capture approach road only, not parallel roads 600m away
const QUEUE_SEARCH_RADIUS    = 500
// skip unreliable HERE segments
const MIN_SEGMENT_CONFIDENCE = 0.3
// G7 controls add ~20% overhead vs baseline (was 1.5 — too aggressive)
const G7_WAIT_FACTOR         = 1.2

// Time spent at the booth itself, based on how congested the approach is
function processingMinutes(peakJam: number): number {
  if (peakJam < 5) return 2
  if (peakJam < 7) return 4
  return 8
}

/**
 * Speed-delay method: extra_time = Σ len × 3.6 × (1/speed − 1/freeFlow)
 * where len is in metres and speeds in km/h.
 *
 * Replaces the old score = queueLengthM × (jamFactor/10)^1.5 which summed ALL
 * slow roads within 1000m — motorway, parallel streets, etc. — producing false
 * 90-min waits on empty crossings.
 */
function analyzeApproachQueue(
  lat: number, lng: number,
  franceSide: FranceSide,
  flow: FlowFeatureCollection,
): QueueAnalysis {
  let frDelayS     = 0
  let chDelayS     = 0
  let frPeakJam    = 0
  let chPeakJam    = 0
  let maxConfidence = 0
  let segmentCount  = 0

  for (const f of flow.features) {
    const { jamFactor, confidence, speed, freeFlow } = f.properties
    if (jamFactor < FLOW_JAM_THRESHOLD)        continue
    if (confidence < MIN_SEGMENT_CONFIDENCE)   continue

    let withinRadius = false
    let centLat = 0, centLng = 0

    for (const [fLng, fLat] of f.geometry.coordinates) {
      if (distM(lat, lng, fLat, fLng) <= QUEUE_SEARCH_RADIUS) withinRadius = true
      centLat += fLat
      centLng += fLng
    }
    if (!withinRadius) continue

    const n = f.geometry.coordinates.length
    centLat /= n
    centLng /= n

    const len = segmentLengthM(f.geometry.coordinates)

    // Extra seconds vs free-flow for this segment (floor speeds to avoid div/0)
    const safeSpeed    = Math.max(speed, 1)
    const safeFreeFlow = Math.max(freeFlow, 10)
    const delayS = len * 3.6 * (1 / safeSpeed - 1 / safeFreeFlow)

    const onFrSide = franceSide === 'south' ? centLat < lat
      : franceSide === 'north'              ? centLat > lat
      : franceSide === 'east'               ? centLng > lng
      :                                       centLng < lng

    if (onFrSide) {
      frDelayS += delayS
      if (jamFactor > frPeakJam) frPeakJam = jamFactor
    } else {
      chDelayS += delayS
      if (jamFactor > chPeakJam) chPeakJam = jamFactor
    }

    if (confidence > maxConfidence) maxConfidence = confidence
    segmentCount++
  }

  return {
    frDelayS, chDelayS, frPeakJam, chPeakJam,
    peakJamFactor: Math.max(frPeakJam, chPeakJam),
    confidence: maxConfidence,
    segmentCount,
  }
}

/**
 * Wait = (queue drive-through time + booth processing) × G7 factor.
 * Max cap: 60 min (realistic Geneva-area ceiling even in worst G7 conditions).
 */
function queueToStatusAndWait(
  q: QueueAnalysis,
  isG7: boolean,
): { status: BorderStatus; waitMinutes: number } {
  if (q.peakJamFactor < FLOW_JAM_THRESHOLD || q.segmentCount === 0) {
    return { status: 'CLEAR', waitMinutes: 0 }
  }

  const g7Factor = isG7 ? G7_WAIT_FACTOR : 1.0
  const driveMin = (q.frDelayS + q.chDelayS) / 60
  const procMin  = processingMinutes(q.peakJamFactor)
  const wait     = Math.round((driveMin + procMin) * g7Factor)

  if (wait < 3)  return { status: 'CLEAR',    waitMinutes: 0 }
  if (wait < 9)  return { status: 'LIGHT',    waitMinutes: wait }
  if (wait < 28) return { status: 'MODERATE', waitMinutes: wait }
  return             { status: 'HEAVY',    waitMinutes: Math.min(wait, 60) }
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

// Synthetic fallback (no HERE data available) — time-of-day estimate
function syntheticWait(status: BorderStatus, capacity: Capacity): number {
  const base: Record<BorderStatus, number> = { CLEAR: 0, LIGHT: 3, MODERATE: 9, HEAVY: 16, BLOCKED: 35 }
  const mult: Record<Capacity, number>     = { high: 1.15, medium: 1.0, low: 0.85 }
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
    if (isEveningPeak && isFriday)      return { status: 'MODERATE', jamFactor: 5 }
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

const CACHE_KEY = 'tif:layer:border-crossings:v15'
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
    let waitTimeMinutes = 0
    let waitFrChMinutes = 0
    let waitChFrMinutes = 0
    let waitDirection: WaitDirection = null

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
      // Try HERE live traffic — queue-length algorithm
      const queue = flow ? analyzeApproachQueue(c.lat, c.lng, c.franceSide, flow) : null

      if (queue && queue.segmentCount > 0) {
        const derived   = queueToStatusAndWait(queue, g7Active)
        status          = derived.status
        jamFactor       = queue.peakJamFactor
        waitTimeMinutes = derived.waitMinutes
        confidence      = queue.confidence
        source          = g7Active ? 'G7-directive' : 'here-live'
        dataQuality     = g7Active ? 'g7-directive' : 'live'
        liveCount++

        // Per-direction wait: each side computed from its own delay + processing
        const g7f = g7Active ? G7_WAIT_FACTOR : 1.0
        waitFrChMinutes = Math.min(Math.round(((queue.frDelayS / 60) + processingMinutes(queue.frPeakJam)) * g7f), 60)
        waitChFrMinutes = Math.min(Math.round(((queue.chDelayS / 60) + processingMinutes(queue.chPeakJam)) * g7f), 60)

        // Dominant direction: > 15s delay on a side = meaningful queue
        if (queue.frDelayS > 15 && queue.chDelayS > 15) {
          const ratio = Math.max(queue.frDelayS, queue.chDelayS) / Math.min(queue.frDelayS, queue.chDelayS)
          waitDirection = ratio < 2 ? 'both' : queue.frDelayS > queue.chDelayS ? 'fr-ch' : 'ch-fr'
        } else if (queue.frDelayS > 15) {
          waitDirection = 'fr-ch'
        } else if (queue.chDelayS > 15) {
          waitDirection = 'ch-fr'
        }
      } else {
        const computed  = computeCrossingStatus(c, now)
        status          = computed.status
        jamFactor       = computed.jamFactor
        waitTimeMinutes = syntheticWait(status, c.capacity)
        // No directional HERE data — show same estimate for both directions
        waitFrChMinutes = waitTimeMinutes
        waitChFrMinutes = waitTimeMinutes
        confidence      = 0.3
        source          = g7Active ? 'G7-directive' : 'synthetic-calibrated'
        dataQuality     = g7Active ? 'g7-directive' : 'synthetic'
      }

      // Apply G7 adjustments on top of live/synthetic base
      if (g7Active) {
        if (G7_MACARON.has(c.id)) {
          status     = status === 'BLOCKED' ? 'MODERATE' : status
          color      = G7_MACARON_COLOR
          icon       = '🛂'
          g7Status   = 'macaron'
          confidence = 1.0
        } else {
          // Open during G7 — minimum LIGHT, G7 penalty (+2 jam)
          if (status === 'CLEAR') {
            status = 'LIGHT'
            if (waitTimeMinutes === 0) waitTimeMinutes = syntheticWait('LIGHT', c.capacity)
          }
          jamFactor  = Math.min(jamFactor + 2, 9)
          color      = STATUS_COLOR[status]
          icon       = '🛂'
          g7Status   = 'open'
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
        waitTimeMinutes,
        waitFrChMinutes,
        waitChFrMinutes,
        waitDirection,
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
