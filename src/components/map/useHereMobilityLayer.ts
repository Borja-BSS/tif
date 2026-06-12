'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

const SOURCE_ID = 'mapbox-traffic-native'
const ARROW_ID  = 'tif-arrow'

// Niveaux du moins grave au plus grave — l'ordre d'ajout des layers détermine le z-order.
// Green est ajouté en premier (en dessous), severe en dernier (au-dessus de tout).
const LEVELS = [
  {
    congestion:   'low',
    color:        '#30D158',
    widthFactor:  1.0,
    glowOpacity:  0.18,
    flowOpacity:  0.90,
  },
  {
    congestion:   'moderate',
    color:        '#FF9F0A',
    widthFactor:  1.35,
    glowOpacity:  0.30,
    flowOpacity:  0.97,
  },
  {
    congestion:   'heavy',
    color:        '#FF453A',
    widthFactor:  1.65,
    glowOpacity:  0.40,
    flowOpacity:  1.0,
  },
  {
    congestion:   'severe',
    color:        '#FF2D55',
    widthFactor:  1.90,
    glowOpacity:  0.50,
    flowOpacity:  1.0,
  },
] as const

function glowId(c: string) { return `tif-glow-${c}` }
function flowId(c: string) { return `tif-flow-${c}` }
function arrowId(c: string) { return `tif-arrow-${c}` }

const ALL_LAYER_IDS = LEVELS.flatMap(l => [glowId(l.congestion), flowId(l.congestion), arrowId(l.congestion)])

function applyVis(map: mapboxgl.Map, visible: boolean) {
  const v = visible ? 'visible' : 'none'
  for (const id of ALL_LAYER_IDS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v)
  }
}

// Layers qu'on doit garder au-dessus des routes de trafic
const TOP_LAYERS = [
  'tif-border-shadow', 'tif-border-dot', 'tif-border-icon',
  'user-location-accuracy', 'user-location-dot',
]

function bringTopLayersAbove(map: mapboxgl.Map) {
  TOP_LAYERS.forEach(id => {
    try { if (map.getLayer(id)) map.moveLayer(id) } catch {}
  })
}

export function useHereMobilityLayer(map: mapboxgl.Map | null, visible: boolean) {
  const visRef = useRef(visible)
  visRef.current = visible

  useEffect(() => {
    if (!map) return
    let active = true

    const setup = () => {
      if (!active) return
      // Déjà initialisé — juste réappliquer la visibilité
      if (map.getLayer(flowId('low'))) {
        applyVis(map, visRef.current)
        return
      }

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: 'vector', url: 'mapbox://mapbox.mapbox-traffic-v1' })
      }

      // Ajouter les layers du MOINS grave au PLUS grave.
      // Chaque niveau suivant est dessiné PAR-DESSUS le précédent.
      for (const lvl of LEVELS) {
        const filter = ['==', ['get', 'congestion'], lvl.congestion] as mapboxgl.Expression

        // 1. Halo / glow (flou) — sous le trait net
        map.addLayer({
          id: glowId(lvl.congestion),
          type: 'line',
          source: SOURCE_ID,
          'source-layer': 'traffic',
          filter,
          layout: { 'line-join': 'round', 'line-cap': 'round', visibility: 'none' },
          paint: {
            'line-color':   lvl.color,
            'line-width':   ['interpolate', ['linear'], ['zoom'],
              8,  5  * lvl.widthFactor,
              10, 8  * lvl.widthFactor,
              14, 14 * lvl.widthFactor,
            ] as mapboxgl.Expression,
            'line-opacity': lvl.glowOpacity,
            'line-blur':    4,
          },
        })

        // 2. Trait net — couche principale colorée
        map.addLayer({
          id: flowId(lvl.congestion),
          type: 'line',
          source: SOURCE_ID,
          'source-layer': 'traffic',
          filter,
          layout: { 'line-join': 'round', 'line-cap': 'round', visibility: 'none' },
          paint: {
            'line-color':   lvl.color,
            'line-width':   ['interpolate', ['linear'], ['zoom'],
              8,  2   * lvl.widthFactor,
              10, 3.5 * lvl.widthFactor,
              14, 6   * lvl.widthFactor,
            ] as mapboxgl.Expression,
            'line-opacity': lvl.flowOpacity,
          },
        })
      }

      bringTopLayersAbove(map)

      // Flèches — ajoutées après toutes les couches de trafic
      const addArrows = () => {
        if (!active) return
        for (const lvl of LEVELS) {
          if (map.getLayer(arrowId(lvl.congestion))) continue
          map.addLayer({
            id: arrowId(lvl.congestion),
            type: 'symbol',
            source: SOURCE_ID,
            'source-layer': 'traffic',
            filter: ['==', ['get', 'congestion'], lvl.congestion] as mapboxgl.Expression,
            minzoom: 11,
            layout: {
              'symbol-placement':        'line',
              'symbol-spacing':          120,
              'icon-image':              ARROW_ID,
              'icon-size':               ['interpolate', ['linear'], ['zoom'], 11, 0.4, 14, 0.65] as mapboxgl.Expression,
              'icon-keep-upright':       false,
              'icon-rotation-alignment': 'map',
              'icon-allow-overlap':      false,
              visibility:                'none',
            },
            paint: {
              'icon-color':   lvl.color,
              'icon-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 14, 0.75] as mapboxgl.Expression,
            },
          })
        }
        bringTopLayersAbove(map)
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
          addArrows()
        }
        img.onerror = () => URL.revokeObjectURL(url)
        img.src = url
      } else {
        addArrows()
      }

      applyVis(map, visRef.current)
    }

    const onStyleLoad = () => { map.off('style.load', onStyleLoad); setup() }
    const onIdle      = () => { map.off('idle', onIdle); if (!map.getLayer(flowId('low'))) setup() }

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
      applyVis(map, false)
    }
  }, [map])

  useEffect(() => {
    if (!map) return
    applyVis(map, visible)
  }, [map, visible])
}
