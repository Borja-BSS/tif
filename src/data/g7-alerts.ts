import type { G7Alert, Severity } from './types'

export const g7Alerts: G7Alert[] = [
  {
    id: 'aerien', category: 'aerien', severity: 'warning',
    title: "Restriction de l'espace aérien (région lémanique)",
    detail: "Zone Évian–Lausanne–Aéroport GE. Aéroport opérationnel. Hausse de trafic côté Lausanne.",
    activeFrom: '2026-06-10T13:00:00', activeTo: '2026-06-18T03:00:00',
    source: 'https://www.eda.admin.ch/fr/sommet-du-g7-a-evian',
  },
  {
    id: 'frontiere-controles', category: 'frontiere', severity: 'warning',
    title: 'Contrôles rétablis à la frontière franco-suisse',
    detail: "Contrôles temporaires sur tous les passages. Pièce d'identité requise.",
    activeFrom: '2026-06-10T00:00:00', activeTo: '2026-06-19T23:59:00',
    source: 'https://www.ge.ch/dossier/sommet-du-g7-evian-2026',
  },
  {
    id: 'frontiere-fermeture', category: 'frontiere', severity: 'critical',
    title: '25 passages frontaliers fermés — 7 douanes seulement ouvertes',
    detail: "Fermeture physique dès le 11 juin après-midi. Ouverts 12–18 : Anières, Moillesulaz, Thônex-Vallard, Bardonnex, Perly, Meyrin, Ferney-Voltaire. Également ouverts : gares de Cornavin et d'Annemasse, aéroport de Genève. Pièce d'identité obligatoire. Interdit hors passages dédiés, même à pied ou à vélo. Des temps d'attente sont à prévoir.",
    activeFrom: '2026-06-11T15:00:00', activeTo: '2026-06-18T23:59:00',
    source: 'https://www.ge.ch/document/sommet-du-g7-2026-evian-faq',
  },
  {
    id: 'tpg', category: 'transport', severity: 'warning',
    title: 'TPG perturbés (lignes transfrontalières, horaire vacances)',
    detail: "Lignes 64/69 suspendues ; 38/40/52/82/83 limitées côté suisse ; ligne 29 supprimée 12–14 ; tpgFlex coupé en France ; agences Cornavin/Rive fermées dès le 12. Horaire vacances 15–17 sur tout le réseau.",
    activeFrom: '2026-06-12T00:00:00', activeTo: '2026-06-17T23:59:00',
    source: 'https://www.tcs.ch/fr/camping-voyages/informations-touristiques/news-actualites/g7-evian.php',
  },
  {
    id: 'a1', category: 'route', severity: 'critical',
    title: 'Autoroute A1 (contournement) fermée vers la France',
    detail: "A1 fermée (15–17 juin) en direction de Bardonnex. Depuis Vaud : sortie forcée Meyrin/Vernier/Genève-Centre ; Bernex et Perly/Plan-les-Ouates fermés ; bretelle A1aP La Praille→Bardonnex fermée. Depuis France : circulation maintenue 2 voies, temps d'attente à prévoir. Dim. 14 juin (06h–24h) : sortie Vengeron/Genève-Lac fermée.",
    activeFrom: '2026-06-14T06:00:00', activeTo: '2026-06-17T23:59:00',
    source: 'https://www.ge.ch/dossier/sommet-du-g7-evian-2026',
  },
  {
    id: 'bastions', category: 'culture', severity: 'info',
    title: 'Parc des Bastions fermé au public',
    detail: "Fermé dès le 12 juin ; rouvre le 19 pour la Fête de la musique.",
    activeFrom: '2026-06-12T00:00:00', activeTo: '2026-06-18T23:59:00',
    source: 'https://www.geneve.ch/actualites/sommet-evian-impacts-geneve',
  },
  {
    id: 'cgn', category: 'lac', severity: 'info',
    title: 'CGN — débarcadère Évian fermé, croisières adaptées',
    detail: "Débarcadère Évian fermé (déviation Lugrin). Nyon–Yvoire interrompue le 15. Navigation de plaisance autorisée sans franchir la frontière.",
    activeFrom: '2026-06-11T00:00:00', activeTo: '2026-06-17T23:59:00',
    source: 'https://www.cgn.ch/g7',
  },
  {
    id: 'services', category: 'service', severity: 'info',
    title: 'Services cantonaux adaptés + ligne verte police',
    detail: "Postes de police : Pâquis et aéroport 24h/7j ; Plainpalais lun–ven 10h–17h ; autres postes fermés au public (10–19 juin). Guichets Office des poursuites fermés 12–17. Ligne verte 0800 902 456 (lun 8 – jeu 18 juin, 11h–19h). Drones ≤ 25 kg interdits sur tout le canton + lac (10 juin 06h – 19 juin 06h). Urgences : 117.",
    activeFrom: '2026-06-10T00:00:00', activeTo: '2026-06-19T23:59:00',
    source: 'https://www.ge.ch/dossier/sommet-du-g7-evian-2026',
  },
]

const sev = (s: Severity): number => ({ critical: 3, warning: 2, info: 1 }[s])

export function getAlertsForDay(date: string): G7Alert[] {
  const d = new Date(date + 'T12:00:00')
  return g7Alerts
    .filter(a => new Date(a.activeFrom) <= d && d <= new Date(a.activeTo))
    .sort((x, y) => sev(y.severity) - sev(x.severity))
}
