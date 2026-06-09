'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

const SOURCE_ID   = 'mapbox-traffic-native'
const LAYER_FLOW  = 'tif-traffic-flow'
const LAYER_GLOW  = 'tif-traffic-glow'
const LAYER_ARROW = 'tif-traffic-arrows'
const ARROW_ID    = 'tif-arrow'

const CONGESTION_COLOR = [
  'match', ['get', 'congestion'],
  'low',      '#30D158',
  'moderate', '#FF9F0A',
  'heavy',    '#FF453A',
  'severe',   '#FF2D55',
  '#30D158',
] as unknown as mapboxgl.Expression

function applyVis(map: mapboxgl.Map, visible: boolean) {
  const v = visible ? 'visible' : 'none'
  for (const id of [LAYER_GLOW, LAYER_FLOW, LAYER_ARROW]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v)
  }
}

// Nouveau contrat : reçoit toujours la map + un booléen visible
// Les layers sont ajoutés une seule fois et ne sont JAMAIS supprimés —
// seule leur visibilité change. Élimine tous les problèmes de timing.
export function useHereMobilityLayer(map: mapboxgl.Map | null, visible: boolean) {
  const visRef = useRef(visible)
  visRef.current = visible

  // ── Setup : ajout unique des layers au chargement de la carte ─────────────
  useEffect(() => {
    if (!map) return

    let active = true   // empêche les callbacks async après démontage

    const setup = () => {
      if (!active || map.getLayer(LAYER_FLOW)) {
        applyVis(map, visRef.current)
        return
      }

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: 'vector', url: 'mapbox://mapbox.mapbox-traffic-v1' })
      }

      map.addLayer({
        id: LAYER_GLOW, type: 'line', source: SOURCE_ID, 'source-layer': 'traffic',
        layout: { 'line-join': 'round', 'line-cap': 'round', visibility: 'none' },
        paint: {
          'line-color':   CONGESTION_COLOR,
          'line-width':   ['interpolate', ['linear'], ['zoom'], 8, 5, 10, 8, 14, 14],
          'line-opacity': 0.30,
          'line-blur':    4,
        },
      })

      map.addLayer({
        id: LAYER_FLOW, type: 'line', source: SOURCE_ID, 'source-layer': 'traffic',
        layout: {
          'line-join': 'round', 'line-cap': 'round', visibility: 'none',
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

      ;['tif-border-shadow','tif-border-dot','tif-border-icon',
        'user-location-accuracy','user-location-dot'].forEach(id => {
        try { if (map.getLayer(id)) map.moveLayer(id) } catch {}
      })

      const addArrow = () => {
        if (!active || map.getLayer(LAYER_ARROW)) return
        ;['tif-border-shadow','tif-border-dot','tif-border-icon',
          'user-location-accuracy','user-location-dot'].forEach(id => {
          try { if (map.getLayer(id)) map.moveLayer(id) } catch {}
        })
        map.addLayer({
          id: LAYER_ARROW, type: 'symbol', source: SOURCE_ID, 'source-layer': 'traffic',
          minzoom: 11,
          layout: {
            'symbol-placement': 'line', 'symbol-spacing': 100,
            'icon-image': ARROW_ID,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 14, 0.65],
            'icon-keep-upright': false, 'icon-rotation-alignment': 'map',
            'icon-allow-overlap': false, visibility: 'none',
          },
          paint: {
            'icon-color':   CONGESTION_COLOR,
            'icon-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 14, 0.75],
          },
        })
        applyVis(map, visRef.current)
      }

      if (!map.hasImage(ARROW_ID)) {
        const size = 24
        const svg  = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><polygon points="6,4 18,12 6,20" fill="white" opacity="0.85"/></svg>`
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const url  = URL.createObjectURL(blob)
        const img  = new Image(size, size)
        img.onload = () => {
          URL.revokeObjectURL(url)
          if (!active) return
          if (!map.hasImage(ARROW_ID)) map.addImage(ARROW_ID, img, { sdf: true })
          addArrow()
        }
        img.onerror = () => URL.revokeObjectURL(url)
        img.src = url
      } else {
        addArrow()
      }

      applyVis(map, visRef.current)
    }

    // map.on (pas once) pour que map.off fonctionne vraiment au cleanup
    const onStyleLoad = () => { map.off('style.load', onStyleLoad); setup() }
    const onIdle      = () => { map.off('idle', onIdle); if (!map.getLayer(LAYER_FLOW)) setup() }

    if (map.isStyleLoaded()) {
      setup()
    } else {
      map.on('style.load', onStyleLoad)
    }
    map.on('idle', onIdle)

    return () => {
      active = false
      map.off('style.load', onStyleLoad)
      map.off('idle',       onIdle)
      // Layers laissés sur la carte — uniquement cachés
      applyVis(map, false)
    }
  }, [map])

  // ── Visibilité : s'applique instantanément à chaque changement de filtre ──
  useEffect(() => {
    if (!map) return
    applyVis(map, visible)
  }, [map, visible])
}
