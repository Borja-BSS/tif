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

// Liquid Glass base style — iOS 26
const LG: React.CSSProperties = {
  background:           'rgba(255,255,255,0.04)',
  backdropFilter:       'blur(48px) saturate(200%) brightness(1.05)',
  WebkitBackdropFilter: 'blur(48px) saturate(200%) brightness(1.05)',
  borderTop:            '0.5px solid rgba(255,255,255,0.25)',
  boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.28), 0 -8px 48px rgba(0,0,0,0.06)',
}

// Spring animation
const SPRING = 'all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
const SPRING_HEIGHT = 'height 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)'

const SHEET_H: Record<SheetSize, string> = {
  peek: '120px',
  half: '50vh',
  full: 'calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 120px)',
}

// ── NavModal types & helpers ──────────────────────────────────────────────────

interface NavPending {
  lat: number
  lng: number
  label: string
  mode: 'driving' | 'transit'
  waypoints?: [number, number][]
}

function buildNavLinks(
  orig: { lat: number; lng: number } | null,
  dest: { lat: number; lng: number; label: string },
  mode: 'driving' | 'transit',
  waypoints?: [number, number][]
) {
  const destLatLng = `${dest.lat},${dest.lng}`

  // Google Maps — supporte les waypoints voiture
  const wpParam = (waypoints && waypoints.length > 0)
    ? `&waypoints=${waypoints.map(([lng, lat]) => `${lat},${lng}`).join('|')}`
    : ''
  const origParam = orig ? `&origin=${orig.lat},${orig.lng}` : ''
  const gm = `https://www.google.com/maps/dir/?api=1${origParam}&destination=${destLatLng}${wpParam}&travelmode=${mode === 'transit' ? 'transit' : 'driving'}&dir_action=navigate`

  // Apple Maps — origine + destination (dirflg=d voiture, r transit)
  const appleMode = mode === 'transit' ? 'r' : 'd'
  const appleSrc = orig ? `&saddr=${orig.lat},${orig.lng}` : ''
  const apple = `maps://?${appleSrc}&daddr=${destLatLng}&dirflg=${appleMode}`

  // Waze — destination uniquement (pas de waypoints API publique)
  const waze = `https://waze.com/ul?ll=${destLatLng}&navigate=yes${orig ? `&from=${orig.lat},${orig.lng}` : ''}`

  return { gm, apple, waze }
}

