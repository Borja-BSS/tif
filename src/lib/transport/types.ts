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
  detectedAt?:   string            // ISO — heure du départ concerné
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
  detectedAt?:   string            // ISO — heure du départ concerné
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
  generatedAt: string
  sources: {
    vehicles: string
    tpg:      string
    cff:      string
  }
}
