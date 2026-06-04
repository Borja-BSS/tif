'use client'

import { useEffect } from 'react'
import type mapboxgl from 'mapbox-gl'
import type { CarRoute } from '@/lib/routing/car/here-router'

interface RouteDisplayProps {
  map:            mapboxgl.Map | null
  routes:         CarRoute[]
  selectedIndex?: number
}

const ROUTE_LAYERS  = ['route-alternative', 'route-main', 'route-main-outline']
const ROUTE_SOURCES = ['route', 'route-alt']

export function RouteDisplay({ map, routes, selectedIndex = 0 }: RouteDisplayProps) {
  useEffect(() => {
    if (!map) return

    // Cleanup previous layers
    ROUTE_LAYERS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id) })
    ROUTE_SOURCES.forEach(id => { if (map.getSource(id)) map.removeSource(id) })

    if (routes.length === 0) return

    const mainRoute = routes[selectedIndex]
    if (mainRoute?.geometry.length > 0) {
      map.addSource('route', {
        type: 'geojson',
        data: {
          type:       'Feature',
          properties: { duration: mainRoute.summary.durationInTraffic },
          geometry:   { type: 'LineString', coordinates: mainRoute.geometry },
        },
      })
      map.addLayer({
        id: 'route-main-outline', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint:  { 'line-color': '#FFFFFF', 'line-width': 8, 'line-opacity': 0.4 },
      })
      map.addLayer({
        id: 'route-main', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint:  { 'line-color': '#0A84FF', 'line-width': 5, 'line-opacity': 0.95 },
      })
    }

    const altRoutes = routes.filter((_, i) => i !== selectedIndex)
    if (altRoutes.length > 0 && altRoutes[0].geometry.length > 0) {
      map.addSource('route-alt', {
        type: 'geojson',
        data: {
          type:       'Feature',
          properties: {},
          geometry:   { type: 'LineString', coordinates: altRoutes[0].geometry },
        },
      })
      map.addLayer({
        id: 'route-alternative', type: 'line', source: 'route-alt',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint:  {
          'line-color':      'rgba(255,255,255,0.35)',
          'line-width':      3,
          'line-opacity':    0.5,
          'line-dasharray':  [3, 2],
        },
      })
    }

    return () => {
      ROUTE_LAYERS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id) })
      ROUTE_SOURCES.forEach(id => { if (map.getSource(id)) map.removeSource(id) })
    }
  }, [map, routes, selectedIndex])

  return null
}
