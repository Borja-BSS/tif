import type { EventItem, Occurrence } from './types'

// Génère une occurrence par jour entre deux dates ISO (incluses)
const dailyRange = (start: string, end: string, note?: string): Occurrence[] => {
  const out: Occurrence[] = []
  const cur = new Date(start + 'T12:00:00Z')
  const fin = new Date(end   + 'T12:00:00Z')
  while (cur <= fin) {
    out.push({ date: cur.toISOString().slice(0, 10), ...(note ? { note } : {}) })
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

export const events: EventItem[] = [
  {
    id: 'claudine', slug: 'jaime-pas-lbonheur-claudine',
    title: "J'aime pas l'bonheur (Claudine)", category: 'theatre',
    description: "Comédie de Marjolaine Minot, mise en scène Günther Baldauf. Re-création.",
    venue: {
      name: 'Théâtre Alchimic',
      address: '2 Avenue de la Praille, 1227 Carouge',
      phone: '+41 22 300 75 92',
      area: 'Carouge', lat: 46.1802, lng: 6.1393,
    },
    occurrences: [
      { date: '2026-06-11', start: '20:00', end: '21:30' },
      { date: '2026-06-12', start: '20:00', end: '21:30' },
      { date: '2026-06-13', start: '19:00', end: '20:30' },
      { date: '2026-06-14', start: '19:00', end: '20:30' },
      { date: '2026-06-16', start: '19:00', end: '20:30' },
      { date: '2026-06-17', start: '19:00', end: '20:30' },
      { date: '2026-06-18', start: '20:00', end: '21:30' },
      { date: '2026-06-19', start: '19:00', end: '20:30' },
      { date: '2026-06-20', start: '19:00', end: '20:30' },
      { date: '2026-06-21', start: '19:00', end: '20:30' },
    ],
    links: [
      { label: 'Théâtre Alchimic', url: 'https://alchimic.ch/claudine/', kind: 'venue', status: 'verified' },
      { label: 'Billetterie (Infomaniak)', url: 'https://infomaniak.events/fr-ch/theatre/claudine-jaime-pas-lbonheur/d89b7efd-7f86-4247-a868-bab4202a80a1/events/357941', kind: 'tickets', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'tania-dutel', slug: 'tania-dutel-guest',
    title: 'Tania Dutel & Guest', category: 'comedie',
    description: "Nouveau spectacle en création de Tania Dutel, marraine du Caustic.",
    venue: {
      name: 'Caustic Comedy Club',
      address: 'Avenue Cardinal-Mermillod 6, 1227 Carouge',
      area: 'Carouge', lat: 46.1811, lng: 6.1397,
    },
    occurrences: [
      { date: '2026-06-12', start: '19:30', end: '20:30' },
      { date: '2026-06-12', start: '21:30', end: '22:30', note: 'séance 2' },
      { date: '2026-06-13', start: '19:30', end: '20:30' },
      { date: '2026-06-13', start: '21:30', end: '22:30', note: 'séance 2' },
    ],
    links: [
      { label: 'Caustic — agenda/billets', url: 'https://www.causticcomedyclub.com/agenda', kind: 'tickets', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'charles-nouveau', slug: 'charles-nouveau-impro-discussion',
    title: 'Charles Nouveau — Impro & Discussion', category: 'comedie',
    description: "1h d'impro et de discussions sur les sujets du public.",
    venue: {
      name: 'Caustic Comedy Club',
      address: 'Avenue Cardinal-Mermillod 6, 1227 Carouge',
      area: 'Carouge', lat: 46.1811, lng: 6.1397,
    },
    occurrences: [{ date: '2026-06-19', start: '19:30', end: '20:30' }],
    links: [{ label: 'Caustic — agenda/billets', url: 'https://www.causticcomedyclub.com/agenda', kind: 'tickets', status: 'verified' }],
    verif: 'confirmed',
  },
  {
    id: 'felix-ringaby', slug: 'felix-ringaby-premier-spectacle',
    title: 'Félix Ringaby — Premier spectacle', category: 'comedie',
    description: 'Premier spectacle du jeune humoriste.',
    venue: {
      name: 'Caustic Comedy Club',
      address: 'Avenue Cardinal-Mermillod 6, 1227 Carouge',
      area: 'Carouge', lat: 46.1811, lng: 6.1397,
    },
    occurrences: [{ date: '2026-06-16', start: '20:00', end: '21:10' }],
    links: [{ label: 'Caustic — agenda/billets', url: 'https://www.causticcomedyclub.com/agenda', kind: 'tickets', status: 'verified' }],
    verif: 'confirmed',
  },
  {
    id: 'fiona-g', slug: 'fiona-g-trauma-and-chill',
    title: 'Fiona G. "Trauma & Chill"', category: 'comedie',
    description: 'Membre de la Clique du Caustic, humour mordant multilingue.',
    venue: {
      name: 'Caustic Comedy Club',
      address: 'Avenue Cardinal-Mermillod 6, 1227 Carouge',
      area: 'Carouge', lat: 46.1811, lng: 6.1397,
    },
    occurrences: [{ date: '2026-06-16', start: '20:00', end: '21:00' }],
    links: [{ label: 'Caustic — agenda/billets', url: 'https://www.causticcomedyclub.com/agenda', kind: 'tickets', status: 'verified' }],
    verif: 'confirmed',
  },
  {
    id: 'guillaume-guisset', slug: 'guillaume-guisset-en-spectacle',
    title: 'Guillaume Guisset "En Spectacle"', category: 'comedie',
    description: 'One-man-show.',
    venue: {
      name: 'Caustic Comedy Club',
      address: 'Avenue Cardinal-Mermillod 6, 1227 Carouge',
      area: 'Carouge', lat: 46.1811, lng: 6.1397,
    },
    occurrences: [
      { date: '2026-06-19', start: '21:30', end: '22:40' },
      { date: '2026-06-20' },
    ],
    links: [{ label: 'Caustic — agenda/billets', url: 'https://www.causticcomedyclub.com/agenda', kind: 'tickets', status: 'to_confirm' }],
    verif: 'plausible',
  },
  {
    id: 'castello-lopes', slug: 'david-castello-lopes-delicieux',
    title: 'David Castello-Lopes — Délicieux', category: 'comedie',
    description: 'Nouveau spectacle (≈1h15). COMPLET sur toutes les dates.',
    venue: {
      name: 'Uptown Geneva',
      address: 'Rue de la Navigation 23, 1201 Genève',
      area: 'GE', lat: 46.2059, lng: 6.1509,
    },
    occurrences: [
      { date: '2026-06-17', start: '20:00', end: '21:15' },
      { date: '2026-06-18', start: '20:00', end: '21:15' },
      { date: '2026-06-19', start: '20:00', end: '21:15' },
    ],
    priceInfo: 'Complet',
    links: [
      { label: 'Uptown Geneva', url: 'https://uptown-geneva.ch/event/delicieux-de-david-castello-lopes/', kind: 'venue', status: 'verified' },
      { label: 'Opus One (billetterie)', url: 'https://opus-one.ch/representation/humour/38274/david-castello-lopes-delicieux/', kind: 'tickets', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'wasted-land', slug: 'wasted-land-ntando-cele',
    title: 'WASTED LAND — Ntando Cele', category: 'theatre',
    description: "Spectacle exutoire et jubilatoire sur l'urgence écologique.",
    venue: {
      name: 'Maison Saint-Gervais',
      address: 'Rue du Temple 6, 1201 Genève',
      area: 'GE', lat: 46.2082, lng: 6.1443,
    },
    occurrences: [
      { date: '2026-06-12', start: '20:30', end: '21:05' },
      { date: '2026-06-13', start: '20:30', end: '21:05' },
    ],
    links: [{ label: 'Saint-Gervais Genève', url: 'https://saintgervais.ch', kind: 'venue', status: 'venue_fallback' }],
    verif: 'confirmed',
  },
  {
    id: 'soumoud-darwiche', slug: 'soumoud-jihad-darwiche',
    title: 'Soumoud « Tenir bon ! » — Jihad Darwiche', category: 'theatre',
    description: 'Récits et portraits de Palestine, de et par Jihad Darwiche (conteur).',
    venue: {
      name: 'Théâtre Spirale',
      address: 'Esplanade de Bel-Air, 1204 Genève',
      area: 'GE', lat: 46.1973, lng: 6.1498,
    },
    occurrences: [
      { date: '2026-06-13', start: '19:00', end: '20:10' },
      { date: '2026-06-14', start: '17:00', end: '18:10' },
    ],
    links: [{ label: 'Théâtre Spirale', url: 'https://theatre-spirale.ch', kind: 'venue', status: 'venue_fallback' }],
    verif: 'plausible',
  },
  {
    id: 'catch-impro', slug: 'catch-impro-grande-finale',
    title: 'Championnat Genevois de Catch Impro — Grande Finale', category: 'comedie',
    description: 'Grande finale du championnat genevois (Cie lesArts).',
    venue: {
      name: 'Village du Soir',
      address: 'Plaine de Plainpalais, 1205 Genève',
      area: 'GE', lat: 46.2001, lng: 6.1415,
    },
    occurrences: [{ date: '2026-06-12', start: '20:00', end: '22:00', note: 'portes 19:30' }],
    priceInfo: 'CHF 25',
    links: [
      { label: 'Village du Soir', url: 'https://www.villagedusoir.com/event-details/catch-impro-championnat-genevois-11', kind: 'venue', status: 'verified' },
      { label: 'Billets (Lilipass)', url: 'https://lilipass.com', kind: 'tickets', status: 'to_confirm' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'gli-angeli', slug: 'gli-angeli-haydn-stabat-mater',
    title: 'Gli Angeli Genève — Haydn Stabat Mater & Zelenka', category: 'classique',
    description: 'Festival Haydn-Mozart, dir. Václav Luks. Présentation 19h15.',
    venue: {
      name: 'Victoria Hall',
      address: 'Rue du Général-Dufour 14, 1204 Genève',
      phone: '+41 22 418 35 00',
      area: 'GE', lat: 46.1992, lng: 6.1427,
    },
    occurrences: [{ date: '2026-06-15', start: '20:00', end: '22:00' }],
    links: [
      { label: 'Billetterie Ville de Genève', url: 'https://billetterie-culture.geneve.ch', kind: 'tickets', status: 'verified' },
      { label: 'Gli Angeli Genève', url: 'https://www.gliangeligeneve.com/concerts/haydn_stabat_mater_luks', kind: 'info', status: 'to_confirm' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'gtg-200-motels', slug: 'gtg-200-motels-frank-zappa',
    title: 'GTG — 200 Motels (Frank Zappa)', category: 'concert',
    description: 'Fresque musico-théâtrale de Frank Zappa. Première en Suisse. Durée ~1h50.',
    venue: {
      name: 'Bâtiment des Forces Motrices (BFM)',
      address: 'Place des Volontaires 2, 1204 Genève',
      phone: '+41 22 321 12 20',
      area: 'GE', lat: 46.2004, lng: 6.1424,
    },
    occurrences: [
      { date: '2026-06-18', start: '20:00', end: '21:50' },
      { date: '2026-06-20', start: '20:00', end: '21:50' },
      { date: '2026-06-21', start: '15:00', end: '16:50', note: 'matinée' },
    ],
    links: [
      { label: 'Grand Théâtre de Genève', url: 'https://www.gtg.ch/en/2025-2026-season/200-motels/', kind: 'info', status: 'verified' },
      { label: 'BFM', url: 'https://www.bfm.ch/fr/programme/gtg-200-motels', kind: 'venue', status: 'verified' },
      { label: 'Billetterie GTG', url: 'https://billetterie.gtg.ch', kind: 'tickets', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'aperopera', slug: 'aperopera-200-motels',
    title: 'Apéropéra — Autour de 200 Motels', category: 'classique',
    description: "Apéro musical du GTG autour de l'opéra 200 Motels. CHF 25, 1er verre inclus.",
    venue: {
      name: 'École des Musiques Actuelles (eMa)',
      address: 'Rue de l\'École-de-Chimie 7, 1205 Genève',
      area: 'GE', lat: 46.2022, lng: 6.1467,
    },
    occurrences: [{ date: '2026-06-11', start: '18:30', end: '20:30' }],
    priceInfo: 'CHF 25 (1er verre inclus)',
    links: [
      { label: 'Apéropéra (GTG)', url: 'https://www.gtg.ch/en/la-plage/aperopera/', kind: 'info', status: 'verified' },
      { label: 'Billetterie GTG', url: 'https://billetterie.gtg.ch', kind: 'tickets', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'candlelight-zimmer', slug: 'candlelight-hans-zimmer',
    title: 'Candlelight : hommage à Hans Zimmer', category: 'classique',
    description: 'Concert aux chandelles, quatuor. ~60 min.',
    venue: {
      name: 'Fondation Les Salons',
      address: 'Rue de la Croix-d\'Or 5, 1204 Genève',
      area: 'GE', lat: 46.2010, lng: 6.1483,
    },
    occurrences: [{ date: '2026-06-18', start: '18:30', end: '19:30', note: 'date à confirmer' }],
    links: [{ label: 'Fever (officiel)', url: 'https://feverup.com/m/122591', kind: 'tickets', status: 'verified' }],
    verif: 'plausible',
  },
  {
    id: 'candlelight-abba', slug: 'candlelight-abba',
    title: 'Candlelight : hommage à ABBA', category: 'classique',
    description: 'Concert aux chandelles.',
    venue: {
      name: 'Fondation Les Salons',
      address: 'Rue de la Croix-d\'Or 5, 1204 Genève',
      area: 'GE', lat: 46.2010, lng: 6.1483,
    },
    occurrences: [{ date: '2026-06-18', start: '20:30', end: '21:30', note: 'date à confirmer' }],
    links: [{ label: 'Fever (officiel)', url: 'https://feverup.com/m/359324', kind: 'tickets', status: 'verified' }],
    verif: 'plausible',
  },
  {
    id: 'candlelight-coldplay', slug: 'candlelight-coldplay-imagine-dragons',
    title: 'Candlelight : Coldplay et Imagine Dragons', category: 'classique',
    description: 'Concert aux chandelles.',
    venue: {
      name: 'Fondation Les Salons',
      address: 'Rue de la Croix-d\'Or 5, 1204 Genève',
      area: 'GE', lat: 46.2010, lng: 6.1483,
    },
    occurrences: [{ date: '2026-06-18', note: 'date/heure à confirmer' }],
    links: [{ label: 'Fever (officiel)', url: 'https://feverup.com/m/332896', kind: 'tickets', status: 'verified' }],
    verif: 'plausible',
  },
  {
    id: 'ky-mani-marley', slug: 'ky-mani-marley',
    title: 'Ky-Mani Marley', category: 'concert',
    description: 'Reggae / Jamaïque, Love & Energy Tour. Portes 20h.',
    venue: {
      name: "L'Usine — PTR / Le Rez",
      address: 'Place des Volontaires 4, 1204 Genève',
      phone: '+41 22 781 34 90',
      area: 'GE', lat: 46.2003, lng: 6.1426,
    },
    occurrences: [{ date: '2026-06-17', start: '20:00', note: 'portes' }],
    priceInfo: 'Prévente CHF 35 / sur place 38',
    links: [
      { label: "L'Usine", url: 'https://www.usine.ch/evenements/ky-mani-marley', kind: 'venue', status: 'verified' },
      { label: 'La Décadanse (billets)', url: 'https://www.ladecadanse.ch/event/evenement.php?idE=503934', kind: 'tickets', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'calle-12', slug: 'calle-12-somos-mundial',
    title: 'Calle 12 — « Somos Mundial »', category: 'nightlife',
    description: 'Édition spéciale reggaeton / latin. 23h–05h.',
    venue: {
      name: 'Monte Cristo Club',
      address: 'Rue Simon-Durand 2, 1201 Genève',
      area: 'GE', lat: 46.2082, lng: 6.1471,
    },
    occurrences: [{ date: '2026-06-12', start: '23:00', end: '05:00' }],
    links: [{ label: 'Monte Cristo Club', url: 'https://montecristoclub.ch/', kind: 'venue', status: 'venue_fallback' }],
    verif: 'plausible',
  },
  {
    id: 'la-capitale', slug: 'la-capitale-izno',
    title: 'La Capitale — Izno + Kader K', category: 'nightlife',
    description: "Showcase d'Izno avec Kader K (DJ de Mister You). 23h–05h.",
    venue: {
      name: 'Monte Cristo Club',
      address: 'Rue Simon-Durand 2, 1201 Genève',
      area: 'GE', lat: 46.2082, lng: 6.1471,
    },
    occurrences: [{ date: '2026-06-13', start: '23:00', end: '05:00' }],
    links: [{ label: 'Monte Cristo Club', url: 'https://montecristoclub.ch/', kind: 'venue', status: 'venue_fallback' }],
    verif: 'plausible',
  },
  {
    id: 'prisme', slug: 'prisme-amr-fete-musique',
    title: 'PRISME', category: 'concert',
    description: 'Trio genevois à la croisée du jazz et de la pop. AMR / Fête de la musique. Gratuit.',
    venue: {
      name: 'Alhambra',
      address: 'Rue de la Rôtisserie 10, 1204 Genève',
      phone: '+41 22 310 78 14',
      area: 'GE', lat: 46.2019, lng: 6.1466,
    },
    occurrences: [{ date: '2026-06-19', start: '19:30', end: '20:30' }],
    priceInfo: 'Gratuit',
    links: [
      { label: 'AMR', url: 'https://www.amr-geneve.ch/programme', kind: 'organizer', status: 'verified' },
      { label: 'La Décadanse', url: 'https://www.ladecadanse.ch/event/evenement.php?idE=511871', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'country-cooking', slug: 'country-cooking-amr',
    title: 'COUNTRY COOKING', category: 'concert',
    description: 'Brass band genevois, Cape Jazz sud-africain. AMR / Fête de la musique. Gratuit.',
    venue: {
      name: 'Alhambra',
      address: 'Rue de la Rôtisserie 10, 1204 Genève',
      phone: '+41 22 310 78 14',
      area: 'GE', lat: 46.2019, lng: 6.1466,
    },
    occurrences: [{ date: '2026-06-19', start: '21:00', end: '22:30' }],
    priceInfo: 'Gratuit',
    links: [{ label: 'AMR', url: 'https://www.amr-geneve.ch/programme', kind: 'organizer', status: 'verified' }],
    verif: 'confirmed',
  },
  {
    id: 'valentin-liechti', slug: 'valentin-liechti-trio',
    title: 'Valentin Liechti Trio', category: 'concert',
    description: "Trio impressionniste/groove, album « N O W WHAT? ». AMR / Fête de la musique. Gratuit. Portes 22h30.",
    venue: {
      name: 'Alhambra',
      address: 'Rue de la Rôtisserie 10, 1204 Genève',
      phone: '+41 22 310 78 14',
      area: 'GE', lat: 46.2019, lng: 6.1466,
    },
    occurrences: [{ date: '2026-06-19', start: '22:30', end: '23:45' }],
    priceInfo: 'Gratuit',
    links: [
      { label: 'AMR', url: 'https://www.amr-geneve.ch/programme', kind: 'organizer', status: 'verified' },
      { label: 'La Décadanse', url: 'https://www.ladecadanse.ch/event/evenement.php?idE=511873', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'amr-champel', slug: 'ateliers-amr-champel',
    title: "Les Ateliers de l'AMR en concert — Champel", category: 'concert',
    description: "Huit concerts des ateliers de jazz de l'AMR. Gratuit.",
    venue: {
      name: 'Maison de quartier de Champel',
      address: 'Chemin Sauter 6, 1206 Genève',
      area: 'GE', lat: 46.1878, lng: 6.1490,
    },
    occurrences: [{ date: '2026-06-20', start: '12:00', end: '20:00' }],
    priceInfo: 'Gratuit',
    links: [{ label: 'AMR', url: 'https://www.amr-geneve.ch/programme', kind: 'organizer', status: 'verified' }],
    verif: 'plausible',
  },
  {
    id: 'amr-juniors', slug: 'ateliers-juniors-fete-musique',
    title: 'Les Ateliers Juniors à la Fête de la Musique', category: 'concert',
    description: "Deux concerts des ateliers juniors de l'AMR sur la Scène des écoles. Gratuit.",
    venue: {
      name: 'Parc des Bastions',
      address: 'Promenade des Bastions, 1204 Genève',
      area: 'GE', lat: 46.1975, lng: 6.1444,
    },
    occurrences: [{ date: '2026-06-21', start: '19:00', end: '21:00' }],
    priceInfo: 'Gratuit',
    links: [{ label: 'AMR', url: 'https://www.amr-geneve.ch/programme', kind: 'organizer', status: 'verified' }],
    verif: 'plausible',
  },
  {
    id: 'swing-with-me', slug: 'swing-with-me-halles',
    title: 'Swing With Me — Geneva Swing', category: 'danse',
    description: 'Soirée swing hebdomadaire (mardi).',
    venue: {
      name: "Halles de l'Île",
      address: "Place de l'Île 1, 1204 Genève",
      phone: '+41 22 311 11 11',
      area: 'GE', lat: 46.2031, lng: 6.1455,
    },
    occurrences: [{ date: '2026-06-16', start: '18:00', end: '23:00' }],
    priceInfo: 'Entrée libre / conso',
    links: [{ label: "Halles de l'Île", url: 'https://www.hallesdelile.ch/programmation', kind: 'venue', status: 'verified' }],
    verif: 'confirmed',
  },
  {
    id: 'mix-mash', slug: 'mix-and-mash-halles',
    title: "Mix & Mash — Halles de l'Île", category: 'nightlife',
    description: 'Soirée diversité culturelle hebdomadaire (mercredi).',
    venue: {
      name: "Halles de l'Île",
      address: "Place de l'Île 1, 1204 Genève",
      phone: '+41 22 311 11 11',
      area: 'GE', lat: 46.2031, lng: 6.1455,
    },
    occurrences: [{ date: '2026-06-17', start: '17:00', end: '23:50' }],
    priceInfo: 'Entrée libre / conso',
    links: [{ label: "Halles de l'Île", url: 'https://www.hallesdelile.ch/programmation', kind: 'venue', status: 'verified' }],
    verif: 'confirmed',
  },
  {
    id: 'amazing-afterwork', slug: 'amazing-afterwork-halles',
    title: 'Amazing Afterwork', category: 'nightlife',
    description: 'Afterwork hebdomadaire (jeudi).',
    venue: {
      name: "Halles de l'Île",
      address: "Place de l'Île 1, 1204 Genève",
      phone: '+41 22 311 11 11',
      area: 'GE', lat: 46.2031, lng: 6.1455,
    },
    occurrences: [{ date: '2026-06-18', start: '17:00' }],
    priceInfo: 'Entrée libre / conso',
    links: [{ label: "Halles de l'Île", url: 'https://www.hallesdelile.ch/programmation', kind: 'venue', status: 'verified' }],
    verif: 'confirmed',
  },
  {
    id: 'ephj', slug: 'ephj-salon-haute-precision',
    title: 'EPHJ — Salon de la haute précision', category: 'festival',
    description: "Plus grand salon mondial horlogerie/joaillerie/microtech/medtech. Badge pro.",
    venue: {
      name: 'Palexpo',
      address: 'Route François-Peyrot 30, 1218 Le Grand-Saconnex',
      phone: '+41 22 761 11 11',
      area: 'Grand-Saconnex', lat: 46.2277, lng: 6.1095,
    },
    occurrences: [
      { date: '2026-06-16', note: '9h–18h' },
      { date: '2026-06-17', note: '9h–18h' },
      { date: '2026-06-18', note: '9h–18h' },
      { date: '2026-06-19', note: '9h–16h' },
    ],
    links: [
      { label: 'EPHJ', url: 'https://ephj.ch', kind: 'info', status: 'verified' },
      { label: 'Palexpo', url: 'https://www.palexpo.ch/en/evenement/ephj-en/', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'jimmy-carr', slug: 'jimmy-carr-laughs-funny',
    title: 'Jimmy Carr — Laughs Funny', category: 'comedie',
    description: 'Stand-up (en anglais). Portes 18:30, fin ~22:30. Dès 7 ans (accompagné <16).',
    venue: {
      name: 'Arena de Genève',
      address: 'Avenue Louis-Casaï 1218, Le Grand-Saconnex',
      phone: '+41 22 761 23 00',
      area: 'Grand-Saconnex', lat: 46.2259, lng: 6.1070,
    },
    occurrences: [{ date: '2026-06-16', start: '20:00', end: '22:30' }],
    links: [
      { label: 'Ticketcorner (officiel)', url: 'https://www.ticketcorner.ch/en/event/jimmy-carr-laughs-funny-arena-de-geneve-20633202/', kind: 'tickets', status: 'verified' },
      { label: 'Arena de Genève', url: 'https://www.geneva-arena.ch', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'fusion-fight-lab', slug: 'fusion-fight-lab-boxe-thai',
    title: 'Fusion Fight Lab — Gala de Boxe Thaïlandaise', category: 'sport',
    description: 'Gala de Muay Thai à Carouge. Portes 18h30.',
    venue: {
      name: 'CECG / ECG Madame de Staël',
      address: 'Route de Saint-Julien 25, 1227 Carouge',
      area: 'Carouge', lat: 46.1729, lng: 6.1373,
    },
    occurrences: [{ date: '2026-06-13', start: '19:30', end: '23:30', note: 'portes 18:30' }],
    links: [],
    verif: 'unverified',
  },
  // ── FOOTBALL & COUPE DU MONDE FIFA 2026 ─────────────────────────────────────
  {
    id: 'worldcup-2026', slug: 'coupe-du-monde-fifa-2026',
    title: '⚽ Coupe du Monde FIFA 2026', category: 'football',
    description: "104 matchs, 48 nations. USA, Canada & Mexique. Bars et terrasses autorisés avec écran jusqu'à minuit (semaine) / 2h (weekend). Fan zones à Nyon, Saint-Genis-Pouilly et Plan-les-Ouates (Gradi24).",
    venue: {
      name: 'Bars & terrasses de Genève',
      address: 'Cafés, bars et terrasses de la Ville de Genève',
      area: 'GE', lat: 46.2044, lng: 6.1432,
    },
    occurrences: [
      // Phase de groupes (11–26 juin) — matchs chaque jour
      { date: '2026-06-11', note: 'Ouverture : USA · 3 matchs' },
      { date: '2026-06-12', note: 'Phase de groupes · 4 matchs' },
      { date: '2026-06-13', note: '🇨🇭 Qatar vs Suisse 21h · 4 matchs' },
      { date: '2026-06-14', note: 'Phase de groupes · 4 matchs' },
      { date: '2026-06-15', note: 'Phase de groupes · 4 matchs' },
      { date: '2026-06-16', note: 'Phase de groupes · 4 matchs' },
      { date: '2026-06-17', note: 'Phase de groupes · 4 matchs' },
      { date: '2026-06-18', note: '🇨🇭 Suisse vs Bosnie 21h · 4 matchs' },
      { date: '2026-06-19', note: 'Phase de groupes · 4 matchs' },
      { date: '2026-06-20', note: 'Phase de groupes · 4 matchs' },
      { date: '2026-06-21', note: 'Phase de groupes · 4 matchs' },
      { date: '2026-06-22', note: 'Phase de groupes · 4 matchs' },
      { date: '2026-06-23', note: 'Phase de groupes · 4 matchs' },
      { date: '2026-06-24', note: '🇨🇭 Suisse vs Canada 21h · 4 matchs' },
      { date: '2026-06-25', note: 'Phase de groupes · 4 matchs (décisifs)' },
      { date: '2026-06-26', note: 'Phase de groupes · 4 matchs (décisifs)' },
      // 8es de finale
      { date: '2026-06-28', note: '8es de finale · 2 matchs' },
      { date: '2026-06-29', note: '8es de finale · 2 matchs' },
      { date: '2026-06-30', note: '8es de finale · 2 matchs' },
      { date: '2026-07-01', note: '8es de finale · 2 matchs' },
      { date: '2026-07-02', note: '8es de finale · 2 matchs' },
      { date: '2026-07-03', note: '8es de finale · 2 matchs' },
      // 16es de finale → QF → SF → Finale
      { date: '2026-07-04', note: 'Quarts de finale · 2 matchs' },
      { date: '2026-07-05', note: 'Quarts de finale · 2 matchs' },
      { date: '2026-07-06', note: 'Quarts de finale · 2 matchs' },
      { date: '2026-07-07', note: 'Quarts de finale · 2 matchs' },
      { date: '2026-07-09', note: 'Demi-finales' },
      { date: '2026-07-11', note: 'Demi-finales' },
      { date: '2026-07-14', note: 'Match pour la 3e place' },
      { date: '2026-07-19', note: '🏆 Finale · soirée exceptionnelle' },
    ],
    priceInfo: 'Gratuit (bars autorisés par la Ville)',
    links: [
      { label: 'RTS — Où voir les matchs en Suisse romande', url: 'https://www.rts.ch/info/suisse/2026/article/ou-regarder-la-coupe-du-monde-2026-en-suisse-romande-fan-zones-et-bars-29266676.html', kind: 'info', status: 'verified' },
      { label: 'Grand Genève — Fan Zone', url: 'https://www.grand-geneve.org/evenements/fan-zone-coupe-du-monde-fifa-2026/', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'nati-qatar-suisse', slug: 'nati-qatar-vs-suisse',
    title: '🇨🇭 Nati — Qatar vs Suisse (Gr. B)', category: 'football',
    description: "Premier match de la Nati à la Coupe du Monde 2026. Joué à Levi's Stadium, Santa Clara (Californie). Voir dans les bars genevois autorisés avec écran.",
    venue: {
      name: 'Bars & terrasses de Genève',
      address: 'Cafés, bars et terrasses de la Ville de Genève',
      area: 'GE', lat: 46.2044, lng: 6.1432,
    },
    occurrences: [{ date: '2026-06-13', start: '21:00', note: 'CEST · Levi\'s Stadium, Santa Clara CA' }],
    links: [
      { label: 'Calendrier FIFA', url: 'https://www.foxsports.com/stories/soccer/switzerland-world-cup-2026-schedule-locations-dates-times', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'nati-suisse-bosnie', slug: 'nati-suisse-vs-bosnie',
    title: '🇨🇭 Nati — Suisse vs Bosnie-Herzégovine (Gr. B)', category: 'football',
    description: "Deuxième match de la Nati. Joué à Inglewood, Californie. Voir dans les bars genevois autorisés avec écran.",
    venue: {
      name: 'Bars & terrasses de Genève',
      address: 'Cafés, bars et terrasses de la Ville de Genève',
      area: 'GE', lat: 46.2044, lng: 6.1432,
    },
    occurrences: [{ date: '2026-06-18', start: '21:00', note: 'CEST · Inglewood, Californie' }],
    links: [
      { label: 'Calendrier FIFA', url: 'https://www.foxsports.com/stories/soccer/switzerland-world-cup-2026-schedule-locations-dates-times', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'nati-suisse-canada', slug: 'nati-suisse-vs-canada',
    title: '🇨🇭 Nati — Suisse vs Canada (Gr. B)', category: 'football',
    description: "Troisième match de la Nati (dernier de la phase de groupes). Joué à Vancouver, Canada. Voir dans les bars genevois autorisés avec écran.",
    venue: {
      name: 'Bars & terrasses de Genève',
      address: 'Cafés, bars et terrasses de la Ville de Genève',
      area: 'GE', lat: 46.2044, lng: 6.1432,
    },
    occurrences: [{ date: '2026-06-24', start: '21:00', note: 'CEST · Vancouver, Canada' }],
    links: [
      { label: 'Calendrier FIFA', url: 'https://www.foxsports.com/stories/soccer/switzerland-world-cup-2026-schedule-locations-dates-times', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'fanzone-gradi24', slug: 'fanzone-gradi24-village-plan-les-ouates',
    title: '⚽ Fan Zone Gradi24 Village — Plan-les-Ouates', category: 'football',
    description: "Fan zone ouverte tout le Mondial. Tous les matchs sur écran géant, ambiance village festif. À Plan-les-Ouates, facilement accessible depuis Genève.",
    venue: {
      name: 'Gradi24 Village FanZone',
      address: 'Rte de la Galaise 24, 1228 Plan-les-Ouates',
      phone: '+41 22 512 60 59',
      area: 'GE', lat: 46.1671, lng: 6.1230,
    },
    occurrences: [
      // Phase de groupes
      { date: '2026-06-11', start: '18:00', note: 'Ouverture · USA' },
      { date: '2026-06-12', start: '18:00', note: 'Phase de groupes' },
      { date: '2026-06-13', start: '18:00', note: '🇨🇭 Qatar vs Suisse 21h' },
      { date: '2026-06-14', start: '18:00', note: 'Phase de groupes' },
      { date: '2026-06-15', start: '18:00', note: 'Phase de groupes' },
      { date: '2026-06-16', start: '18:00', note: 'Phase de groupes' },
      { date: '2026-06-17', start: '18:00', note: 'Phase de groupes' },
      { date: '2026-06-18', start: '18:00', note: '🇨🇭 Suisse vs Bosnie 21h' },
      { date: '2026-06-19', start: '18:00', note: 'Phase de groupes' },
      { date: '2026-06-20', start: '18:00', note: 'Phase de groupes' },
      { date: '2026-06-21', start: '18:00', note: 'Phase de groupes' },
      { date: '2026-06-22', start: '18:00', note: 'Phase de groupes' },
      { date: '2026-06-23', start: '18:00', note: 'Phase de groupes' },
      { date: '2026-06-24', start: '18:00', note: '🇨🇭 Suisse vs Canada 21h' },
      { date: '2026-06-25', start: '18:00', note: 'Phase de groupes (décisifs)' },
      { date: '2026-06-26', start: '18:00', note: 'Phase de groupes (décisifs)' },
      // 8es de finale
      { date: '2026-06-28', start: '18:00', note: '8es de finale' },
      { date: '2026-06-29', start: '18:00', note: '8es de finale' },
      { date: '2026-06-30', start: '18:00', note: '8es de finale' },
      { date: '2026-07-01', start: '18:00', note: '8es de finale' },
      { date: '2026-07-02', start: '18:00', note: '8es de finale' },
      { date: '2026-07-03', start: '18:00', note: '8es de finale' },
      // Phases finales
      { date: '2026-07-04', start: '18:00', note: 'Quarts de finale' },
      { date: '2026-07-05', start: '18:00', note: 'Quarts de finale' },
      { date: '2026-07-06', start: '18:00', note: 'Quarts de finale' },
      { date: '2026-07-07', start: '18:00', note: 'Quarts de finale' },
      { date: '2026-07-09', start: '18:00', note: 'Demi-finale' },
      { date: '2026-07-11', start: '18:00', note: 'Demi-finale' },
      { date: '2026-07-14', start: '18:00', note: '3e place' },
      { date: '2026-07-19', start: '18:00', note: '🏆 Finale' },
    ],
    priceInfo: 'À confirmer sur place',
    links: [
      { label: 'TikTok @gradi24fanzone', url: 'https://www.tiktok.com/@gradi24fanzone', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
    g7AccessNotes: [
      'Bus 11 → arrêt Plan-les-Ouates / Galaise · 15 min depuis Carouge',
      'Voiture : sortie Lancy/Plan-les-Ouates · parking gratuit sur site',
    ],
  },
  {
    id: 'fanzone-nyon', slug: 'fanzone-cantine-de-rive-nyon',
    title: '⚽ Fan Zone Nyon — Cantine de Rive', category: 'football',
    description: "Vaste fan zone organisée par l'association Etaris sous la Cantine de Rive à Nyon. Écran géant, bar, restauration et animations. ~40 matchs sélectionnés. 25 km de Genève. Entrée libre.",
    venue: {
      name: 'Cantine de Rive (Nyon)',
      address: 'Rive du lac, 1260 Nyon',
      area: 'autour', lat: 46.3821, lng: 6.2376,
    },
    occurrences: [
      // Nati + matchs sélectionnés (env. 40 sur la durée du Mondial)
      { date: '2026-06-11', start: '18:00', note: 'Ouverture · USA' },
      { date: '2026-06-13', start: '19:00', note: '🇨🇭 Qatar vs Suisse 21h' },
      { date: '2026-06-14', start: '18:00', note: 'Matchs sélectionnés' },
      { date: '2026-06-15', start: '18:00', note: 'Matchs sélectionnés' },
      { date: '2026-06-17', start: '18:00', note: 'Matchs sélectionnés' },
      { date: '2026-06-18', start: '19:00', note: '🇨🇭 Suisse vs Bosnie 21h' },
      { date: '2026-06-19', start: '18:00', note: 'Matchs sélectionnés' },
      { date: '2026-06-20', start: '18:00', note: 'Matchs sélectionnés' },
      { date: '2026-06-21', start: '18:00', note: 'Matchs sélectionnés' },
      { date: '2026-06-22', start: '18:00', note: 'Matchs sélectionnés' },
      { date: '2026-06-24', start: '19:00', note: '🇨🇭 Suisse vs Canada 21h' },
      { date: '2026-06-25', start: '18:00', note: 'Phase de groupes décisifs' },
      { date: '2026-06-26', start: '18:00', note: 'Phase de groupes décisifs' },
      { date: '2026-06-29', start: '18:00', note: '8es de finale' },
      { date: '2026-06-30', start: '18:00', note: '8es de finale' },
      { date: '2026-07-01', start: '18:00', note: '8es de finale' },
      { date: '2026-07-02', start: '18:00', note: '8es de finale' },
      { date: '2026-07-05', start: '18:00', note: 'Quarts de finale' },
      { date: '2026-07-06', start: '18:00', note: 'Quarts de finale' },
      { date: '2026-07-09', start: '18:00', note: 'Demi-finale' },
      { date: '2026-07-11', start: '18:00', note: 'Demi-finale' },
      { date: '2026-07-19', start: '18:00', note: '🏆 Finale' },
    ],
    priceInfo: 'Entrée libre',
    links: [
      { label: 'RTS — Nyon fan zone', url: 'https://www.rts.ch/info/suisse/2026/article/ou-regarder-la-coupe-du-monde-2026-en-suisse-romande-fan-zones-et-bars-29266676.html', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
    g7AccessNotes: [
      'Train CFF : Genève-Cornavin → Nyon (18 min, très fréquent)',
      'Voiture : A1 dir. Lausanne, sortie Nyon · ~25 km de Genève',
    ],
  },
  {
    id: 'fanzone-saint-genis', slug: 'fanzone-saint-genis-pouilly',
    title: '⚽ Fan Zone Saint-Genis-Pouilly (France)', category: 'football',
    description: "Fan zone officielle de la Ville de Saint-Genis-Pouilly. Écran géant, cage football, bubble football, freestyle, châteaux gonflables, trampolines, tir de précision, tombola, animations, bar et restauration. Gratuit. Places limitées.",
    venue: {
      name: 'Place Jean Monnet',
      address: 'Place Jean Monnet, 01630 Saint-Genis-Pouilly',
      area: 'autour', lat: 46.2432, lng: 6.0278,
    },
    occurrences: [
      { date: '2026-07-09', start: '19:00', note: 'Demi-finale · places limitées' },
      { date: '2026-07-11', start: '19:00', note: 'Demi-finale · places limitées' },
      { date: '2026-07-14', start: '19:00', note: '3e place' },
      { date: '2026-07-19', start: '19:00', note: '🏆 Finale — arriver tôt' },
    ],
    priceInfo: 'Gratuit — places limitées',
    links: [
      { label: 'Grand Genève — Fan Zone officielle', url: 'https://www.grand-geneve.org/evenements/fan-zone-coupe-du-monde-fifa-2026/', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'fanzone-crowne-plaza', slug: 'fanzone-crowne-plaza-geneve',
    title: '⚽ Fan Zone Privée — Crowne Plaza Geneva', category: 'football',
    description: "Fan zone privée réservée aux groupes (25 personnes minimum). Projection sur grand écran, ambiance exclusive. Réservation obligatoire à l'avance. Idéal pour entreprises et groupes.",
    venue: {
      name: 'Crowne Plaza Geneva',
      address: 'Avenue Louis-Casaï 75-77, 1216 Cointrin',
      area: 'Grand-Saconnex', lat: 46.2258, lng: 6.1094,
    },
    occurrences: [
      { date: '2026-06-11', note: '11 juin – 19 juillet · sur réservation uniquement' },
    ],
    priceInfo: 'Sur réservation (groupes 25+)',
    links: [
      { label: 'Crowne Plaza Geneva', url: 'https://geneva.crowneplaza.com/en/2026-world-cup/', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  // ── CARIBANA FESTIVAL 2026 — Crans-près-Céligny (Vaud) ───────────────────────
  {
    id: 'caribana-17', slug: 'caribana-festival-17-juin',
    title: 'Caribana Festival — Kendji · M Pokora · Nâdiya', category: 'festival',
    description: "Mercredi 17 juin — Kendji (pop-flamenco), M Pokora (R&B), Nâdiya, Marine, Deluxe. Festival estival au bord du lac Léman à Crans-près-Céligny (Vaud). 34e édition · 30 000 spectateurs.",
    priceInfo: 'CHF 90 standard · CHF 155 VIP · Pass 4j CHF 280',
    venue: {
      name: 'Port de Crans-près-Céligny',
      address: 'Crans-plage, 1299 Crans-près-Céligny',
      area: 'autour', lat: 46.3765, lng: 6.2155,
    },
    occurrences: [{ date: '2026-06-17', start: '17:00', end: '02:00' }],
    links: [
      { label: '🎟️ Billetterie (Ticketcorner)', url: 'https://www.ticketcorner.ch/fr/event/caribana-festival-2026-caribana-festival-21007826/', kind: 'tickets', status: 'verified' },
      { label: 'Programme officiel', url: 'https://caribana.ch/fr/programmation-du-caribana-festival', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
    g7AccessNotes: [
      'Train CFF : Genève-Cornavin → Nyon (20 min, fréquent) · bus 802 Nyon → Crans-près-Céligny (~15 min)',
      'Voiture : A1/E25 dir. Lausanne, sortie Crans-Céligny · ~35 km de Genève · Parking sur site',
      'Navette nocturne Lausanne disponible (CHF 15)',
    ],
  },
  {
    id: 'caribana-18', slug: 'caribana-festival-18-juin',
    title: 'Caribana Festival — Mika · Louane · Yoa', category: 'festival',
    description: "Jeudi 18 juin — Mika (pop-rock), Louane (pop), Yoa (électropop), Broken Back, Ève, Saint Stacy. Festival estival au bord du lac Léman à Crans-près-Céligny (Vaud).",
    priceInfo: 'CHF 90 standard · CHF 155 VIP · Pass 4j CHF 280',
    venue: {
      name: 'Port de Crans-près-Céligny',
      address: 'Crans-plage, 1299 Crans-près-Céligny',
      area: 'autour', lat: 46.3765, lng: 6.2155,
    },
    occurrences: [{ date: '2026-06-18', start: '17:00', end: '02:00' }],
    links: [
      { label: '🎟️ Billetterie (Ticketcorner)', url: 'https://www.ticketcorner.ch/fr/event/caribana-festival-2026-caribana-festival-21007826/', kind: 'tickets', status: 'verified' },
      { label: 'Programme officiel', url: 'https://caribana.ch/fr/programmation-du-caribana-festival', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
    g7AccessNotes: [
      'Train CFF : Genève-Cornavin → Nyon (20 min, fréquent) · bus 802 Nyon → Crans-près-Céligny (~15 min)',
      'Voiture : A1/E25 dir. Lausanne, sortie Crans-Céligny · ~35 km de Genève · Parking sur site',
      'Navette nocturne Lausanne disponible (CHF 15)',
    ],
  },
  {
    id: 'caribana-19', slug: 'caribana-festival-19-juin',
    title: 'Caribana Festival — Niska · Soolking · KeBlack', category: 'festival',
    description: "Vendredi 19 juin — Niska (afro-trap), Soolking (rap-raï), KeBlack, La Rvfleuze, Genezio, Maureen, a6el. Festival estival au bord du lac Léman à Crans-près-Céligny (Vaud).",
    priceInfo: 'CHF 90 standard · CHF 155 VIP · Pass 4j CHF 280',
    venue: {
      name: 'Port de Crans-près-Céligny',
      address: 'Crans-plage, 1299 Crans-près-Céligny',
      area: 'autour', lat: 46.3765, lng: 6.2155,
    },
    occurrences: [{ date: '2026-06-19', start: '17:00', end: '02:00' }],
    links: [
      { label: '🎟️ Billetterie (Ticketcorner)', url: 'https://www.ticketcorner.ch/fr/event/caribana-festival-2026-caribana-festival-21007826/', kind: 'tickets', status: 'verified' },
      { label: 'Programme officiel', url: 'https://caribana.ch/fr/programmation-du-caribana-festival', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
    g7AccessNotes: [
      'Train CFF : Genève-Cornavin → Nyon (20 min, fréquent) · bus 802 Nyon → Crans-près-Céligny (~15 min)',
      'Voiture : A1/E25 dir. Lausanne, sortie Crans-Céligny · ~35 km de Genève · Parking sur site',
      'Navette nocturne Lausanne disponible (CHF 15)',
    ],
  },
  {
    id: 'caribana-20', slug: 'caribana-festival-20-juin',
    title: 'Caribana Festival — Lost Frequencies · Purple Disco Machine', category: 'festival',
    description: "Samedi 20 juin — Lost Frequencies (deep house), Purple Disco Machine (disco-house), A-Trak, Etienne de Crécy, Trinix, MYD (live), Bon Entendeur, Leila. Soirée électro au bord du lac Léman.",
    priceInfo: 'CHF 90 standard · CHF 155 VIP · Pass week-end CHF 140 · Pass 4j CHF 280',
    venue: {
      name: 'Port de Crans-près-Céligny',
      address: 'Crans-plage, 1299 Crans-près-Céligny',
      area: 'autour', lat: 46.3765, lng: 6.2155,
    },
    occurrences: [{ date: '2026-06-20', start: '17:00', end: '02:00' }],
    links: [
      { label: '🎟️ Billetterie (Ticketcorner)', url: 'https://www.ticketcorner.ch/fr/event/caribana-festival-2026-caribana-festival-21007826/', kind: 'tickets', status: 'verified' },
      { label: 'Programme officiel', url: 'https://caribana.ch/fr/programmation-du-caribana-festival', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
    g7AccessNotes: [
      'Train CFF : Genève-Cornavin → Nyon (20 min, fréquent) · bus 802 Nyon → Crans-près-Céligny (~15 min)',
      'Voiture : A1/E25 dir. Lausanne, sortie Crans-Céligny · ~35 km de Genève · Parking sur site',
      'Navette nocturne Lausanne disponible (CHF 15)',
    ],
  },

  {
    id: 'fete-musique', slug: 'fete-de-la-musique-geneve',
    title: 'Fête de la Musique de Genève', category: 'festival',
    description: "35e édition, gratuite, dans toute la ville (Bastions, Victoria Hall, Conservatoire, Vieille-Ville, Jonction, Place des Volontaires…). ~500 concerts, 30 scènes. Ven 19h–02h · Sam 11h–02h · Dim 10h–22h.",
    venue: {
      name: 'Toute la ville de Genève',
      address: 'Parc des Bastions, Plainpalais, Vieille-Ville…',
      area: 'GE', lat: 46.2044, lng: 6.1432,
    },
    occurrences: [
      { date: '2026-06-19', start: '19:00', end: '02:00' },
      { date: '2026-06-20', start: '11:00', end: '02:00' },
      { date: '2026-06-21', start: '10:00', end: '22:00' },
    ],
    priceInfo: 'Gratuit',
    links: [
      { label: 'Programme officiel', url: 'https://evenements.geneve.ch/fetedelamusique/', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
  },

  // ── L'AMR AUX CROPETTES — 24–28 juin 2026 ────────────────────────────────────
  {
    id: 'amr-cropettes', slug: 'amr-aux-cropettes-2026',
    title: "L'AMR aux Cropettes", category: 'festival',
    description: "27 concerts de jazz gratuits en plein air sur 5 jours. Festival emblématique de Genève organisé par l'AMR (Association pour l'encouragement de la Musique Improvisée). Scènes en plein air, atmosphère conviviale, bar et restauration.",
    venue: {
      name: 'Parc des Cropettes',
      address: 'Rue Élisabeth Baulacre 12, 1202 Genève',
      area: 'GE', lat: 46.2115, lng: 6.1399,
    },
    occurrences: [
      { date: '2026-06-24', start: '17:00', end: '23:00', note: 'Jour 1 — 5–6 concerts' },
      { date: '2026-06-25', start: '17:00', end: '23:00', note: 'Jour 2 — 5–6 concerts' },
      { date: '2026-06-26', start: '17:00', end: '23:00', note: 'Jour 3 — 5–6 concerts' },
      { date: '2026-06-27', start: '17:00', end: '23:00', note: 'Jour 4 — 5–6 concerts' },
      { date: '2026-06-28', start: '14:00', end: '22:00', note: 'Jour 5 — clôture · programme complet sur amr-geneve.ch' },
    ],
    priceInfo: 'Gratuit',
    links: [
      { label: 'AMR — programme', url: 'https://www.amr-geneve.ch/programme', kind: 'organizer', status: 'verified' },
    ],
    verif: 'confirmed',
    g7AccessNotes: [
      'Tram 15 → arrêt Cropettes · Bus 3/5 → arrêt Servette',
      'Parking Servette à proximité',
    ],
  },

  // ── SCÈNE ELLA FITZGERALD — Parc La Grange (dès le 29 juin) ──────────────────
  {
    id: 'scene-ella', slug: 'scene-ella-fitzgerald-parc-la-grange',
    title: 'Scène Ella Fitzgerald — Parc La Grange', category: 'concert',
    description: "26 concerts gratuits en plein air tout l'été dans le Parc La Grange, au bord du lac Léman. Programmation jazz, world music et variétés. Lundi, mercredi et vendredi à 21h. Entrée libre, apporter un pique-nique recommandé.",
    venue: {
      name: 'Parc La Grange — Scène Ella Fitzgerald',
      address: 'Avenue William-Favre 35, 1207 Genève',
      area: 'GE', lat: 46.2041, lng: 6.1745,
    },
    occurrences: [
      { date: '2026-06-19', start: '21:00', note: 'Concert inaugural' },
      { date: '2026-06-29', start: '21:00', note: 'Lundi' },
      { date: '2026-07-01', start: '21:00', note: 'Mercredi' },
      { date: '2026-07-03', start: '21:00', note: 'Vendredi' },
      { date: '2026-07-06', start: '21:00', note: 'Lundi' },
      { date: '2026-07-08', start: '21:00', note: 'Mercredi' },
      { date: '2026-07-10', start: '21:00', note: 'Vendredi' },
      { date: '2026-07-13', start: '21:00', note: 'Lundi' },
      { date: '2026-07-15', start: '21:00', note: 'Mercredi' },
    ],
    priceInfo: 'Gratuit',
    links: [
      { label: 'Ville de Genève — concerts La Grange', url: 'https://www.geneve.ch/fr/actualites/concerts-gratuits-parc-la-grange', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
    g7AccessNotes: [
      'Bus 2/9 → arrêt Eaux-Vives / Genève · 10 min à pied jusqu\'au parc',
      'Parking Eaux-Vives à proximité',
    ],
  },

  // ── PLEIN-LES-WATTS FESTIVAL — 9–11 juillet 2026 ────────────────────────────
  {
    id: 'plein-les-watts', slug: 'plein-les-watts-festival-2026',
    title: 'Plein-les-Watts Festival', category: 'festival',
    description: "Festival reggae 3 jours à Grand-Lancy. Lineup international exceptionnel : Richie Spice, Barrington Levy, Burning Spear, Israel Vibration, Danakil, Culture feat. Kenyatta Hill, KT Gorique. Portes 18h.",
    venue: {
      name: 'Parc Navazza-Oltramare',
      address: 'Avenue Eugène-Lance 28, 1212 Grand-Lancy',
      area: 'GE', lat: 46.1770, lng: 6.1258,
    },
    occurrences: [
      { date: '2026-07-09', start: '18:00', end: '23:59', note: 'Jour 1 — Richie Spice · Danakil · KT Gorique' },
      { date: '2026-07-10', start: '18:00', end: '23:59', note: 'Jour 2 — Barrington Levy · Israel Vibration' },
      { date: '2026-07-11', start: '18:00', end: '23:59', note: 'Jour 3 — Burning Spear · Culture ft. Kenyatta Hill' },
    ],
    priceInfo: 'Payant — billetterie sur place',
    links: [
      { label: 'Plein-les-Watts', url: 'https://www.pleinleswatts.ch', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
    g7AccessNotes: [
      'Bus 11 → arrêt Lancy-Bâtie · 5 min à pied',
      'Tram 14/18 → Carouge-Bachet puis bus 23 → Grand-Lancy',
      'Voiture : sortie Lancy depuis le contournement · parking sur site',
    ],
  },

  // ── GUITARE EN SCÈNE — 14–18 juillet 2026 ────────────────────────────────────
  {
    id: 'guitare-en-scene', slug: 'guitare-en-scene-saint-julien-2026',
    title: 'Guitare en Scène — Saint-Julien-en-Genevois', category: 'festival',
    description: "Festival rock et guitare 5 soirées, ~5000 places, au Stade des Burgondes à Saint-Julien-en-Genevois (France, 15 km de Genève). Lineup : Kool & The Gang, Pixies, Ben Harper, Gregory Porter, hommage Michael Jackson.",
    venue: {
      name: 'Stade des Burgondes',
      address: 'Stade des Burgondes, 74160 Saint-Julien-en-Genevois',
      area: 'autour', lat: 46.1430, lng: 6.0853,
    },
    occurrences: [
      { date: '2026-07-14', start: '19:00', end: '23:30', note: 'Soirée 1' },
      { date: '2026-07-15', start: '19:00', end: '23:30', note: 'Soirée 2' },
      { date: '2026-07-16', start: '19:00', end: '23:30', note: 'Soirée 3' },
      { date: '2026-07-17', start: '19:00', end: '23:30', note: 'Soirée 4' },
      { date: '2026-07-18', start: '19:00', end: '23:30', note: 'Soirée 5 — clôture' },
    ],
    priceInfo: 'Payant — billetterie sur le site officiel',
    links: [
      { label: 'Guitare en Scène (officiel)', url: 'https://www.guitare-en-scene.com', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
    g7AccessNotes: [
      'Bus TPG 44/46 → Saint-Julien depuis Genève (30 min)',
      'Voiture : A40 sortie Saint-Julien-en-Genevois · ~15 km de Genève · Parking sur site',
      'Douane Bardonnex–Saint-Julien (ouverte 24h)',
    ],
  },

  // ── CINÉMAS — Genève & Grand Genève ──────────────────────────────────────────
  {
    id: 'pathe-balexert', slug: 'cinema-pathe-balexert',
    title: 'Pathé Balexert', category: 'cinema',
    description: "Plus grand multiplex de Suisse. 13 salles, 2909 places. Blockbusters, IMAX, VF et VO. Ouvert tous les jours dès 13h (11h sam/dim).",
    venue: {
      name: 'Pathé Balexert',
      address: 'Avenue Louis-Casaï 27, 1209 Genève (CC Balexert)',
      phone: '+41 22 979 01 11',
      area: 'Grand-Saconnex', lat: 46.2278, lng: 6.1086,
    },
    occurrences: dailyRange('2026-06-18', '2026-08-31', 'Séances dès 13h · 13 salles'),
    priceInfo: 'Dès CHF 17.– · Ciné Pass CHF 10.–',
    links: [
      { label: 'Pathé Balexert — programme', url: 'https://www.pathe.ch/fr/cinemas/cinema-pathe-balexert', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'arena-la-praille', slug: 'cinema-arena-la-praille',
    title: 'Arena Cinemas La Praille', category: 'cinema',
    description: "Multiplex de Carouge avec technologies immersives 4DX et ScreenX. Films grand public en VF, VO et formats spéciaux. Parking gratuit.",
    venue: {
      name: 'Arena Cinemas La Praille',
      address: 'Route des Jeunes 10, 1227 Carouge (Grand-Lancy)',
      phone: '0900 916 916',
      area: 'Carouge', lat: 46.1796, lng: 6.1283,
    },
    occurrences: dailyRange('2026-06-18', '2026-08-31', 'Séances dès 13h · 4DX & ScreenX'),
    priceInfo: 'Dès CHF 17.– · 4DX et ScreenX disponibles',
    links: [
      { label: 'Arena Cinemas — programme', url: 'https://www.arena.ch/fr/geneve/programme/horaires-des-films', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'grutli', slug: 'cinemas-du-grutli',
    title: 'Cinémas du Grütli', category: 'cinema',
    description: "Cinéphile genevois incontournable. Art & essai, cinématographies émergentes, ciné-clubs, avant-premières et rencontres avec réalisateurs. 2 salles (196 + 59 places) au sous-sol de la Maison des Arts du Grütli.",
    venue: {
      name: 'Maison des Arts du Grütli',
      address: 'Rue du Général-Dufour 16, 1204 Genève',
      phone: '+41 22 320 78 78',
      area: 'GE', lat: 46.2001, lng: 6.1453,
    },
    occurrences: dailyRange('2026-06-18', '2026-08-31', 'Art & essai · ciné-clubs'),
    priceInfo: 'CHF 14.– · Ciné Pass CHF 10.–',
    links: [
      { label: 'Cinémas du Grütli — programme', url: 'https://www.cinemas-du-grutli.ch/programme', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'spoutnik', slug: 'cinema-spoutnik',
    title: 'Cinéma Spoutnik', category: 'cinema',
    description: "Cinéma alternatif et militant fondé en 1986, logé dans L'Usine (1er étage). Films en marge des circuits commerciaux, expérimentaux et politiques. 1 salle. Payez ce que vous pouvez les mardis.",
    venue: {
      name: 'L\'Usine (Cinéma Spoutnik)',
      address: '11 rue de la Coulouvrenière, 1er étage, 1204 Genève',
      phone: '+41 22 328 09 26',
      area: 'GE', lat: 46.2040, lng: 6.1361,
    },
    occurrences: dailyRange('2026-06-18', '2026-08-31', 'Cinéma alternatif · 1 salle'),
    priceInfo: 'CHF 12.– · réduit CHF 10.– · mardi prix libre',
    links: [
      { label: 'Spoutnik — programme', url: 'https://spoutnik.info/', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'cinema-bio', slug: 'cinema-bio-carouge',
    title: 'Cinéma Bio — Carouge', category: 'cinema',
    description: "Cinéma indépendant de Carouge. Films grand public et d'auteur, documentaires, opéras filmés, séances seniors et jeune public. Grande salle 194 places + petite salle vidéo 20 places.",
    venue: {
      name: 'Cinéma Bio',
      address: 'Rue Saint-Joseph 47, 1227 Carouge',
      phone: '+41 22 301 54 43',
      area: 'Carouge', lat: 46.1820, lng: 6.1401,
    },
    occurrences: dailyRange('2026-06-18', '2026-08-31', 'Ouvert lun–dim · séances dès 13h30'),
    priceInfo: 'CHF 15.– · Ciné Pass CHF 10.–',
    links: [
      { label: 'Cinéma Bio — programme', url: 'https://cinema-bio.ch/programme', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'les-scala', slug: 'cinema-les-scala',
    title: 'Les Scala', category: 'cinema',
    description: "Cinéma indépendant des Eaux-Vives. Films en VO et VF, films d'auteur et grand public. Programmation soignée dans un cadre de quartier.",
    venue: {
      name: 'Les Scala',
      address: 'Rue des Eaux-Vives 23, 1207 Genève',
      phone: '+41 22 736 04 22',
      area: 'GE', lat: 46.2003, lng: 6.1576,
    },
    occurrences: dailyRange('2026-06-18', '2026-08-31', 'VO & VF · Eaux-Vives'),
    priceInfo: 'CHF 16.– · Ciné Pass CHF 10.–',
    links: [
      { label: 'Les Scala — programme', url: 'https://www.les-scala.ch/fr/a-l-affiche', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'le-city', slug: 'cinema-le-city',
    title: 'Le City', category: 'cinema',
    description: "Salle indépendante de la Place des Eaux-Vives. Films en VO sous-titrée, auteur et grand public. Même groupe que Les Scala et Le Nord-Sud.",
    venue: {
      name: 'Le City',
      address: 'Place des Eaux-Vives 3, 1207 Genève',
      phone: '+41 22 736 04 22',
      area: 'GE', lat: 46.2005, lng: 6.1582,
    },
    occurrences: dailyRange('2026-06-18', '2026-08-31', 'VO & VF · Place Eaux-Vives'),
    priceInfo: 'CHF 16.– · Ciné Pass CHF 10.–',
    links: [
      { label: 'Le City — programme', url: 'https://www.les-scala.ch/fr/a-l-affiche', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'nord-sud', slug: 'cinema-nord-sud',
    title: 'Le Nord-Sud', category: 'cinema',
    description: "Cinéma de quartier au cœur de la Servette depuis 1951, entièrement rénové en 2019. 2 salles (Nord + Sud). Cinéma d'auteur européen et américain, films Art & Essai.",
    venue: {
      name: 'Le Nord-Sud',
      address: 'Rue de la Servette 78, 1202 Genève',
      phone: '+41 22 736 04 22',
      area: 'GE', lat: 46.2127, lng: 6.1368,
    },
    occurrences: dailyRange('2026-06-18', '2026-08-31', 'Art & essai · quartier Servette'),
    priceInfo: 'CHF 16.– · Ciné Pass CHF 10.–',
    links: [
      { label: 'Le Nord-Sud — programme', url: 'https://www.les-scala.ch/fr/a-l-affiche', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'allianz-cinema', slug: 'allianz-cinema-plein-air',
    title: 'Allianz Cinema — Cinéma en plein air', category: 'cinema',
    description: "8 semaines de cinéma en plein air au bord du lac Léman, entre la plage des Eaux-Vives et Genève Plage. Séances chaque soir à la tombée de la nuit (~22h). Restaurant, terrasses et cocktails sur place dès 18h.",
    venue: {
      name: 'Place du Port-Noir',
      address: 'Place du Port-Noir, 1207 Genève (bord du lac)',
      area: 'GE', lat: 46.2014, lng: 6.1680,
    },
    occurrences: dailyRange('2026-06-29', '2026-08-24', 'Plein air · bord du lac · ~22h'),
    priceInfo: 'CHF 16.– · Enfants (–16 ans) CHF 12.–',
    links: [
      { label: 'Allianz Cinema — programme 2026', url: 'https://geneve.allianzcinema.ch/fr/programmation', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'cinema-voltaire-ferney', slug: 'cinema-voltaire-ferney-voltaire',
    title: 'Cinéma Voltaire — Ferney-Voltaire', category: 'cinema',
    description: "Cinéma de proximité à Ferney-Voltaire (France), à 10 min de Genève. 3 salles climatisées. Films en VF et VOST, 2D et 3D. Idéal pour les frontaliers genevois.",
    venue: {
      name: 'Cinéma Voltaire',
      address: '77 CCAL de la Poterie, 01210 Ferney-Voltaire (France)',
      phone: '+33 4 50 40 84 86',
      area: 'autour', lat: 46.2584, lng: 6.1098,
    },
    occurrences: dailyRange('2026-06-18', '2026-08-31', 'VF & VOST · 3 salles · Ferney-Voltaire'),
    priceInfo: '€9.– · réduit €7.–',
    links: [
      { label: 'Cinéma Voltaire — programme', url: 'https://cinemavoltaire.fr/', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },
  {
    id: 'pathe-archamps', slug: 'cinema-pathe-archamps',
    title: 'Pathé Archamps — IMAX', category: 'cinema',
    description: "Multiplex à l'ArchParc d'Archamps (France), à 15 min de Genève. 12 salles dont la seule salle IMAX LASER de la région (350 m² d'écran). Blockbusters, films en VO et VF. Accessible depuis la douane de Bardonnex.",
    venue: {
      name: 'Pathé Archamps',
      address: 'Rue des Frères Lumière, ArchParc, 74160 Archamps (France)',
      area: 'autour', lat: 46.1327, lng: 6.0878,
    },
    occurrences: dailyRange('2026-06-18', '2026-08-31', 'IMAX · 12 salles · Archamps'),
    priceInfo: 'Dès €12.50 · IMAX disponible',
    links: [
      { label: 'Pathé Archamps — programme', url: 'https://www.pathe.ch/fr/cinemas/cinema-pathe-archamps', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
    g7AccessNotes: [
      'Depuis Genève : douane Bardonnex–Saint-Julien (ouverte 24h) · ~15 min en voiture',
      'Bus STO ligne 43/44 depuis Genève Gare Routière vers Archamps',
    ],
  },

  // ── PALÉO FESTIVAL NYON — 21–26 juillet 2026 ─────────────────────────────────
  {
    id: 'paleo-2026', slug: 'paleo-festival-nyon-2026',
    title: 'Paléo Festival Nyon', category: 'festival',
    description: "L'un des plus grands festivals en plein air d'Europe. 6 jours, 200 000 spectateurs. Édition 2026 : Katy Perry, Gorillaz, The Cure, Lorde, Gims, Twenty One Pilots, Orelsan et bien d'autres. 6 scènes simultanées.",
    venue: {
      name: "Plaine de l'Asse",
      address: "Route des Plantaz 10, 1260 Nyon",
      area: 'autour', lat: 46.3809, lng: 6.2318,
    },
    occurrences: [
      { date: '2026-07-21', start: '14:00', end: '03:00', note: 'Jour 1' },
      { date: '2026-07-22', start: '14:00', end: '03:00', note: 'Jour 2' },
      { date: '2026-07-23', start: '14:00', end: '03:00', note: 'Jour 3' },
      { date: '2026-07-24', start: '14:00', end: '03:00', note: 'Jour 4' },
      { date: '2026-07-25', start: '14:00', end: '03:00', note: 'Jour 5' },
      { date: '2026-07-26', start: '14:00', end: '03:00', note: 'Jour 6 — clôture' },
    ],
    priceInfo: 'Journée ~CHF 95 · Pass 6j ~CHF 440 · Camping disponible',
    links: [
      { label: 'Paléo Festival (officiel)', url: 'https://yeah.paleo.ch', kind: 'info', status: 'verified' },
      { label: 'Billetterie (Ticketcorner)', url: 'https://www.ticketcorner.ch', kind: 'tickets', status: 'verified' },
    ],
    verif: 'confirmed',
    g7AccessNotes: [
      'Train CFF : Genève-Cornavin → Nyon (18 min, très fréquent) · navette festival Nyon → Plaine de l\'Asse',
      'Voiture : A1 dir. Lausanne, sortie Nyon · ~25 km de Genève · Parking payant sur site',
      'Vélo : piste cyclable bord du lac Genève–Nyon (~25 km)',
    ],
  },

  // ── BEACH PRO TOUR FUTURES FEMMES — 18–21 juin 2026 ─────────────────────────
  {
    id: 'beach-pro-tour-femmes', slug: 'beach-pro-tour-futures-femmes-2026',
    title: 'Beach Pro Tour Futures — Femmes', category: 'sport',
    description: 'Tournoi international de beach-volley féminin (World Tour Futures). Compétitions en accès libre sur le sable. Classement mondial WTA en jeu.',
    venue: {
      name: 'Parc des Evaux', address: 'Parc des Evaux, 1222 Vésenaz',
      area: 'GE', lat: 46.1993, lng: 6.1626,
    },
    occurrences: [
      { date: '2026-06-18', note: 'J1 — Phase de poules' },
      { date: '2026-06-19', note: 'J2 — Phase de poules' },
      { date: '2026-06-20', note: 'J3 — Quarts et demi-finales' },
      { date: '2026-06-21', note: 'Finale' },
    ],
    priceInfo: 'Entrée libre',
    links: [
      { label: 'Swiss Volley', url: 'https://www.swissvolley.ch', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
  },

  // ── BEACH PRO TOUR FUTURES HOMMES — 25–28 juin 2026 ─────────────────────────
  {
    id: 'beach-pro-tour-hommes', slug: 'beach-pro-tour-futures-hommes-2026',
    title: 'Beach Pro Tour Futures — Hommes', category: 'sport',
    description: 'Tournoi international de beach-volley masculin (World Tour Futures). Compétitions en accès libre sur le sable. Classement mondial en jeu.',
    venue: {
      name: 'Parc des Evaux', address: 'Parc des Evaux, 1222 Vésenaz',
      area: 'GE', lat: 46.1993, lng: 6.1626,
    },
    occurrences: [
      { date: '2026-06-25', note: 'J1 — Phase de poules' },
      { date: '2026-06-26', note: 'J2 — Phase de poules' },
      { date: '2026-06-27', note: 'J3 — Quarts et demi-finales' },
      { date: '2026-06-28', note: 'Finale' },
    ],
    priceInfo: 'Entrée libre',
    links: [
      { label: 'Swiss Volley', url: 'https://www.swissvolley.ch', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
  },

  // ── TOUS À LA PLAGE — 25–27 juin 2026 ───────────────────────────────────────
  {
    id: 'tous-a-la-plage-2026', slug: 'tous-a-la-plage-festival-2026',
    title: 'Tous À la Plage', category: 'festival',
    description: 'Festival afro-latino 3 soirées à la Canopée. Musiques du monde, jazz, latin. Ambiance plein air estivale au bord du Rhône.',
    venue: {
      name: 'La Canopée', address: 'Rue de la Coulouvrenière, 1204 Genève',
      area: 'GE', lat: 46.2038, lng: 6.1358,
    },
    occurrences: [
      { date: '2026-06-25', start: '20:00', note: 'Soirée 1 — Afro Latino' },
      { date: '2026-06-26', start: '20:00', note: 'Soirée 2 — Jazz & World' },
      { date: '2026-06-27', start: '20:00', note: 'Soirée 3 — Clôture Latino' },
    ],
    priceInfo: 'Payant — billetterie sur place',
    links: [
      { label: 'Ville de Genève — événements', url: 'https://www.geneve.ch/faire-geneve', kind: 'info', status: 'verified' },
    ],
    verif: 'plausible',
  },

  // ── LA TOUR GENÈVE TRIATHLON — 4–5 juillet 2026 ─────────────────────────────
  {
    id: 'triathlon-tour-geneve', slug: 'triathlon-tour-de-geneve-2026',
    title: 'La Tour Genève Triathlon', category: 'sport',
    description: 'Genève Triathlon, 36e édition. Natation dans le lac Léman face au Jet d\'eau, vélo et course à pied sur parcours fermés le long des quais. Formats Half, Standard, Short, Découverte, Youth League et courses enfants (relais possible). Village et zone de départ sur le Quai Gustave-Ador. Spectacle gratuit depuis les quais. Fermetures de routes et perturbations TPG à prévoir sur le week-end.',
    venue: {
      name: 'Plage des Eaux-Vives — Quai Gustave-Ador', address: 'Quai Gustave-Ador, 1207 Genève',
      area: 'GE', lat: 46.2049, lng: 6.1645,
    },
    occurrences: [
      { date: '2026-07-04', note: 'Samedi — épreuves sur parcours fermés' },
      { date: '2026-07-05', note: 'Dimanche — épreuves sur parcours fermés' },
    ],
    priceInfo: 'Gratuit spectateurs — inscriptions dès CHF 29',
    links: [
      { label: 'Genève Triathlon — site officiel', url: 'https://www.genevetriathlon.ch', kind: 'info', status: 'verified' },
      { label: 'Infos circulation riverains', url: 'https://www.genevetriathlon.ch/infosriverains', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
  },

  // ── GRAND JUILLET — 4–12 juillet 2026 ───────────────────────────────────────
  {
    id: 'grand-juillet-2026', slug: 'grand-juillet-geneve-2026',
    title: 'Grand Juillet', category: 'art',
    description: 'Festival pluridisciplinaire gratuit de la Ville de Genève. Concerts, spectacles, expositions et animations dans plusieurs quartiers. Animations gratuites pour tous.',
    venue: {
      name: 'Plusieurs lieux — Genève', address: 'Canton de Genève',
      area: 'GE', lat: 46.2044, lng: 6.1432,
    },
    occurrences: dailyRange('2026-07-04', '2026-07-12', 'Événements gratuits en continu'),
    priceInfo: 'Gratuit',
    links: [
      { label: 'Ville de Genève', url: 'https://www.geneve.ch/faire-geneve', kind: 'info', status: 'verified' },
    ],
    verif: 'plausible',
  },

  // ── MONTREUX JAZZ FESTIVAL — 3–17 juillet 2026 ──────────────────────────────
  {
    id: 'montreux-jazz-2026', slug: 'montreux-jazz-festival-2026',
    title: 'Montreux Jazz Festival', category: 'festival',
    description: "L'un des plus grands festivals de jazz au monde. 2 semaines de concerts au bord du lac Léman à Montreux. Stars internationales, scènes gratuites en ville, clubbing toute la nuit.",
    venue: {
      name: 'Montreux Music & Convention Centre', address: 'Rue du Théâtre 2, 1820 Montreux',
      area: 'autour', lat: 46.4384, lng: 6.9085,
    },
    occurrences: dailyRange('2026-07-03', '2026-07-17'),
    priceInfo: 'Scènes gratuites · Pass payant pour les grandes salles',
    links: [
      { label: 'Montreux Jazz Festival (officiel)', url: 'https://www.montreuxjazz.com', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
  },

  // ── SWISS OPEN GENEVA — 14–18 juillet 2026 ──────────────────────────────────
  {
    id: 'swiss-open-geneva-2026', slug: 'swiss-open-geneva-wheelchair-2026',
    title: 'Swiss Open Geneva (Tennis Fauteuil)', category: 'sport',
    description: 'Tournoi international ITF de tennis en fauteuil roulant. Compétition de haut niveau réunissant les meilleurs joueurs mondiaux classés ITF. Accès spectateurs gratuit.',
    venue: {
      name: 'Centre sportif de Sous-Moulin', address: 'Route de Sous-Moulin 51, 1225 Chêne-Bourg',
      area: 'GE', lat: 46.1985, lng: 6.1951,
    },
    occurrences: [
      { date: '2026-07-14', note: 'Poules' },
      { date: '2026-07-15', note: 'Poules' },
      { date: '2026-07-16', note: 'Quarts de finale' },
      { date: '2026-07-17', note: 'Demi-finales' },
      { date: '2026-07-18', note: 'Finales' },
    ],
    priceInfo: 'Entrée libre',
    links: [
      { label: 'Swiss Tennis', url: 'https://www.swisstennis.ch', kind: 'info', status: 'verified' },
    ],
    verif: 'plausible',
  },

  // ── ÉTOILE CAROUGE — Challenge League J1 — 24 juillet 2026 ──────────────────
  {
    id: 'etoile-carouge-aarau-j1', slug: 'etoile-carouge-fc-aarau-cl-2026',
    title: 'Étoile Carouge FC vs FC Aarau', category: 'football',
    description: 'Challenge League — Journée 1. Derby entre le club historique carougeois et le FC Aarau. Ambiance populaire au Stade de Carouge.',
    venue: {
      name: 'Stade de Carouge', address: 'Av. du Stade 5, 1227 Carouge',
      area: 'Carouge', lat: 46.1838, lng: 6.1381,
    },
    occurrences: [
      { date: '2026-07-24', start: '20:15', note: 'Challenge League — J1' },
    ],
    priceInfo: 'Payant — guichet sur place',
    links: [
      { label: 'Étoile Carouge FC', url: 'https://www.etoilecarouge.ch', kind: 'venue', status: 'verified' },
    ],
    verif: 'plausible',
  },

  // ── SERVETTE FC — Super League saison 2026–27 ────────────────────────────────
  {
    id: 'servette-bale-j1', slug: 'servette-fc-vs-bale-superleague-j1',
    title: 'Servette FC vs FC Bâle', category: 'football',
    description: 'Super League — Journée 1. Choc de la saison 2026-27 entre Servette FC et le FC Bâle au Stade de la Praille. Ambiance électrique pour le match d\'ouverture des grenat-et-noir.',
    venue: {
      name: 'Stade de la Praille (Stade de Genève)', address: 'Route des Jeunes 8, 1227 Carouge',
      area: 'GE', lat: 46.1883, lng: 6.1318,
    },
    occurrences: [
      { date: '2026-07-25', start: '18:00', note: 'Super League — J1' },
    ],
    priceInfo: 'Payant — billetterie Servette FC',
    links: [
      { label: 'Servette FC billetterie', url: 'https://www.servettefc.ch', kind: 'tickets', status: 'verified' },
    ],
    verif: 'plausible',
  },
  {
    id: 'servette-grasshoppers-2026', slug: 'servette-fc-vs-grasshoppers-j5',
    title: 'Servette FC vs Grasshoppers', category: 'football',
    description: 'Super League — Journée 5. Derby genevois face au Grasshopper Club Zurich. Match à fort enjeu au Stade de la Praille.',
    venue: {
      name: 'Stade de la Praille (Stade de Genève)', address: 'Route des Jeunes 8, 1227 Carouge',
      area: 'GE', lat: 46.1883, lng: 6.1318,
    },
    occurrences: [
      { date: '2026-08-08', start: '20:30', note: 'Super League — J5' },
    ],
    priceInfo: 'Payant — billetterie Servette FC',
    links: [
      { label: 'Servette FC billetterie', url: 'https://www.servettefc.ch', kind: 'tickets', status: 'verified' },
    ],
    verif: 'plausible',
  },
  {
    id: 'servette-lucerne-2026', slug: 'servette-fc-vs-lucerne-j9',
    title: 'Servette FC vs FC Lucerne', category: 'football',
    description: 'Super League — Journée 9. Servette FC reçoit le FC Lucerne au Stade de la Praille. Rencontre clé du championnat.',
    venue: {
      name: 'Stade de la Praille (Stade de Genève)', address: 'Route des Jeunes 8, 1227 Carouge',
      area: 'GE', lat: 46.1883, lng: 6.1318,
    },
    occurrences: [
      { date: '2026-08-29', start: '18:00', note: 'Super League — J9' },
    ],
    priceInfo: 'Payant — billetterie Servette FC',
    links: [
      { label: 'Servette FC billetterie', url: 'https://www.servettefc.ch', kind: 'tickets', status: 'verified' },
    ],
    verif: 'plausible',
  },

  // ── NOCTURNE DE SAINT-PIERRE — 27 juillet 2026 ──────────────────────────────
  {
    id: 'nocturne-saint-pierre-2026', slug: 'nocturne-cathedrale-saint-pierre-2026',
    title: 'Nocturne de Saint-Pierre', category: 'art',
    description: 'Nuit blanche à la Cathédrale Saint-Pierre. Accès aux tours et au site archéologique, concert d\'orgue, animations nocturnes. Pleine lune sur la vieille-ville.',
    venue: {
      name: 'Cathédrale Saint-Pierre', address: 'Cour Saint-Pierre 6, 1204 Genève',
      area: 'GE', lat: 46.2015, lng: 6.1489,
    },
    occurrences: [
      { date: '2026-07-27', start: '20:00', end: '00:00', note: 'Nocturne — accès tours + site archéologique' },
    ],
    priceInfo: 'Payant — accès tours CHF 5',
    links: [
      { label: 'Cathédrale Saint-Pierre', url: 'https://www.cathedrale-geneve.ch', kind: 'info', status: 'verified' },
    ],
    verif: 'plausible',
  },

  // ── JAZZ SUR LA PLAGE — 7–8 août 2026 ───────────────────────────────────────
  {
    id: 'jazz-sur-la-plage-2026', slug: 'jazz-sur-la-plage-hermance-2026',
    title: 'Jazz sur la Plage', category: 'concert',
    description: "Concert jazz en plein air sur la plage d'Hermance. Ambiance unique au bord du lac Léman, musique jazz et world music, couchers de soleil. Entrée libre.",
    venue: {
      name: "Plage d'Hermance", address: 'Plage de la Rive, 1248 Hermance',
      area: 'GE', lat: 46.3013, lng: 6.2307,
    },
    occurrences: [
      { date: '2026-08-07', start: '18:00', note: 'Jazz sur la Plage — J1' },
      { date: '2026-08-08', start: '18:00', note: 'Jazz sur la Plage — J2' },
    ],
    priceInfo: 'Gratuit',
    links: [
      { label: 'Commune d\'Hermance', url: 'https://www.geneve.ch/faire-geneve', kind: 'info', status: 'verified' },
    ],
    verif: 'plausible',
  },

  // ── OSR FESTIVAL GENÈVE-PLAGE — 13–15 août 2026 ─────────────────────────────
  {
    id: 'osr-geneve-plage-2026', slug: 'osr-festival-geneve-plage-2026',
    title: 'OSR · Festival Genève-Plage', category: 'concert',
    description: "L'Orchestre de la Suisse Romande investit Genève-Plage pour 3 soirées exceptionnelles : concert classique, ciné-concert Hitchcock et soirée jazz. En bord de lac.",
    venue: {
      name: 'Genève-Plage', address: 'Quai de Cologny, 1223 Cologny',
      area: 'GE', lat: 46.2053, lng: 6.1712,
    },
    occurrences: [
      { date: '2026-08-13', start: '20:00', note: 'Concert classique OSR' },
      { date: '2026-08-14', start: '20:30', note: 'Ciné-concert Hitchcock' },
      { date: '2026-08-15', start: '20:00', note: 'Soirée Jazz' },
    ],
    priceInfo: 'Payant — billetterie OSR',
    links: [
      { label: 'Orchestre de la Suisse Romande', url: 'https://www.osr.ch', kind: 'tickets', status: 'verified' },
    ],
    verif: 'plausible',
  },

  // ── PIZ PALÜ FESTIVAL — 14–16 août 2026 ─────────────────────────────────────
  {
    id: 'piz-palu-festival-2026', slug: 'piz-palu-festival-plan-les-ouates-2026',
    title: 'Piz Palü Festival', category: 'festival',
    description: 'Festival rock, pop et électro 3 jours à Plan-les-Ouates. Artistes suisses et internationaux, food trucks, ambiance conviviale. Gratuit pour les moins de 14 ans.',
    venue: {
      name: 'Plan-les-Ouates', address: 'Plan-les-Ouates, 1228 Genève',
      area: 'GE', lat: 46.1677, lng: 6.1208,
    },
    occurrences: [
      { date: '2026-08-14', start: '18:00', note: 'Jour 1' },
      { date: '2026-08-15', start: '18:00', note: 'Jour 2' },
      { date: '2026-08-16', start: '18:00', note: 'Jour 3 — clôture' },
    ],
    priceInfo: 'Payant — gratuit -14 ans',
    links: [
      { label: 'Piz Palü Festival', url: 'https://infomaniak.events/fr-ch/festival/geneve', kind: 'info', status: 'verified' },
    ],
    verif: 'plausible',
  },

  // ── FESTIVERBANT — 22–23 août 2026 ──────────────────────────────────────────
  {
    id: 'festiverbant-2026', slug: 'festiverbant-compesieres-2026',
    title: 'Festiverbant', category: 'festival',
    description: 'Festival rock 2 jours à Compesières. Groupes locaux et régionaux, ambiance conviviale dans un cadre champêtre. Incontournable de la scène rock genevoise.',
    venue: {
      name: 'Compesières', address: 'Compesières, 1252 Genève',
      area: 'GE', lat: 46.1470, lng: 6.1480,
    },
    occurrences: [
      { date: '2026-08-22', start: '18:00', note: 'Jour 1' },
      { date: '2026-08-23', start: '18:00', note: 'Jour 2 — clôture' },
    ],
    priceInfo: 'Payant',
    links: [
      { label: 'Festiverbant', url: 'https://www.geneve.ch/faire-geneve', kind: 'info', status: 'verified' },
    ],
    verif: 'plausible',
  },

  // ── TOUR DE FRANCE FEMMES — Étape 2 — 2 août 2026 ───────────────────────────
  {
    id: 'tdf-femmes-etape2', slug: 'tour-de-france-femmes-etape2-geneve-2026',
    title: 'Tour de France Femmes — Arrivée à Genève', category: 'sport',
    description: 'Étape 2 du Tour de France Femmes avec Zwift. Arrivée à Genève après 149 km depuis Aigle (Valais). Arrivée prévue ~17h sur les quais. Spectacle gratuit et accès libre.',
    venue: {
      name: 'Quais de Genève — Arrivée', address: 'Quai du Mont-Blanc, 1201 Genève',
      area: 'GE', lat: 46.2085, lng: 6.1488,
    },
    occurrences: [
      { date: '2026-08-02', start: '17:00', note: 'Arrivée Étape 2 — Aigle → Genève 149 km' },
    ],
    priceInfo: 'Gratuit',
    links: [
      { label: 'Tour de France Femmes', url: 'https://www.tdf-femmes.com', kind: 'info', status: 'verified' },
    ],
    verif: 'plausible',
  },

  // ── LA BÂTIE — FESTIVAL DE GENÈVE — 25 août → 13 sept 2026 ──────────────────
  {
    id: 'la-batie-2026', slug: 'la-batie-festival-de-geneve-2026',
    title: 'La Bâtie — Festival de Genève', category: 'festival',
    description: 'Festival pluridisciplinaire emblématique — 50e édition. Danse, musique du monde, cirque, théâtre et arts de la rue dans une vingtaine de lieux genevois. Référence culturelle romande.',
    venue: {
      name: 'Plusieurs lieux — Genève', address: 'Canton de Genève',
      area: 'GE', lat: 46.2044, lng: 6.1432,
    },
    occurrences: dailyRange('2026-08-25', '2026-09-13'),
    priceInfo: 'Variable selon spectacle — billetterie en ligne',
    links: [
      { label: 'La Bâtie Festival (officiel)', url: 'https://www.batie.ch', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
  },

  // ── SCÈNE VAGABONDE — 27 août → 18 oct 2026 ─────────────────────────────────
  {
    id: 'scene-vagabonde-2026', slug: 'scene-vagabonde-caecilia-2026',
    title: 'Scène Vagabonde', category: 'theatre',
    description: 'Saison automne de la Scène Vagabonde à la Scène Cæcilia. Théâtre, performances et spectacles pluridisciplinaires. Lieu incontournable de la création contemporaine genevoise.',
    venue: {
      name: 'Scène Cæcilia', address: 'Rue de Carouge 45, 1205 Genève',
      area: 'GE', lat: 46.2050, lng: 6.1420,
    },
    occurrences: dailyRange('2026-08-27', '2026-10-18'),
    priceInfo: 'Payant — billetterie en ligne',
    links: [
      { label: 'Scène Cæcilia', url: 'https://www.scene-caecilia.ch', kind: 'info', status: 'verified' },
    ],
    verif: 'plausible',
  },

  // ── MUSÉE ARIANA — Exposition Marie Ducaté — jusqu'au 29 nov 2026 ────────────
  {
    id: 'musee-ariana-ducate', slug: 'musee-ariana-marie-ducate-2026',
    title: 'Musée Ariana — Marie Ducaté', category: 'art',
    description: 'Exposition temporaire consacrée à Marie Ducaté au Musée Ariana (céramique et verre). Accès gratuit avec la carte journalière TPG. Fermé le lundi.',
    venue: {
      name: 'Musée Ariana', address: 'Avenue de la Paix 10, 1202 Genève',
      area: 'GE', lat: 46.2272, lng: 6.1394,
    },
    occurrences: dailyRange('2026-06-18', '2026-11-29'),
    priceInfo: 'Gratuit (collections permanentes) — expo temporaire payante',
    links: [
      { label: 'Musée Ariana', url: 'https://www.ariana-geneve.ch', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },

  // ── MUSÉE ARIANA — Le Verre / Cirva — jusqu'au 3 janv 2027 ──────────────────
  {
    id: 'musee-ariana-verre-cirva', slug: 'musee-ariana-verre-cirva-2026',
    title: 'Musée Ariana — Le Verre / Cirva', category: 'art',
    description: 'Exposition Le Verre en dialogue avec le CIRVA (Centre International de Recherche sur le Verre). Art contemporain du verre soufflé et travaillé par des artistes internationaux.',
    venue: {
      name: 'Musée Ariana', address: 'Avenue de la Paix 10, 1202 Genève',
      area: 'GE', lat: 46.2272, lng: 6.1394,
    },
    occurrences: dailyRange('2026-06-18', '2026-12-31'),
    priceInfo: 'Payant — expo temporaire',
    links: [
      { label: 'Musée Ariana', url: 'https://www.ariana-geneve.ch', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },

  // ── MUSÉE RATH — Sylvia Sleigh — juin → oct 2026 ────────────────────────────
  {
    id: 'musee-rath-sylvia-sleigh', slug: 'musee-rath-sylvia-sleigh-2026',
    title: 'Musée Rath — Sylvia Sleigh', category: 'art',
    description: "Rétrospective Sylvia Sleigh au Musée Rath. Peintre féministe majeure du XXe siècle, célèbre pour ses portraits inversant les codes du nu académique. Première grande expo en Suisse.",
    venue: {
      name: 'Musée Rath', address: 'Place de Neuve, 1204 Genève',
      area: 'GE', lat: 46.1998, lng: 6.1456,
    },
    occurrences: dailyRange('2026-06-18', '2026-10-25'),
    priceInfo: 'Payant — tarif réduit étudiants',
    links: [
      { label: 'Musée Rath — MAH Genève', url: 'https://www.mah-geneve.ch', kind: 'venue', status: 'verified' },
    ],
    verif: 'confirmed',
  },

  // ── CINÉTRANSAT — 9 juil → 16 août 2026 ─────────────────────────────────────
  {
    id: 'cinetransat-2026', slug: 'cinetransat-parc-perle-du-lac-2026',
    title: 'CinéTransat — Cinéma en plein air', category: 'cinema',
    description: 'Cinéma en plein air au Parc de la Perle du Lac. Films projetés sur grand écran les jeudis, vendredis, samedis et dimanches à partir de 21h30. Entrée libre, transat CHF 5.',
    venue: {
      name: 'Parc de la Perle du Lac', address: 'Rue de Lausanne 128, 1202 Genève',
      area: 'GE', lat: 46.2195, lng: 6.1480,
    },
    occurrences: dailyRange('2026-07-09', '2026-08-16'),
    priceInfo: 'Entrée libre — transat CHF 5',
    links: [
      { label: 'CinéTransat', url: 'https://www.cinetransat.ch', kind: 'info', status: 'verified' },
    ],
    verif: 'confirmed',
  },
]

export const CATEGORY_LABELS: Record<string, string> = {
  theatre:   'Théâtre',
  comedie:   'Comédie',
  concert:   'Concert',
  classique: 'Classique',
  nightlife: 'Vie nocturne',
  danse:     'Danse',
  art:       'Art',
  sport:     'Sport',
  festival:  'Festival',
  football:  'Football & Mondial',
  cinema:    'Cinéma',
}

export const CATEGORY_ICONS: Record<string, string> = {
  theatre:   '🎭',
  comedie:   '😂',
  concert:   '🎵',
  classique: '🎻',
  nightlife: '🌙',
  danse:     '💃',
  art:       '🎨',
  sport:     '🥊',
  festival:  '🎪',
  football:  '⚽',
  cinema:    '🎬',
}
