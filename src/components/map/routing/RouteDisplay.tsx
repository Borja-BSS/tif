'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { CarRoute } from '@/lib/routing/car/here-router'
import type { SearchResult } from '@/lib/routing/shared/search-engine'

interface RouteDisplayProps {
  map:            mapboxgl.Map | null
  routes:         CarRoute[]
  selectedIndex?: number
  origin?:        SearchResult | null
  destination?:   SearchResult | null
}

const LAYERS  = ['route-alt', 'route-glow', 'route-outline', 'route-main']
const SOURCES = ['route', 'route-alt']

// ── Marker HTML factory ────────────────────────────────────────────────────────
function buildMarkerEl(type: 'origin' | 'destination'): HTMLElement {
  const isOrigin = type === 'origin'
  const color    = isOrigin ? '#0A84FF' : '#FF453A'
  const glow     = isOrigin ? 'rgba(10,132,255,0.5)' : 'rgba(255,69,58,0.5)'

  const el = document.createElement('div')
  el.style.cssText = `
    width: 30px; height: 30px; position: relative;
    display: flex; align-items: center; justify-content: center;
  `

  // Pulse ring (origin only)
  if (isOrigin) {
    const pulse = document.createElement('div')
    pulse.style.cssText = `
      position: absolute; inset: -6px; border-radius: 50%;
      border: 2px solid ${color};
      opacity: 0.4; animation: tif-pulse 2s ease-out infinite;
    `
    el.appendChild(pulse)

    // Inject keyframes once
    if (!document.getElementById('tif-marker-styles')) {
      const style = document.createElement('style')
      style.id = 'tif-marker-styles'
      style.textContent = `
        @keyframes tif-pulse {
          0%   { transform: scale(1);   opacity: 0.4; }
          50%  { transform: scale(1.4); opacity: 0.15; }
          100% { transform: scale(1);   opacity: 0.4; }
        }
      `
      document.head.appendChild(style)
    }
  }

  // Liquid Glass circle
  const circle = document.createElement('div')
  circle.style.cssText = `
    width: 30px; height: 30px; border-radius: 50%;
    background: rgba(18,18,22,0.88);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border: 2px solid ${color};
    box-shadow: 0 0 14px ${glow}, inset 0 0.5px 0 rgba(255,255,255,0.2);
    display: flex; align-items: center; justify-content: center;
  `

  // Inner dot
  const dot = document.createElement('div')
  dot.style.cssText = `
    width: 10px; height: 10px; border-radius: 50%;
    background: ${color};
    box-shadow: 0 0 8px ${glow};
  `
  circle.appendChild(dot)
  el.appendChild(circle)
  return el
}

// ── Progressive animation ──────────────────────────────────────────────────────
function animateDrawing(
  map:       mapboxgl.Map,
  geometry:  [number, number][],
  sourceId:  string,
  onDone?:   () => void,
) {
  if (geometry.length < 2) { onDone?.(); return }

  const FRAMES    = 50
  const step      = Math.max(1, Math.floor(geometry.length / FRAMES))
  let   current   = 2
  let   cancelled = false

  const src = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined
  if (!src) { onDone?.(); return }

  const tick = () => {
    if (cancelled || !map.getSource(sourceId)) return

    const s = map.getSource(sourceId) as mapboxgl.GeoJSONSource
    s.setData({
      type: 'Feature', properties: {},
      geometry: { type: 'LineString', coordinates: geometry.slice(0, current) },
    })
    current = Math.min(geometry.length, current + step)

    if (current < geometry.length) {
      requestAnimationFrame(tick)
    } else {
      // Final frame — exact geometry
      s.setData({
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: geometry },
      })
      onDone?.()
    }
  }

  requestAnimationFrame(tick)
  return () => { cancelled = true }
}

// ── Component ──────────────────────────────────────────────────────────────────
export function RouteDisplay({
  map, routes, selectedIndex = 0, origin, destination,
}: RouteDisplayProps) {
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const cancelRef  = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    if (!map) return

    // Cancel any running animation
    cancelRef.current?.()

    // Remove previous markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    // Remove previous layers/sources
    LAYERS.forEach(id  => { try { if (map.getLayer(id))   map.removeLayer(id)   } catch {} })
    SOURCES.forEach(id => { try { if (map.getSource(id))  map.removeSource(id)  } catch {} })

    if (routes.length === 0) return

    const mainRoute = routes[selectedIndex]
    const geo       = mainRoute?.geometry

    if (!geo || geo.length < 2) return

    // ── Alternative route (drawn first, behind) ───────────────────────────────
    const altRoutes = routes.filter((_, i) => i !== selectedIndex)
    if (altRoutes.length > 0 && altRoutes[0].geometry.length > 1) {
      map.addSource('route-alt', {
        type: 'geojson',
        data: {
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: altRoutes[0].geometry },
        },
      })
      map.addLayer({
        id: 'route-alt', type: 'line', source: 'route-alt',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint:  {
          'line-color':     'rgba(255,255,255,0.25)',
          'line-width':     3,
          'line-opacity':   0.5,
          'line-dasharray': [4, 3],
        },
      })
    }

    // ── Main route source (starts with just first 2 coords for animation) ─────
    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: geo.slice(0, 2) },
      },
    })

    // Glow layer — blurred, wide
    map.addLayer({
      id: 'route-glow', type: 'line', source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color':   '#0A84FF',
        'line-width':   14,
        'line-opacity': 0.22,
        'line-blur':    6,
      },
    })

    // White outline
    map.addLayer({
      id: 'route-outline', type: 'line', source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color':   '#FFFFFF',
        'line-width':   7,
        'line-opacity': 0.18,
      },
    })

    // Main blue line
    map.addLayer({
      id: 'route-main', type: 'line', source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color':   '#0A84FF',
        'line-width':   5,
        'line-opacity': 0.96,
      },
    })

    // ── Animate drawing ────────────────────────────────────────────────────────
    cancelRef.current = animateDrawing(map, geo, 'route', () => {
      // After drawing complete, add start/end markers
      if (!map.getSource('route')) return   // map was reset during animation

      const [startLng, startLat] = geo[0]
      const [endLng,   endLat]   = geo[geo.length - 1]

      const originMarker = new mapboxgl.Marker({
        element: buildMarkerEl('origin'),
        anchor:  'center',
      })
        .setLngLat([startLng, startLat])
        .addTo(map)

      const destMarker = new mapboxgl.Marker({
        element: buildMarkerEl('destination'),
        anchor:  'center',
      })
        .setLngLat([endLng, endLat])
        .addTo(map)

      markersRef.current = [originMarker, destMarker]
    })

    return () => {
      cancelRef.current?.()
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      LAYERS.forEach(id  => { try { if (map.getLayer(id))  map.removeLayer(id)  } catch {} })
      SOURCES.forEach(id => { try { if (map.getSource(id)) map.removeSource(id) } catch {} })
    }
  }, [map, routes, selectedIndex])

  // Update marker positions if origin/destination change while panel is open
  useEffect(() => {
    const [originMarker, destMarker] = markersRef.current
    if (originMarker && origin) {
      originMarker.setLngLat([origin.lng, origin.lat])
    }
    if (destMarker && destination) {
      destMarker.setLngLat([destination.lng, destination.lat])
    }
  }, [origin, destination])

  return null
}
