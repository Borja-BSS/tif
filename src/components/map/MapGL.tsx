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

      setReady(true)
      onMapReady?.(map)
    })

    mapRef.current = map

    return () => {
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
