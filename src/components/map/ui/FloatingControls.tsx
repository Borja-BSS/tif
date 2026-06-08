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

type OrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number }

interface FloatingControlsProps {
  map: mapboxgl.Map | null
}

export function FloatingControls({ map }: FloatingControlsProps) {
  const [active,    setActive]    = useState(false)
  const [following, setFollowing] = useState(false)
  const followRef      = useRef(false)
  const watchIdRef     = useRef<number | null>(null)
  const compassRef     = useRef<number>(0)
  const compassCleanup = useRef<(() => void) | null>(null)

  // ── Compass setup ─────────────────────────────────────────────────────────
  const startCompass = useCallback(async () => {
    if (compassCleanup.current) return  // already running

    // iOS 13+ requires permission
    const DOE = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }
    if (typeof DOE.requestPermission === 'function') {
      const perm = await DOE.requestPermission().catch(() => 'denied')
      if (perm !== 'granted') return
    }

    const handler = (e: OrientationEvent) => {
      let heading: number | null = null
      if (e.webkitCompassHeading != null) {
        // iOS — 0=North, clockwise, calibrated
        heading = e.webkitCompassHeading
      } else if (e.alpha != null) {
        // Android absolute — convert to clockwise from North
        heading = (360 - e.alpha) % 360
      }
      if (heading == null) return
      compassRef.current = heading
      if (followRef.current && map) {
        map.rotateTo(heading, { duration: 200, essential: true })
      }
    }

    // deviceorientationabsolute is more reliable on Android (Chrome 50+)
    window.addEventListener('deviceorientationabsolute', handler as EventListener, true)
    window.addEventListener('deviceorientation',         handler as EventListener, true)

    compassCleanup.current = () => {
      window.removeEventListener('deviceorientationabsolute', handler as EventListener, true)
      window.removeEventListener('deviceorientation',         handler as EventListener, true)
    }
  }, [map])

  // ── GPS button click ──────────────────────────────────────────────────────
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
            map.easeTo({ center: [lng, lat], duration: 500, essential: true })
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 2000 },
      )
      watchIdRef.current = id
      setActive(true)
    }

    // Start compass (async — may request iOS permission)
    void startCompass()

    // Engage immersive view
    followRef.current = true
    setFollowing(true)

    navigator.geolocation.getCurrentPosition(
      pos => {
        map.flyTo({
          center:    [pos.coords.longitude, pos.coords.latitude],
          pitch:     80,
          zoom:      16,
          bearing:   compassRef.current,
          duration:  1300,
          essential: true,
        })
        window.dispatchEvent(new CustomEvent('tif:update-user-location', {
          detail: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy },
        }))
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000 },
    )
  }, [map, startCompass])

  // ── Stop following on user map interaction ────────────────────────────────
  useEffect(() => {
    if (!map) return

    const doStop = () => {
      if (!followRef.current) return
      followRef.current = false
      setFollowing(false)
      map.easeTo({ pitch: 0, duration: 400 })
    }

    // dragstart = toujours user-initiated (pas de dragstart programmatique)
    const onDrag = () => doStop()

    // zoomstart se déclenche aussi sur flyTo — ne stopper que si originalEvent présent
    const onZoom = (e: mapboxgl.MapboxEvent & { originalEvent?: Event }) => {
      if (e.originalEvent) doStop()
    }

    map.on('dragstart', onDrag)
    map.on('zoomstart', onZoom)

    return () => {
      map.off('dragstart', onDrag)
      map.off('zoomstart', onZoom)
    }
  }, [map])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      compassCleanup.current?.()
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

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
