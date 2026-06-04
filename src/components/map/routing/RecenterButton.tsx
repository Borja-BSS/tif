'use client'

import { useState, useCallback } from 'react'
import type mapboxgl from 'mapbox-gl'

interface RecenterButtonProps {
  map:               mapboxgl.Map | null
  onPositionUpdate?: (lat: number, lng: number) => void
}

export function RecenterButton({ map, onPositionUpdate }: RecenterButtonProps) {
  const [tracking, setTracking] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [watchId,  setWatchId]  = useState<number | null>(null)

  const recenter = useCallback(() => {
    if (!navigator.geolocation) return
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        map?.flyTo({ center: [lng, lat], zoom: 15, duration: 800 })
        onPositionUpdate?.(lat, lng)
        setLoading(false)
      },
      () => setLoading(false),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }, [map, onPositionUpdate])

  const toggleTracking = useCallback(() => {
    if (tracking) {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
      setTracking(false)
      const src = map?.getSource('user-location') as mapboxgl.GeoJSONSource | undefined
      src?.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    const id = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        if (!map) return
        const source = map.getSource('user-location') as mapboxgl.GeoJSONSource | undefined
        const point: GeoJSON.Feature = {
          type: 'Feature',
          properties: { accuracy: pos.coords.accuracy },
          geometry:   { type: 'Point', coordinates: [lng, lat] },
        }
        if (source) {
          source.setData({ type: 'FeatureCollection', features: [point] })
        } else {
          map.addSource('user-location', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [point] },
          })
          map.addLayer({
            id: 'user-location-accuracy', type: 'circle', source: 'user-location',
            paint: {
              'circle-radius':  ['/', ['get', 'accuracy'], 2],
              'circle-color':   '#0A84FF',
              'circle-opacity': 0.15,
            },
          })
          map.addLayer({
            id: 'user-location-dot', type: 'circle', source: 'user-location',
            paint: {
              'circle-radius':       8,
              'circle-color':        '#0A84FF',
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#FFFFFF',
            },
          })
        }
        map.panTo([lng, lat], { duration: 500 })
        onPositionUpdate?.(lat, lng)
      },
      () => setTracking(false),
      { enableHighAccuracy: true, maximumAge: 5000 },
    )
    setWatchId(id)
    setTracking(true)
  }, [tracking, watchId, map, onPositionUpdate])

  return (
    <div className="flex gap-2">
      <button
        onClick={recenter}
        disabled={loading}
        className="w-10 h-10 rounded-xl border flex items-center justify-center
                   transition-all hover:scale-105 active:scale-95"
        style={{ background: 'rgba(0,0,0,0.6)', borderColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)' }}
        title="Me localiser"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
               style={{ borderColor: '#0A84FF', borderTopColor: 'transparent' }} />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="2"  x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2"  y1="12" x2="6"  y2="12"/>
            <line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
        )}
      </button>

      <button
        onClick={toggleTracking}
        className="w-10 h-10 rounded-xl border flex items-center justify-center
                   transition-all hover:scale-105 active:scale-95"
        style={{
          background:     tracking ? 'rgba(10,132,255,0.15)' : 'rgba(0,0,0,0.6)',
          borderColor:    tracking ? '#0A84FF' : 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(12px)',
        }}
        title={tracking ? 'Arrêter le suivi GPS' : 'Suivre ma position'}
      >
        <span style={{ fontSize: '16px' }}>{tracking ? '🔵' : '📡'}</span>
      </button>
    </div>
  )
}
