// ── Waze unofficial API types ─────────────────────────────────────────────────
// Source : endpoint non officiel live-map/api/georss (env=row)
// NON SUPPORTÉ par Waze/Google — peut changer ou disparaître sans préavis.
// Usage : développement / validation uniquement.

export interface WazePoint {
  x: number  // longitude
  y: number  // latitude
}

export type WazeJamType = 'NONE' | 'ROAD_CLOSED' | string

export interface WazeJam {
  uuid:       string
  pubMillis:  number
  type:       WazeJamType
  speed:      number
  speedKMH:   number
  delay:      number   // secondes de délai estimé
  length:     number   // mètres
  level:      number   // 0–5
  line:       WazePoint[]
  street?:    string
  city?:      string
  country?:   string
  endNode?:   string
  startNode?: string
}

export type WazeAlertType =
  | 'ACCIDENT'
  | 'JAM'
  | 'ROAD_CLOSED'
  | 'HAZARD'
  | 'WEATHERHAZARD'
  | 'POLICE'
  | 'CONSTRUCTION'
  | 'MISC'

export interface WazeAlert {
  uuid:          string
  pubMillis:     number
  type:          WazeAlertType | string
  subtype?:      string
  location:      WazePoint
  street?:       string
  city?:         string
  country?:      string
  magvar:        number
  reliability:   number   // 0–10
  confidence:    number   // 0–10
  nThumbsUp?:    number
  reportRating?: number
}

export interface WazeResponse {
  jams?:   WazeJam[]
  alerts?: WazeAlert[]
}
