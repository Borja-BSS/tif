// Données P+R Grand Genève — Source officielle : SITG OTC_PARKING (Canton de Genève)
// Coordonnées et capacités vérifiées juin 2026. Pas de temps réel : afficher "Capacité totale".

export interface ParkingPR {
  id:       string
  name:     string
  lng:      number
  lat:      number
  capacity: number    // places totales publiques
  hasRT:    boolean   // disponibilité temps réel sur geneve-parking.ch
  url?:     string    // lien Fondation des Parkings ou aéroport
  tpg?:     string    // correspondance transport en commun
}

export const PARKINGS_PR: ParkingPR[] = [
  // ── Très grands lots (≥700) ───────────────────────────────────────────────────
  { id: 'balexert',     name: 'Balexert',             lng: 6.113072, lat: 46.218929, capacity: 1879, hasRT: false, url: 'https://www.geneve-parking.ch/fr/parkings/pr-balexert',                          tpg: 'Tram 14'         },
  { id: 'sous-moulin',  name: 'Sous-Moulin',           lng: 6.192746, lat: 46.190342, capacity:  876, hasRT: true,  url: 'https://www.geneve-parking.ch/fr/parkings/pr-sous-moulin',                       tpg: 'Tram 12'         },
  { id: 'ge-plage',     name: 'Genève-Plage',          lng: 6.173559, lat: 46.213208, capacity:  865, hasRT: true,  url: 'https://www.geneve-parking.ch/fr/parkings/pr-geneve-plage',                      tpg: 'Bus 2 · 27'      },
  { id: 'ikea',         name: 'IKEA Vernier',           lng: 6.095461, lat: 46.219567, capacity:  739, hasRT: false                                                                                                                   },
  // ── Grands lots (400–700) ─────────────────────────────────────────────────────
  { id: 'etoile',       name: 'Étoile',                lng: 6.128224, lat: 46.187044, capacity:  541, hasRT: true,  url: 'https://www.geneve-parking.ch/fr/parkings/pr-etoile',                            tpg: 'Tram 15 · 17'    },
  { id: 'p26',          name: 'P26 Aéroport',           lng: 6.113017, lat: 46.234159, capacity:  527, hasRT: true,  url: 'https://www.gva.ch/fr/Site/Passagers/Acces-Transports/Parkings/Parkings-aeroport', tpg: 'Train · Tram 14' },
  { id: 'secheron',     name: 'Sécheron',               lng: 6.145717, lat: 46.222174, capacity:  395, hasRT: false, url: 'https://www.geneve-parking.ch/fr/parkings/pr-secheron',                         tpg: 'Tram 14 · 15'    },
  { id: 'moillesulaz',  name: 'Moillesulaz',            lng: 6.204622, lat: 46.191401, capacity:  379, hasRT: true,  url: 'https://www.geneve-parking.ch/fr/parkings/pr-moillesulaz',                      tpg: 'Tram 12'         },
  // ── Lots moyens (150–399) ─────────────────────────────────────────────────────
  { id: 'les-mouilles',  name: 'Les Mouilles',          lng: 6.111498, lat: 46.187119, capacity:  342, hasRT: false                                                                                                                   },
  { id: 'vailly',        name: 'P+R Vailly',            lng: 6.061215, lat: 46.175507, capacity:  262, hasRT: false                                                                                                                   },
  { id: 'bernex',        name: 'Bernex',                lng: 6.082968, lat: 46.178640, capacity:  254, hasRT: false, url: 'https://www.geneve-parking.ch/fr/parkings/pr-bernex',                           tpg: 'Tram 15'         },
  { id: 'pre-bois',      name: 'Pré-Bois',              lng: 6.096942, lat: 46.222561, capacity:  206, hasRT: false, url: 'https://www.geneve-parking.ch/fr/parkings/pr-pre-bois',                         tpg: 'Tram 14'         },
  { id: 'saint-julien',  name: 'Saint-Julien (FR)',      lng: 6.088116, lat: 46.150694, capacity:  200, hasRT: false                                                                                                                   },
  { id: 'p47',           name: 'P47 Voie des Traz',     lng: 6.121678, lat: 46.241680, capacity:  150, hasRT: false, url: 'https://www.geneve-parking.ch/fr/ou-stationner/pr-p47'                                                    },
  // ── Petits lots (<150) ────────────────────────────────────────────────────────
  { id: 'rampe-gare',    name: 'Rampe de la Gare',      lng: 6.166412, lat: 46.279737, capacity:  117, hasRT: false                                                                                                                   },
  { id: 'satigny',       name: 'Satigny P+Rail',         lng: 6.038352, lat: 46.214900, capacity:   91, hasRT: false,                                                                                          tpg: 'Train (CFF)'    },
  { id: 'la-plaine',     name: 'La Plaine P+Rail',       lng: 5.998698, lat: 46.178623, capacity:   82, hasRT: false,                                                                                          tpg: 'Train (CFF)'    },
  { id: 'champ-bossu',   name: 'Champ Bossu',            lng: 6.077954, lat: 46.214425, capacity:   78, hasRT: false                                                                                                                   },
  { id: 'tuileries',     name: 'P+R Tuileries',          lng: 6.147791, lat: 46.249757, capacity:   55, hasRT: false, url: 'https://www.geneve-parking.ch/fr/parkings/pr-tuileries'                                                   },
  { id: 'l-huche',       name: "L'Huche",                lng: 6.181740, lat: 46.168472, capacity:   51, hasRT: false                                                                                                                   },
  { id: 'meyrin',        name: 'Meyrin-Gravière',        lng: 6.084449, lat: 46.235325, capacity:   49, hasRT: false, url: 'https://www.geneve-parking.ch/fr/parkings/pr-meyrin-graviere'                                             },
  { id: 'frontenex',     name: 'Stade Frontenex',        lng: 6.175846, lat: 46.206157, capacity:   25, hasRT: false                                                                                                                   },
  { id: 'bout-monde',    name: 'Bout-du-Monde',          lng: 6.158195, lat: 46.181111, capacity:   15, hasRT: false                                                                                                                   },
]

export const TOTAL_PR_CAPACITY = PARKINGS_PR.reduce((s, p) => s + p.capacity, 0)
