'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type mapboxgl from 'mapbox-gl'
import { SearchBox }    from './routing/SearchBox'
import { RouteDisplay } from './routing/RouteDisplay'
import type { SearchResult }   from '@/lib/routing/shared/search-engine'
import type { CarRoute }       from '@/lib/routing/car/here-router'
import type { TransportRoute } from '@/lib/routing/transport/transport-router'

type HandleState = 'idle' | 'search' | 'route'
type RouteTab    = 'car' | 'transport'
type SheetSize   = 'peek' | 'half' | 'full'

// Liquid Glass base style
const LG: React.CSSProperties = {
  background:           'rgba(18,18,22,0.78)',
  backdropFilter:       'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  border:               '1px solid rgba(255,255,255,0.13)',
  boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.13), 0 -4px 32px rgba(0,0,0,0.4)',
}

// Spring animation
const SPRING = 'all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
const SPRING_HEIGHT = 'height 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)'

const SHEET_H: Record<SheetSize, string> = {
  peek: '120px',
  half: '50vh',
  full: '88vh',
}

interface SearchHandleProps {
  map: mapboxgl.Map | null
}

export default function SearchHandle({ map }: SearchHandleProps) {
  const [state,       setState]       = useState<HandleState>('idle')
  const [activeTab,   setActiveTab]   = useState<RouteTab>('car')
  const [sheetSize,   setSheetSize]   = useState<SheetSize>('peek')

  // Search state
  const [origin,      setOrigin]      = useState<SearchResult | null>(null)
  const [destination, setDestination] = useState<SearchResult | null>(null)

  // Route results
  const [carRoutes,   setCarRoutes]   = useState<CarRoute[]>([])
  const [transRoutes, setTransRoutes] = useState<TransportRoute[]>([])
  const [carLoading,  setCarLoading]  = useState(false)
  const [transLoading,setTransLoading]= useState(false)

  // Swipe handling
  const touchStartY = useRef<number>(0)
  const touchState  = useRef<SheetSize>('peek')

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    touchState.current  = sheetSize
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartY.current - e.changedTouches[0].clientY
    if (delta > 50) setSheetSize(touchState.current === 'peek' ? 'half' : 'full')
    else if (delta < -50) setSheetSize(touchState.current === 'full' ? 'half' : 'peek')
  }

  // GPS auto-fill
  const handleGPSSelect = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      const result: SearchResult = {
        id: 'gps', title: 'Ma position',
        lat: pos.coords.latitude, lng: pos.coords.longitude, type: 'address',
      }
      setOrigin(result)
      map?.flyTo({ center: [result.lng, result.lat], zoom: 14, duration: 700, essential: true })
      window.dispatchEvent(new CustomEvent('tif:update-user-location', {
        detail: { lat: result.lat, lng: result.lng, accuracy: pos.coords.accuracy }
      }))
    })
  }, [map])

  // Écoute tif:route-to depuis SearchBar — destination pré-remplie, GPS auto
  useEffect(() => {
    const handler = (e: Event) => {
      const dest = (e as CustomEvent<SearchResult>).detail
      setDestination(dest)
      setState('search')
      setSheetSize('peek')
      // Auto-fill GPS origin
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            const gps: SearchResult = { id: 'gps', title: 'Ma position', lat: pos.coords.latitude, lng: pos.coords.longitude, type: 'address' }
            setOrigin(gps)
          },
          () => setOrigin(null),
          { timeout: 4000, maximumAge: 30000 }
        )
      }
    }
    window.addEventListener('tif:route-to', handler)
    return () => window.removeEventListener('tif:route-to', handler)
  }, [])

  // Calculate both route types when origin + destination ready
  useEffect(() => {
    if (!origin || !destination) return

    // Car route
    setCarLoading(true)
    fetch('/api/v1/routing/car', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: { lat: origin.lat, lng: origin.lng }, to: { lat: destination.lat, lng: destination.lng }, avoidIncidents: true }),
      signal: AbortSignal.timeout(15000),
    })
    .then(r => r.json())
    .then(d => {
      if (d.routes?.length) {
        setCarRoutes(d.routes)
        setState('route')
        setSheetSize('peek')
        if (map && d.routes[0].geometry?.length > 1) {
          const coords = d.routes[0].geometry
          const lngs = coords.map((c: number[]) => c[0])
          const lats = coords.map((c: number[]) => c[1])
          map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: { top: 80, bottom: 180, left: 40, right: 40 }, duration: 900, essential: true })
        }
      }
    })
    .catch(() => null)
    .finally(() => setCarLoading(false))

    // Transport route
    setTransLoading(true)
    fetch('/api/v1/routing/transport', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: { lat: origin.lat, lng: origin.lng }, to: { lat: destination.lat, lng: destination.lng } }),
      signal: AbortSignal.timeout(15000),
    })
    .then(r => r.json())
    .then(d => { if (d.routes?.length) setTransRoutes(d.routes) })
    .catch(() => null)
    .finally(() => setTransLoading(false))
  }, [origin, destination, map])

  const reset = () => {
    setState('idle')
    setOrigin(null)
    setDestination(null)
    setCarRoutes([])
    setTransRoutes([])
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    return m < 60 ? `${m} min` : `${Math.floor(m/60)}h${(m%60).toString().padStart(2,'0')}`
  }
  const fmtDist = (m: number) => m < 1000 ? `${Math.round(m)}m` : `${(m/1000).toFixed(1)} km`
  const fmtTime = (iso: string) => iso ? iso.slice(11, 16) : '—'

  // Bouton "Y aller" — ouvre la navigation native
  const launchNav = useCallback((lat: number, lng: number, label: string, mode: 'driving' | 'transit' = 'driving') => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    const enc   = encodeURIComponent(label)
    if (isIOS && mode === 'driving') {
      window.location.href = `maps:0,0?daddr=${lat},${lng}`
    } else {
      const tm = mode === 'transit' ? 'r' : 'd'
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${enc}&travelmode=${mode === 'transit' ? 'transit' : 'driving'}&dir_action=navigate`, '_blank')
    }
  }, [])

  // ── IDLE STATE — invisible, activé par tif:route-to ──────────────────────────
  if (state === 'idle') return null

  // ── SEARCH STATE ──────────────────────────────────────────────────────────────
  if (state === 'search') {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl overflow-hidden flex flex-col"
        style={{ ...LG, height: '55vh', transition: SPRING_HEIGHT }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        </div>

        {/* Header row */}
        <div className="flex items-center gap-2 px-4 pb-3 flex-shrink-0">
          <button
            onClick={reset}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 active:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 1l8 8M9 1L1 9"/>
            </svg>
          </button>
          <div className="flex-1 space-y-1.5">
            <SearchBox
              placeholder="Départ — Ma position ou adresse"
              icon="🔵"
              value={origin?.title}
              gpsHint
              onGPSSelect={handleGPSSelect}
              loading={false}
              onSelect={r => {
                setOrigin(r)
                map?.flyTo({ center: [r.lng, r.lat], zoom: 14, duration: 600, essential: true })
                window.dispatchEvent(new CustomEvent('tif:search-pin', { detail: { lat: r.lat, lng: r.lng, title: r.title } }))
              }}
            />
            <SearchBox
              placeholder="Destination"
              icon="🔴"
              value={destination?.title}
              loading={false}
              onSelect={r => {
                setDestination(r)
                if (!origin) map?.flyTo({ center: [r.lng, r.lat], zoom: 14, duration: 600, essential: true })
                window.dispatchEvent(new CustomEvent('tif:search-pin', { detail: { lat: r.lat, lng: r.lng, title: r.title } }))
              }}
            />
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 px-4 pb-2 flex-shrink-0">
          {(['car', 'transport'] as RouteTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: activeTab === tab ? (tab === 'car' ? 'rgba(10,132,255,0.2)' : 'rgba(50,215,75,0.18)') : 'rgba(255,255,255,0.06)',
                border: activeTab === tab ? `1px solid ${tab === 'car' ? 'rgba(10,132,255,0.5)' : 'rgba(50,215,75,0.4)'}` : '1px solid transparent',
                color: activeTab === tab ? (tab === 'car' ? '#0A84FF' : '#34C759') : 'rgba(255,255,255,0.45)',
              }}
            >
              {tab === 'car' ? '🚗 Voiture' : '🧭 Transports'}
            </button>
          ))}
        </div>

        <div className="h-px flex-shrink-0" style={{ background: 'rgba(255,255,255,0.07)' }} />
        <div className="flex-1 overflow-hidden" />
        <div className="h-[env(safe-area-inset-bottom,0px)] flex-shrink-0" />
      </div>
    )
  }

  // ── ROUTE STATE ───────────────────────────────────────────────────────────────
  return (
    <>
    {/* Tracé de l'itinéraire sur la carte */}
    <RouteDisplay
      map={map}
      routes={carRoutes}
      origin={origin}
      destination={destination}
    />
    <div
      className="fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl overflow-hidden flex flex-col"
      style={{ ...LG, height: SHEET_H[sheetSize], transition: SPRING_HEIGHT }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-2.5 pb-0 flex-shrink-0">
        <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
      </div>

      {/* Route summary header */}
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-white/85 truncate">
            {origin?.title ?? '?'} → {destination?.title ?? '?'}
          </span>
        </div>
        <button onClick={reset} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ml-2" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
        </button>
      </div>

      {/* Quick summary row — always visible in peek state */}
      <div className="flex gap-3 px-4 pb-2.5 flex-shrink-0">
        <button
          onClick={() => setActiveTab('car')}
          className="flex-1 flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-all"
          style={{
            background: activeTab === 'car' ? 'rgba(10,132,255,0.15)' : 'rgba(255,255,255,0.05)',
            border: activeTab === 'car' ? '1px solid rgba(10,132,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span className="text-base">🚗</span>
          <div className="min-w-0">
            {carLoading ? (
              <div className="w-8 h-3 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.1)' }} />
            ) : carRoutes.length > 0 ? (
              <span className="text-sm font-bold" style={{ color: activeTab === 'car' ? '#0A84FF' : 'rgba(255,255,255,0.75)' }}>
                {fmt(carRoutes[0].summary.durationInTraffic)}
              </span>
            ) : <span className="text-xs text-white/35">—</span>}
            <div className="text-[10px] text-white/30">
              {carRoutes.length > 0 ? fmtDist(carRoutes[0].summary.distance) : 'Voiture'}
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('transport')}
          className="flex-1 flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-all"
          style={{
            background: activeTab === 'transport' ? 'rgba(50,215,75,0.12)' : 'rgba(255,255,255,0.05)',
            border: activeTab === 'transport' ? '1px solid rgba(50,215,75,0.35)' : '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span className="text-base">🧭</span>
          <div className="min-w-0">
            {transLoading ? (
              <div className="w-8 h-3 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.1)' }} />
            ) : transRoutes.length > 0 ? (
              <span className="text-sm font-bold" style={{ color: activeTab === 'transport' ? '#34C759' : 'rgba(255,255,255,0.75)' }}>
                {fmt(transRoutes[0].summary.duration)}
              </span>
            ) : <span className="text-xs text-white/35">—</span>}
            <div className="text-[10px] text-white/30">
              {transRoutes.length > 0 ? `${transRoutes[0].summary.transfers} corresp.` : 'Transports'}
            </div>
          </div>
        </button>
      </div>

      {/* Separator */}
      <div className="h-px flex-shrink-0" style={{ background: 'rgba(255,255,255,0.07)' }} />

      {/* Scrollable detail area — only visible in half/full */}
      {sheetSize !== 'peek' && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {activeTab === 'car' && carRoutes.map((route, i) => {
            const reasons = i === 0
              ? ['Itinéraire le plus rapide', route.trafficDelay === 0 ? 'Trafic fluide' : null].filter(Boolean) as string[]
              : route.warnings.includes('Évite les zones G7')
                ? ['Évite périmètres G7', 'Recommandé 12-18 juin']
                : ['Via centre-ville', `+${Math.ceil((route.summary.duration - carRoutes[0].summary.duration)/60)} min`]
            return (
              <div key={route.id} className="mb-3 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-base font-bold" style={{ color: i === 0 ? '#0A84FF' : 'rgba(255,255,255,0.6)' }}>{fmt(route.summary.durationInTraffic)}</span>
                  <span className="text-xs text-white/35">{fmtDist(route.summary.distance)}</span>
                </div>
                <div className="flex flex-col gap-0.5 mb-2">
                  {reasons.map(r => <span key={r} className="text-[10px] text-white/40">✓ {r}</span>)}
                </div>
                {destination && (
                  <button
                    onClick={() => launchNav(destination.lat, destination.lng, destination.title, 'driving')}
                    className="w-full py-2 rounded-xl text-xs font-semibold transition-colors active:scale-[0.98]"
                    style={{ background: 'rgba(10,132,255,0.18)', color: '#0A84FF', border: '1px solid rgba(10,132,255,0.3)' }}
                  >
                    🧭 Y aller · Voiture
                  </button>
                )}
              </div>
            )
          })}
          {activeTab === 'transport' && transRoutes.slice(0, 3).map((route, i) => (
            <div key={route.id} className="mb-3 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white/80">{fmtTime(route.summary.departure)}</span>
                  <span className="text-xs text-white/30">→</span>
                  <span className="text-sm font-bold text-white/80">{fmtTime(route.summary.arrival)}</span>
                </div>
                <span className="text-xs font-semibold" style={{ color: '#34C759' }}>{fmt(route.summary.duration)}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {route.legs.filter(l => l.type !== 'walk').map((leg, li) => (
                  <span key={li} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                    background: leg.type === 'ceva' ? 'rgba(175,82,222,0.2)' : leg.type === 'cff' ? 'rgba(10,132,255,0.2)' : 'rgba(255,159,10,0.2)',
                    color: leg.type === 'ceva' ? '#AF52DE' : leg.type === 'cff' ? '#0A84FF' : '#FF9F0A',
                  }}>{leg.line}</span>
                ))}
                {route.summary.transfers > 0 && <span className="text-[10px] text-white/30">{route.summary.transfers} corresp.</span>}
              </div>
              {destination && i === 0 && (
                <button
                  onClick={() => launchNav(destination.lat, destination.lng, destination.title, 'transit')}
                  className="w-full py-2 rounded-xl text-xs font-semibold transition-colors active:scale-[0.98]"
                  style={{ background: 'rgba(50,215,75,0.15)', color: '#34C759', border: '1px solid rgba(50,215,75,0.3)' }}
                >
                  🧭 Y aller · Transports publics
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="h-[env(safe-area-inset-bottom,0px)] flex-shrink-0" />
    </div>
    </>
  )
}
