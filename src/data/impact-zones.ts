// Impact zones — polygones et fermetures statiques basés sur documents officiels
// Source : NO-G7 14.06.26 (exporté GestE 13.06.2026 21:28)

export type ImpactZoneType =
  | 'DEMONSTRATION'
  | 'SECURITY_PERIMETER'
  | 'TRANSPORT_DISRUPTION'
  | 'ROAD_CLOSURE'

export interface ImpactZone {
  id:            string
  title:         string
  description:   string
  label?:        string           // libellé court affiché sur la carte-alerte (sinon fallback par type)
  lines?:        string[]
  type:          ImpactZoneType
  severity:      'HIGH' | 'MEDIUM'
  renderOnMap?:  boolean           // false = données dispo dans le menu mais pas sur la carte
  geometryType?: 'Polygon' | 'LineString'  // défaut Polygon
  coordinates:   [number, number][]
  activeFrom:    Date
  activeTo:      Date
  fillColor:     string
  fillOpacity:   number
  strokeColor:   string
  source:        string
  sourceRef:     string
}

// ── Zone 1 — Périmètre manifestation NO-G7 (rouge) ──────────────────────────
const ZONE_MANIFESTATION: [number, number][] = [
  [6.1505923, 46.2040486], // Point de jonction sud (Cornavin / Sécheron)
  [6.1548,    46.2073],    // Quai du Mont-Blanc (milieu)
  [6.1572,    46.2098],    // Quai Wilson (sud, angle Rue des Alpes)
  [6.1578,    46.2148],    // Quai Wilson (milieu)
  [6.1568,    46.2188],    // Quai Wilson (nord, Pâquis)
  [6.1542,    46.2215],    // Avenue Giuseppe-Motta × lac
  [6.1486,    46.2236],    // Avenue Giuseppe-Motta (milieu est)
  [6.1420,    46.2250],    // Place des Nations (est)
  [6.1360,    46.2244],    // Avenue de France (est)
  [6.1335,    46.2218],    // Rue de la Servette (nord)
  [6.1327630, 46.2178423], // Rue de la Servette (point précis)
  [6.1271830, 46.2111268], // Rue Hoffmann
  [6.1267310, 46.2081691], // Extension ouest (Saint-Jean)
  [6.1327700, 46.2055601], // Descente sud-est
  [6.1426392, 46.2055738], // Longueur est (bas)
  [6.1434680, 46.2043145], // Angle sud
  [6.1505923, 46.2040486], // Fermeture (jonction)
]

// ── Zone 2 — Réseau TPG perturbé (orange, carte masquée) ────────────────────
const ZONE_TPG: [number, number][] = [
  [6.1498, 46.2055], [6.1548, 46.2073], [6.1572, 46.2098],
  [6.1578, 46.2148], [6.1568, 46.2188], [6.1542, 46.2215],
  [6.1486, 46.2236], [6.1420, 46.2250], [6.1360, 46.2244],
  [6.1248, 46.2232], [6.1105, 46.2185], [6.1062, 46.2130],
  [6.1080, 46.2040], [6.1118, 46.1980], [6.1225, 46.1930],
  [6.1350, 46.1935], [6.1435, 46.1970], [6.1498, 46.2055],
]

// ── Zone 3 — A1 fermée (Bardonnex → Genève) ─────────────────────────────────
// Fermeture totale de l'autoroute A1 le 14.06.2026 en contexte NO-G7
// Points relevés sur tracé exact de l'autoroute (sud → nord)
const ZONE_A1: [number, number][] = [
  [6.0959020, 46.1468117], // Début — Bardonnex (frontière CH/FR)
  [6.1010086, 46.1625812], // A1 via Saint-Julien-en-Genevois
  [6.0828893, 46.1841458], // A1 virage ouest (Plan-les-Ouates)
  [6.0781994, 46.1941265], // A1 nord (Lancy / Bachet-de-Pesay)
  [6.0773713, 46.2005765], // A1 nord
  [6.0753506, 46.2045619], // A1 nord
  [6.0777679, 46.2090570], // A1 virage est (Vernier)
  [6.0959587, 46.2155479], // A1 est (Meyrin / Aéroport)
  [6.1001037, 46.2189987], // Fin — Genève-Aéroport / Meyrin
]

