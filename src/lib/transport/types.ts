import type { FeatureCollection } from 'geojson'

export type ExtendedVehicleType = 'train' | 'tram' | 'bus' | 'ceva'

export interface TpgDisruption {
  id:            string
  lineNumber:    string
  type:          'travaux' | 'deviation' | 'suppression' | 'retard' | 'perturbation'
  description:   string
  affectedStops: string[]
  direction?:    string
  coordinates?:  [number, number]  // [lat, lng]
}

export interface CffDisruption {
  id:            string
  line:          string
  type:          'retard' | 'suppression' | 'deviation' | 'travaux'
  from:          string
  to:            string
  delayMinutes?: number
  description:   string
  coordinates:   [number, number]  // [lat, lng]
  isCEVA:        boolean
}

export interface G7Impact {
  isActive:        boolean
  isWarningPeriod: boolean
  affectedLines:   string[]
  suspendedLines:  string[]
  closedAgencies:  { name: string; closedFrom: string; reopenAt: string }[]
  hotline:         string
  startDate:       string
  endDate:         string
}

export interface VehicleSplit {
  tpg: FeatureCollection
  cff: FeatureCollection
  generatedAt: string
}

export interface TransportLayerResponse {
  vehicles: {
    tpg: FeatureCollection | null
    cff: FeatureCollection | null
  }
  disruptions: {
    tpg: TpgDisruption[]
    cff: CffDisruption[]
  }
  g7: G7Impact
  generatedAt: string
  sources: {
    vehicles: string
    tpg:      string
    cff:      string
  }
}
