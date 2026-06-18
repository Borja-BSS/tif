'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [active,       setActive]       = useState(false)
  const [following,    setFollowing]    = useState(false)
  const [gpsLoading,   setGpsLoading]   = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const followRef      = useRef(false)
  const watchIdRef     = useRef<number | null>(null)
  const flyDoneRef     = useRef(false)
  const flyingRef      = useRef(false)
  const lastPosRef     = useRef<[number, number] | null>(null)
  const bearingRef     = useRef<number>(0)
  const gpsActivatedAt = useRef<number>(0)

  // ── Zoom +/− — desktop only ──────────────────────────────────────────────
  const handleZoomIn  = useCallback(() => map?.zoomIn({ duration: 200 }),  [map])
  const handleZoomOut = useCallback(() => map?.zoomOut({ duration: 200 }), [map])

  // ── Fit all (Grand Genève) — desktop only ────────────────────────────────
  const handleFitAll = useCallback(() => {
    if (!map) return
    followRef.current = false
    setFollowing(false)
    map.fitBounds([[5.75, 45.75], [7.00, 46.95]], {
      padding: 40, duration: 1200, pitch: 0, bearing: 0,
    })
  }, [map])

  // ── GPS button click ──────────────────────────────────────────────────────
  const handleGPS = useCallback(() => {
    if (!navigator.geolocation || !map) return

    const topPad = Math.round(window.innerHeight * 0.42)

    if (watchIdRef.current === null) {
      // Première activation
      gpsActivatedAt.current = Date.now()
      flyDoneRef.current = false
      followRef.current  = true
      setActive(true)
      setFollowing(true)
      setGpsLoading(true)

      const id = navigator.geolocation.watchPosition(
        pos => {
          setGpsLoading(false)
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
              duration: 900,
              essential: true,
              padding:  { top: topPad, bottom: 0, left: 0, right: 0 },
            })
            map.once('moveend', () => { flyingRef.current = false })
          } else {
            // Suivi continu — easeTo smooth, annulable par drag utilisateur
            map.easeTo({
              center:   [lng, lat],
              bearing:  bearingRef.current,
              duration: 700,
              padding:  { top: topPad, bottom: 0, left: 0, right: 0 },
            })
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 },
      )
      watchIdRef.current = id

    } else {
      // Re-clic : re-centrer et ré-activer le suivi
      gpsActivatedAt.current = Date.now()
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
          duration: 900,
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
      if (Date.now() - gpsActivatedAt.current < 300) return
      followRef.current = false
      setFollowing(false)
      setGpsLoading(false)
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

  const color  = following ? '#0A84FF' : (gpsLoading || active) ? 'rgba(10,132,255,0.65)' : 'rgba(255,255,255,0.75)'
  const bg     = following ? 'rgba(10,132,255,0.18)' : gpsLoading ? 'rgba(10,132,255,0.10)' : 'rgba(255,255,255,0.07)'
  const border = following ? '0.5px solid #0A84FF' : gpsLoading ? '0.5px solid rgba(10,132,255,0.45)' : '0.5px solid rgba(255,255,255,0.22)'

  return (
    <>
      {/* ── Popup signalement ───────────────────────────────────────────── */}
      {showReportModal && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={() => setShowReportModal(false)} />
          {/* Modal */}
          <div className="fixed z-50 rounded-3xl overflow-hidden"
            style={{
              right: 16, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px + 24px + 54px)',
              width: 'min(320px, calc(100vw - 32px))',
              background: 'var(--bg-modal)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '0.5px solid rgba(255,255,255,0.18)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.50)',
              animation: 'fadeUp 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,59,48,0.15)', border: '1px solid rgba(255,59,48,0.35)' }}>
                <span className="text-xl">📡</span>
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>Signaler en direct</p>
                <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Remontée communautaire · G7 2026</p>
              </div>
              <button onClick={() => setShowReportModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-[16px] leading-none"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>×</button>
            </div>

            {/* Body */}
            <div className="px-4 py-4 space-y-3">
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Vous observez quelque chose de notable — circulation, incident, manifestation, contrôle douanier ?
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Signalez-le en quelques secondes. Chaque signalement est <strong style={{ color: 'var(--text-primary)' }}>examiné avant publication</strong> sur la carte.
              </p>

              <div className="rounded-2xl px-3 py-2.5 space-y-1.5"
                style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.10)' }}>
                {['🚦 Circulation & incidents','🛂 Douanes & frontières','👥 Rassemblements','🚨 Forces de l\'ordre','⚠️ Sécurité & zones à risque'].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{item}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  // Flag temporaire (sessionStorage) — WelcomeModals l'efface après vérification
                  sessionStorage.setItem('tif:from-signaler', '1')
                  setShowReportModal(false)
                  window.location.href = '/signaler'
                }}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-bold text-[14px] active:scale-[0.97] transition-transform"
                style={{ background: 'var(--red)', color: '#fff', boxShadow: '0 4px 16px var(--red-glow)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
                Signaler un événement
              </button>

              <p className="text-[10px] text-center" style={{ color: 'var(--text-tertiary)' }}>
                Anonyme · Aucune donnée personnelle
              </p>
            </div>
          </div>
        </>
      )}

      {/* Zoom + — desktop uniquement */}
      <div className="fixed z-20 hidden md:flex" style={{ right: 16, bottom: 'calc(56px + 24px + 208px)' }}>
        <button onClick={handleZoomIn}
          style={{ ...BTN_BASE, background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.22)', color: 'var(--text-secondary)', fontSize: 22, fontWeight: 300, lineHeight: 1 }}
          aria-label="Zoom avant">+</button>
      </div>

      {/* Zoom − — desktop uniquement */}
      <div className="fixed z-20 hidden md:flex" style={{ right: 16, bottom: 'calc(56px + 24px + 156px)' }}>
        <button onClick={handleZoomOut}
          style={{ ...BTN_BASE, background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.22)', color: 'var(--text-secondary)', fontSize: 22, fontWeight: 300, lineHeight: 1 }}
          aria-label="Zoom arrière">−</button>
      </div>

      {/* Fit all — desktop uniquement */}
      <div className="fixed z-20 hidden md:flex" style={{ right: 16, bottom: 'calc(56px + 24px + 104px)' }}>
        <button
          onClick={handleFitAll}
          style={{ ...BTN_BASE, background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.22)', color: 'var(--text-secondary)' }}
          aria-label="Voir toute la région"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9"/>
            <polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/>
            <line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        </button>
      </div>

      {/* Bouton Signaler — au-dessus du GPS */}
      <div className="fixed z-20" style={{ right: 16, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px + 24px + 52px)' }}>
        <button
          onClick={() => setShowReportModal(prev => !prev)}
          style={{
            ...BTN_BASE,
            background: showReportModal ? 'rgba(255,59,48,0.22)' : 'rgba(255,59,48,0.12)',
            border: `0.5px solid ${showReportModal ? 'rgba(255,59,48,0.70)' : 'rgba(255,59,48,0.45)'}`,
            color: 'var(--red)',
          }}
          aria-label="Signaler un événement">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
        </button>
      </div>

      <div className="fixed z-20" style={{ right: 16, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px + 24px)' }}>
      <button
        onClick={handleGPS}
        onPointerDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        data-onboarding="gps-btn"
        style={{ ...BTN_BASE, background: bg, border, color }}
        aria-label="Se localiser"
      >
        {gpsLoading ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="4"/>
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ animation: 'pulseStatus 1s ease-in-out infinite', opacity: 0.45 }}/>
          </svg>
        ) : following ? (
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
    </>
  )
}
