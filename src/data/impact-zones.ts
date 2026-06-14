// Impact zones — polygones statiques basés sur documents officiels TPG GestE
// Source : NO-G7 14.06.26 (exporté GestE 13.06.2026 21:28)

export type ImpactZoneType =
  | 'DEMONSTRATION'
  | 'SECURITY_PERIMETER'
  | 'TRANSPORT_DISRUPTION'
  | 'ROAD_CLOSURE'

export interface ImpactZone {
  id:          string
  title:       string
  description: string
  lines?:      string[]      // lignes TPG impactées
  type:        ImpactZoneType
  severity:    'HIGH' | 'MEDIUM'
  renderOnMap?: boolean      // false = données dispo dans le menu mais pas sur la carte
  // GeoJSON Polygon coordinates [lng, lat][]
  coordinates: [number, number][]
  activeFrom:  Date
  activeTo:    Date
  fillColor:   string
  fillOpacity: number
  strokeColor: string
  source:      string
  sourceRef:   string
}

// ── Zone 1 — Périmètre manifestation NO-G7 (rouge) ──────────────────────────
// Tracé officiel TPG page 1 : Quai Wilson · Quai du Mont-Blanc · Rue des Alpes
// Rue A-Lévrier/F-Bonivard · Rue de Chantepoulet · Place Lise-Girardin
// Rue de la Servette · Rue Louis-Favre · Rue du Grand-Pré
// Avenue Giuseppe-Motta · Place des Nations · Avenue de France · Parc Mon Repos
const ZONE_MANIFESTATION: [number, number][] = [
  [6.1505923, 46.2040486], // Point de jonction sud (Cornavin / Sécheron)
  [6.1548, 46.2073],       // Quai du Mont-Blanc (milieu)
  [6.1572, 46.2098],       // Quai Wilson (sud, angle Rue des Alpes)
  [6.1578, 46.2148],       // Quai Wilson (milieu)
  [6.1568, 46.2188],       // Quai Wilson (nord, Pâquis)
  [6.1542, 46.2215],       // Avenue Giuseppe-Motta × lac
  [6.1486, 46.2236],       // Avenue Giuseppe-Motta (milieu est)
  [6.1420, 46.2250],       // Place des Nations (est)
  [6.1360, 46.2244],       // Avenue de France (est)
  [6.1335, 46.2218],       // Rue de la Servette (nord)
  [6.1325, 46.2178],       // Rue de la Servette (milieu)
  [6.1330, 46.2148],       // Rue Louis-Favre (ouest)
  [6.1348, 46.2112],       // Rue du Grand-Pré (milieu)
  [6.1370, 46.2088],       // Rue du Grand-Pré (sud)
  [6.1267310, 46.2081691], // Extension ouest (Rue de la Servette / Saint-Jean)
  [6.1327700, 46.2055601], // Descente sud-est
  [6.1426392, 46.2055738], // Longueur est (bas)
  [6.1434680, 46.2043145], // Angle sud
  [6.1505923, 46.2040486], // Fermeture (jonction)
]

// ── Zone 2 — Réseau TPG perturbé (orange) ───────────────────────────────────
// Zone d'impact élargie visible carte page 2 — lignes supprimées ou déviées
// Couvre de Cornavin / Centre-Ville vers le lac (rive droite)
// Dépôt Jonction pour les trolleybus (toutes les lignes rentrées)
const ZONE_TPG: [number, number][] = [
  [6.1498, 46.2055],  // Pont du Mont-Blanc (SE lac)
  [6.1548, 46.2073],  // Quai du Mont-Blanc
  [6.1572, 46.2098],  // Quai Wilson (sud)
  [6.1578, 46.2148],  // Quai Wilson (milieu)
  [6.1568, 46.2188],  // Quai Wilson (nord)
  [6.1542, 46.2215],  // Avenue Giuseppe-Motta × lac
  [6.1486, 46.2236],  // Avenue Giuseppe-Motta (est)
  [6.1420, 46.2250],  // Place des Nations (est)
  [6.1360, 46.2244],  // Avenue de France
  [6.1248, 46.2232],  // Route de Meyrin / Petit-Saconnex (extension nord-ouest)
  [6.1105, 46.2185],  // Route de Vernier
  [6.1062, 46.2130],  // Vernier / Entrée dépôt trolleybus Jonction
  [6.1080, 46.2040],  // Jonction (Route des Acacias)
  [6.1118, 46.1980],  // Carouge nord-ouest (Bd du Pont-d'Arve)
  [6.1225, 46.1930],  // Carouge-Tours
  [6.1350, 46.1935],  // Carouge est
  [6.1435, 46.1970],  // Rive / Quai des Bergues (rive gauche)
  [6.1498, 46.2055],  // Fermeture
]

