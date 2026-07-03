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

// ── Zone — Genève Triathlon (rive gauche : Eaux-Vives → Corsier/Meinier) ────
// Emprise INDICATIVE du corridor perturbé (carte officielle du samedi) : de la
// Plage des Eaux-Vives jusqu'à Corsier/Meinier, via Cologny, Vésenaz, Collonge
// et les rtes de la Capite / d'Hermance / de Thonon / de Compois. Fermetures et
// horaires exacts par commune sur la carte officielle (infos riverains).
const ZONE_TRIATHLON: [number, number][] = [
  // Bord du lac (SW), du sud au nord
  [6.1545, 46.2035], // Plage des Eaux-Vives (départ / arrivée)
  [6.1720, 46.2120], // Cologny (bord du lac)
  [6.1850, 46.2300], // Vésenaz
  [6.1950, 46.2500], // Collonge-Bellerive
  [6.2050, 46.2700], // approche Corsier (bord du lac)
  [6.2120, 46.2790], // Corsier (nord de la zone)
  // Retour intérieur (NE → SW)
  [6.2250, 46.2610], // Meinier (nord-est)
  [6.2270, 46.2450], // Meinier
  [6.2110, 46.2320], // Rte de Compois (intérieur)
  [6.1970, 46.2170], // Vandœuvres
  [6.1810, 46.2040], // intérieur Cologny / Vandœuvres
  [6.1670, 46.1965], // retour vers les Eaux-Vives (intérieur)
  [6.1545, 46.2035], // fermeture
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
