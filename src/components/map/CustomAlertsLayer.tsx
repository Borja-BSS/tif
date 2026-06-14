'use client'

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import mapboxgl from 'mapbox-gl'

interface AlertFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    id: string; type: string; title: string; description: string
    color: string; icon: string; radius: number
  }
}

interface Props { map: mapboxgl.Map | null }

const CIRCLE_PREFIX = 'tif-custom-circle-'

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
  ))
}

function injectStyles() {
  if (document.getElementById('tif-custom-alert-styles')) return
  const s = document.createElement('style')
  s.id = 'tif-custom-alert-styles'
  s.textContent = `
    @keyframes tif-ca-pulse {
      0%   { box-shadow: var(--ca-shadow), 0 0 0 0 var(--ca-pulse); }
      70%  { box-shadow: var(--ca-shadow), 0 0 0 10px transparent; }
      100% { box-shadow: var(--ca-shadow), 0 0 0 0 transparent; }
    }
    .tif-ca-marker {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
      animation: tif-ca-pulse 2.2s ease-out infinite;
      border: 2px solid rgba(255,255,255,0.3);
    }
  `
  document.head.appendChild(s)
}

// Réutilise le même style que ParkingLayer / G7ClosuresLayer
function injectPopupStyle() {
  if (document.getElementById('tif-popup-style')) return
  const s = document.createElement('style')
  s.id = 'tif-popup-style'
  s.textContent = `
    .tif-popup .mapboxgl-popup-content {
      background: rgba(12,12,18,0.96);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      padding: 0;
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      overflow: hidden;
    }
    .tif-popup .mapboxgl-popup-tip { border-top-color: rgba(12,12,18,0.96); }
    .tif-popup .mapboxgl-popup-close-button {
      color: rgba(255,255,255,0.4); font-size:18px;
      padding: 6px 10px; right: 2px; top: 2px;
    }
    .tif-popup .mapboxgl-popup-close-button:hover { color:#fff; background:none; }
  `
  document.head.appendChild(s)
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/

function safeColor(c: string): string {
  return HEX_RE.test(c) ? c : '#888888'
}

function buildPopupHTML(p: { type: string; title: string; description: string; color: string; icon: string }): string {
  const color   = safeColor(p.color)
  const descLine = p.description
    ? `<div style="font-size:12px;color:rgba(255,255,255,0.78);margin-bottom:8px">${esc(p.description)}</div>`
    : ''

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:12px 14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="width:28px;height:28px;border-radius:50%;background:${color}dd;
          display:inline-flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">${esc(p.icon)}</span>
        <span style="font-size:14px;font-weight:700;color:#fff">${esc(p.title)}</span>
      </div>
      ${descLine}
      <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;
        background:${color}22;color:${color};border:1px solid ${color}44;
        text-transform:uppercase;letter-spacing:0.05em">${esc(p.type || 'Alerte')}</span>
      <div style="font-size:10px;color:rgba(255,255,255,0.25);margin-top:8px">Source : Signalements TIF</div>
    </div>`
}

export default function CustomAlertsLayer({ map }: Props) {
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const circlesRef = useRef<Set<string>>(new Set())

  const { data } = useQuery<{ features: AlertFeature[] }>({
    queryKey:        ['tif-custom-alerts'],
    queryFn:         () => fetch('/api/v1/layers/custom-alerts', { cache: 'no-store' }).then(r => r.json()),
    refetchInterval: 30_000,
    staleTime:       30_000,
  })

  useEffect(() => {
    if (!map) return
    injectStyles()
    injectPopupStyle()
  }, [map])

  useEffect(() => {
    if (!map || !data) return

    const features = data.features ?? []
    const seen = new Set<string>()

    features.forEach(f => {
      const { id, type, color, icon, title, description, radius } = f.properties
      const [lng, lat] = f.geometry.coordinates
      seen.add(id)

      if (!markersRef.current.has(id)) {
        const safeCol = safeColor(color)
        const el = document.createElement('div')
        el.className = 'tif-ca-marker'
        el.style.background = `${safeCol}dd`
        el.style.cursor = 'pointer'
        el.style.setProperty('--ca-shadow', '0 4px 12px rgba(0,0,0,0.4)')
        el.style.setProperty('--ca-pulse', `${safeCol}66`)
        el.textContent = icon

        el.addEventListener('click', (e) => {
          e.stopPropagation()
          new mapboxgl.Popup({ maxWidth: '280px', className: 'tif-popup', closeButton: true, offset: 14 })
            .setLngLat([lng, lat])
            .setHTML(buildPopupHTML({ type, title, description, color: safeColor(color), icon }))
            .addTo(map)
        })

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map)

        markersRef.current.set(id, marker)
      }

      if (radius > 0 && !circlesRef.current.has(id)) {
        const srcId = `${CIRCLE_PREFIX}${id}`
        circlesRef.current.add(id)

        const addCircle = () => {
          if (map.getSource(srcId)) return
          map.addSource(srcId, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [f] },
          })
          map.addLayer({
            id: `${srcId}-fill`, type: 'circle', source: srcId,
            paint: {
              'circle-radius': { stops: [[0, 0], [20, radius]], base: 2 },
              'circle-color':   color,
              'circle-opacity': 0.12,
            },
          })
          map.addLayer({
            id: `${srcId}-border`, type: 'circle', source: srcId,
            paint: {
              'circle-radius': { stops: [[0, 0], [20, radius]], base: 2 },
              'circle-color':        'transparent',
              'circle-stroke-color': color,
              'circle-stroke-width': 2,
              'circle-stroke-opacity': 0.6,
            },
          })
        }

        if (map.loaded()) addCircle()
        else map.once('load', addCircle)
      }
    })

    markersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
        const srcId = `${CIRCLE_PREFIX}${id}`
        if (map.getLayer(`${srcId}-fill`))   map.removeLayer(`${srcId}-fill`)
        if (map.getLayer(`${srcId}-border`)) map.removeLayer(`${srcId}-border`)
        if (map.getSource(srcId))             map.removeSource(srcId)
        circlesRef.current.delete(id)
      }
    })
  }, [map, data])

  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current.clear()
    }
  }, [map])

  return null
}
