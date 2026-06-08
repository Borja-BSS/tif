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

      // Points toujours au-dessus des lignes trafic
      ;['tif-border-shadow','tif-border-dot','tif-border-icon',
        'user-location-accuracy','user-location-dot'].forEach(id => {
        try { if (map.getLayer(id)) map.moveLayer(id) } catch {}
      })

      // Flèches de direction via image SVG — ▶ n'est pas dans la police Mapbox GL
      const ARROW_ID = 'tif-arrow'
      if (!map.hasImage(ARROW_ID)) {
        const size = 24
        const svg  = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><polygon points="6,4 18,12 6,20" fill="white" opacity="0.85"/></svg>`
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const url  = URL.createObjectURL(blob)
        const img  = new Image(size, size)
        img.onload = () => {
          if (!map.hasImage(ARROW_ID)) map.addImage(ARROW_ID, img, { sdf: true })
          URL.revokeObjectURL(url)
          if (!map.getLayer(LAYER_ARROW)) addArrowLayer()
        }
        img.onerror = () => URL.revokeObjectURL(url)
        img.src = url
      } else {
        addArrowLayer()
      }

      function addArrowLayer() {
        if (!map || map.getLayer(LAYER_ARROW)) return
        // Points au-dessus des flèches trafic
        ;['tif-border-shadow','tif-border-dot','tif-border-icon',
          'user-location-accuracy','user-location-dot'].forEach(id => {
          try { if (map.getLayer(id)) map.moveLayer(id) } catch {}
        })
        map.addLayer({
          id:   LAYER_ARROW,
          type: 'symbol',
          source: SOURCE_ID,
          'source-layer': 'traffic',
          minzoom: 11,
          layout: {
            'symbol-placement':    'line',
            'symbol-spacing':      100,
            'icon-image':          ARROW_ID,
            'icon-size':           ['interpolate', ['linear'], ['zoom'], 11, 0.4, 14, 0.65],
            'icon-keep-upright':   false,
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap':  false,
          },
          paint: {
            'icon-color':   CONGESTION_COLOR,
            'icon-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 14, 0.75],
          },
        })
      }
    }

    // Fallback multi-event : style.load peut avoir déjà tiré quand cet effet s'exécute
    if (map.isStyleLoaded()) {
      addTraffic()
    } else {
      map.once('style.load', addTraffic)
    }
    // Garantie : si les deux ont raté, on réessaie au premier idle
    map.once('idle', () => {
      if (!map.getLayer(LAYER_FLOW)) addTraffic()
    })

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