export const IMPACT_ZONES: ImpactZone[] = [
  {
    id:          'no-g7-manifestation',
    title:       'Manifestation NO-G7 — Périmètre',
    description:
      'Rassemblement autorisé au Parc Mon Repos de 15h00 à 22h30.\n' +
      'Zone d\'impact direct sur la circulation et le réseau TPG.\n\n' +
      'Trams rentrés aux dépôts :\n' +
      '* Ligne 12 → dépôt CMB\n' +
      '* Lignes 14, 2/3 → dépôt CMC\n' +
      '* Lignes 15, 18 (moitié) → dépôt CMC\n\n' +
      'Tous les trolleybus → dépôt Jonction.\n' +
      'Temps de mise en œuvre : 1h30 avant déclenchement.',
    lines:       ['12', '14', '15', '18', '2', '3'],
    type:        'DEMONSTRATION',
    severity:    'HIGH',
    coordinates: ZONE_MANIFESTATION,
    activeFrom:  new Date('2026-06-14T13:30:00+02:00'),
    activeTo:    new Date('2026-06-14T22:30:00+02:00'),
    fillColor:   '#FF453A',
    fillOpacity: 0.14,
    strokeColor: '#FF453A',
    source:      'TPG GestE',
    sourceRef:   'NO-G7 14.06.26',
  },
  {
    id:          'no-g7-tpg-disruption',
    renderOnMap: false,
    title:       'Réseau TPG — Lignes supprimées',
    description:
      'Perturbation majeure du réseau dès 13h30 (1h30 avant le déclenchement).\n\n' +
      'Lignes SUPPRIMÉES :\n' +
      '* Trams : 12 · 14 · 15 · 18 (partiel)\n' +
      '* Bus/Trolleybus : 1 · 2 · 3 · 6 · 7 · 10 · 17 · 19 · 25 · 91 · 92\n\n' +
      'Lignes avec rebroussement ou modification de terminus :\n' +
      '* 5 · 8 · 9 · 11 · 20 · 22 · 33 · 51 · 60 · 80 · A · E · G\n\n' +
      'Prévoyez un itinéraire alternatif depuis/vers le centre-ville.',
    lines:       ['1','2','3','6','7','10','12','17','19','25','91','92'],
    type:        'TRANSPORT_DISRUPTION',
    severity:    'HIGH',
    coordinates: ZONE_TPG,
    activeFrom:  new Date('2026-06-14T13:30:00+02:00'),
    activeTo:    new Date('2026-06-14T23:30:00+02:00'),
    fillColor:   '#FF9F0A',
    fillOpacity: 0.09,
    strokeColor: '#FF9F0A',
    source:      'TPG GestE',
    sourceRef:   'NO-G7 14.06.26',
  },
]

export function getActiveImpactZones(now = new Date()): ImpactZone[] {
  return IMPACT_ZONES.filter(z => now >= z.activeFrom && now <= z.activeTo)
}

export function getImpactZoneGeoJSON(zones: ImpactZone[]) {
  return {
    type: 'FeatureCollection' as const,
    features: zones.map(z => ({
      type:       'Feature' as const,
      properties: {
        id:          z.id,
        title:       z.title,
        description: z.description,
        lines:       z.lines ?? [],
        type:        z.type,
        fillColor:   z.fillColor,
        fillOpacity: z.fillOpacity,
        strokeColor: z.strokeColor,
        source:      z.source,
        sourceRef:   z.sourceRef,
        activeFrom:  z.activeFrom.toISOString(),
        activeTo:    z.activeTo.toISOString(),
      },
      geometry: {
        type:        'Polygon' as const,
        coordinates: [z.coordinates],
      },
    })),
  }
}