// ── Zone — Genève Triathlon (rive gauche : Eaux-Vives → Cologny) ────────────
// Emprise INDICATIVE de la zone perturbée (village/départ + routes fermées de
// Cologny : Rampe de Cologny, Quai de Cologny, Ch. du Petray). Les fermetures
// exactes par commune et par heure sont sur la carte officielle (infos riverains).
const ZONE_TRIATHLON: [number, number][] = [
  [6.1545, 46.2048], // Quai Gustave-Ador (côté Jardin Anglais)
  [6.1665, 46.2052], // Plage des Eaux-Vives (départ / arrivée)
  [6.1770, 46.2110], // Quai de Cologny / Port de la Nautique
  [6.1830, 46.2175], // Cologny bord du lac (Rampe de Cologny)
  [6.1740, 46.2180], // Cologny village (Chemin du Petray)
  [6.1650, 46.2110], // Cologny intérieur
  [6.1585, 46.2065], // Retour vers les Eaux-Vives
  [6.1545, 46.2048], // Fermeture
]

export const IMPACT_ZONES: ImpactZone[] = [
  {
    id:          'triathlon-2026-mobilite',
    renderOnMap: true,
    label:       'Mobilité · Genève Triathlon',
    title:       'Genève Triathlon — circulation perturbée · 4–5 juillet',
    description:
      'Week-end du Genève Triathlon (36e édition), samedi 4 et dimanche 5 juillet 2026.\n' +
      'Départs / arrivées : Plage des Eaux-Vives. Zone de départ perturbée du samedi 4h00 au dimanche 17h00.\n\n' +
      'ROUTES FERMÉES DANS LES DEUX SENS (samedi)\n' +
      '* Rampe de Cologny\n' +
      '* Chemin du Petray\n' +
      '* Quai de Cologny\n' +
      'Accès au Parking de Genève-Plage par la contre-allée du Quai Gustave-Ador.\n\n' +
      'SECTEURS PERTURBÉS · SAMEDI 4 JUILLET\n' +
      '* Rive gauche / Cologny / Vandœuvres (rte de la Capite, rte de Vandœuvres) : 6h00–11h15 et 13h00–21h00\n' +
      '* Vésenaz / Collonge-Bellerive : 6h15–11h00 et 13h00–16h00\n' +
      '* Anières / Corsier / Meinier (rte d\'Hermance, rte de Thonon, rte de Compois) : 6h30–11h00 et 13h15–16h00\n\n' +
      'TRANSPORTS · Perturbations à prévoir sur les lignes TPG (détails et suivi en direct sur tpg.ch).\n' +
      'Secours (144, ambulances, police) : accès permanent et prioritaire.\n\n' +
      'Le dispositif du dimanche 5 juillet diffère — carte détaillée par commune sur les infos riverains officielles.',
    type:        'TRANSPORT_DISRUPTION',
    severity:    'HIGH',
    coordinates: ZONE_TRIATHLON,
    activeFrom:  new Date('2026-07-03T00:00:00+02:00'),
    activeTo:    new Date('2026-07-05T23:59:00+02:00'),
    fillColor:   '#FF9F0A',
    fillOpacity: 0.15,
    strokeColor: '#FF9F0A',
    source:      'https://www.genevetriathlon.ch/infosriverains',
    sourceRef:   'Genève Triathlon — infos riverains',
  },
  {
    id:          'no-g7-tpg-disruption',
    renderOnMap: false,
    title:       'Réseau TPG — Perturbations G7 · 11–17 juin',
    description:
      'En lien avec le Sommet du G7 Évian 2026 (13–15 juin) et la manifestation NO-G7 du 14 juin au Parc Mon Repos.\n' +
      '↩ Retour à la normale : à partir du 18 juin 2026.\n\n' +
      'LIGNES SUPPRIMÉES (TRANSFRONTALIÈRES) · Dès le 11 juin\n' +
      '* Ligne 64 — service interrompu jusqu\'au 17 juin inclus\n' +
      '* Ligne 69 — service interrompu jusqu\'au 17 juin inclus\n\n' +
      'LIGNES À PARCOURS ADAPTÉ · Dès le 11 juin\n' +
      '* 38, 40, 52, 78, 82, 83, M — certains arrêts non desservis temporairement\n' +
      '* tpgFlex — aucun arrêt sur le territoire français\n\n' +
      'HORAIRE VACANCES · 15–17 juin\n' +
      '* Horaire vacances appliqué (sauf scolaires 60, 61, 80)\n' +
      '* 14 juin dès 5h00 : aucun tram 17 ; tram 12 limité Bachet-de-Pesay ↔ Plainpalais\n\n' +
      'SUPPRESSIONS TOTALES · Dimanche 14 juin · 13h30–23h30\n' +
      '* Trams : 12 · 14 · 15 · 18 (partiel)\n' +
      '* Bus/Trolleybus : 1 · 2 · 3 · 6 · 7 · 10 · 17 · 19 · 25 · 91 · 92\n' +
      '* Rebroussements / terminus modifiés : 5 · 8 · 9 · 11 · 20 · 22 · 33 · 51 · 60 · 80 · A · E · G\n\n' +
      'AGENCES\n' +
      '* Cornavin & Rive : fermées dès le 12 juin (réouverture 19 et 22 juin)\n' +
      '* Lancy-Pont-Rouge : ouverte normalement\n\n' +
      'Ligne info gratuite : 0800 858 900\n' +
      'Aérobus : service normal prévu (anticiper délais sécurité aéroport)',
    lines:       ['64','69','38','40','52','78','82','83','M','12','14','15','18','1','2','3','6','7','10','17','19','25','91','92'],
    type:        'TRANSPORT_DISRUPTION',
    severity:    'HIGH',
    coordinates: ZONE_TPG,
    activeFrom:  new Date('2026-06-11T00:00:00+02:00'),
    activeTo:    new Date('2026-06-17T23:59:59+02:00'),
    fillColor:   '#FF9F0A',
    fillOpacity: 0.09,
    strokeColor: '#FF9F0A',
    source:      'Transports publics genevois (tpg)',
    sourceRef:   'Communiqué du 10.06.2026',
  },
  {
    id:           'a1-closure',
    title:        'A1 fermée — Bardonnex → Genève',
    description:
      'Fermeture totale de l\'autoroute A1 du 14 au 17 juin 2026 (G7 Évian 2026).\n\n' +
      '⛔ DOUBANE DE BARDONNEX FERMÉE\n\n' +
      'Itinéraires alternatifs :\n' +
      '* Via Ferney-Voltaire (D1005)\n' +
      '* Via Thônex-Vallard (N201)\n' +
      '* Via Moillesulaz (N205)\n\n' +
      'Évitez absolument la A1 et le poste de Bardonnex.',
    type:         'ROAD_CLOSURE',
    severity:     'HIGH',
    geometryType: 'LineString',
    coordinates:  ZONE_A1,
    activeFrom:   new Date('2026-06-14T00:00:00+02:00'),
    activeTo:     new Date('2026-06-17T23:59:59+02:00'),
    fillColor:    '#FF453A',
    fillOpacity:  0,
    strokeColor:  '#FF453A',
    source:       'OFROU / Confédération suisse',
    sourceRef:    'G7 Évian 2026',
  },
]

