'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { SearchBox }   from './SearchBox'
import type { SearchResult }   from '@/lib/routing/shared/search-engine'
import type { TransportRoute } from '@/lib/routing/transport/transport-router'
import { useMapT } from '@/i18n/map'

import mapboxgl from 'mapbox-gl'

interface TransportRoutingPanelProps {
  map?:     mapboxgl.Map | null
  onClose?: () => void
}

const LG: React.CSSProperties = {
  background:           'rgba(18,18,22,0.82)',
  backdropFilter:       'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  border:               '1px solid rgba(255,255,255,0.13)',
  boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.14), 0 -8px 40px rgba(0,0,0,0.4)',
}

type SheetState = 'peek' | 'half' | 'full'

const SHEET_HEIGHTS: Record<SheetState, string> = {
  peek: '90px',
  half: '50vh',
  full: '92vh',
}

export function TransportRoutingPanel({ map, onClose }: TransportRoutingPanelProps) {
  const t = useMapT()
  const tRef = useRef(t)
  tRef.current = t

  const [origin,      setOrigin]      = useState<SearchResult | null>(null)
  const [destination, setDestination] = useState<SearchResult | null>(null)
  const [routes,      setRoutes]      = useState<TransportRoute[]>([])
  const [selected,    setSelected]    = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  // ── Bottom sheet state (mobile) ───────────────────────────────────────────────
  const [sheetState,  setSheetState]  = useState<SheetState>('half')
  const touchStartY = useRef<number | null>(null)

  // ── Stop markers on the map ───────────────────────────────────────────────────
  const stopMarkersRef = useRef<mapboxgl.Marker[]>([])

  // ── Touch handlers for swipe ──────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const delta = touchStartY.current - e.changedTouches[0].clientY
    touchStartY.current = null

    if (delta > 60) {
      setSheetState(prev =>
        prev === 'peek' ? 'half' : prev === 'half' ? 'full' : 'full'
      )
    } else if (delta < -60) {
      setSheetState(prev =>
        prev === 'full' ? 'half' : prev === 'half' ? 'peek' : 'peek'
      )
    }
  }

  // ── Route calculation ─────────────────────────────────────────────────────────
  const calculate = useCallback(async (from: SearchResult, to: SearchResult) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/v1/routing/transport', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({
          from: { lat: from.lat, lng: from.lng, name: from.type === 'station' ? from.title : undefined },
          to:   { lat: to.lat,   lng: to.lng,   name: to.type   === 'station' ? to.title   : undefined },
        }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      if (data.routes?.length > 0) {
        setRoutes(data.routes)
        setSelected(0)
        setSheetState('full')
      }
      else setError(tRef.current.transit.noConnection)
    } catch { setError(tRef.current.transit.calcError) }
    finally  { setLoading(false) }
  }, [])

  useEffect(() => {
    if (origin && destination) calculate(origin, destination)
  }, [origin, destination, calculate])

  useEffect(() => {
    if (routes.length === 0) return
    const interval = setInterval(() => {
      if (origin && destination) calculate(origin, destination)
    }, 180_000)
    return () => clearInterval(interval)
  }, [routes.length, origin, destination, calculate])

  // ── Place/update stop markers when routes or selected route changes ───────────
  useEffect(() => {
    stopMarkersRef.current.forEach(m => m.remove())
    stopMarkersRef.current = []

    if (routes.length > 0 && map) {
      const route = routes[selected]
      const transitLegs = route.legs.filter(l => l.type !== 'walk')

      if (transitLegs.length > 0) {
        const firstLeg = transitLegs[0]
        const lastLeg  = transitLegs[transitLegs.length - 1]

        const makeMarkerEl = (borderColor: string, prefix: string, stopName: string) => {
          const wrapper = document.createElement('div')
          wrapper.style.cssText = [
            'background:rgba(18,18,22,0.88)',
            'backdrop-filter:blur(12px)',
            `border:2px solid ${borderColor}`,
            'border-radius:12px',
            'padding:4px 8px',
            'color:white',
            'font-size:11px',
            'font-weight:600',
            'white-space:nowrap',
            'box-shadow:0 4px 16px rgba(0,0,0,0.4)',
            'display:flex',
            'align-items:center',
            'gap:4px',
          ].join(';')
          const icon = document.createElement('span')
          icon.textContent = prefix
          const label = document.createElement('span')
          label.textContent = stopName
          wrapper.appendChild(icon)
          wrapper.appendChild(label)
          return wrapper
        }

        const startEl = makeMarkerEl('#34C759', '🚌', firstLeg.from)
        const endEl   = makeMarkerEl('#FF9F0A', '🏁', lastLeg.to)

        Promise.all([
          fetch(`/api/v1/routing/geocode?q=${encodeURIComponent(firstLeg.from + ' Genève')}`).then(r => r.json()),
          fetch(`/api/v1/routing/geocode?q=${encodeURIComponent(lastLeg.to + ' Genève')}`).then(r => r.json()),
        ]).then(([startResults, endResults]) => {
          const s = startResults?.[0]
          const e = endResults?.[0]
          if (s && map) {
            const m = new mapboxgl.Marker({ element: startEl, anchor: 'bottom' })
              .setLngLat([s.lng, s.lat])
              .addTo(map)
            stopMarkersRef.current.push(m)
          }
          if (e && map) {
            const m = new mapboxgl.Marker({ element: endEl, anchor: 'bottom' })
              .setLngLat([e.lng, e.lat])
              .addTo(map)
            stopMarkersRef.current.push(m)
          }
        }).catch(() => null)
      }
    }

    return () => {
      stopMarkersRef.current.forEach(m => m.remove())
      stopMarkersRef.current = []
    }
  }, [routes, selected, map])

  // ── Formatters ────────────────────────────────────────────────────────────────
  const fmtTime = (iso: string) =>
    iso ? new Date(iso).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }) : '—'

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60)
    return m < 60 ? `${m} min` : `${Math.floor(m/60)}h${(m%60).toString().padStart(2,'0')}`
  }

  const legIcon  = (t: string) => ({ walk:'🚶', tpg:'🚌', cff:'🚄', ceva:'🚆', other:'🚍' }[t] ?? '🚌')
  const legColor = (t: string) => ({
    tpg:'#FF9F0A', cff:'#0A84FF', ceva:'#AF52DE',
    walk:'rgba(255,255,255,0.3)', other:'rgba(255,255,255,0.5)',
  }[t] ?? 'rgba(255,255,255,0.5)')

  return (
    <div
      className={[
        // Mobile: fixed bottom sheet with height driven by sheetState
        'fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl transition-[height] duration-300 ease-out',
        // Desktop sm+: sidebar, auto height
        'sm:absolute sm:bottom-auto sm:left-4 sm:right-auto sm:top-20',
        'sm:w-80 sm:rounded-2xl sm:h-auto',
        'overflow-hidden flex flex-col',
      ].join(' ')}
      style={{
        ...LG,
        // On mobile drive height by sheetState; on sm+ let content dictate height
        height: SHEET_HEIGHTS[sheetState],
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Drag handle (mobile only) */}
      <div className="flex justify-center pt-2.5 pb-1 sm:hidden flex-shrink-0 cursor-grab active:cursor-grabbing">
        <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
      </div>

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🚌</span>
          <span className="text-sm font-semibold text-white/85">{t.transit.title}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center
                       text-white/40 hover:text-white/70 transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)' }}
            aria-label="Fermer"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto flex-1">
        {/* Inputs */}
        <div className="p-3 space-y-2">
          <SearchBox
            placeholder={t.transit.origin}
            icon="🔵"
            value={origin?.title}
            gpsHint
            onGPSSelect={() => {
              if (!navigator.geolocation) return
              navigator.geolocation.getCurrentPosition(pos => {
                const r: SearchResult = {
                  id: 'gps', title: tRef.current.searchBox.gpsTitle,
                  lat: pos.coords.latitude, lng: pos.coords.longitude,
                  type: 'address',
                }
                setOrigin(r)
                map?.flyTo({ center: [r.lng, r.lat], zoom: 15, duration: 600, essential: true })
              })
            }}
            onSelect={r => {
              setOrigin(r)
              map?.flyTo({ center: [r.lng, r.lat], zoom: 15, duration: 600, essential: true })
            }}
          />
          <SearchBox
            placeholder={t.transit.destination}
            icon="🔴"
            value={destination?.title}
            onSelect={r => {
              setDestination(r)
              if (!origin) map?.flyTo({ center: [r.lng, r.lat], zoom: 14, duration: 600, essential: true })
            }}
          />
        </div>

        {loading && (
          <div className="px-4 pb-3 flex items-center gap-2 text-white/50">
            <div
              className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
              style={{ borderColor: '#0A84FF', borderTopColor: 'transparent' }}
            />
            <span className="text-xs">{t.transit.searching}</span>
          </div>
        )}
        {error && <div className="px-4 pb-3 text-xs text-red-400">{error}</div>}

        {routes.length > 0 && !loading && (
          <div className="pb-4">
            {routes.map((route, idx) => (
              <div
                key={route.id}
                onClick={() => setSelected(idx)}
                className="cursor-pointer transition-colors"
                style={{
                  background: idx === selected ? 'rgba(10,132,255,0.10)' : 'transparent',
                  borderTop:  idx > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                <div className="px-4 py-3">
                  {/* Time + duration row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-bold"
                        style={{ color: idx === selected ? '#0A84FF' : 'rgba(255,255,255,0.85)' }}
                      >
                        {fmtTime(route.summary.departure)}
                      </span>
                      <span className="text-[10px] text-white/30">→</span>
                      <span
                        className="text-sm font-bold"
                        style={{ color: idx === selected ? '#0A84FF' : 'rgba(255,255,255,0.85)' }}
                      >
                        {fmtTime(route.summary.arrival)}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-white/50">
                      {fmtDuration(route.summary.duration)}
                    </span>
                  </div>

                  {/* Summary badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {route.summary.transfers > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/35">
                        {route.summary.transfers} {t.transit.transfers}
                      </span>
                    )}
                    {route.summary.walkDistance > 100 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/35">
                        🚶 {Math.round(route.summary.walkDistance)}m
                      </span>
                    )}
                    {route.summary.disrupted && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,69,58,0.15)', color: 'var(--red)' }}
                      >
                        {t.transit.disruption}
                      </span>
                    )}
                  </div>

                  {/* Leg detail — expanded for selected route */}
                  {idx === selected && (
                    <div className="mt-2.5 space-y-2">
                      {route.legs.map((leg, li) => (
                        <div key={li} className="flex items-start gap-2">
                          <span className="text-sm w-5 flex-shrink-0">{legIcon(leg.type)}</span>
                          <div className="flex-1 min-w-0">
                            {leg.type === 'walk' ? (
                              <span className="text-[10px] text-white/30">
                                {t.transit.walk} {leg.walkDistance ? `${Math.round(leg.walkDistance)}m` : ''}
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                {/* Line badge + from stop + departure time */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                    style={{
                                      background: `${legColor(leg.type)}20`,
                                      color: legColor(leg.type),
                                    }}
                                  >
                                    {leg.line}
                                  </span>
                                  <span className="text-[10px] font-medium text-white/70 truncate">
                                    {leg.from}
                                  </span>
                                  <span className="text-[10px] text-white/40 flex-shrink-0">
                                    {fmtTime(leg.departure)}
                                  </span>
                                </div>
                                {/* To stop + arrival time */}
                                <div className="flex items-center gap-1.5 pl-1">
                                  <span className="text-[10px] text-white/25">↳</span>
                                  <span className="text-[10px] text-white/55 truncate">{leg.to}</span>
                                  <span className="text-[10px] text-white/35 flex-shrink-0">
                                    {fmtTime(leg.arrival)}
                                  </span>
                                </div>
                              </div>
                            )}
                            {leg.delayMinutes > 0 && (
                              <span className="text-[10px] text-red-400 font-medium">
                                +{leg.delayMinutes} {t.transit.delay}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="px-4 pt-1">
              <p className="text-[10px] text-white/20">{t.transit.footer}</p>
            </div>
          </div>
        )}

        <div className="h-[env(safe-area-inset-bottom,0px)] sm:hidden" />
      </div>
    </div>
  )
}
