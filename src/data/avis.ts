// Avis officiels dates (interdictions, perturbations, informations), affiches sur la carte
// pendant leur periode de validite. Reconstitue le 20.10.2026 depuis le build de production
// du 31.07.2026, dont la source etait perdue. Le nom du fichier d'origine n'est pas connu.

export type NiveauAvis = 'interdiction' | 'perturbation' | 'info'

export interface AvisOfficiel {
  id: string
  niveau: NiveauAvis
  /** Premier jour d'affichage, AAAA-MM-JJ */
  from: string
  /** Dernier jour d'affichage, AAAA-MM-JJ */
  to: string
  titre: string
  corps: string
  source: { label: string; url: string }
}

export const AVIS_OFFICIELS: AvisOfficiel[] = [
  {
    id: 'danger-incendie-foret-degre-5',
    niveau: 'interdiction',
    from: '2026-07-29',
    to: '2026-08-31',
    titre: 'Danger d’incendie de forêt : degré 5 sur 5, le maximum',
    corps: 'Genève a relevé le 29 juillet son indice de vigilance au statut « très fort danger », le plus élevé de l’échelle. Les feux sont interdits partout dans l’espace forestier et à moins de 10 mètres d’une lisière, y compris sur les emplacements aménagés par les autorités avec des foyers fixes. Renoncez aux barbecues en campagne. Ne jetez jamais un mégot ni une allumette en plein air. En cas de départ de feu, appelez immédiatement le 118.',
    source: { label: 'Annonce OCAN, Département du territoire', url: 'https://www.ge.ch/c/foretsfeux' },
  },
  {
    id: 'interdiction-feux-2026',
    niveau: 'interdiction',
    from: '2026-07-29',
    to: '2026-08-31',
    titre: 'Feux et feux d’artifice interdits dans tout le canton',
    corps: 'Le danger d’incendie de forêt est monté au niveau 5 sur 5. Depuis le 29 juillet et jusqu’à nouvel avis, les feux en plein air, les barbecues, les feux d’artifice et la vente de pièces d’artifice sont interdits, dans l’espace public comme privé. Restent permis : les tirs communaux sur le lac autorisés par le canton et menés par des artificiers professionnels, les barbecues communaux surveillés, les barbecues à gaz ou électriques sur pieds posés sur un sol non combustible, et les pièces de catégorie 1 à l’intérieur. Décision du Conseil d’État. Une infraction expose aux sanctions du droit fédéral et cantonal.',
    source: { label: 'Arrêté du canton de Genève', url: 'https://www.ge.ch/document/interdiction-feux-plein-air-feux-artifice-dans-canton-geneve-29-juillet' },
  },
  {
    id: 'premier-aout-2026-ville',
    niveau: 'info',
    from: '2026-07-29',
    to: '2026-08-01',
    titre: '1er Août au parc La Grange, sans feu de joie',
    corps: 'La fête de la Ville de Genève a lieu samedi 1er août au parc La Grange, de 15h à minuit. Le feu de joie et la zone réservée aux feux d’artifice du public sont annulés en raison du risque d’incendie. Le cortège de lampions part à 21h, rendez-vous à 20h45 devant la villa La Grange, avec des lampions LED. Partie officielle à 18h. Le brunch du terroir est complet.',
    source: { label: 'Ville de Genève', url: 'https://www.geneve.ch/actualites/aout-ville-geneve-brunch-terroir-complet-concerts-folklore' },
  },
  {
    id: 'premier-aout-2026-communes',
    niveau: 'info',
    from: '2026-07-29',
    to: '2026-08-01',
    titre: 'Ce que les communes maintiennent, et ce qu’elles annulent',
    corps: 'Bellevue et Genthod maintiennent leur tir, mais sur le lac : cérémonie à 21h, dès 18h30 sous le préau couvert. Lancy annule ses feux d’artifice, ses feux en plein air et ses barbecues ; la fête commence exceptionnellement à 18h30 au parc Navazza-Oltramare, concert à 19h30, cérémonie à 21h. Le Grand-Saconnex annule son feu d’artifice et son feu de joie. Vérifiez auprès de votre commune avant de vous déplacer : la situation a changé après le 29 juillet et certaines pages communales n’ont pas encore été mises à jour.',
    source: { label: 'Agenda des communes genevoises', url: 'https://www.geneve-communes.ch/agenda/fete-du-1er-aout-2026' },
  },
  {
    id: 'tdf-femmes-2026-circulation',
    niveau: 'perturbation',
    from: '2026-07-30',
    to: '2026-08-03',
    titre: 'Tour de France Femmes : rive droite dimanche, rive gauche lundi',
    corps: 'Dimanche 2 août, circulation perturbée sur la rive droite de 6h30 à 21h30 ; avenue de France, quai Wilson et quai du Mont-Blanc fermés de 7h à 22h. Lundi 3 août, rive gauche perturbée de 5h30 à 15h ; rue de l’École-de-Médecine, pont Hans-Wilsdorf et rue Hans-Wilsdorf fermés de 7h à 16h, puis rue François-Dussaud, Voie-Centrale et rampe Quidort de 10h à 16h. Les TPG adaptent plusieurs lignes.',
    source: { label: 'Ville de Genève', url: 'https://www.geneve.ch/actualites/tour-france-femmes-preparez-deplacements-geneve' },
  },
]

/** Avis en vigueur a la date donnee, du plus contraignant au plus informatif. */
export function avisEnVigueur(today: string): AvisOfficiel[] {
  const rang: Record<NiveauAvis, number> = { interdiction: 0, perturbation: 1, info: 2 }
  return AVIS_OFFICIELS
    .filter(a => a.from <= today && today <= a.to)
    .sort((a, b) => rang[a.niveau] - rang[b.niveau])
}
