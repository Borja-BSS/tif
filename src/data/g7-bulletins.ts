export type BulletinCategory = 'route' | 'tpg' | 'acces'
export type BulletinSeverity = 'info' | 'warning' | 'critical'
export type BulletinStatus   = 'active' | 'upcoming' | 'past'

export interface BulletinBodySection {
  heading?: string
  lines: string[]
}

export interface G7Bulletin {
  id:         string
  category:   BulletinCategory
  severity:   BulletinSeverity
  icon:       string
  title:      string
  summary:    string
  body:       BulletinBodySection[]
  activeFrom: string | null
  activeTo:   string | null
  source:     string
}

export function getBulletinStatus(b: G7Bulletin): BulletinStatus {
  const now = new Date()
  if (b.activeFrom && new Date(b.activeFrom) > now) return 'upcoming'
  if (b.activeTo   && new Date(b.activeTo)   < now) return 'past'
  return 'active'
}

export const G7_BULLETINS: G7Bulletin[] = [
  {
    id:       'a1-marchandises',
    category: 'route',
    severity: 'critical',
    icon:     '🚫',
    title:    'A1 · Circulation modifiée',
    summary:  'Dispositif 15–17 juin · Depuis Vaud : A1 fermée vers Bardonnex, sortie forcée Meyrin/Vernier/Genève-Centre · Dim. 14 juin : sortie Vengeron/Genève-Lac fermée 06h–24h',
    body: [
      {
        lines: [
          "Dispositif Police cantonale de Genève du 15 au 17 juin.",
        ],
      },
      {
        heading: 'Depuis Vaud',
        lines: [
          "• A1 fermée en direction de Bardonnex ; sortie forcée : Meyrin, Vernier, Genève-Centre.",
          "• Entrées/sorties fermées : Bernex, Perly / Plan-les-Ouates.",
          "• Bretelle A1aP fermée : La Praille → Bardonnex.",
        ],
      },
      {
        heading: 'Depuis la France',
        lines: [
          "Circulation maintenue sur les deux voies ; temps d'attente à prévoir.",
        ],
      },
      {
        heading: 'Dimanche 14 juin (06h–24h)',
        lines: [
          "Sortie Vengeron – Genève-Lac fermée.",
        ],
      },
      {
        heading: 'Trafic transfrontalier de marchandises',
        lines: [
          "Depuis Vaud, privilégiez la douane de Vallorbe (VD) ou tout autre douane sur l'arc jurassien.",
        ],
      },
    ],
    activeFrom: '2026-06-14T00:00:00',
    activeTo:   '2026-06-17T23:59:59',
    source:     'Police cantonale de Genève — g7.ge.ch',
  },
  {
    id:       'tpg-g7',
    category: 'tpg',
    severity: 'warning',
    icon:     '🚌',
    title:    'TPG · Fortes perturbations G7',
    summary:  'Lignes 64, 69 suspendues · 38, 40, 52, 78, 82, 83, M adaptées · Dès le jeudi 11 juin',
    body: [
      {
        lines: [
          "Les tpg prévoient des ajustements importants de leur réseau à partir du jeudi 11 juin 2026.",
        ],
      },
      {
        heading: 'Lignes suspendues (transfrontalières)',
        lines: [
          "Lignes 64 et 69 — service interrompu jusqu'au 17 juin inclus.",
        ],
      },
      {
        heading: 'Lignes à parcours adapté',
        lines: [
          'Lignes 38, 40, 52, 78, 82, 83, M — certains arrêts non desservis temporairement.',
          'tpgFlex — aucun arrêt sur le territoire français.',
        ],
      },
      {
        heading: 'Horaire vacances 15–17 juin',
        lines: [
          'Horaire vacances appliqué (sauf lignes scolaires 60, 61, 80).',
          'Dimanche 14 juin : dès 5h00, aucun tram 17 ; tram 12 limité Bachet-de-Pesay ↔ Plainpalais.',
        ],
      },
      {
        heading: 'Ligne info gratuite',
        lines: ['0800 858 900 — messages mis à jour régulièrement.'],
      },
      {
        heading: 'Agences',
        lines: [
          'Cornavin & Rive : fermées dès le 12 juin (réouverture 19 et 22 juin).',
          'Lancy-Pont-Rouge : ouverte normalement.',
        ],
      },
      {
        heading: 'Aéroport',
        lines: [
          "tpgAérobus : service normal prévu — anticiper les délais liés aux mesures de sécurité dans le périmètre aéroportuaire.",
        ],
      },
    ],
    activeFrom: '2026-06-11T00:00:00',
    activeTo:   '2026-06-17T23:59:59',
    source:     'Transports publics genevois (tpg) — communiqué du 10.06.2026',
  },
  {
    id:       'macaron-retrait',
    category: 'acces',
    severity: 'info',
    icon:     '🪪',
    title:    'Macaron G7 · Retrait OCPPAM',
    summary:  "Retrait les 8–9 juin à Bernex · Pièce d'identité + procuration requises",
    body: [
      {
        lines: [
          'OCPPAM · Chemin du Stand 2, 1233 Bernex (parking disponible)',
          '• Lundi 8 juin : 12h–17h',
          '• Mardi 9 juin : 8h–17h',
          '',
          "Seules les personnes ayant préalablement commandé un macaron peuvent le retirer. Aucun macaron ne sera transmis sans commande préalable.",
        ],
      },
      {
        heading: 'Retrait groupé (entreprises)',
        lines: [
          "Un seul représentant désigné avec procuration employeur pour récupérer l'ensemble des macarons.",
        ],
      },
      {
        heading: 'Documents obligatoires',
        lines: [
          "• Pièce d'identité",
          '• Procuration officielle de l\'entreprise (si retrait groupé)',
          '• Liste nominative des bénéficiaires (telle que renseignée lors de la commande)',
        ],
      },
      {
        heading: "Consignes d'utilisation",
        lines: [
          'Aux contrôles : macaron parfaitement visible. En covoiturage : chaque passager doit avoir le sien.',
          'Hors contrôle : ne pas laisser traîner sur le tableau de bord.',
          'Après le G7 : vous pouvez le détruire vous-même une fois le dispositif levé.',
        ],
      },
    ],
    activeFrom: '2026-06-07T00:00:00',
    activeTo:   '2026-06-09T23:59:59',
    source:     "OCPPAM — Office cantonal de la protection de la population et des affaires militaires",
  },
  {
    id:       'postes-police',
    category: 'acces',
    severity: 'info',
    icon:     '👮',
    title:    'Postes de police · Accueil modifié 10–19 juin',
    summary:  'Pâquis et aéroport : 24h/7j · Plainpalais : lun–ven 10h–17h · Autres postes : fermés · Drones ≤ 25 kg interdits',
    body: [
      {
        lines: [
          "Du 10 au 19 juin, l'accueil du public est modifié dans les postes de police genevois.",
        ],
      },
      {
        heading: 'Postes ouverts au public',
        lines: [
          "• Pâquis et aéroport : ouverts 24h/7j.",
          "• Plainpalais : lundi – vendredi, 10h–17h.",
          "• Autres postes : fermés au public.",
        ],
      },
      {
        heading: 'Drones : survol du canton interdit',
        lines: [
          "Tout aéronef sans occupant (≤ 25 kg) est interdit sur tout le canton, lac compris, du 10 juin (06h) au 19 juin (06h).",
          "En cas d'infraction : amende et saisie.",
        ],
      },
    ],
    activeFrom: '2026-06-10T00:00:00',
    activeTo:   '2026-06-19T06:00:00',
    source:     'Police cantonale de Genève — g7.ge.ch',
  },
  {
    id:       'macaron-regles',
    category: 'acces',
    severity: 'info',
    icon:     '🛃',
    title:    'Contrôles frontières · Règles macaron',
    summary:  'Contrôles renforcés 12–18 juin · Douanes secondaires 6h–9h30 et 15h30–19h',
    body: [
      {
        lines: [
          "Du 12 au 18 juin, le Conseil d'Etat intensifie les contrôles aux points de passage frontaliers ouverts.",
          "Rappel : l'accès au territoire suisse est maintenu même sans macaron — le dispositif macaron permet uniquement un accès prioritaire plus fluide.",
        ],
      },
      {
        heading: 'Douanes secondaires — ouvertures spécifiques (12–18 juin)',
        lines: ['6h00–9h30 · 15h30–19h'],
      },
      {
        heading: 'Qui peut utiliser un macaron ?',
        lines: [
          "• Santé & sécurité : hôpitaux, urgences, forces de l'ordre, secours",
          '• Infrastructures publiques : TPG, SIG, Genève Aéroport',
          '',
          "Critères cumulatifs : résider en France, présence indispensable sur site, fonction opérationnelle non différable, horaires fixes ou service de piquet.",
        ],
      },
      {
        heading: 'Validité du macaron',
        lines: [
          'Du 12 juin 00h01 au 18 juin 23h59 · Personnel et intransmissible.',
          "Toute utilisation abusive ou falsification fera l'objet de poursuites.",
        ],
      },
    ],
    activeFrom: '2026-06-10T00:00:00',
    activeTo:   '2026-06-18T23:59:59',
    source:     "Etat de Genève — Conseil d'Etat / OFDF",
  },
]
