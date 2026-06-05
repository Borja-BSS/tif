'use client'

import { useEffect } from 'react'
import mapboxgl     from 'mapbox-gl'

// Identifiants pour les layers Mapbox traffic natifs
const SOURCE_ID    = 'mapbox-traffic-native'
const LAYER_FLOW   = 'tif-traffic-flow'
const LAYER_GLOW   = 'tif-traffic-glow'

// Palette couleurs cohérente avec le design system TIF
const CONGESTION_COLOR = [
  'match', ['get', 'congestion'],
  'low',      '#30D158',  // vert
  'moderate', '#FF9F0A',  // orange
  'heavy',    '#FF453A',  // rouge
  'severe',   '#FF2D55',  // rouge foncé
  '#30D158',
] as unknown as mapboxgl.Expression

export function useHereMobilityLayer(map: mapboxgl.Map | null) {
  useEffect(() => {
    if (!map) return

    const addTraffic = () => {
      // Évite les doublons si le hook est appelé plusieurs fois
      if (map.getLayer(LAYER_FLOW)) return

      // Tuiles Mapbox traffic — servies depuis CDN Mapbox, chargement < 1s
      // Aucun appel API externe, aucune dépendance HERE Maps
      map.addSource(SOURCE_ID, {
        type: 'vector',
        url:  'mapbox://mapbox.mapbox-traffic-v1',
      })

      // Halo lumineux sous les lignes (effet de profondeur)
      map.addLayer({
        id:   LAYER_GLOW,
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'traffic',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color':   CONGESTION_COLOR,
          'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 4, 12, 8, 15, 14],
          'line-opacity': 0.25,
          'line-blur':    3,
        },
      })

      // Ligne principale traffic
      map.addLayer({
        id:   LAYER_FLOW,
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'traffic',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color':   CONGESTION_COLOR,
          'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 1.5, 12, 3.5, 15, 6],
          'line-opacity': 0.9,
        },
      })
    }

    if (map.isStyleLoaded()) addTraffic()
    else map.once('style.load', addTraffic)

    return () => {
      try {
        if (map.getLayer(LAYER_FLOW)) map.removeLayer(LAYER_FLOW)
        if (map.getLayer(LAYER_GLOW)) map.removeLayer(LAYER_GLOW)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch { /* map détruite */ }
    }
  }, [map])
}
