'use client'

import { useEffect } from 'react'
import mapboxgl     from 'mapbox-gl'

// Identifiants pour les layers Mapbox traffic natifs
const SOURCE_ID    = 'mapbox-traffic-native'
const LAYER_FLOW   = 'tif-traffic-flow'
const LAYER_GLOW   = 'tif-traffic-glow'
const LAYER_ARROW  = 'tif-traffic-arrows'

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

      // Ligne principale — sort-key : rouge/sévère au-dessus du vert
      map.addLayer({
        id:   LAYER_FLOW,
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'traffic',
        layout: {
          'line-join': 'round',
          'line-cap':  'round',
          'line-sort-key': ['match', ['get', 'congestion'],
            'severe', 4, 'heavy', 3, 'moderate', 2, 'low', 1, 0,
          ] as unknown as mapboxgl.Expression,
        },
        paint: {
          'line-color':   CONGESTION_COLOR,
          'line-width':   ['interpolate', ['linear'], ['zoom'], 8, 2, 10, 3.5, 14, 6],
          'line-opacity': 0.95,
        },
      })

      // Flèches de direction — visibles à partir du zoom 12
      map.addLayer({
        id:   LAYER_ARROW,
        type: 'symbol',
        source: SOURCE_ID,
        'source-layer': 'traffic',
        minzoom: 12,
        layout: {
          'symbol-placement':        'line',
          'symbol-spacing':          120,
          'text-field':              '▶',
          'text-size':               ['interpolate', ['linear'], ['zoom'], 12, 9, 15, 13],
          'text-keep-upright':       false,
          'text-rotation-alignment': 'map',
          'text-pitch-alignment':    'map',
          'text-allow-overlap':      false,
        },
        paint: {
          'text-color': CONGESTION_COLOR,
          'text-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 14, 0.8],
          'text-halo-width': 0,
        },
      })
    }

    if (map.isStyleLoaded()) addTraffic()
    else map.once('style.load', addTraffic)

    return () => {
      try {
        if (map.getLayer(LAYER_ARROW)) map.removeLayer(LAYER_ARROW)
        if (map.getLayer(LAYER_FLOW))  map.removeLayer(LAYER_FLOW)
        if (map.getLayer(LAYER_GLOW))  map.removeLayer(LAYER_GLOW)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch { /* map détruite */ }
    }
  }, [map])
}
