'use client'

import { useEffect, useRef, useState } from 'react'
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

interface SelectedAlert {
  id: string; title: string; description: string; color: string; icon: string; type: string
}

interface Props { map: mapboxgl.Map | null }

const CIRCLE_PREFIX = 'tif-custom-circle-'

function injectStyles() {
  if (document.getElementById('tif-custom-alert-styles')) return
  const s = document.createElement('style')
  s.id = 'tif-custom-alert-styles'
  s.textContent = `
    @keyframes custom-alert-pulse {
      0%   { box-shadow: var(--ca-shadow), 0 0 0 0 var(--ca-pulse); }
      70%  { box-shadow: var(--ca-shadow), 0 0 0 10px transparent; }
      100% { box-shadow: var(--ca-shadow), 0 0 0 0 transparent; }
    }
    .tif-ca-marker {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
      animation: custom-alert-pulse 2.2s ease-out infinite;
      border: 2px solid rgba(255,255,255,0.3);
    }
  `
  document.head.appendChild(s)
}

export default function CustomAlertsLayer({ map }: Props) {
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const circlesRef = useRef<Set<string>>(new Set())
  const [selected, setSelected] = useState<SelectedAlert | null>(null)

  const { data } = useQuery<{ features: AlertFeature[] }>({
    queryKey:        ['tif-custom-alerts'],
    queryFn:         () => fetch('/api/v1/layers/custom-alerts', { cache: 'no-store' }).then(r => r.json()),
    refetchInterval: 30_000,
    staleTime:       30_000,
  })

  useEffect(() => {
    if (!map) return
    injectStyles()
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
        const el = document.createElement('div')
        el.className = 'tif-ca-marker'
        el.style.background = `${color}dd`
        el.style.cursor = 'pointer'
        el.style.setProperty('--ca-shadow', `0 4px 12px rgba(0,0,0,0.4)`)
        el.style.setProperty('--ca-pulse', `${color}66`)
        el.textContent = icon

        el.addEventListener('click', (e) => {
          e.stopPropagation()
          setSelected({ id, type, title, description, color, icon })
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

  // Ferme la carte si clic en dehors
  useEffect(() => {
    if (!selected) return
    const close = () => setSelected(null)
    map?.on('click', close)
    return () => { map?.off('click', close) }
  }, [selected, map])

  if (!selected) return null

  return (
    <div
      style={{
        position:        'fixed',
        bottom:          '80px',
        left:            '50%',
        transform:       'translateX(-50%)',
        zIndex:          45,
        width:           'calc(100% - 32px)',
        maxWidth:        '360px',
        background:      'rgba(12,12,18,0.96)',
        border:          `1px solid ${selected.color}44`,
        borderRadius:    '20px',
        overflow:        'hidden',
        backdropFilter:  'blur(24px)',
        boxShadow:       `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${selected.color}22`,
        animation:       'fadeUp 0.18s cubic-bezier(0.23,1,0.32,1)',
      }}
    >
      {/* Header */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        gap:            '10px',
        padding:        '12px 14px',
        background:     `${selected.color}12`,
        borderBottom:   '1px solid rgba(255,255,255,0.07)',
      }}>
        <span style={{ fontSize: '22px', flexShrink: 0 }}>{selected.icon}</span>
        <span style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
          {selected.title}
        </span>
        <button
          onClick={() => setSelected(null)}
          style={{
            flexShrink:   0,
            width:        '28px',
            height:       '28px',
            borderRadius: '50%',
            border:       'none',
            background:   'rgba(255,255,255,0.08)',
            color:        'rgba(255,255,255,0.5)',
            fontSize:     '16px',
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            lineHeight:   1,
          }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      {selected.description && (
        <div style={{ padding: '10px 14px' }}>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.78)', lineHeight: 1.5, margin: 0 }}>
            {selected.description}
          </p>
        </div>
      )}

      {/* Badge type */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{
          fontSize:     '10px',
          fontWeight:   600,
          padding:      '2px 8px',
          borderRadius: '6px',
          background:   `${selected.color}22`,
          color:        selected.color,
          border:       `1px solid ${selected.color}44`,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {selected.type || 'Alerte'}
        </span>
      </div>
    </div>
  )
}
