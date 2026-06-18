// Client-safe subset of border-crossings — no server imports

export type BorderStatus = 'CLEAR' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'BLOCKED'

export interface CrossingStatic {
  id: string; name: string; lat: number; lng: number
  type: 'motorway' | 'main' | 'secondary' | 'tertiary' | 'rail'
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
  // ── RAIL — Douane ferroviaire ────────────────────────────────────────────────
  { id: 'cornavin-tgv', name: 'Cornavin — Douane TGV', lat: 46.2099487, lng: 6.1414634, type: 'rail', capacity: 'medium', hours: 'Selon horaires TGV Lyria', vehicles: ['TGV Lyria', 'Trains internationaux CFF'], pedestrian: true, g7Info: '✓ Douane ferroviaire OFDF · Contrôle à quai ou à bord · Pièce d\'identité obligatoire · CH→FR : arrivez 30 min avant départ · FR→CH : contrôle PAF à bord · Horaires TGV Lyria normaux', nearestOpen: undefined },

  // ── TIER 1 — Geneva canton, 24/7 ────────────────────────────────────────────
  { id: 'bardonnex', name: 'Bardonnex', lat: 46.14952, lng: 6.09693, type: 'motorway', capacity: 'high', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Cars', 'Motos'], pedestrian: false, g7Info: '✓ Douane principale · Ouverte 24h/24 · A1 rouverte dans les deux sens · Pièce d\'identité obligatoire · Des temps d\'attente sont à prévoir', nearestOpen: undefined },
  { id: 'thonex-vallard', name: 'Thônex-Vallard', lat: 46.1881120, lng: 6.2027720, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'], pedestrian: false, g7Info: '✓ Ouverte 24h/24 · Pièce d\'identité obligatoire · Des temps d\'attente sont à prévoir', nearestOpen: undefined },
  { id: 'moillesulaz', name: 'Moillesulaz', lat: 46.1922427, lng: 6.2064349, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos', 'Piétons', 'Vélos', 'Tram D'], pedestrian: true, g7Info: '✓ Ouvert 24/7 · Pièce d\'identité obligatoire · Contrôles renforcés · Des temps d\'attente sont à prévoir', nearestOpen: undefined },
  { id: 'meyrin', name: 'Meyrin', lat: 46.2347, lng: 6.0505, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert 24/7 · Pièce d\'identité obligatoire · Contrôles systématiques · Corridor CERN maintenu', nearestOpen: undefined },
  { id: 'ferney-voltaire', name: 'Ferney-Voltaire', lat: 46.25005, lng: 6.11905, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos', 'Cars'], pedestrian: false, g7Info: '✓ Ouvert 24/7 · Pièce d\'identité obligatoire · Contrôles renforcés · Proximité aéroport GVA', nearestOpen: undefined },
  { id: 'perly', name: 'Perly', lat: 46.15234, lng: 6.09103, type: 'secondary', capacity: 'low', hours: '24h/24', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert 24/7 · Pièce d\'identité obligatoire · Route de Saint-Julien-en-Genevois · Des temps d\'attente sont à prévoir', nearestOpen: undefined },
  { id: 'anieres', name: 'Anières', lat: 46.26932, lng: 6.23901, type: 'secondary', capacity: 'low', hours: '24h/24', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert 24/7 · Pièce d\'identité obligatoire · Passage est du canton · Des temps d\'attente sont à prévoir', nearestOpen: undefined },
  // ── TIER 2 — Geneva canton, restricted ──────────────────────────────────────
  { id: 'croix-de-rozon', name: 'Croix-de-Rozon', lat: 46.14351, lng: 6.13836, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Bardonnex (7 km)' },
  { id: 'veyrier', name: 'Veyrier', lat: 46.16631, lng: 6.18840, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos', 'Piétons'], pedestrian: true, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Moillesulaz (5 km)' },
  { id: 'fossard', name: 'Fossard', lat: 46.1836465, lng: 6.1950107, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Moillesulaz (2 km)' },
  { id: 'mategnin', name: 'Mategnin', lat: 46.2437796, lng: 6.0923679, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Meyrin (3 km)' },
  { id: 'mon-idee', name: 'Mon-Idée', lat: 46.2021, lng: 6.2242, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Thônex-Vallard (2 km)' },
  { id: 'monniaz', name: 'Monniaz', lat: 46.2415, lng: 6.3083, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Anières (3 km)' },
  { id: 'chancy', name: 'Chancy', lat: 46.14442, lng: 5.96583, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Perly (11 km)' },
  { id: 'avully', name: 'Avully', lat: 46.1618, lng: 5.9778, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Perly (9 km)' },
  { id: 'la-plaine', name: 'La Plaine', lat: 46.17737, lng: 5.99153, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Meyrin (20 km)' },
  { id: 'communaux-ambilly', name: 'Communaux d\'Ambilly', lat: 46.1982, lng: 6.2118, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Riverains'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Moillesulaz (2 km)' },
  { id: 'hermance', name: 'Hermance', lat: 46.30283, lng: 6.24758, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Piétons', 'Vélos'], pedestrian: true, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Veigy (8 km)' },
  { id: 'soral', name: 'Soral', lat: 46.1433, lng: 6.0451, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Perly (4 km)' },
  { id: 'mandement', name: 'Mandement (Satigny)', lat: 46.2018913, lng: 5.9718478, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Meyrin (12 km)' },
  { id: 'dardagny', name: 'Dardagny', lat: 46.1900628, lng: 5.9820292, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Meyrin (11 km)' },
  { id: 'valleiry', name: 'Valleiry', lat: 46.1336524, lng: 5.9774808, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Perly (18 km) · Bardonnex (19 km)' },
  { id: 'avusy', name: 'Avusy', lat: 46.1427496, lng: 6.0088161, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Perly (12 km) · Bardonnex (12 km)' },
  { id: 'avusy-sezegnin', name: 'Avusy Sézegnin', lat: 46.1427656, lng: 6.0087949, type: 'tertiary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Perly (12 km) · Bardonnex (12 km)' },
  { id: 'soral-mangons', name: 'Soral — Rte des Mangons', lat: 46.1426323, lng: 6.0470017, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Perly (7 km) · Bardonnex (8 km)' },
  { id: 'pas-de-lechelle', name: 'Pas-de-l\'Échelle', lat: 46.1664299, lng: 6.1884322, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures', 'Motos', 'Piétons'], pedestrian: true, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Thônex-Vallard (4 km) · Moillesulaz (4 km)' },
  // ── TIER 3 — Geneva canton, tertiary ────────────────────────────────────────
  { id: 'landecy', name: 'Landecy', lat: 46.1430, lng: 6.1270, type: 'tertiary', capacity: 'low', hours: 'Restreint (locaux)', vehicles: ['Voitures', 'Riverains'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Bardonnex (3 km)' },
  { id: 'bossey', name: 'Bossey', lat: 46.1548324, lng: 6.1608997, type: 'tertiary', capacity: 'low', hours: 'Piétons / Vélos uniquement', vehicles: ['Piétons', 'Vélos'], pedestrian: true, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Bardonnex (9 km) · Perly (8 km)' },
  { id: 'troinex', name: 'Troinex', lat: 46.1545, lng: 6.1613, type: 'tertiary', capacity: 'low', hours: 'Restreint (locaux)', vehicles: ['Voitures'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Veyrier (2 km)' },
  { id: 'compesieres', name: 'Compesières', lat: 46.1460, lng: 6.1195, type: 'tertiary', capacity: 'low', hours: '06:00–18:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Bardonnex (2 km)' },
  { id: 'bernex', name: 'Bernex', lat: 46.15500, lng: 6.04050, type: 'tertiary', capacity: 'low', hours: 'Restreint (locaux)', vehicles: ['Voitures'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Perly (4 km)' },
  { id: 'ecogia', name: 'Écogia (Satigny)', lat: 46.2350, lng: 6.0278, type: 'tertiary', capacity: 'low', hours: 'Restreint (agricole)', vehicles: ['Voitures', 'Tracteurs'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Meyrin (6 km)' },
  { id: 'veigy', name: 'Veigy', lat: 46.27652, lng: 6.24683, type: 'tertiary', capacity: 'low', hours: 'Restreint (locaux)', vehicles: ['Voitures'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Anières (5 km)' },

  // ── NOUVEAU — Pays de Gex (Ain) ──────────────────────────────────────────────
  { id: 'prevessin-moens', name: 'Prévessin-Moëns', lat: 46.2457785, lng: 6.0820011, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Meyrin (5 km)' },
  { id: 'sauverny', name: 'Sauverny', lat: 46.3114, lng: 6.1204, type: 'secondary', capacity: 'low', hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Meyrin (5 km) · Ferney-Voltaire (7 km)' },
  { id: 'bois-chaton', name: 'Bois-Châton', lat: 46.2869728, lng: 6.1045552, type: 'secondary', capacity: 'low', hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Meyrin (4 km)' },
  { id: 'versoix-ferney', name: 'Versoix / Ferney', lat: 46.2608456, lng: 6.1197727, type: 'secondary', capacity: 'low', hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Ferney-Voltaire (1 km) · Meyrin (5 km)' },
  { id: 'thoiry', name: 'Thoiry / Saint-Jean-de-Gonville', lat: 46.2444, lng: 5.9837, type: 'secondary', capacity: 'low', hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Contrôles normaux', nearestOpen: 'La Plaine (12 km)' },
  { id: 'peron', name: 'Péron', lat: 46.1878, lng: 5.9237, type: 'secondary', capacity: 'low', hours: '06:00–20:00', vehicles: ['Voitures'], pedestrian: false, g7Info: '✓ Ouvert · Contrôles normaux', nearestOpen: 'La Plaine (10 km)' },
  { id: 'divonne', name: 'Divonne-les-Bains', lat: 46.34573, lng: 6.15228, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos', 'Piétons'], pedestrian: true, g7Info: '✓ Ouvert 24h/24 · Canton Vaud — pas de fermeture G7 · Contrôles renforcés possibles · Accès lac et casino (source : admin.ch)', nearestOpen: undefined },
  { id: 'leaz', name: 'Léaz / Longeray', lat: 45.93400, lng: 5.81200, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Entrée A40 côté français', nearestOpen: undefined },

  // ── NOUVEAU — Vaud-France (Jura/Nyon area) ───────────────────────────────────
  { id: 'la-cure', name: 'La Cure / Les Rousses', lat: 46.46478, lng: 6.07300, type: 'main', capacity: 'medium', hours: '24h/24 (sauf conditions neige)', vehicles: ['Voitures', 'Motos', 'Piétons', 'Vélos'], pedestrian: true, g7Info: '✓ Ouvert · Route D1084 ↔ Givrine · Fermé si neige abondante', nearestOpen: undefined },
  { id: 'saint-cergue', name: 'Saint-Cergue (Col de la Givrine)', lat: 46.4546, lng: 6.0877, type: 'secondary', capacity: 'low', hours: '24h/24 (saison)', vehicles: ['Voitures', 'Motos', 'Vélos', 'Piétons'], pedestrian: true, g7Info: '✓ Ouvert · Passage Nyon ↔ Morez FR', nearestOpen: 'La Cure (2 km)' },
  { id: 'vallorbe', name: 'Vallorbe', lat: 46.7311, lng: 6.3861, type: 'main', capacity: 'high', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Train', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Douane principale Vaud · Ligne CFF Lausanne-Paris', nearestOpen: undefined },

  // ── NOUVEAU — Haute-Savoie (vers Thonon/Évian) ──────────────────────────────
  { id: 'douvaine', name: 'Douvaine', lat: 46.30283, lng: 6.31200, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos', 'Camions'], pedestrian: false, g7Info: '✓ Ouvert · Hors canton GE — restrictions GE ne s\'appliquent pas · Contrôles renforcés G7 · Axe Annemasse ↔ Thonon', nearestOpen: undefined },
  { id: 'sciez', name: 'Sciez / Ballaison', lat: 46.34158, lng: 6.39015, type: 'secondary', capacity: 'low', hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Contrôles normaux', nearestOpen: 'Douvaine (8 km)' },
  { id: 'excenevex', name: 'Excenevex / Yvoire', lat: 46.37162, lng: 6.32362, type: 'tertiary', capacity: 'low', hours: 'Piétons / Vélos / Riverains', vehicles: ['Piétons', 'Vélos', 'Voitures riverains'], pedestrian: true, g7Info: '✓ Ouvert · Contrôles normaux · Rive lac Léman', nearestOpen: 'Douvaine (9 km)' },
  { id: 'thonon', name: 'Thonon-les-Bains', lat: 46.37609, lng: 6.47516, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Hors canton GE · CGN relocalisé ici (bac Évian suspendu) · Axe vers Valais · Renforcé G7 (source : thononagglo.fr)', nearestOpen: undefined },
  { id: 'evian', name: 'Évian-les-Bains', lat: 46.40163, lng: 6.59467, type: 'main', capacity: 'medium', hours: 'PASS G7 requis', vehicles: ['Voitures', 'Camions', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert post-G7 · Bac CGN progressivement rétabli · Contrôles normaux · Pièce d\'identité obligatoire', nearestOpen: 'Thonon (15 km)' },

  // ── NOUVEAU — Zone Annecy / Sud Haute-Savoie ────────────────────────────────
  { id: 'annemasse-gaillard', name: 'Annemasse / Gaillard', lat: 46.1930, lng: 6.2068, type: 'main', capacity: 'high', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos', 'Piétons', 'Tram'], pedestrian: true, g7Info: '✓ Rouvert · Passage routier et gare ouverts · Léman Express disponible · Pièce d\'identité obligatoire', nearestOpen: 'Moillesulaz (1 km)' },
  { id: 'saint-julien', name: 'Saint-Julien-en-Genevois', lat: 46.15063, lng: 6.08890, type: 'main', capacity: 'high', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Cars', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Axe A41 vers Annecy · Contrôles renforcés G7 · Pièce d\'identité obligatoire', nearestOpen: undefined },
  { id: 'collonges', name: 'Collonges-sous-Salève', lat: 46.1400, lng: 6.1490, type: 'secondary', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Rouvert · Horaires habituels', nearestOpen: 'Bardonnex (8 km)' },

  // ── NOUVEAU — Zone Jura / Pontarlier / Champagnole ──────────────────────────
  { id: 'les-hopitaux-neufs', name: 'Les Hôpitaux-Neufs / Pontarlier', lat: 46.7375, lng: 6.3771, type: 'main', capacity: 'medium', hours: '24h/24', vehicles: ['Voitures', 'Camions', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Axe RN57 Pontarlier ↔ Vallorbe (CH)', nearestOpen: undefined },
  { id: 'saint-Laurent', name: 'Saint-Laurent-en-Grandvaux', lat: 46.578, lng: 6.018, type: 'secondary', capacity: 'low', hours: '06:00–22:00', vehicles: ['Voitures', 'Motos'], pedestrian: false, g7Info: '✓ Ouvert · Jura ↔ Vaud · Vers Champagnole', nearestOpen: 'La Cure (20 km)' },
  { id: 'bois-d-amont', name: 'Bois-d\'Amont (Jura)', lat: 46.54842, lng: 6.15903, type: 'secondary', capacity: 'low', hours: '24h/24 (saison ski)', vehicles: ['Voitures', 'Motos', 'Piétons'], pedestrian: true, g7Info: '✓ Ouvert · Station Les Rousses ↔ Suisse · Zone ski transfrontalière', nearestOpen: 'La Cure (5 km)' },
]

const G7_START = new Date('2026-06-11T22:01:00Z')
const G7_END   = new Date('2026-06-18T05:00:00Z') // Retour à la normale 18 juin 7h CEST
const G7_OPEN  = new Set(['bardonnex','thonex-vallard','moillesulaz','meyrin','ferney-voltaire','perly','anieres','saint-julien','divonne','leaz','la-cure','vallorbe','bois-d-amont','les-hopitaux-neufs','saint-Laurent','douvaine','thonon'])

export function computeInstantStatus(c: CrossingStatic, now: Date): { status: BorderStatus; color: string; icon: string; waitMinutes: number } {
  const isG7 = now >= G7_START && now <= G7_END

  // Rail crossings: fixed process time, not affected by road G7 closures
  if (c.type === 'rail') {
    const status: BorderStatus = isG7 ? 'MODERATE' : 'LIGHT'
    const waitMinutes          = isG7 ? 45 : 30
    return { status, color: STATUS_COLOR[status], icon: '🚂', waitMinutes }
  }

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
