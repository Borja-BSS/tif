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

type RouteType = 'fastest' | 'alternative' | 'safe'

const LAYERS  = ['route-alt-2', 'route-alt-1', 'route-glow', 'route-outline', 'route-main']
const SOURCES = ['route', 'route-alt-1', 'route-alt-2']

// ── Derive route display type from warnings ────────────────────────────────────
function routeType(route: CarRoute): RouteType {
  if (route.warnings.includes('Évite les zones G7')) return 'safe'
  if (route.alternative) return 'alternative'
  return 'fastest'
}

// ── Route paint config by type ────────────────────────────────────────────────
const ROUTE_STYLE: Record<RouteType, { color: string; width: number; opacity: number; dasharray?: number[] }> = {
  fastest:     { color: '#0A84FF', width: 5,  opacity: 0.96 },
  alternative: { color: 'var(--text-tertiary)', width: 3, opacity: 0.5, dasharray: [4, 3] },
  safe:        { color: '#34C759', width: 3,  opacity: 0.85, dasharray: [5, 2] },
}

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
          100%  { transform: scale(1);   opacity: 0.4; }
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

    // ── Alternative routes (drawn first, behind main) ─────────────────────────
    const altRoutes = routes
      .map((r, i) => ({ route: r, origIdx: i }))
      .filter(({ origIdx }) => origIdx !== selectedIndex)

    altRoutes.forEach(({ route }, slotIdx) => {
      if (route.geometry.length < 2) return
      const sourceId = `route-alt-${slotIdx + 1}` as 'route-alt-1' | 'route-alt-2'
      const layerId  = sourceId
      const style    = ROUTE_STYLE['alternative']  // non-selected routes always dimmed

      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: route.geometry },
        },
      })

      const paint: mapboxgl.LinePaint = {
        'line-color':   style.color,
        'line-width':   style.width,
        'line-opacity': style.opacity,
      }
      if (style.dasharray) paint['line-dasharray'] = style.dasharray

      map.addLayer({
        id: layerId, type: 'line', source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint,
      })
    })

    // ── Main route source (starts with just first 2 coords for animation) ─────
    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: geo.slice(0, 2) },
      },
    })

    // Selected route always draws solid — blue unless it's the G7-safe (green) variant
    const selectedType = routeType(mainRoute) === 'safe' ? 'safe' : 'fastest'
    const mainStyle    = ROUTE_STYLE[selectedType]
    const isBlue       = selectedType === 'fastest'
    const glowColor    = selectedType === 'safe' ? '#34C759' : '#0A84FF'

    // Glow layer — blurred, wide
    map.addLayer({
      id: 'route-glow', type: 'line', source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color':   glowColor,
        'line-width':   isBlue ? 14 : 10,
        'line-opacity': 0.22,
        'line-blur':    6,
      },
    })

    // White outline (only for fastest/most visible routes)
    if (routeType(mainRoute) !== 'alternative') {
      map.addLayer({
        id: 'route-outline', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color':   '#FFFFFF',
          'line-width':   7,
          'line-opacity': 0.18,
        },
      })
    }

    // Main line (color varies by route type)
    const mainPaint: mapboxgl.LinePaint = {
      'line-color':   mainStyle.color,
      'line-width':   mainStyle.width,
      'line-opacity': mainStyle.opacity,
    }
    if (mainStyle.dasharray) mainPaint['line-dasharray'] = mainStyle.dasharray

    map.addLayer({
      id: 'route-main', type: 'line', source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: mainPaint,
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
