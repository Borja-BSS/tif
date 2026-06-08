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

// Bearing from A→B in degrees (0=Nord, sens horaire)
function bearingBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => d * Math.PI / 180
  const dLng  = toRad(lng2 - lng1)
  const φ1    = toRad(lat1), φ2 = toRad(lat2)
  const y = Math.sin(dLng) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

// Distance approx en mètres
function distMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = (lat2 - lat1) * 111_000
  const dlng = (lng2 - lng1) * 111_000 * Math.cos(lat1 * Math.PI / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng)
}

interface FloatingControlsProps {
  map: mapboxgl.Map | null
}

export function FloatingControls({ map }: FloatingControlsProps) {
  const [active,    setActive]    = useState(false)
  const [following, setFollowing] = useState(false)
  const followRef  = useRef(false)
  const watchIdRef = useRef<number | null>(null)
  const flyDoneRef = useRef(false)
  const flyingRef  = useRef(false)
  const lastPosRef = useRef<[number, number] | null>(null)  // [lng, lat]
  const bearingRef = useRef<number>(0)                      // bearing calculé depuis le mouvement

  // ── GPS button click ──────────────────────────────────────────────────────
  const handleGPS = useCallback(() => {
    if (!navigator.geolocation || !map) return

    const topPad = Math.round(window.innerHeight * 0.42)

    if (watchIdRef.current === null) {
      // Première activation
      flyDoneRef.current = false
      followRef.current  = true
      setActive(true)
      setFollowing(true)

      const id = navigator.geolocation.watchPosition(
        pos => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords

          // Émettre position pour le point bleu
          window.dispatchEvent(new CustomEvent('tif:update-user-location', {
            detail: { lat, lng, accuracy },
          }))

          // Calculer le bearing depuis le mouvement (seulement si déplacé > 5m)
          if (lastPosRef.current) {
            const [prevLng, prevLat] = lastPosRef.current
            const dist = distMeters(prevLat, prevLng, lat, lng)
            if (dist >= 5) {
              bearingRef.current = bearingBetween(prevLat, prevLng, lat, lng)
            }
          }
          lastPosRef.current = [lng, lat]

          if (!followRef.current) return
          if (flyingRef.current)  return

          if (!flyDoneRef.current) {
            // Premier fix : flyTo immersif
            flyDoneRef.current = true
            flyingRef.current  = true
            map.flyTo({
              center:   [lng, lat],
              pitch:    55,
              zoom:     16,
              bearing:  bearingRef.current,
              duration: 1300,
              essential: true,
              padding:  { top: topPad, bottom: 0, left: 0, right: 0 },
            })
            map.once('moveend', () => { flyingRef.current = false })
          } else {
            // Suivi continu — easeTo smooth, annulable par drag utilisateur
            map.easeTo({
              center:   [lng, lat],
              bearing:  bearingRef.current,
              duration: 1000,
              padding:  { top: topPad, bottom: 0, left: 0, right: 0 },
            })
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 2000 },
      )
      watchIdRef.current = id

    } else {
      // Re-clic : re-centrer et ré-activer le suivi
      followRef.current = true
      setFollowing(true)

      if (lastPosRef.current && map) {
        const [lng, lat] = lastPosRef.current
        flyingRef.current  = true
        flyDoneRef.current = true
        map.flyTo({
          center:   [lng, lat],
          pitch:    55,
          zoom:     16,
          bearing:  bearingRef.current,
          duration: 1300,
          essential: true,
          padding:  { top: topPad, bottom: 0, left: 0, right: 0 },
        })
        map.once('moveend', () => { flyingRef.current = false })
      } else {
        flyDoneRef.current = false
      }
    }
  }, [map])

  // ── Stop following on user map interaction ────────────────────────────────
  useEffect(() => {
    if (!map) return

    const doStop = () => {
      if (!followRef.current) return
      followRef.current = false
      setFollowing(false)
    }

    // dragstart = toujours user-initiated
    const onDrag = () => doStop()

    // zoomstart se déclenche aussi sur flyTo — stopper seulement si user-initiated
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
