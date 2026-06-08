'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type mapboxgl from 'mapbox-gl'

const BTN_BASE: React.CSSProperties = {
  width: 44, height: 44,
  borderRadius: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backdropFilter:       'blur(40px) saturate(200%) brightness(1.06)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%) brightness(1.06)',
  boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.28), 0 4px 20px rgba(0,0,0,0.12)',
  cursor: 'pointer',
}

interface FloatingControlsProps {
  map: mapboxgl.Map | null
}

export function FloatingControls({ map }: FloatingControlsProps) {
  const [active,    setActive]    = useState(false)   // watchPosition running
  const [following, setFollowing] = useState(false)   // auto-centering on
  const followRef  = useRef(false)
  const watchIdRef = useRef<number | null>(null)

  const handleGPS = useCallback(() => {
    if (!navigator.geolocation || !map) return

    // Start watchPosition if not already running
    if (watchIdRef.current === null) {
      const id = navigator.geolocation.watchPosition(
        pos => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords
          window.dispatchEvent(new CustomEvent('tif:update-user-location', {
            detail: { lat, lng, accuracy },
          }))
          if (followRef.current) {
            map.easeTo({ center: [lng, lat], duration: 600, essential: true })
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 3000 },
      )
      watchIdRef.current = id
      setActive(true)
    }

    // Always re-engage immersive view
    followRef.current = true
    setFollowing(true)

    // Immediate fix for flyTo (watchPosition may have slight delay)
    navigator.geolocation.getCurrentPosition(
      pos => {
        map.flyTo({
          center:   [pos.coords.longitude, pos.coords.latitude],
          pitch:    65,
          zoom:     16,
          bearing:  0,
          duration: 1200,
          essential: true,
        })
        window.dispatchEvent(new CustomEvent('tif:update-user-location', {
          detail: {
            lat:      pos.coords.latitude,
            lng:      pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        }))
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000 },
    )
  }, [map])

  // Detect user map interaction → stop following, reset pitch
  useEffect(() => {
    if (!map) return

    const stopFollow = (e: { originalEvent?: Event }) => {
      if (followRef.current && e.originalEvent) {
        followRef.current = false
        setFollowing(false)
        map.easeTo({ pitch: 0, duration: 400 })
      }
    }

    map.on('dragstart',  stopFollow as Parameters<typeof map.on>[1])
    map.on('zoomstart',  stopFollow as Parameters<typeof map.on>[1])

    return () => {
      map.off('dragstart', stopFollow as Parameters<typeof map.on>[1])
      map.off('zoomstart', stopFollow as Parameters<typeof map.on>[1])
    }
  }, [map])

  const color  = following ? '#0A84FF' : active ? 'rgba(10,132,255,0.55)' : 'rgba(255,255,255,0.75)'
  const bg     = following ? 'rgba(10,132,255,0.18)' : 'rgba(255,255,255,0.07)'
  const border = following ? '0.5px solid #0A84FF' : '0.5px solid rgba(255,255,255,0.22)'

  return (
    <div className="fixed z-20" style={{ right: 16, bottom: 'calc(56px + 24px)' }}>
      <button
        onClick={handleGPS}
        style={{ ...BTN_BASE, background: bg, border, color }}
        aria-label="Se localiser"
      >
        {following ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="5"/>
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="2"  x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2"  y1="12" x2="6"  y2="12"/>
            <line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
        )}
      </button>
    </div>
  )
}
