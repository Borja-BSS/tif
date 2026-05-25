import { hereGet, BBOX_IN } from './client'
import type { HereIncidentsResponse, HereIncidentDetails, HereMainType, HereCriticality } from './types'

type IncidentFeature = {
  type:       'Feature'
  properties: {
    id:          string
    type:        HereMainType
    criticality: HereCriticality
    description: string
    icon:        string
    color:       string
    startTime:   string
    endTime:     string | null
  }
  geometry: {
    type:        'Point'
    coordinates: [number, number]
  }
}

export type IncidentFeatureCollection = {
  type:        'FeatureCollection'
  features:    IncidentFeature[]
  generatedAt: string
}

const ICON: Record<HereMainType, string> = {
  accident:         '🚨',
  congestion:       '🚦',
  construction:     '🚧',
  disabledVehicle:  '🚗',
  roadClosure:      '🚫',
  massTransit:      '🚌',
  weatherCondition: '⛈',
  plannedEvent:     '📌',
  misc:             '⚠️',
}

const SEVERITY_COLOR: Record<HereCriticality, string> = {
  critical:  '#FF3B30',
  major:     '#FF9500',
  minor:     '#FFCC00',
  lowImpact: '#8E8E93',
}

function mapIncident(inc: HereIncidentDetails): IncidentFeature | null {
  const firstPoint = inc.location.shape.links[0]?.points[0]
  if (!firstPoint) return null

  const description =
    inc.description.find(d => d.language === 'fr')?.value ??
    inc.description[0]?.value ??
    'Incident signalé'

  return {
    type:       'Feature',
    properties: {
      id:          inc.id,
      type:        inc.type.mainType,
      criticality: inc.criticality,
      description,
      icon:        ICON[inc.type.mainType],
      color:       SEVERITY_COLOR[inc.criticality],
      startTime:   inc.startTime,
      endTime:     inc.endTime ?? null,
    },
    geometry: { type: 'Point', coordinates: [firstPoint.lng, firstPoint.lat] },
  }
}

export async function getIncidents(): Promise<IncidentFeatureCollection> {
  const data = await hereGet<HereIncidentsResponse>('/incidents', {
    locationReferencing: 'shape',
    in:                  BBOX_IN,
  })

  const features: IncidentFeature[] = data.results
    .map(({ incidentDetails }): IncidentFeature | null => mapIncident(incidentDetails))
    .filter((f): f is IncidentFeature => f !== null)

  return { type: 'FeatureCollection', features, generatedAt: new Date().toISOString() }
}
