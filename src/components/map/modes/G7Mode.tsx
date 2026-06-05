'use client'

import { useEffect, useState } from 'react'
import type mapboxgl from 'mapbox-gl'

const G7_START = new Date('2026-06-08T00:00:00')
const G7_END   = new Date('2026-06-17T23:59:59')

export function useG7Active(): boolean {
  const now = new Date()
  return now >= G7_START && now <= G7_END
}

interface G7ModeProps { map: mapboxgl.Map | null }

export function G7Mode({ map }: G7ModeProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!map) return

    const addLayers = async () => {
      try {
        const res  = await fetch('/api/v1/territory/events')
        const data = await res.json() as { zones?: { geohash6: string; lat: number; lng: number }[] }
        if (!data.zones?.length) return

        if (!map.getSource('g7-zones')) {
          map.addSource('g7-zones', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: data.zones.map(z => ({
                type:       'Feature' as const,
                geometry:   { type: 'Point' as const, coordinates: [z.lng, z.lat] },
                properties: { geohash6: z.geohash6 },
              })),
            },
          })
        }

        if (!map.getLayer('g7-zones-fill')) {
          map.addLayer({
            id: 'g7-zones-fill', type: 'circle', source: 'g7-zones',
            paint: {
              'circle-radius':         800,
              'circle-color':          '#FF453A',
              'circle-opacity':        0.08,
              'circle-stroke-width':   1.5,
              'circle-stroke-color':   '#FF453A',
              'circle-stroke-opacity': 0.3,
            },
          })
        }
      } catch { /* circuit breaker */ }
    }

    if (map.loaded()) addLayers()
    else map.once('load', addLayers)

    return () => {
      try {
        if (map.getLayer('g7-zones-fill')) map.removeLayer('g7-zones-fill')
        if (map.getSource('g7-zones'))     map.removeSource('g7-zones')
      } catch { /* ignore if already removed */ }
    }
  }, [map])

  if (dismissed) return null

  return (
    <div
      className="fixed top-[108px] left-4 right-4 z-24 flex items-center gap-3 px-4 rounded-2xl border"
      style={{
        height: 48, zIndex: 24,
        background: 'rgba(255,69,58,0.12)',
        borderColor: 'rgba(255,69,58,0.35)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <span className="text-base flex-shrink-0">🏛️</span>
      <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        G7 actif · Restrictions en vigueur jusqu'au 17 juin
      </span>
      <button onClick={() => setDismissed(true)} style={{ color: 'var(--text-tertiary)' }} aria-label="Fermer">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1 1l8 8M9 1L1 9"/>
        </svg>
      </button>
    </div>
  )
}
