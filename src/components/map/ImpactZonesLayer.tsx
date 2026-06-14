'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FilterId } from './ui/QuickFilters'
import { IMPACT_ZONES, getImpactZoneGeoJSON, getImpactRoadGeoJSON } from '@/data/impact-zones'
import type { ImpactZone } from '@/data/impact-zones'

interface Props {
  map:          mapboxgl.Map | null
  activeFilter: FilterId
}

const SRC_ID      = 'tif-impact-zones'
const FILL_ID     = 'tif-impact-zones-fill'
const STROKE_ID   = 'tif-impact-zones-stroke'
const ROAD_SRC    = 'tif-impact-roads'
const ROAD_ID     = 'tif-impact-roads-line'
const ROAD_GLOW   = 'tif-impact-roads-glow'

// Filtres pour les zones polygonales
function filterExprFor(filter: FilterId): mapboxgl.FilterSpecification | null {
  if (filter === 'alerts')  return ['==', ['get', 'type'], 'DEMONSTRATION']
  if (filter === 'transit') return ['==', ['get', 'type'], 'TRANSPORT_DISRUPTION']
  if (filter === 'all' || filter === 'g7') return ['any',
    ['==', ['get', 'type'], 'DEMONSTRATION'],
    ['==', ['get', 'type'], 'TRANSPORT_DISRUPTION'],
  ]
  return null
}

// La A1 est visible dans : all, traffic, g7, alerts
function roadVisible(filter: FilterId): boolean {
  return filter === 'all' || filter === 'traffic' || filter === 'g7' || filter === 'alerts'
}

