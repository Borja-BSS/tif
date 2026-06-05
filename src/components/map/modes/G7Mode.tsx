'use client'

import { useEffect } from 'react'
import type mapboxgl from 'mapbox-gl'

const G7_START = new Date('2026-06-08T00:00:00')
const G7_END   = new Date('2026-06-17T23:59:59')

export function useG7Active(): boolean {
  const now = new Date()
  return now >= G7_START && now <= G7_END
}

interface G7ModeProps { map: mapboxgl.Map | null }

export function G7Mode({ map }: G7ModeProps) {
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

  // Banner removed — G7 status shown in BottomSheet compact
  return null
}
