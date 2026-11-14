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

// Zone du Rolex Switzerland Sail Grand Prix (rive gauche : Eaux-Vives vers Pallanterie)
// Emprise INDICATIVE du corridor perturbe, tracee sur les axes nommes par l'arrete :
// quai Gustave-Ador, quai de Cologny, route de Thonon jusqu'au rond-point de la
// Pallanterie, et les chemins de Cologny (Byron, Righi, Tour-Carree, Perriere,
// Nant-d'Argent, Ruth). Les fermetures exactes figurent dans la description.
const ZONE_SAILGP: [number, number][] = [
  [6.1545, 46.2035], // Plage des Eaux-Vives / quai Gustave-Ador
  [6.1655, 46.2078], // quai Gustave-Ador, hauteur Geneve-Plage
  [6.1760, 46.2148], // quai de Cologny
  [6.1868, 46.2298], // Vesenaz, tranchee couverte
  [6.1975, 46.2432], // route de Thonon, vers La Pallanterie
  [6.2048, 46.2512], // rond-point de la Pallanterie (limite NE)
  [6.1962, 46.2470], // arriere de la route de Thonon
  [6.1858, 46.2330], // ch. du Nant-d'Argent / Vesenaz interieur
  [6.1782, 46.2205], // ch. de la Tour-Carree / ch. de Ruth
  [6.1715, 46.2120], // ch. du Righi / ch. de la Perriere
  [6.1648, 46.2050], // ch. Byron / rampe de Cologny
  [6.1545, 46.2035], // fermeture
]

export const IMPACT_ZONES: ImpactZone[] = [
  {
    id:          'sailgp-2026-mobilite',
    renderOnMap: true,
    label:       'Mobilité · Rolex Switzerland Sail GP',
    title:       'Rolex Switzerland Sail Grand Prix · circulation perturbée · 16 au 22 septembre',
    description:
      'Deuxième édition du Rolex Switzerland Sail Grand Prix, samedi 19 et dimanche 20 septembre 2026,\n' +
      'sur le Léman. Catamarans à foils F50. Rive gauche fortement perturbée pendant le montage,\n' +
      'la compétition et le démontage.\n\n' +
      'FERMETURES DU MERCREDI 16 SEPTEMBRE (MINUIT) AU MARDI 22 SEPTEMBRE (MINUIT)\n' +
      'Fermeture totale, sauf ayants droit :\n' +
      '* Route de Thonon en direction de Genève, du rond-point de la Pallanterie au quai de Cologny\n' +
      '* Tranchée couverte de Vésenaz\n' +
      'Rues adjacentes fortement perturbées.\n\n' +
      'FERMETURES DU SAMEDI 19 SEPTEMBRE 9H00 AU DIMANCHE 20 SEPTEMBRE 22H00\n' +
      'Fermeture totale, sauf ayants droit :\n' +
      '* Quai Gustave-Ador\n' +
      '* Quai de Cologny\n' +
      '* Route de Thonon\n' +
      '* Chemin Byron\n' +
      '* Chemin du Righi\n' +
      '* Chemin de la Tour-Carrée\n' +
      '* Chemin de la Perrière\n' +
      '* Chemin du Nant-d\'Argent\n' +
      '* Chemin de Ruth\n' +
      'Rues adjacentes fortement perturbées.\n\n' +
      'STATIONNEMENT INTERDIT\n' +
      '* Quai Gustave-Ador et sa contre-route\n' +
      '* Rue de la Scie\n' +
      '* Rue du Lac (3 places)\n' +
      '* Quai de Cologny\n\n' +
      'PARKINGS AMÉNAGÉS\n' +
      '* Cycles, cyclomoteurs et motos : rue de la Scie et contre-route du quai Gustave-Ador\n' +
      '* Cycles et cyclomoteurs : quai de Cologny et parking du Manoir\n' +
      '* Personnes à mobilité réduite : rue des Barques\n\n' +
      'ACCÈS MAINTENU\n' +
      '* Parking de Genève-Plage, par la contre-route et la rampe de Cologny\n\n' +
      'Les horaires des courses, les renforts de transports publics et le village public ne figurent\n' +
      'pas dans l\'arrêté cantonal. Se référer à sailgp.com et à tpg.ch.\n' +
      'Secours (144, ambulances, police) : accès permanent et prioritaire.',
    type:        'TRANSPORT_DISRUPTION',
    severity:    'HIGH',
    coordinates: ZONE_SAILGP,
    activeFrom:  new Date('2026-09-16T00:00:00+02:00'),
    activeTo:    new Date('2026-09-22T23:59:00+02:00'),
    fillColor:   '#FF9F0A',
    fillOpacity: 0.15,
    strokeColor: '#FF9F0A',
    source:      'https://www.ge.ch/actualite/perturbations-circulation-du-mercredi-16-au-mardi-22-septembre-15-09-2026',
    sourceRef:   'État de Genève · perturbations de la circulation, 16 au 22 septembre 2026',
  },
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
