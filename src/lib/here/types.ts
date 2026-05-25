export interface HerePoint {
  lat: number
  lng: number
}

export interface HereShapeLink {
  points: HerePoint[]
}

export interface HereLocation {
  shape: { links: HereShapeLink[] }
}

export interface HereCurrentFlow {
  speed:      number
  freeFlow:   number
  jamFactor:  number
  confidence: number
}

export interface HereFlowResult {
  location:    HereLocation
  currentFlow: HereCurrentFlow
}

export interface HereFlowResponse {
  results: HereFlowResult[]
}

export type HereMainType =
  | 'accident'
  | 'congestion'
  | 'construction'
  | 'disabledVehicle'
  | 'massTransit'
  | 'plannedEvent'
  | 'roadClosure'
  | 'weatherCondition'
  | 'misc'

export type HereCriticality = 'critical' | 'major' | 'minor' | 'lowImpact'

export interface HereIncidentDetails {
  id:          string
  startTime:   string
  endTime?:    string
  criticality: HereCriticality
  type:        { mainType: HereMainType }
  description: { value: string; language: string }[]
  location:    HereLocation
}

export interface HereIncident {
  incidentDetails: HereIncidentDetails
}

export interface HereIncidentsResponse {
  results: HereIncident[]
}
