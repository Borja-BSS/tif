export type EtatRoute = 'fluide' | 'ralenti' | 'congestionne' | 'bloque' | 'inconnu'

/** Un point d'observation : endroit précis dont on décide l'état. */
export interface PointObservation {
  id:   string
  nom:  string
  lat:  number
  lng:  number
  /** 'douane' ou 'axe' : sert seulement à l'affichage. */
  type: 'douane' | 'axe'
}

/** Ce qu'UNE source a mesuré à UN point, avec son heure. Jamais de valeur par défaut. */
export interface Lecture {
  source:      string
  pointId:     string
  /** Heure de la mesure, ISO 8601. */
  at:          string
  speed:       number             // km/h
  freeFlow:    number             // km/h
  jamFactor:   number             // 0 (libre) à 10 (bloqué)
  confidence:  number             // 0 à 1
  fermee:      boolean            // la source déclare la route fermée
  coordinates: [number, number][] // [lng, lat], tronçon mesuré
}

/** Source interchangeable. Ajouter une source = ajouter un fichier dans `sources/` et l'enregistrer dans `sources/index.ts`. */
export interface SourceEtat {
  id:      string
  libelle: string
  /** Page officielle des conditions d'usage, pour le dossier de licence. */
  licence: string
  /** Vrai seulement si la source est configurée ET autorisée par la variable TIF_TRAFFIC_SOURCE. */
  active(): boolean
  lire(points: PointObservation[]): Promise<Lecture[]>
}

export interface DecisionRoute {
  id:         string
  nom:        string
  lat:        number
  lng:        number
  etat:       EtatRoute
  couleur:    string
  raison:     string
  jamFactor:  number | null
  sources:    Array<{ source: string; at: string; jamFactor: number; speed: number; fermee: boolean }>
  calculeLe:  string
}
