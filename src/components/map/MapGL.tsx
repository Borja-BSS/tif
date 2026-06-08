'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// ── Grand Genève — bbox complète ───────────────────────────────────────────────
// Lausanne (NE) · Sallanches (SE) · Annecy (S) · Champagnole (W) · Pontarlier (NW)
const GRAND_GENEVE_BOUNDS: mapboxgl.LngLatBoundsLike = [
  [5.75, 45.75],  // SW
  [7.00, 46.95],  // NE
]

export interface MapGLProps {
  initialLat?:  number
  initialLng?:  number
  initialZoom?: number
  onMapReady?:  (map: mapboxgl.Map) => void
}

export default function MapGL({
  initialLat  = 46.35,
  initialLng  = 6.30,
  initialZoom = 9,
  onMapReady,
}: MapGLProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    const map = new mapboxgl.Map({
      container:    containerRef.current,
      style:        'mapbox://styles/mapbox/dark-v11',
      center:       [initialLng, initialLat],
      zoom:         initialZoom,
      antialias:    false,
      fadeDuration: 0,
    })

    // Contrôles natifs Mapbox supprimés — UI custom gère GPS + zoom

    map.on('load', () => {
      // Cadrer sur le Grand Genève complet après le chargement du style
      map.fitBounds(GRAND_GENEVE_BOUNDS, { duration: 0, padding: 0 })

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

    // Garantit que user-location-dot reste toujours au-dessus de toutes les couches
    // (trafic, TPG, incidents…) quel que soit l'ordre d'ajout des layers
    map.on('idle', () => {
      ;['user-location-accuracy', 'user-location-dot'].forEach(id => {
        try { if (map.getLayer(id)) map.moveLayer(id) } catch { /* ignoré */ }
      })
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
