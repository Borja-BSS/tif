import { hereGet, BBOX_IN } from './client'
import type { HereFlowResponse, HereFlowResult } from './types'

type FlowFeature = {
  type:       'Feature'
  properties: {
    jamFactor:  number
    speed:      number
    freeFlow:   number
    color:      string
    speedRatio: number
  }
  geometry: {
    type:        'LineString'
    coordinates: [number, number][]
  }
}

export type FlowFeatureCollection = {
  type:         'FeatureCollection'
  features:     FlowFeature[]
  generatedAt:  string
}

function jamColor(j: number): string {
  if (j < 2) return '#34C759'  // libre
  if (j < 4) return '#FFCC00'  // ralenti
  if (j < 7) return '#FF9500'  // congestionné
  return '#FF3B30'              // bloqué
}

export async function getTrafficFlow(): Promise<FlowFeatureCollection> {
  const data = await hereGet<HereFlowResponse>('/flow', {
    locationReferencing: 'shape',
    in:                  BBOX_IN,
    minJamFactor:        '0',
  })

  const features: FlowFeature[] = data.results.map((result: HereFlowResult): FlowFeature => {
    const jam         = result.currentFlow.jamFactor
    const coordinates = result.location.shape.links
      .flatMap(link => link.points.map((p): [number, number] => [p.lng, p.lat]))

    return {
      type:       'Feature',
      properties: {
        jamFactor:  jam,
        speed:      result.currentFlow.speed,
        freeFlow:   result.currentFlow.freeFlow,
        color:      jamColor(jam),
        speedRatio: result.currentFlow.freeFlow > 0
          ? result.currentFlow.speed / result.currentFlow.freeFlow
          : 0,
      },
      geometry: { type: 'LineString', coordinates },
    }
  })

  return { type: 'FeatureCollection', features, generatedAt: new Date().toISOString() }
}
