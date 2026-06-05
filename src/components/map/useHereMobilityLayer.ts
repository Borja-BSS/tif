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

      // Halo lumineux (visible même à zoom 9)
      map.addLayer({
        id:   LAYER_GLOW,
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'traffic',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color':   CONGESTION_COLOR,
          'line-width':   ['interpolate', ['linear'], ['zoom'], 8, 5, 10, 8, 14, 14],
          'line-opacity': 0.30,
          'line-blur':    4,
        },
      })

      // Ligne principale — épaisseur doublée à zoom 9 pour lisibilité Grand Genève
      map.addLayer({
        id:   LAYER_FLOW,
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'traffic',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color':   CONGESTION_COLOR,
          'line-width':   ['interpolate', ['linear'], ['zoom'], 8, 2, 10, 3.5, 14, 6],
          'line-opacity': 0.95,
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
