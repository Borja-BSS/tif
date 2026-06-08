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
  { id: 'bardonnex', name: 'Bardonnex', lat: 46.1406, lng: 6.1008, type: 'motorway', capacity: 'high', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Cars', 'Motos'], pedestrian: false, g7Info: '⭐ Poste macaron prioritaire G7 · Contrôle permanent OFDF 24h/24 · 12-18 juin (source : ge.ch)', nearestOpen: undefined },
  { id: 'thonex-vallard', name: 'Thônex-Vallard', lat: 46.1942, lng: 6.2236, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'], pedestrian: false, g7Info: '⭐ Poste macaron prioritaire G7 · Contrôle permanent OFDF 24h/24 · 12-18 juin (source : ge.ch)', nearestOpen: undefined },
  { id: 'moillesulaz', name: 'Moillesulaz', lat: 46.1946, lng: 6.2055, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos', 'Piétons', 'Vélos', 'Tram D'], pedestrian: true, g7Info: '✓ Ouvert 24h/24 · Contrôle permanent OFDF · 12-18 juin (source : ge.ch)', nearestOpen: undefined },
  { id: 'meyrin', name: 'Meyrin', lat: 46.23440, lng: 6.06100, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert 24h/24 · Contrôle permanent OFDF · Corridor CERN maintenu · 12-18 juin (source : ge.ch)', nearestOpen: undefined },
  { id: 'ferney-voltaire', name: 'Ferney-Voltaire', lat: 46.2505, lng: 6.1107, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos', 'Cars'], pedestrian: false, g7Info: '✓ Ouvert 24h/24 · Contrôle permanent OFDF · Proximité aéroport GVA · 12-18 juin (source : ge.ch)', nearestOpen: undefined },
  { id: 'perly', name: 'Perly', lat: 46.1488, lng: 6.0829, type: 'secondary', capacity: 'low', hours: '24h/24', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert 24h/24 · Contrôle permanent OFDF · Route de Saint-Julien · 12-18 juin (source : ge.ch)', nearestOpen: undefined },
  { id: 'anieres', name: 'Anières', lat: 46.2650, lng: 6.2440, type: 'secondary', capacity: 'low', hours: '24h/24', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert 24h/24 · Contrôle permanent OFDF · Passage est · 12-18 juin (source : ge.ch)', nearestOpen: undefined },
  // ── TIER 2 — Geneva canton, restricted ──────────────────────────────────────
  { id: 'croix-de-rozon', name: 'Croix-de-Rozon', lat: 46.1379, lng: 6.126, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Bardonnex (7 km)' },
  { id: 'veyrier', name: 'Veyrier', lat: 46.16940, lng: 6.18803, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos', 'Piétons'], pedestrian: true, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Moillesulaz (5 km)' },
  { id: 'fossard', name: 'Fossard', lat: 46.195, lng: 6.213, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Moillesulaz (1 km)' },
  { id: 'mategnin', name: 'Mategnin', lat: 46.2315, lng: 6.0640, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Meyrin (3 km)' },
  { id: 'mon-idee', name: 'Mon-Idée', lat: 46.2084, lng: 6.2456, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Perly (1 km)' },
  { id: 'monniaz', name: 'Monniaz', lat: 46.24155, lng: 6.30836, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Macaron requis · Ouvert 06:00–09:30 / 15:30–19:00 · Hors macaron : fermé · 12-18 juin (source : ge.ch)', nearestOpen: 'Anières (8 km)' },
  { id: 'chancy', name: 'Chancy', lat: 46.1501, lng: 5.9722, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '🔒 Macaron requis · Ouvert 06:00–09:30 / 15:30–19:00 · Hors macaron : fermé · 12-18 juin (source : ge.ch)', nearestOpen: 'Soral (14 km)' },
  { id: 'avully', name: 'Avully', lat: 46.1618, lng: 5.9778, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'La Plaine (9 km)' },
  { id: 'la-plaine', name: 'La Plaine', lat: 46.1776, lng: 5.9821, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Meyrin (20 km)' },
  { id: 'communaux-ambilly', name: 'Communaux d\'Ambilly', lat: 46.1958, lng: 6.2180, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Riverains'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Moillesulaz (2 km)' },
  { id: 'hermance', name: 'Hermance', lat: 46.3018, lng: 6.2480, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Piétons', 'Vélos'], pedestrian: true, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Veigy (8 km)' },
  { id: 'soral', name: 'Soral', lat: 46.1509, lng: 5.9993, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Bardonnex (18 km)' },
  // ── TIER 3 — Geneva canton, tertiary ────────────────────────────────────────
  { id: 'landecy', name: 'Landecy', lat: 46.1395, lng: 6.0756, type: 'tertiary', capacity: 'low', hours: 'Restreint (locaux)', vehicles: ['Voitures', 'Riverains'], pedestrian: false, g7Info: '🔒 Macaron requis · Ouvert 06:00–09:30 / 15:30–19:00 · Hors macaron : fermé · 12-18 juin (source : ge.ch)', nearestOpen: 'Bardonnex (6 km)' },
  { id: 'bossey', name: 'Bossey', lat: 46.15300, lng: 6.20500, type: 'tertiary', capacity: 'low', hours: 'Piétons / Vélos uniquement', vehicles: ['Piétons', 'Vélos'], pedestrian: true, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Veyrier (3 km)' },
  { id: 'troinex', name: 'Troinex', lat: 46.1616, lng: 6.1530, type: 'tertiary', capacity: 'low', hours: 'Restreint (locaux)', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Veyrier (2 km)' },
  { id: 'compesieres', name: 'Compesières', lat: 46.14950, lng: 6.07338, type: 'tertiary', capacity: 'low', hours: '06:00–18:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Mon-Idée (1 km)' },
  { id: 'bernex', name: 'Bernex', lat: 46.15500, lng: 6.04050, type: 'tertiary', capacity: 'low', hours: 'Restreint (locaux)', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Mon-Idée (3 km)' },
  { id: 'ecogia', name: 'Écogia (Satigny)', lat: 46.22780, lng: 6.01960, type: 'tertiary', capacity: 'low', hours: 'Restreint (agricole)', vehicles: ['Voitures', 'Tracteurs'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Meyrin (8 km)' },
  { id: 'veigy', name: 'Veigy', lat: 46.2500, lng: 6.2524, type: 'tertiary', capacity: 'low', hours: 'Restreint (locaux)', vehicles: ['Voitures'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026', nearestOpen: 'Anières (5 km)' },

  // ── NOUVEAU — Pays de Gex (Ain) ──────────────────────────────────────────────
  { id: 'prevessin-moens', name: 'Prévessin-Moëns', lat: 46.2470, lng: 6.0642, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Zone CERN · Contrôles fréquents', nearestOpen: undefined },
  { id: 'sauverny', name: 'Sauverny', lat: 46.28200, lng: 6.01700, type: 'secondary', capacity: 'low', hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '⚠️ Contrôles renforcés pendant G7', nearestOpen: 'Meyrin (5 km)' },
  { id: 'thoiry', name: 'Thoiry / Saint-Jean-de-Gonville', lat: 46.24700, lng: 5.98100, type: 'secondary', capacity: 'low', hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '⚠️ Contrôles renforcés pendant G7', nearestOpen: 'La Plaine (12 km)' },
  { id: 'peron', name: 'Péron', lat: 46.19600, lng: 5.92900, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '⚠️ Contrôles renforcés pendant G7', nearestOpen: 'La Plaine (15 km)' },
  { id: 'divonne', name: 'Divonne-les-Bains', lat: 46.3521, lng: 6.1488, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos', 'Piétons'], pedestrian: true, g7Info: '✓ Ouvert 24h/24 · Canton Vaud — pas de fermeture G7 · Contrôles renforcés possibles · Accès lac et casino (source : admin.ch)', nearestOpen: undefined },
  { id: 'leaz', name: 'Léaz / Longeray', lat: 45.93400, lng: 5.81200, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Entrée A40 côté français', nearestOpen: undefined },

  // ── NOUVEAU — Vaud-France (Jura/Nyon area) ───────────────────────────────────
  { id: 'la-cure', name: 'La Cure / Les Rousses', lat: 46.4638, lng: 6.0726, type: 'main', capacity: 'medium', hours: '24h/24 (sauf conditions neige)', vehicles: ['Voitures', 'Motos', 'Piétons', 'Vélos'], pedestrian: true, g7Info: '✓ Ouvert · Route D1084 ↔ Givrine · Fermé si neige abondante', nearestOpen: undefined },
  { id: 'saint-cergue', name: 'Saint-Cergue (Col de la Givrine)', lat: 46.4182, lng: 6.0780, type: 'secondary', capacity: 'low', hours: '24h/24 (saison)', vehicles: ['Voitures', 'Motos', 'Vélos', 'Piétons'], pedestrian: true, g7Info: '✓ Ouvert · Passage Nyon ↔ Morez FR', nearestOpen: 'La Cure (15 km)' },
  { id: 'vallorbe', name: 'Vallorbe', lat: 46.7138, lng: 6.3800, type: 'main', capacity: 'high', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Train', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Douane principale Vaud · Ligne CFF Lausanne-Paris', nearestOpen: undefined },

  // ── NOUVEAU — Haute-Savoie (vers Thonon/Évian) ──────────────────────────────
  { id: 'douvaine', name: 'Douvaine', lat: 46.3005, lng: 6.2552, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos', 'Camions'], pedestrian: false, g7Info: '✓ Ouvert · Hors canton GE — restrictions GE ne s\'appliquent pas · Contrôles renforcés G7 · Axe Annemasse ↔ Thonon', nearestOpen: undefined },
  { id: 'sciez', name: 'Sciez / Ballaison', lat: 46.33136, lng: 6.37525, type: 'secondary', capacity: 'low', hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '⚠️ Contrôles pendant G7', nearestOpen: 'Douvaine (8 km)' },
  { id: 'excenevex', name: 'Excenevex / Yvoire', lat: 46.36933, lng: 6.32545, type: 'tertiary', capacity: 'low', hours: 'Piétons / Vélos / Riverains', vehicles: ['Piétons', 'Vélos', 'Voitures riverains'], pedestrian: true, g7Info: '⚠️ Contrôles renforcés G7 · Rive lac Léman', nearestOpen: 'Douvaine (9 km)' },
  { id: 'thonon', name: 'Thonon-les-Bains', lat: 46.3693, lng: 6.4788, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Hors canton GE · CGN relocalisé ici (bac Évian suspendu) · Axe vers Valais · Renforcé G7 (source : thononagglo.fr)', nearestOpen: undefined },
  { id: 'evian', name: 'Évian-les-Bains', lat: 46.4018, lng: 6.5878, type: 'main', capacity: 'medium', hours: 'PASS G7 requis', vehicles: ['Voitures', 'Camions', 'Motos'], pedestrian: false, g7Info: '🏛️ SITE G7 · Zone bleue active 11-17 juin · PASS G7 (QR code) obligatoire · Bac CGN suspendu — relocalisé à Thonon et Lugrin · Accès très restreint (source : haute-savoie.gouv.fr)', nearestOpen: 'Thonon (15 km)' },

  // ── NOUVEAU — Zone Annecy / Sud Haute-Savoie ────────────────────────────────
  { id: 'annemasse-gaillard', name: 'Annemasse / Gaillard', lat: 46.1944, lng: 6.2278, type: 'main', capacity: 'high', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos', 'Piétons', 'Tram'], pedestrian: true, g7Info: '⚠️ Passage routier fermé 12-18 juin · Gare d\'Annemasse autorisée (Léman Express) · (source : ge.ch)', nearestOpen: 'Moillesulaz (2 km)' },
  { id: 'saint-julien', name: 'Saint-Julien-en-Genevois', lat: 46.1516, lng: 6.0978, type: 'main', capacity: 'high', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Cars', 'Motos'], pedestrian: false, g7Info: '🔒 Fermé 12-18 juin 2026 · Hors périmètre des 7 passages autorisés GE · Axe A41 vers Annecy (source : ge.ch)', nearestOpen: 'Bardonnex (7 km)' },
  { id: 'collonges', name: 'Collonges-sous-Salève', lat: 45.99800, lng: 6.05200, type: 'secondary', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · A40 direction Annecy / Sallanches', nearestOpen: undefined },

  // ── NOUVEAU — Zone Jura / Pontarlier / Champagnole ──────────────────────────
  { id: 'les-hopitaux-neufs', name: 'Les Hôpitaux-Neufs / Pontarlier', lat: 46.7740, lng: 6.3682, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Axe RN57 Pontarlier ↔ Vallorbe (CH)', nearestOpen: undefined },
  { id: 'saint-Laurent', name: 'Saint-Laurent-en-Grandvaux', lat: 46.5766, lng: 6.0840, type: 'secondary', capacity: 'low', hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Jura ↔ Vaud · Vers Champagnole', nearestOpen: 'La Cure (20 km)' },
  { id: 'bois-d-amont', name: 'Bois-d\'Amont (Jura)', lat: 46.5476, lng: 6.1870, type: 'secondary', capacity: 'low', hours: '24h/24 (saison ski)', vehicles: ['Voitures', 'Motos', 'Piétons'], pedestrian: true, g7Info: '✓ Ouvert · Station Les Rousses ↔ Suisse · Zone ski transfrontalière', nearestOpen: 'La Cure (5 km)' },
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