function NavModal({ pending, origin, onClose }: {
  pending: NavPending
  origin: { lat: number; lng: number } | null
  onClose: () => void
}) {
  const links = buildNavLinks(
    origin,
    { lat: pending.lat, lng: pending.lng, label: pending.label },
    pending.mode,
    pending.waypoints
  )

  const modalLG: React.CSSProperties = {
    background:           'rgba(255,255,255,0.06)',
    backdropFilter:       'blur(48px) saturate(200%)',
    WebkitBackdropFilter: 'blur(48px) saturate(200%)',
    border:               '0.5px solid rgba(255,255,255,0.22)',
    borderRadius:         20,
    boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.25)',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4"
      onClick={onClose}
    >
      <div
        style={modalLG}
        className="w-full max-w-sm p-5 space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <p
          className="text-xs font-semibold uppercase tracking-wider text-center"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Ouvrir dans…
        </p>

        {/* Bouton Google Maps */}
        <a
          href={links.gm}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="flex items-center gap-3 w-full rounded-2xl px-4 py-3 active:scale-[0.98] transition-transform"
          style={{ background: 'rgba(66,133,244,0.15)', border: '1px solid rgba(66,133,244,0.3)' }}
        >
          <span className="text-xl">🗺️</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-white">Google Maps</p>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              Avec la route exacte {pending.waypoints?.length ? '(waypoints inclus)' : ''}
            </p>
          </div>
        </a>

        {pending.mode === 'driving' && (
          /* Bouton Plans (Apple Maps) */
          <a
            href={links.apple}
            onClick={onClose}
            className="flex items-center gap-3 w-full rounded-2xl px-4 py-3 active:scale-[0.98] transition-transform"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}
          >
            <span className="text-xl">🍎</span>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-white">Plans</p>
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Apple Maps · iOS uniquement</p>
            </div>
          </a>
        )}

        {pending.mode === 'driving' ? (
          /* Bouton Waze */
          <a
            href={links.waze}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-center gap-3 w-full rounded-2xl px-4 py-3 active:scale-[0.98] transition-transform"
            style={{ background: 'rgba(0,199,177,0.12)', border: '1px solid rgba(0,199,177,0.25)' }}
          >
            <span className="text-xl">🚗</span>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-white">Waze</p>
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Navigation communautaire</p>
            </div>
          </a>
        ) : (
          /* Bouton TPG (transit seulement) */
          <a
            href="tpg://"
            onClick={e => {
              setTimeout(() => { window.location.href = 'https://www.tpg.ch/fr/horaires' }, 1500)
              onClose()
            }}
            className="flex items-center gap-3 w-full rounded-2xl px-4 py-3 active:scale-[0.98] transition-transform"
            style={{ background: 'rgba(255,159,10,0.12)', border: '1px solid rgba(255,159,10,0.25)' }}
          >
            <span className="text-xl">🚌</span>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-white">App TPG</p>
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Horaires & billets TPG</p>
            </div>
          </a>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 text-sm text-center rounded-2xl active:scale-[0.98]"
          style={{ color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.04)' }}
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

// ── SearchHandle ──────────────────────────────────────────────────────────────

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
  const [carRoutes,        setCarRoutes]        = useState<CarRoute[]>([])
  const [transRoutes,      setTransRoutes]      = useState<TransportRoute[]>([])
  const [carLoading,       setCarLoading]       = useState(false)
  const [transLoading,     setTransLoading]     = useState(false)
  const [selectedCarIdx,   setSelectedCarIdx]   = useState(0)
  const [editingOrigin,    setEditingOrigin]    = useState(false)

  // Navigation modal
  const [navPending, setNavPending] = useState<NavPending | null>(null)

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

  // Écoute tif:route-to depuis SearchBar ou EventDetail — destination pré-remplie, GPS auto
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SearchResult & { mode?: RouteTab }>).detail
      if (detail.mode) setActiveTab(detail.mode)
      setDestination(detail)
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
        const sorted = [...d.routes].sort((a: CarRoute, b: CarRoute) => a.summary.durationInTraffic - b.summary.durationInTraffic)
        setCarRoutes(sorted)
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
    setSelectedCarIdx(0)
    setEditingOrigin(false)
    setNavPending(null)
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    return m < 60 ? `${m} min` : `${Math.floor(m/60)}h${(m%60).toString().padStart(2,'0')}`
  }
  const fmtDist = (m: number) => m < 1000 ? `${Math.round(m)}m` : `${(m/1000).toFixed(1)} km`
  const fmtTime = (iso: string) => iso ? iso.slice(11, 16) : '—'

  // ── IDLE STATE — invisible, activé par tif:route-to ──────────────────────────
  if (state === 'idle') return null

  // ── SEARCH STATE ──────────────────────────────────────────────────────────────
  if (state === 'search') {
    return (
      <div
        className="fixed left-0 right-0 z-30 rounded-t-3xl overflow-hidden flex flex-col"
        style={{ ...LG, height: '55vh', transition: SPRING_HEIGHT, bottom: 'env(safe-area-inset-bottom, 0px)' }}
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
      </div>
    )
  }

  // ── ROUTE STATE ───────────────────────────────────────────────────────────────
  return (
    <>
    {/* Tracé de tous les itinéraires voiture sur la carte */}
    <RouteDisplay
      map={map}
      routes={carRoutes}
      selectedIndex={selectedCarIdx}
      origin={origin}
      destination={destination}
    />
    <div
      className="fixed left-0 right-0 z-30 rounded-t-3xl overflow-hidden flex flex-col"
      style={{ ...LG, height: SHEET_H[sheetSize], transition: SPRING_HEIGHT, bottom: 'env(safe-area-inset-bottom, 0px)' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-2.5 pb-0 flex-shrink-0">
        <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
      </div>

      {/* Header : départ éditable + destination + fermer */}
      <div className="px-4 pt-2 pb-2.5 flex-shrink-0">
        {editingOrigin ? (
          <div className="flex items-center gap-2">
            <SearchBox
              placeholder="Adresse de départ"
              icon="🔵"
              value={origin?.title}
              gpsHint
              onGPSSelect={() => { handleGPSSelect(); setEditingOrigin(false) }}
              loading={false}
              onSelect={r => {
                setOrigin(r)
                setEditingOrigin(false)
                map?.flyTo({ center: [r.lng, r.lat], zoom: 13, duration: 500, essential: true })
              }}
            />
            <button onClick={() => setEditingOrigin(false)}
              className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-tertiary)' }}>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              {/* Départ — tappable pour modifier */}
              <button
                onClick={() => { setEditingOrigin(true); setSheetSize('half') }}
                className="flex items-center gap-1.5 w-full text-left mb-0.5 active:opacity-60"
              >
                <span className="text-[10px]">🔵</span>
                <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  {origin?.title ?? 'Modifier le départ…'}
                </span>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/>
                </svg>
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]">🔴</span>
                <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {destination?.title ?? '?'}
                </span>
              </div>
            </div>
            <button onClick={reset} className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-tertiary)' }}>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
            </button>
          </div>
        )}
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
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold" style={{ color: activeTab === 'transport' ? '#34C759' : 'rgba(255,255,255,0.75)' }}>
                  {fmt(transRoutes[0].summary.duration)}
                </span>
              </div>
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
            const isSelected = i === selectedCarIdx
            const openCrossing = route.warnings.find((w: string) => w.startsWith('Via ') && w !== 'Via centre-ville')
            const slower = i > 0 ? Math.ceil((route.summary.durationInTraffic - carRoutes[0].summary.durationInTraffic) / 60) : 0
            const reasons = i === 0
              ? ['Itinéraire le plus rapide', route.trafficDelay === 0 ? 'Trafic fluide' : null].filter(Boolean) as string[]
              : openCrossing
                ? (slower > 0 ? [`+${slower} min vs le plus rapide`] : [])
                : [`Via centre-ville`, `+${slower} min`]
            const routeColor = isSelected ? '#0A84FF' : 'rgba(255,255,255,0.45)'
            return (
              <button
                key={route.id}
                onClick={() => {
                  setSelectedCarIdx(i)
                  // Recentrer la carte sur cet itinéraire
                  if (map && route.geometry?.length > 1) {
                    const lngs = route.geometry.map((c: number[]) => c[0])
                    const lats = route.geometry.map((c: number[]) => c[1])
                    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: { top: 80, bottom: 220, left: 40, right: 40 }, duration: 600, essential: true })
                  }
                }}
                className="w-full mb-3 rounded-2xl p-3 text-left active:scale-[0.99] transition-transform"
                style={{
                  background: isSelected ? 'rgba(10,132,255,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isSelected ? 'rgba(10,132,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {isSelected && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: routeColor }} />}
                    <span className="text-base font-bold" style={{ color: routeColor }}>{fmt(route.summary.durationInTraffic)}</span>
                  </div>
                  <span className="text-xs text-white/35">{fmtDist(route.summary.distance)}</span>
                </div>
                <div className="flex flex-col gap-0.5 mb-2">
                  {reasons.map(r => <span key={r} className="text-[10px] text-white/40">✓ {r}</span>)}
                </div>

                {/* ── Douane ouverte badge ── */}
                {openCrossing && (
                  <div className="mb-2 rounded-xl px-2 py-1.5 flex items-center gap-1.5"
                    style={{ background: 'rgba(52,199,89,0.10)', border: '1px solid rgba(52,199,89,0.25)' }}>
                    <span className="text-[10px]" style={{ color: '#34C759' }}>✅</span>
                    <div>
                      <p className="text-[10px] font-semibold leading-tight" style={{ color: '#34C759' }}>
                        Douane ouverte vérifiée — {openCrossing.replace('Via ', '')}
                      </p>
                    </div>
                  </div>
                )}

                {isSelected && destination && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      const geom = carRoutes[selectedCarIdx].geometry
                      const step = Math.max(1, Math.floor(geom.length / 10))
                      const waypoints = geom
                        .filter((_, idx) => idx > 0 && idx < geom.length - 1 && idx % step === 0)
                        .slice(0, 8) as [number, number][]
                      setNavPending({
                        lat: destination.lat,
                        lng: destination.lng,
                        label: destination.title,
                        mode: 'driving',
                        waypoints,
                      })
                    }}
                    className="w-full py-2 rounded-xl text-xs font-semibold transition-colors active:scale-[0.98]"
                    style={{ background: 'rgba(10,132,255,0.18)', color: '#0A84FF', border: '1px solid rgba(10,132,255,0.3)' }}
                  >
                    🧭 Y aller · Voiture
                  </button>
                )}
              </button>
            )
          })}
          {activeTab === 'transport' && (
            <>
              {transRoutes.slice(0, 3).map((route, i) => (
                <div key={route.id} className="mb-3 rounded-2xl p-3"
                  style={{
                    background: route.summary.disrupted ? 'rgba(255,69,58,0.05)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${route.summary.disrupted ? 'rgba(255,69,58,0.20)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white/80">{fmtTime(route.summary.departure)}</span>
                      <span className="text-xs text-white/30">→</span>
                      <span className="text-sm font-bold text-white/80">{fmtTime(route.summary.arrival)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold" style={{ color: route.summary.disrupted ? 'var(--red)' : '#34C759' }}>
                        {fmt(route.summary.duration)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    {route.legs.filter(l => l.type !== 'walk').map((leg, li) => (
                      <span key={li} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                        background: leg.type === 'ceva' ? 'rgba(175,82,222,0.2)' : leg.type === 'cff' ? 'rgba(10,132,255,0.2)' : 'rgba(255,159,10,0.2)',
                        color: leg.type === 'ceva' ? '#AF52DE' : leg.type === 'cff' ? '#0A84FF' : '#FF9F0A',
                      }}>
                        {leg.line}
                        {leg.disrupted && <span className="ml-0.5 text-[8px]" style={{ color: 'var(--red)' }}>⚠</span>}
                      </span>
                    ))}
                    {route.summary.transfers > 0 && (
                      <span className="text-[10px] text-white/30">{route.summary.transfers} corresp.</span>
                    )}
                  </div>

                  {/* Avertissements par itinéraire */}
                  {route.warnings.length > 0 && (
                    <div className="mb-2 space-y-0.5">
                      {route.warnings.map((w, wi) => (
                        <p key={wi} className="text-[9px] leading-snug" style={{ color: 'rgba(255,159,10,0.65)' }}>
                          ⚠ {w}
                        </p>
                      ))}
                    </div>
                  )}

                  {destination && i === 0 && (
                    <button
                      onClick={() => setNavPending({
                        lat: destination.lat,
                        lng: destination.lng,
                        label: destination.title,
                        mode: 'transit',
                      })}
                      className="w-full py-2 rounded-xl text-xs font-semibold transition-colors active:scale-[0.98]"
                      style={{ background: 'rgba(50,215,75,0.15)', color: '#34C759', border: '1px solid rgba(50,215,75,0.3)' }}
                    >
                      🧭 Y aller · Transports publics
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

    </div>
    {navPending && (
      <NavModal
        pending={navPending}
        origin={origin ? { lat: origin.lat, lng: origin.lng } : null}
        onClose={() => setNavPending(null)}
      />
    )}
    </>
  )
}
