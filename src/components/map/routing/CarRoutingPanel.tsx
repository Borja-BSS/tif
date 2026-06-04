'use client'

import { useState, useCallback, useEffect } from 'react'
import { SearchBox }      from './SearchBox'
import { RecenterButton } from './RecenterButton'
import { RouteDisplay }   from './RouteDisplay'
import type { SearchResult } from '@/lib/routing/shared/search-engine'
import type { CarRoute }     from '@/lib/routing/car/here-router'
import type mapboxgl         from 'mapbox-gl'

interface CarRoutingPanelProps {
  map:      mapboxgl.Map | null
  onClose?: () => void
}

// ── Liquid Glass token ────────────────────────────────────────────────────────
const LG: React.CSSProperties = {
  background:           'rgba(18,18,22,0.82)',
  backdropFilter:       'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  border:               '1px solid rgba(255,255,255,0.13)',
  boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.14), 0 -8px 40px rgba(0,0,0,0.4)',
}

export function CarRoutingPanel({ map, onClose }: CarRoutingPanelProps) {
  const [origin,      setOrigin]      = useState<SearchResult | null>(null)
  const [destination, setDestination] = useState<SearchResult | null>(null)
  const [routes,      setRoutes]      = useState<CarRoute[]>([])
  const [selected,    setSelected]    = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const calculate = useCallback(async (from: SearchResult, to: SearchResult) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/routing/car', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          from: { lat: from.lat, lng: from.lng },
          to:   { lat: to.lat,   lng: to.lng },
          avoidIncidents: true,
        }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      if (data.routes?.length > 0) {
        setRoutes(data.routes)
        setSelected(0)
        if (map && data.routes[0].geometry.length > 0) {
          const coords = data.routes[0].geometry as [number, number][]
          map.fitBounds(
            [[Math.min(...coords.map((c: number[]) => c[0])), Math.min(...coords.map((c: number[]) => c[1]))],
             [Math.max(...coords.map((c: number[]) => c[0])), Math.max(...coords.map((c: number[]) => c[1]))]],
            { padding: { top: 80, bottom: 320, left: 40, right: 40 }, duration: 800 },
          )
        }
      } else {
        setError('Aucun itinéraire trouvé.')
      }
    } catch {
      setError('Calcul indisponible.')
    } finally {
      setLoading(false)
    }
  }, [map])

  useEffect(() => {
    if (origin && destination) calculate(origin, destination)
  }, [origin, destination, calculate])

  useEffect(() => {
    if (routes.length === 0) return
    const t = setInterval(() => {
      if (origin && destination) calculate(origin, destination)
    }, 120_000)
    return () => clearInterval(t)
  }, [routes.length, origin, destination, calculate])

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${(m % 60).toString().padStart(2, '0')}`
  }
  const fmtDist = (m: number) => m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`

  return (
    <>
      <RouteDisplay map={map} routes={routes} selectedIndex={selected} />

      {/*
        Mobile:  fixed bottom sheet, slides up from bottom, full-width
        Desktop: absolute panel, top-left, 320px wide
      */}
      <div
        className={[
          // Mobile — bottom sheet
          'fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl',
          // Desktop override
          'sm:absolute sm:bottom-auto sm:left-4 sm:right-auto sm:top-20',
          'sm:w-80 sm:rounded-2xl',
          'overflow-hidden',
        ].join(' ')}
        style={LG}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🚗</span>
            <span className="text-sm font-semibold text-white/85">Itinéraire voiture</span>
          </div>
          <div className="flex items-center gap-2">
            <RecenterButton map={map} onPositionUpdate={(lat, lng) =>
              setOrigin({ id: 'gps', title: 'Ma position', lat, lng, type: 'address' })
            } />
            {onClose && (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center
                           text-white/40 hover:text-white/70 transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Search inputs */}
        <div className="p-3 space-y-2">
          <SearchBox placeholder="Point de départ..." icon="🔵" value={origin?.title}      onSelect={setOrigin} />
          <SearchBox placeholder="Destination..."     icon="🔴" value={destination?.title} onSelect={setDestination} />
        </div>

        {/* States */}
        {loading && (
          <div className="px-4 pb-3 flex items-center gap-2 text-white/50">
            <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin"
                 style={{ borderColor: '#0A84FF', borderTopColor: 'transparent' }} />
            <span className="text-xs">Calcul en cours…</span>
          </div>
        )}
        {error && <div className="px-4 pb-3 text-xs text-red-400">{error}</div>}

        {/* Route results */}
        {routes.length > 0 && !loading && (
          <div className="pb-4">
            {routes.map((route, idx) => (
              <button
                key={route.id}
                onClick={() => setSelected(idx)}
                className="w-full px-4 py-3 flex items-start justify-between transition-colors text-left"
                style={{
                  background: idx === selected ? 'rgba(10,132,255,0.12)' : 'transparent',
                  borderTop:  idx > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold"
                          style={{ color: idx === selected ? '#0A84FF' : 'rgba(255,255,255,0.85)' }}>
                      {fmt(route.summary.durationInTraffic)}
                    </span>
                    {route.trafficDelay > 60 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(255,149,10,0.15)', color: '#FF9F0A' }}>
                        +{fmt(route.trafficDelay)} trafic
                      </span>
                    )}
                    {route.alternative && (
                      <span className="text-[10px] text-white/30">Alternative</span>
                    )}
                  </div>
                  <div className="text-[10px] mt-1 text-white/35">
                    {fmtDist(route.summary.distance)}
                    {route.warnings.length > 0 && <span className="ml-2">⚠️ {route.warnings[0]}</span>}
                  </div>
                </div>
                <div className="text-[10px] text-white/30">
                  {new Date(route.summary.arrivalTime).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </button>
            ))}
            <div className="px-4 pt-1">
              <p className="text-[10px] text-white/20">Recalcul auto · 2 min · Trafic temps réel</p>
            </div>
          </div>
        )}

        {/* Safe area spacer (mobile notch) */}
        <div className="h-[env(safe-area-inset-bottom,0px)] sm:hidden" />
      </div>
    </>
  )
}
