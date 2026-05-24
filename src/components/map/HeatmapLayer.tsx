'use client'

import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'

export interface HeatmapPoint {
  lng: number
  lat: number
  weight?: number // 0–1, défaut 1
}

interface HeatmapLayerProps {
  map: mapboxgl.Map | null
  points: HeatmapPoint[]
  id?: string
}

export default function HeatmapLayer({ map, points, id = 'tif-heatmap' }: HeatmapLayerProps) {
  useEffect(() => {
    if (!map) return

    const sourceId = `${id}-source`

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: points.map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { weight: p.weight ?? 1 },
      })),
    }

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojson)
      return
    }

    map.addSource(sourceId, { type: 'geojson', data: geojson })

    map.addLayer({
      id,
      type: 'heatmap',
      source: sourceId,
      maxzoom: 15,
      paint: {
        'heatmap-weight':    ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0,    'rgba(0,0,255,0)',
          0.2,  'rgba(0,122,255,0.4)',
          0.5,  'rgba(0,180,255,0.7)',
          0.8,  'rgba(100,210,255,0.9)',
          1,    'rgba(255,255,255,1)',
        ],
        'heatmap-radius':   ['interpolate', ['linear'], ['zoom'], 0, 4, 15, 30],
        'heatmap-opacity':  ['interpolate', ['linear'], ['zoom'], 13, 0.8, 15, 0],
      },
    })

    return () => {
      if (map.getLayer(id))     map.removeLayer(id)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
    }
  }, [map, points, id])

  return null
}
