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
    id: 'frontiere-controles', category: 'frontiere', severity: 'info',
    title: 'Contrôles normaux rétablis à la frontière',
    detail: "Les contrôles renforcés G7 ont pris fin le 18 juin au matin. Contrôles douaniers standard. Pièce d'identité recommandée.",
    activeFrom: '2026-06-18T05:00:00', activeTo: '2026-06-21T23:59:00',
    source: 'https://www.ge.ch/dossier/sommet-du-g7-evian-2026',
  },
  {
    id: 'frontiere-fermeture', category: 'frontiere', severity: 'critical',
    title: '28 passages fermés (sur 35) — 7 douanes seulement ouvertes',
    detail: "Fermeture physique dès le 11 juin après-midi. Ouverts 12–18 : Anières, Moillesulaz, Thônex-Vallard, Bardonnex, Perly, Meyrin, Ferney-Voltaire. Également ouverts : gares de Cornavin et d'Annemasse, aéroport de Genève. Pièce d'identité obligatoire. Interdit hors passages dédiés, même à pied ou à vélo. Des temps d'attente sont à prévoir.",
    activeFrom: '2026-06-11T15:00:00', activeTo: '2026-06-18T05:00:00',
    source: 'https://www.ge.ch/document/sommet-du-g7-2026-evian-faq',
  },
  {
    id: 'tpg', category: 'transport', severity: 'warning',
    title: 'TPG perturbés (lignes transfrontalières, horaire vacances)',
    detail: "Lignes 64/69 suspendues ; 38/40/52/78/82/83/M limitées côté suisse ; tpgFlex coupé en France ; agences Cornavin/Rive fermées dès le 12. Horaire vacances 15–17 sur tout le réseau.",
    activeFrom: '2026-06-12T00:00:00', activeTo: '2026-06-17T23:59:00',
    source: 'https://www.tcs.ch/fr/camping-voyages/informations-touristiques/news-actualites/g7-evian.php',
  },
  {
    id: 'a1', category: 'route', severity: 'critical',
    title: 'Autoroute A1 (contournement) fermée vers la France',
    detail: "A1 fermée (15–17 juin) en direction de Bardonnex. Depuis Vaud : sortie forcée Meyrin/Vernier/Genève-Centre ; Bernex et Perly/Plan-les-Ouates fermés ; bretelle A1aP La Praille→Bardonnex fermée. Depuis France : circulation maintenue 2 voies, temps d'attente à prévoir.",
    activeFrom: '2026-06-15T00:01:00', activeTo: '2026-06-17T23:59:00',
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
    detail: "Débarcadère Évian fermé (déviation Lugrin). Nyon–Yvoire interrompue le 16 juin (9h–16h20). Navigation de plaisance autorisée sans franchir la frontière.",
    activeFrom: '2026-06-11T00:00:00', activeTo: '2026-06-17T23:59:00',
    source: 'https://www.cgn.ch/g7',
  },
  {
    id: 'services', category: 'service', severity: 'info',
    title: 'Services cantonaux — fin des mesures G7 au 19 juin',
    detail: "Postes de police : Pâquis et aéroport reprennent horaires normaux le 19 juin. Guichets Office des poursuites rouverts. Drones ≤ 25 kg interdits jusqu'au 19 juin 06h. Urgences : 117.",
    activeFrom: '2026-06-10T00:00:00', activeTo: '2026-06-19T06:00:00',
    source: 'https://www.ge.ch/dossier/sommet-du-g7-evian-2026',
  },

  // ── Alertes post-G7 — retour à la normale ────────────────────────────────────
  {
    id: 'tpg-retour', category: 'transport', severity: 'info',
    title: 'TPG — Retour progressif à la normale',
    detail: "Lignes 64 et 69 reprennent depuis le 18 juin (tracés transfrontaliers complets). tpgFlex rétabli en France. Lignes 38/40/52/78/82/83/M sur tracé complet. Agence Cornavin rouvre le 19 juin, agence Rive le 22 juin. (source : tpg.ch)",
    activeFrom: '2026-06-18T00:00:00', activeTo: '2026-06-22T23:59:00',
    source: 'https://www.tpg.ch/fr/periode-du-g7-fortes-perturbations-anticipees-sur-le-reseau-des-transports-publics-genevois',
  },
  {
    id: 'frontiere-retour', category: 'frontiere', severity: 'info',
    title: 'Toutes les douanes genevoises rouvertes',
    detail: "Les 28 passages temporairement fermés ont rouvert à partir du 19 juin 6h. Contrôles standard rétablis. Pièce d'identité toujours recommandée. Source : BAZG / Office fédéral des douanes.",
    activeFrom: '2026-06-19T04:00:00', activeTo: '2026-06-21T23:59:00',
    source: 'https://www.bazg.admin.ch/fr/fermeture-partielle-des-passages-frontieres-dans-le-canton-de-geneve',
  },
  {
    id: 'fete-musique', category: 'culture', severity: 'info',
    title: 'Fête de la Musique — Parc des Bastions rouvert',
    detail: "Le Parc des Bastions rouvre le 19 juin pour la Fête de la Musique (19–21 juin). Concerts gratuits dans toute la ville, scènes de quartier, programme sur geneve.ch. Entrée libre.",
    activeFrom: '2026-06-19T00:00:00', activeTo: '2026-06-21T23:59:00',
    source: 'https://www.geneve.ch/actualites/sommet-evian-impacts-geneve',
  },
]

const sev = (s: Severity): number => ({ critical: 3, warning: 2, info: 1 }[s])

export function getAlertsForDay(date: string): G7Alert[] {
  const d = new Date(date + 'T12:00:00')
  return g7Alerts
    .filter(a => new Date(a.activeFrom) <= d && d <= new Date(a.activeTo))
    .sort((x, y) => sev(y.severity) - sev(x.severity))
}