export default function ImpactZonesLayer({ map, activeFilter }: Props) {
  const [ready, setReady] = useState(false)
  const rafRef    = useRef<number>(0)
  const roadRafRef = useRef<number>(0)
  const filterRef = useRef(activeFilter)
  filterRef.current = activeFilter

  // ── Pulse contour zones polygonales ─────────────────────────────────────────
  const startPulse = useCallback(() => {
    if (!map) return
    cancelAnimationFrame(rafRef.current)
    let tick = 0
    const loop = () => {
      tick++
      const alpha = 0.45 + 0.40 * Math.sin((tick / 72) * Math.PI)
      try { if (map.getLayer(STROKE_ID)) map.setPaintProperty(STROKE_ID, 'line-opacity', alpha) }
      catch { /* silencieux */ }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [map])

  const stopPulse = useCallback(() => cancelAnimationFrame(rafRef.current), [])

  // ── Pulse ligne A1 ───────────────────────────────────────────────────────────
  const startRoadPulse = useCallback(() => {
    if (!map) return
    cancelAnimationFrame(roadRafRef.current)
    let tick = 0
    const loop = () => {
      tick++
      const alpha = 0.55 + 0.40 * Math.sin((tick / 60) * Math.PI)
      try {
        if (map.getLayer(ROAD_ID))   map.setPaintProperty(ROAD_ID,   'line-opacity', alpha)
        if (map.getLayer(ROAD_GLOW)) map.setPaintProperty(ROAD_GLOW, 'line-opacity', alpha * 0.3)
      } catch { /* silencieux */ }
      roadRafRef.current = requestAnimationFrame(loop)
    }
    roadRafRef.current = requestAnimationFrame(loop)
  }, [map])

  const stopRoadPulse = useCallback(() => cancelAnimationFrame(roadRafRef.current), [])

  // ── Applique visibilité + filtre polygones ───────────────────────────────────
  const applyFilter = useCallback((filter: FilterId) => {
    if (!map) return
    const expr = filterExprFor(filter)

    if (!expr) {
      try {
        if (map.getLayer(FILL_ID))   map.setLayoutProperty(FILL_ID,   'visibility', 'none')
        if (map.getLayer(STROKE_ID)) map.setLayoutProperty(STROKE_ID, 'visibility', 'none')
      } catch { /* silencieux */ }
      stopPulse()
    } else {
      try {
        if (map.getLayer(FILL_ID)) {
          map.setFilter(FILL_ID,   expr)
          map.setFilter(STROKE_ID, expr)
          map.setLayoutProperty(FILL_ID,   'visibility', 'visible')
          map.setLayoutProperty(STROKE_ID, 'visibility', 'visible')
        }
      } catch { /* silencieux */ }
      stopPulse()
      startPulse()
    }

    // Ligne A1
    const showRoad = roadVisible(filter)
    try {
      if (map.getLayer(ROAD_ID))   map.setLayoutProperty(ROAD_ID,   'visibility', showRoad ? 'visible' : 'none')
      if (map.getLayer(ROAD_GLOW)) map.setLayoutProperty(ROAD_GLOW, 'visibility', showRoad ? 'visible' : 'none')
    } catch { /* silencieux */ }
    if (showRoad) { stopRoadPulse(); startRoadPulse() } else { stopRoadPulse() }
  }, [map, stopPulse, startPulse, stopRoadPulse, startRoadPulse])

  // ── Init layers ──────────────────────────────────────────────────────────────
  const initLayers = useCallback(() => {
    if (!map) return
    if (map.getSource(SRC_ID)) return   // déjà initialisé

    // ── Zones polygonales ────────────────────────────────────────────────────
    const geojson = getImpactZoneGeoJSON(IMPACT_ZONES.filter(z => z.renderOnMap !== false))
    map.addSource(SRC_ID, { type: 'geojson', data: geojson })

    map.addLayer({
      id: FILL_ID, type: 'fill', source: SRC_ID,
      layout: { visibility: 'none' },
      paint: { 'fill-color': ['get', 'fillColor'], 'fill-opacity': ['get', 'fillOpacity'] },
    })
    map.addLayer({
      id: STROKE_ID, type: 'line', source: SRC_ID,
      layout: { visibility: 'none' },
      paint: {
        'line-color': ['get', 'strokeColor'], 'line-width': 2.5,
        'line-opacity': 0.9, 'line-dasharray': [5, 3],
      },
    })

    map.on('click', FILL_ID, (e) => {
      if (!e.features?.length) return
      const props = e.features[0].properties as Record<string, unknown>
      const zone  = IMPACT_ZONES.find(z => z.id === props['id'])
      if (!zone) return
      window.dispatchEvent(new CustomEvent<ImpactZone>('tif:impact-zone-click', { detail: zone }))
    })
    map.on('mouseenter', FILL_ID, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', FILL_ID, () => { map.getCanvas().style.cursor = '' })

    // ── Ligne A1 (LineString) ────────────────────────────────────────────────
    const roadGeo = getImpactRoadGeoJSON(IMPACT_ZONES)
    map.addSource(ROAD_SRC, { type: 'geojson', data: roadGeo })

    // Halo large rouge (effet glow)
    map.addLayer({
      id: ROAD_GLOW, type: 'line', source: ROAD_SRC,
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#FF453A', 'line-width': 18, 'line-opacity': 0.15, 'line-blur': 6 },
    })
    // Ligne principale — tirets rouges épais
    map.addLayer({
      id: ROAD_ID, type: 'line', source: ROAD_SRC,
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color':     '#FF453A',
        'line-width':     6,
        'line-opacity':   0.9,
        'line-dasharray': [2, 1.5],
      },
    })

    map.on('click', ROAD_ID, (e) => {
      if (!e.features?.length) return
      const props = e.features[0].properties as Record<string, unknown>
      const zone  = IMPACT_ZONES.find(z => z.id === props['id'])
      if (!zone) return
      window.dispatchEvent(new CustomEvent<ImpactZone>('tif:impact-zone-click', { detail: zone }))
    })
    map.on('mouseenter', ROAD_ID, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', ROAD_ID, () => { map.getCanvas().style.cursor = '' })

    applyFilter(filterRef.current)
    setReady(true)
  }, [map, applyFilter])

  useEffect(() => {
    if (!map) return
    if (map.isStyleLoaded()) { initLayers() }
    else { map.once('style.load', initLayers); map.once('idle', initLayers) }
  }, [map, initLayers])

  useEffect(() => {
    if (!ready || !map) return
    applyFilter(activeFilter)
  }, [ready, map, activeFilter, applyFilter])

  useEffect(() => {
    return () => {
      stopPulse(); stopRoadPulse()
      if (!map) return
      try {
        if (map.getLayer(FILL_ID))   map.removeLayer(FILL_ID)
        if (map.getLayer(STROKE_ID)) map.removeLayer(STROKE_ID)
        if (map.getSource(SRC_ID))   map.removeSource(SRC_ID)
        if (map.getLayer(ROAD_GLOW)) map.removeLayer(ROAD_GLOW)
        if (map.getLayer(ROAD_ID))   map.removeLayer(ROAD_ID)
        if (map.getSource(ROAD_SRC)) map.removeSource(ROAD_SRC)
      } catch { /* silencieux */ }
    }
  }, [map, stopPulse, stopRoadPulse])

  return null
}
