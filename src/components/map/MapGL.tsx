'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

export interface MapGLProps {
  initialLat?: number
  initialLng?: number
  initialZoom?: number
  onMapReady?: (map: mapboxgl.Map) => void
}

// Grand Genève centroid
const GENEVA_CENTER: [number, number] = [6.1432, 46.2044]

export default function MapGL({
  initialLat = GENEVA_CENTER[1],
  initialLng = GENEVA_CENTER[0],
  initialZoom = 11,
  onMapReady,
}: MapGLProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     'mapbox://styles/mapbox/dark-v11',
      center:    [initialLng, initialLat],
      zoom:      initialZoom,
      projection: 'globe',
      antialias:  true,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    map.on('load', () => {
      // Atmosphère subtile en mode globe
      map.setFog({ color: '#0d0d10', 'space-color': '#000005', 'star-intensity': 0.4 })

      // User location source & layers (created once on load)
      map.addSource('user-location', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Halo de précision GPS (cercle semi-transparent bleu)
      map.addLayer({
        id: 'user-location-accuracy',
        type: 'circle',
        source: 'user-location',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, ['/', ['get', 'accuracy'], 8], 16, ['/', ['get', 'accuracy'], 1]],
          'circle-color': '#0A84FF',
          'circle-opacity': 0.15,
          'circle-stroke-width': 0,
        },
      })

      // Point bleu avec halo blanc
      map.addLayer({
        id: 'user-location-dot',
        type: 'circle',
        source: 'user-location',
        paint: {
          'circle-radius': 8,
          'circle-color': '#0A84FF',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity': 1,
        },
      })

      // Notify external components that the map is ready with user-location source
      window.dispatchEvent(new CustomEvent('tif:user-location-ready', { detail: map }))

      setReady(true)
      onMapReady?.(map)
    })

    // Listen for location update events from RecenterButton or other components
    const handleLocationUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ lat: number; lng: number; accuracy: number } | null>).detail
      const source = map.getSource('user-location') as mapboxgl.GeoJSONSource | undefined
      if (!source) return
      if (!detail) {
        source.setData({ type: 'FeatureCollection', features: [] })
        return
      }
      const { lat, lng, accuracy } = detail
      source.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { accuracy },
          geometry: { type: 'Point', coordinates: [lng, lat] },
        }],
      })
    }
    window.addEventListener('tif:update-user-location', handleLocationUpdate)

    mapRef.current = map

    return () => {
      window.removeEventListener('tif:update-user-location', handleLocationUpdate)
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d10]">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
