'use client'

import { useState, useCallback } from 'react'
import type mapboxgl from 'mapbox-gl'

const BTN: React.CSSProperties = {
  width: 44, height: 44,
  borderRadius: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background:           'rgba(255,255,255,0.07)',
  backdropFilter:       'blur(40px) saturate(200%) brightness(1.06)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%) brightness(1.06)',
  border:               '0.5px solid rgba(255,255,255,0.22)',
  boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.28), 0 4px 20px rgba(0,0,0,0.12)',
  cursor: 'pointer',
  color: 'rgba(255,255,255,0.75)',
}

interface FloatingControlsProps {
  map: mapboxgl.Map | null
}

export function FloatingControls({ map }: FloatingControlsProps) {
  const [gpsActive, setGpsActive] = useState(false)

  const handleGPS = useCallback(() => {
    if (!navigator.geolocation || !map) return
    setGpsActive(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15, duration: 800, essential: true })
        window.dispatchEvent(new CustomEvent('tif:update-user-location', {
          detail: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy },
        }))
        setTimeout(() => setGpsActive(false), 3000)
      },
      () => setGpsActive(false),
    )
  }, [map])

  return (
    <div
      className="fixed z-20 flex flex-col items-center gap-2"
      style={{ right: 16, bottom: 'calc(56px + 24px)' }}
    >
      {/* GPS uniquement — zoom géré par pinch/scroll natif sur mobile */}
      <button
        onClick={handleGPS}
        style={{ ...BTN, color: gpsActive ? '#0A84FF' : 'rgba(255,255,255,0.75)' }}
        aria-label="Recentrer sur ma position"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3"/>
          <line x1="12" y1="2"  x2="12" y2="6"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2"  y1="12" x2="6"  y2="12"/>
          <line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
      </button>
    </div>
  )
}
