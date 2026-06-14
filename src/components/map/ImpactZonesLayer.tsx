'use client'

import { useEffect, useRef, useCallback } from 'react'
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

// Filtres Mapbox par type de zone
const DEMO_FILTER  = ['==', ['get', 'type'], 'DEMONSTRATION'] as mapboxgl.Expression
const TPG_FILTER   = ['==', ['get', 'type'], 'TRANSPORT_DISRUPTION'] as mapboxgl.Expression
const ALL_FILTER   = ['any', DEMO_FILTER, TPG_FILTER] as mapboxgl.Expression

export default function ImpactZonesLayer({ map, activeFilter }: Props) {
  const initRef = useRef(false)
  const rafRef  = useRef<number>(0)

  // Détermine quelles zones afficher selon le filtre actif
  const getFilterExpr = useCallback((filter: FilterId): mapboxgl.Expression | undefined => {
    if (filter === 'alerts')  return ['any', DEMO_FILTER]
    if (filter === 'transit') return ['any', TPG_FILTER]
    if (filter === 'all')     return ALL_FILTER
    if (filter === 'g7')      return ALL_FILTER
    return undefined
  }, [])

  // Animation pulsante sur le stroke via RAF
  const startPulse = useCallback(() => {
    if (!map) return
    let tick = 0

    const animate = () => {
      tick++
      // Sinusoïde lente : période ~2.4s (144 frames à 60fps)
      const alpha = 0.45 + 0.40 * Math.sin((tick / 72) * Math.PI)
      try {
        if (map.getLayer(STROKE_ID)) {
          map.setPaintProperty(STROKE_ID, 'line-opacity', alpha)
        }
      } catch { /* layer retiré */ }
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
  }, [map])

  const stopPulse = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
  }, [])

  // Init layers Mapbox
  const initLayers = useCallback(() => {
    if (!map || initRef.current) return

    // Données — toutes les zones (filtrées côté Mapbox via expressions)
    const geojson = getImpactZoneGeoJSON(IMPACT_ZONES)

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
          'line-width':     2,
          'line-opacity':   0.85,
          'line-dasharray': [5, 3],
        },
      })
    }

    // Clic sur la zone → dispatch event vers BottomSheet
    map.on('click', FILL_ID, (e) => {
      if (!e.features?.length) return
      const props = e.features[0].properties as Record<string, unknown>

      // Retrouver la zone complète depuis les données statiques
      const zone = IMPACT_ZONES.find(z => z.id === props.id)
      if (!zone) return

      window.dispatchEvent(new CustomEvent<ImpactZone>('tif:impact-zone-click', { detail: zone }))
    })

    map.on('mouseenter', FILL_ID, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', FILL_ID, () => { map.getCanvas().style.cursor = '' })

    initRef.current = true
  }, [map])

  // Init au chargement de la carte
  useEffect(() => {
    if (!map) return

    if (map.isStyleLoaded()) {
      initLayers()
    } else {
      map.once('style.load', initLayers)
    }
    map.once('idle', () => { if (!initRef.current) initLayers() })
  }, [map, initLayers])

  // Réactivité au filtre — affiche/masque + filtre Mapbox
  useEffect(() => {
    if (!map || !initRef.current) return

    const filterExpr = getFilterExpr(activeFilter)
    const isVisible  = !!filterExpr

    // Récupère les zones actuellement actives (heure courante)
    const now = new Date()
    const activeZones = IMPACT_ZONES.filter(z => now >= z.activeFrom && now <= z.activeTo)

    if (!isVisible || activeZones.length === 0) {
      try {
        if (map.getLayer(FILL_ID))   map.setLayoutProperty(FILL_ID,   'visibility', 'none')
        if (map.getLayer(STROKE_ID)) map.setLayoutProperty(STROKE_ID, 'visibility', 'none')
      } catch { /* silencieux */ }
      stopPulse()
      return
    }

    // Mise à jour des données (zones actives uniquement)
    const src = map.getSource(SRC_ID) as mapboxgl.GeoJSONSource | undefined
    if (src) {
      src.setData(getImpactZoneGeoJSON(activeZones))
    }

    // Application du filtre Mapbox selon le filtre sélectionné
    try {
      if (map.getLayer(FILL_ID)) {
        map.setFilter(FILL_ID,   filterExpr as mapboxgl.FilterSpecification)
        map.setFilter(STROKE_ID, filterExpr as mapboxgl.FilterSpecification)
        map.setLayoutProperty(FILL_ID,   'visibility', 'visible')
        map.setLayoutProperty(STROKE_ID, 'visibility', 'visible')
      }
    } catch { /* silencieux */ }

    stopPulse()
    startPulse()
  }, [map, activeFilter, getFilterExpr, startPulse, stopPulse])

  // Nettoyage
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