export function getActiveImpactZones(now = new Date()): ImpactZone[] {
  return IMPACT_ZONES.filter(z => now >= z.activeFrom && now <= z.activeTo)
}

export function getImpactZoneGeoJSON(zones: ImpactZone[]) {
  return {
    type: 'FeatureCollection' as const,
    features: zones.filter(z => z.geometryType !== 'LineString').map(z => ({
      type:       'Feature' as const,
      properties: {
        id: z.id, title: z.title, description: z.description,
        lines: z.lines ?? [], type: z.type,
        fillColor: z.fillColor, fillOpacity: z.fillOpacity, strokeColor: z.strokeColor,
        source: z.source, sourceRef: z.sourceRef,
        activeFrom: z.activeFrom.toISOString(), activeTo: z.activeTo.toISOString(),
      },
      geometry: { type: 'Polygon' as const, coordinates: [z.coordinates] },
    })),
  }
}

export function getImpactRoadGeoJSON(zones: ImpactZone[]) {
  return {
    type: 'FeatureCollection' as const,
    features: zones.filter(z => z.geometryType === 'LineString').map(z => ({
      type:       'Feature' as const,
      properties: {
        id: z.id, title: z.title, description: z.description,
        type: z.type, strokeColor: z.strokeColor,
        source: z.source, sourceRef: z.sourceRef,
        activeFrom: z.activeFrom.toISOString(), activeTo: z.activeTo.toISOString(),
      },
      geometry: { type: 'LineString' as const, coordinates: z.coordinates },
    })),
  }
}
