'use client'

import { useEffect } from 'react'
import mapboxgl     from 'mapbox-gl'

const SOURCE_ID    = 'mapbox-traffic-native'
const LAYER_FLOW   = 'tif-traffic-flow'
const LAYER_GLOW   = 'tif-traffic-glow'
const LAYER_ARROW  = 'tif-traffic-arrows'

const CONGESTION_COLOR = [
  'match', ['get', 'congestion'],
  'low',      '#30D158',
  'moderate', '#FF9F0A',
  'heavy',    '#FF453A',
  'severe',   '#FF2D55',
  '#30D158',
] as unknown as mapboxgl.Expression

export function useHereMobilityLayer(map: mapboxgl.Map | null) {
  useEffect(() => {
    if (!map) return

    let cancelled = false

    const addTraffic = () => {
      if (cancelled || map.getLayer(LAYER_FLOW)) return

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'vector',
          url:  'mapbox://mapbox.mapbox-traffic-v1',
        })
      }

      if (!map.getLayer(LAYER_GLOW)) {
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
      }

      if (!map.getLayer(LAYER_FLOW)) {
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
      }

      ;['tif-border-shadow','tif-border-dot','tif-border-icon',
        'user-location-accuracy','user-location-dot'].forEach(id => {
        try { if (map.getLayer(id)) map.moveLayer(id) } catch {}
      })

      const ARROW_ID = 'tif-arrow'
      function addArrowLayer() {
        if (cancelled || !map || map.getLayer(LAYER_ARROW)) return
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
            'symbol-placement':        'line',
            'symbol-spacing':          100,
            'icon-image':              ARROW_ID,
            'icon-size':               ['interpolate', ['linear'], ['zoom'], 11, 0.4, 14, 0.65],
            'icon-keep-upright':       false,
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap':      false,
          },
          paint: {
            'icon-color':   CONGESTION_COLOR,
            'icon-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 14, 0.75],
          },
        })
      }

      if (!map.hasImage(ARROW_ID)) {
        const size = 24
        const svg  = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><polygon points="6,4 18,12 6,20" fill="white" opacity="0.85"/></svg>`
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const url  = URL.createObjectURL(blob)
        const img  = new Image(size, size)
        img.onload = () => {
          URL.revokeObjectURL(url)
          if (cancelled) return
          if (!map.hasImage(ARROW_ID)) map.addImage(ARROW_ID, img, { sdf: true })
          addArrowLayer()
        }
        img.onerror = () => URL.revokeObjectURL(url)
        img.src = url
      } else {
        addArrowLayer()
      }
    }

    // Listener nommé pour pouvoir l'enlever au cleanup
    const onStyleLoad = () => addTraffic()
    const onIdle      = () => { if (!map.getLayer(LAYER_FLOW)) addTraffic() }

    if (map.isStyleLoaded()) {
      addTraffic()
    } else {
      map.once('style.load', onStyleLoad)
    }
    map.once('idle', onIdle)

    return () => {
      cancelled = true
      // Supprime les listeners en attente — évite les callbacks stales après cleanup
      map.off('style.load', onStyleLoad)
      map.off('idle',       onIdle)
      try {
        if (map.getLayer(LAYER_ARROW)) map.removeLayer(LAYER_ARROW)
        if (map.getLayer(LAYER_FLOW))  map.removeLayer(LAYER_FLOW)
        if (map.getLayer(LAYER_GLOW))  map.removeLayer(LAYER_GLOW)
        if (map.getSource(SOURCE_ID))  map.removeSource(SOURCE_ID)
      } catch { /* map détruite */ }
    }
  }, [map])
}
