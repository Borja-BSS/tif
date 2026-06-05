// Client-safe subset of border-crossings — no server imports

export type BorderStatus = 'CLEAR' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'BLOCKED'

export interface CrossingStatic {
  id: string; name: string; lat: number; lng: number
  type: 'motorway' | 'main' | 'secondary' | 'tertiary'
  capacity: 'high' | 'medium' | 'low'
  hours: string; vehicles: string[]; pedestrian: boolean
  g7Info: string; nearestOpen?: string
}

export interface ClientBorderFeature {
  id: string; name: string; lat: number; lng: number
  status: BorderStatus; color: string; icon: string
  waitMinutes: number; hours: string; vehicles: string[]
  pedestrian: boolean; g7Info: string; nearestOpen: string
}

const STATUS_COLOR: Record<BorderStatus, string> = {
  CLEAR: '#34C759', LIGHT: '#30D158', MODERATE: '#FF9500',
  HEAVY: '#FF3B30', BLOCKED: '#636366',
}

// All Grand Genève border crossings — extended to include Vaud, Gex, Haute-Savoie area
export const ALL_CROSSINGS: CrossingStatic[] = [
  // ── TIER 1 — Geneva canton, 24/7 ────────────────────────────────────────────
  { id: 'bardonnex', name: 'Bardonnex', lat: 46.14856, lng: 6.09561, type: 'motorway', capacity: 'high', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Cars', 'Motos'], pedestrian: false, g7Info: '⭐ Poste macaron prioritaire G7 · Contrôles systématiques 12-18 juin', nearestOpen: undefined },
  { id: 'thonex-vallard', name: 'Thônex-Vallard', lat: 46.18885, lng: 6.20215, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'], pedestrian: false, g7Info: '⭐ Poste macaron prioritaire G7', nearestOpen: undefined },
  { id: 'moillesulaz', name: 'Moillesulaz', lat: 46.19220, lng: 6.20628, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos', 'Piétons', 'Vélos', 'Tram D'], pedestrian: true, g7Info: '✓ Ouvert 24/7 pendant le G7 · Contrôles renforcés', nearestOpen: undefined },
  { id: 'meyrin', name: 'Meyrin', lat: 46.23466, lng: 6.05046, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert 24/7 · Corridor CERN maintenu', nearestOpen: undefined },
  { id: 'ferney-voltaire', name: 'Ferney-Voltaire', lat: 46.25004, lng: 6.11905, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos', 'Cars'], pedestrian: false, g7Info: '✓ Ouvert 24/7 · Proximité aéroport GVA', nearestOpen: undefined },
  { id: 'perly', name: 'Perly', lat: 46.15199, lng: 6.09056, type: 'secondary', capacity: 'low', hours: '24h/24', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert 24/7 · Route de Saint-Julien', nearestOpen: undefined },
  { id: 'anieres', name: 'Anières', lat: 46.26925, lng: 6.23907, type: 'secondary', capacity: 'low', hours: '24h/24', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert 24/7 · Passage est', nearestOpen: undefined },
  // ── TIER 2 — Geneva canton, restricted ──────────────────────────────────────
  { id: 'croix-de-rozon', name: 'Croix-de-Rozon', lat: 46.14382, lng: 6.13789, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Bardonnex (7 km)' },
  { id: 'veyrier', name: 'Veyrier', lat: 46.16940, lng: 6.18803, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos', 'Piétons'], pedestrian: true, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Moillesulaz (5 km)' },
  { id: 'fossard', name: 'Fossard', lat: 46.20654, lng: 6.25008, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Moillesulaz (1 km)' },
  { id: 'mategnin', name: 'Mategnin', lat: 46.24900, lng: 6.08000, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Meyrin (3 km)' },
  { id: 'mon-idee', name: 'Mon-Idée', lat: 46.15008, lng: 6.08168, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Perly (1 km)' },
  { id: 'monniaz', name: 'Monniaz', lat: 46.24155, lng: 6.30836, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Anières (8 km)' },
  { id: 'chancy', name: 'Chancy', lat: 46.14442, lng: 5.96568, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Soral (14 km)' },
  { id: 'avully', name: 'Avully', lat: 46.16215, lng: 5.98445, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'La Plaine (9 km)' },
  { id: 'la-plaine', name: 'La Plaine', lat: 46.17765, lng: 5.99194, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Meyrin (20 km)' },
  { id: 'communaux-ambilly', name: 'Communaux d\'Ambilly', lat: 46.19560, lng: 6.22150, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Riverains'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Moillesulaz (2 km)' },
  { id: 'hermance', name: 'Hermance', lat: 46.29605, lng: 6.23890, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Piétons', 'Vélos'], pedestrian: true, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Veigy (8 km)' },
  { id: 'soral', name: 'Soral', lat: 46.13708, lng: 6.03615, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Bardonnex (18 km)' },
  // ── TIER 3 — Geneva canton, tertiary ────────────────────────────────────────
  { id: 'landecy', name: 'Landecy', lat: 46.14550, lng: 6.11720, type: 'tertiary', capacity: 'low', hours: 'Restreint (locaux)', vehicles: ['Voitures', 'Riverains'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Bardonnex (6 km)' },
  { id: 'bossey', name: 'Bossey', lat: 46.15300, lng: 6.20500, type: 'tertiary', capacity: 'low', hours: 'Piétons / Vélos uniquement', vehicles: ['Piétons', 'Vélos'], pedestrian: true, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Veyrier (3 km)' },
  { id: 'troinex', name: 'Troinex', lat: 46.16150, lng: 6.17520, type: 'tertiary', capacity: 'low', hours: 'Restreint (locaux)', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Veyrier (2 km)' },
  { id: 'compesieres', name: 'Compesières', lat: 46.14950, lng: 6.07338, type: 'tertiary', capacity: 'low', hours: '06:00–18:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Mon-Idée (1 km)' },
  { id: 'bernex', name: 'Bernex', lat: 46.16040, lng: 6.04523, type: 'tertiary', capacity: 'low', hours: 'Restreint (locaux)', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Mon-Idée (3 km)' },
  { id: 'ecogia', name: 'Écogia (Satigny)', lat: 46.23427, lng: 6.02693, type: 'tertiary', capacity: 'low', hours: 'Restreint (agricole)', vehicles: ['Voitures', 'Tracteurs'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Meyrin (8 km)' },
  { id: 'veigy', name: 'Veigy', lat: 46.27637, lng: 6.24670, type: 'tertiary', capacity: 'low', hours: 'Restreint (locaux)', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Anières (5 km)' },

  // ── NOUVEAU — Pays de Gex (Ain) ──────────────────────────────────────────────
  { id: 'prevessin-moens', name: 'Prévessin-Moëns', lat: 46.25600, lng: 6.06700, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Zone CERN · Contrôles fréquents', nearestOpen: undefined },
  { id: 'sauverny', name: 'Sauverny', lat: 46.28200, lng: 6.01700, type: 'secondary', capacity: 'low', hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '⚠️ Contrôles renforcés pendant G7', nearestOpen: 'Meyrin (5 km)' },
  { id: 'thoiry', name: 'Thoiry / Saint-Jean-de-Gonville', lat: 46.26600, lng: 5.98800, type: 'secondary', capacity: 'low', hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '⚠️ Contrôles renforcés pendant G7', nearestOpen: 'La Plaine (12 km)' },
  { id: 'peron', name: 'Péron', lat: 46.19600, lng: 5.92900, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '⚠️ Contrôles renforcés pendant G7', nearestOpen: 'La Plaine (15 km)' },
  { id: 'divonne', name: 'Divonne-les-Bains', lat: 46.35700, lng: 6.13800, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos', 'Piétons'], pedestrian: true, g7Info: '✓ Ouvert 24/7 · Accès lac et casino', nearestOpen: undefined },
  { id: 'leaz', name: 'Léaz / Longeray', lat: 45.93400, lng: 5.81200, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Entrée A40 côté français', nearestOpen: undefined },

  // ── NOUVEAU — Vaud-France (Jura/Nyon area) ───────────────────────────────────
  { id: 'la-cure', name: 'La Cure / Les Rousses', lat: 46.45600, lng: 6.06800, type: 'main', capacity: 'medium', hours: '24h/24 (sauf conditions neige)', vehicles: ['Voitures', 'Motos', 'Piétons', 'Vélos'], pedestrian: true, g7Info: '✓ Ouvert · Route D1084 ↔ Givrine · Fermé si neige abondante', nearestOpen: undefined },
  { id: 'saint-cergue', name: 'Saint-Cergue (Col de la Givrine)', lat: 46.44700, lng: 6.15400, type: 'secondary', capacity: 'low', hours: '24h/24 (saison)', vehicles: ['Voitures', 'Motos', 'Vélos', 'Piétons'], pedestrian: true, g7Info: '✓ Ouvert · Passage Nyon ↔ Morez FR', nearestOpen: 'La Cure (15 km)' },
  { id: 'vallorbe', name: 'Vallorbe', lat: 46.70600, lng: 6.37500, type: 'main', capacity: 'high', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Train', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Douane principale Vaud · Ligne CFF Lausanne-Paris', nearestOpen: undefined },

  // ── NOUVEAU — Haute-Savoie (vers Thonon/Évian) ──────────────────────────────
  { id: 'douvaine', name: 'Douvaine', lat: 46.31400, lng: 6.31700, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos', 'Camions'], pedestrian: false, g7Info: '✓ Ouvert · Axe Annemasse ↔ Thonon · Surveillance renforcée G7', nearestOpen: undefined },
  { id: 'sciez', name: 'Sciez / Ballaison', lat: 46.29000, lng: 6.29000, type: 'secondary', capacity: 'low', hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '⚠️ Contrôles pendant G7', nearestOpen: 'Douvaine (8 km)' },
]

const G7_START = new Date('2026-06-11T22:01:00Z')
const G7_END   = new Date('2026-06-18T21:59:00Z')
const G7_OPEN  = new Set(['bardonnex','thonex-vallard','moillesulaz','meyrin','ferney-voltaire','perly','anieres','prevessin-moens','divonne','leaz','la-cure','vallorbe','douvaine','sauverny'])

export function computeInstantStatus(c: CrossingStatic, now: Date): { status: BorderStatus; color: string; icon: string; waitMinutes: number } {
  const isG7 = now >= G7_START && now <= G7_END

  if (isG7 && !G7_OPEN.has(c.id)) {
    return { status: 'BLOCKED', color: '#636366', icon: '🔒', waitMinutes: 0 }
  }

  const h = now.getHours()
  const isPeak = (h >= 7 && h <= 9) || (h >= 16 && h <= 19)
  const isNight = h >= 22 || h < 6

  let status: BorderStatus
  if (c.type === 'motorway') {
    status = isNight ? 'CLEAR' : isPeak ? 'MODERATE' : 'LIGHT'
  } else if (c.type === 'main') {
    status = isNight ? 'CLEAR' : isPeak ? 'LIGHT' : 'CLEAR'
  } else {
    status = isNight ? 'CLEAR' : isPeak ? 'LIGHT' : 'CLEAR'
  }

  if (isG7 && G7_OPEN.has(c.id)) {
    if (status === 'CLEAR') status = 'LIGHT'
  }

  const waitMap: Record<BorderStatus, Record<'high'|'medium'|'low', number>> = {
    CLEAR:    { high: 0,  medium: 0,  low: 0  },
    LIGHT:    { high: 3,  medium: 4,  low: 2  },
    MODERATE: { high: 10, medium: 12, low: 8  },
    HEAVY:    { high: 20, medium: 25, low: 15 },
    BLOCKED:  { high: 0,  medium: 0,  low: 0  },
  }

  return {
    status,
    color: STATUS_COLOR[status],
    icon: c.pedestrian ? '🚶' : '🛂',
    waitMinutes: waitMap[status][c.capacity],
  }
}

export function buildInstantGeoJSON(now: Date) {
  return {
    type: 'FeatureCollection' as const,
    features: ALL_CROSSINGS.map(c => {
      const { status, color, icon, waitMinutes } = computeInstantStatus(c, now)
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: {
          id: c.id, name: c.name, type: 'border',
          status, color, icon, waitMinutes,
          hours: c.hours, vehicles: c.vehicles.join(' · '),
          g7Info: c.g7Info, nearestOpen: c.nearestOpen ?? '',
          pedestrian: c.pedestrian,
        },
      }
    }),
  }
}
