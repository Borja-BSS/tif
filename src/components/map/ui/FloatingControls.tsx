'use client'

import { useState, useCallback } from 'react'
import type mapboxgl from 'mapbox-gl'

const BTN: React.CSSProperties = {
  width: 44, height: 44,
  borderRadius: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background:           'rgba(18,18,22,0.85)',
  backdropFilter:       'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  border:               '1px solid rgba(255,255,255,0.12)',
  boxShadow:            '0 4px 16px rgba(0,0,0,0.30)',
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
    navigator.geolocation.getCurrentPosition(pos => {
      map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15, duration: 800, essential: true })
      window.dispatchEvent(new CustomEvent('tif:update-user-location', {
        detail: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy },
      }))
      setTimeout(() => setGpsActive(false), 3000)
    }, () => setGpsActive(false))
  }, [map])

  return (
    <div className="fixed z-20 flex flex-col gap-2.5" style={{ right: 16, bottom: 'calc(56px + 80px)' }}>
      <button onClick={handleGPS} style={{ ...BTN, color: gpsActive ? '#0A84FF' : 'rgba(255,255,255,0.75)' }} aria-label="Recentrer sur ma position">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3"/>
          <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
      </button>
      <button onClick={() => map?.zoomIn({ duration: 250 })} style={BTN} aria-label="Zoom avant">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <button onClick={() => map?.zoomOut({ duration: 250 })} style={BTN} aria-label="Zoom arrière">
        <svg width="16" height="3" viewBox="0 0 16 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="1" y1="1.5" x2="15" y2="1.5"/>
        </svg>
      </button>
    </div>
  )
}
