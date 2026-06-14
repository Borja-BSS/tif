'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FilterId } from './ui/QuickFilters'
import { IMPACT_ZONES, getImpactZoneGeoJSON } from '@/data/impact-zones'
import type { ImpactZone } from '@/data/impact-zones'

interface Props {
  map:          mapboxgl.Map | null
  activeFilter: FilterId
}

const SRC_ID    = 'tif-impact-zones'
const FILL_ID   = 'tif-impact-zones-fill'
const STROKE_ID = 'tif-impact-zones-stroke'

function filterExprFor(filter: FilterId): mapboxgl.FilterSpecification | null {
  if (filter === 'alerts')  return ['==', ['get', 'type'], 'DEMONSTRATION']
  if (filter === 'transit') return ['==', ['get', 'type'], 'TRANSPORT_DISRUPTION']
  if (filter === 'all' || filter === 'g7') return ['any',
    ['==', ['get', 'type'], 'DEMONSTRATION'],
    ['==', ['get', 'type'], 'TRANSPORT_DISRUPTION'],
  ]
  return null
}

export default function ImpactZonesLayer({ map, activeFilter }: Props) {
  const [ready, setReady] = useState(false)   // useState → re-render déclenché après init
  const rafRef  = useRef<number>(0)
  const filterRef = useRef(activeFilter)
  filterRef.current = activeFilter

  // ── Pulse du contour ────────────────────────────────────────────────────────
  const startPulse = useCallback(() => {
    if (!map) return
    cancelAnimationFrame(rafRef.current)
    let tick = 0
    const loop = () => {
      tick++
      const alpha = 0.45 + 0.40 * Math.sin((tick / 72) * Math.PI)
      try { if (map.getLayer(STROKE_ID)) map.setPaintProperty(STROKE_ID, 'line-opacity', alpha) }
      catch { /* layer absent */ }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [map])

  const stopPulse = useCallback(() => cancelAnimationFrame(rafRef.current), [])

  // ── Applique visibilité + filtre (appelée après init ET à chaque filtre) ───
  const applyFilter = useCallback((filter: FilterId) => {
    if (!map) return
    const expr = filterExprFor(filter)

    if (!expr) {
      try {
        if (map.getLayer(FILL_ID))   map.setLayoutProperty(FILL_ID,   'visibility', 'none')
        if (map.getLayer(STROKE_ID)) map.setLayoutProperty(STROKE_ID, 'visibility', 'none')
      } catch { /* silencieux */ }
      stopPulse()
      return
    }

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
  }, [map, stopPulse, startPulse])

  // ── Init des layers (une seule fois) ────────────────────────────────────────
  const initLayers = useCallback(() => {
    if (!map) return
    if (map.getSource(SRC_ID)) return   // déjà initialisé (idle peut se déclencher après style.load)

    const geojson = getImpactZoneGeoJSON(IMPACT_ZONES.filter(z => z.renderOnMap !== false))

    if (!map.getSource(SRC_ID)) {
      map.addSource(SRC_ID, { type: 'geojson', data: geojson })
    }

    if (!map.getLayer(FILL_ID)) {
      map.addLayer({
        id:     FILL_ID,
        type:   'fill',
        source: SRC_ID,
        layout: { visibility: 'none' },
        paint: {
          'fill-color':   ['get', 'fillColor'],
          'fill-opacity': ['get', 'fillOpacity'],
        },
      })
    }

    if (!map.getLayer(STROKE_ID)) {
      map.addLayer({
        id:     STROKE_ID,
        type:   'line',
        source: SRC_ID,
        layout: { visibility: 'none' },
        paint: {
          'line-color':     ['get', 'strokeColor'],
          'line-width':     2.5,
          'line-opacity':   0.9,
          'line-dasharray': [5, 3],
        },
      })
    }

    map.on('click', FILL_ID, (e) => {
      if (!e.features?.length) return
      const props = e.features[0].properties as Record<string, unknown>
      const zone  = IMPACT_ZONES.find(z => z.id === props['id'])
      if (!zone) return
      window.dispatchEvent(new CustomEvent<ImpactZone>('tif:impact-zone-click', { detail: zone }))
    })
    map.on('mouseenter', FILL_ID, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', FILL_ID, () => { map.getCanvas().style.cursor = '' })

    // Applique immédiatement le filtre courant
    applyFilter(filterRef.current)

    // Déclenche un re-render → activeFilter useEffect peut s'exécuter
    setReady(true)
  }, [map, applyFilter])

  // ── Monte les layers dès que la carte est prête ──────────────────────────
  useEffect(() => {
    if (!map) return
    if (map.isStyleLoaded()) {
      initLayers()
    } else {
      map.once('style.load', initLayers)
      map.once('idle',       initLayers)
    }
  }, [map, initLayers])

  // ── Réagit aux changements de filtre (après init) ───────────────────────
  useEffect(() => {
    if (!ready || !map) return
    applyFilter(activeFilter)
  }, [ready, map, activeFilter, applyFilter])

  // ── Nettoyage ───────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopPulse()
      if (!map) return
      try {
        if (map.getLayer(FILL_ID))   map.removeLayer(FILL_ID)
        if (map.getLayer(STROKE_ID)) map.removeLayer(STROKE_ID)
        if (map.getSource(SRC_ID))   map.removeSource(SRC_ID)
      } catch { /* silencieux */ }
    }
  }, [map, stopPulse])

  return null
}
