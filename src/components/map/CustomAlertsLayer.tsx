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
  const markersRef  = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const circlesRef  = useRef<Set<string>>(new Set())

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
      const { id, color, icon, title, description, radius } = f.properties
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

        el.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('tif:custom-alert-click', {
            detail: { id, type, title, description, source: type, color, icon, lng, lat },
          }))
        })

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map)

        markersRef.current.set(id, marker)
      }

      // Zone circulaire (restriction)
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
              'circle-radius': {
                stops: [[0, 0], [20, radius]],
                base:  2,
              },
              'circle-color':   color,
              'circle-opacity': 0.12,
            },
          })
          map.addLayer({
            id: `${srcId}-border`, type: 'circle', source: srcId,
            paint: {
              'circle-radius': {
                stops: [[0, 0], [20, radius]],
                base:  2,
              },
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

    // Supprime les marqueurs/layers des alertes expirées
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
