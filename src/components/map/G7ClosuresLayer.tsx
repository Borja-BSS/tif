'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { G7_ROAD_CLOSURES } from '@/data/g7-road-closures'
import type { FeatureCollection } from 'geojson'

interface Props { map: mapboxgl.Map | null }

const SOURCE_ID    = 'tif-g7-closures'
const LAYER_GLOW   = 'tif-g7c-glow'
const LAYER_BASE   = 'tif-g7c-base'
const LAYER_HATCH  = 'tif-g7c-hatch'
const LAYER_CASING = 'tif-g7c-casing'

// ── Layer management ──────────────────────────────────────────────────────────
function addLayers(m: mapboxgl.Map) {
  m.addLayer({
    id: LAYER_GLOW, type: 'line', source: SOURCE_ID,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color':   '#FF3B30',
      'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 10, 13, 18, 16, 26],
      'line-opacity': 0.18,
      'line-blur':    4,
    },
  })
  m.addLayer({
    id: LAYER_BASE, type: 'line', source: SOURCE_ID,
    layout: { 'line-join': 'round', 'line-cap': 'butt' },
    paint: {
      'line-color':   '#FF3B30',
      'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 5, 13, 9, 16, 14],
      'line-opacity': 0.92,
    },
  })
  m.addLayer({
    id: LAYER_HATCH, type: 'line', source: SOURCE_ID,
    layout: { 'line-join': 'round', 'line-cap': 'butt' },
    paint: {
      'line-color':      '#FFFFFF',
      'line-width':      ['interpolate', ['linear'], ['zoom'], 9, 2, 13, 3.5, 16, 5],
      'line-opacity':    0.9,
      'line-dasharray':  [2.5, 2.5],
    },
  })
  m.addLayer({
    id: LAYER_CASING, type: 'line', source: SOURCE_ID,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color':       'rgba(0,0,0,0.5)',
      'line-width':       ['interpolate', ['linear'], ['zoom'], 9, 7, 13, 12, 16, 18],
      'line-opacity':     0.4,
      'line-gap-width':   ['interpolate', ['linear'], ['zoom'], 9, 5, 13, 9, 16, 14],
    },
  }, LAYER_GLOW)
}

function removeLayers(m: mapboxgl.Map) {
  for (const id of [LAYER_HATCH, LAYER_BASE, LAYER_CASING, LAYER_GLOW]) {
    if (m.getLayer(id)) m.removeLayer(id)
  }
  if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID)
}

// ── Build active GeoJSON from static data ─────────────────────────────────────
function buildActiveGeoJSON(): FeatureCollection {
  const now = Date.now()
  return {
    type: 'FeatureCollection',
    features: G7_ROAD_CLOSURES.filter(f => {
      const from = new Date(f.properties.startTime).getTime()
      const to   = new Date(f.properties.endTime).getTime()
      return now >= from && now <= to
    }),
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function G7ClosuresLayer({ map }: Props) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!map) return

    const applyData = () => {
      const geojson = buildActiveGeoJSON()
      if (geojson.features.length === 0) {
        removeLayers(map)
        return
      }
      const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      if (src) {
        src.setData(geojson)
      } else {
        map.addSource(SOURCE_ID, { type: 'geojson', data: geojson, tolerance: 0.5 })
        addLayers(map)
      }
    }

    if (map.loaded()) applyData()
    else map.once('load', applyData)

    // Re-évalue toutes les minutes (pour les fermetures avec horaires précis)
    intervalRef.current = setInterval(applyData, 60_000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      try { removeLayers(map) } catch { /* map détruite */ }
    }
  }, [map])

  return null
}
