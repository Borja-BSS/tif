'use client'

import { useState, useCallback, useEffect } from 'react'
import { SearchBox } from './SearchBox'
import type { SearchResult }   from '@/lib/routing/shared/search-engine'
import type { TransportRoute } from '@/lib/routing/transport/transport-router'

interface TransportRoutingPanelProps {
  onClose?: () => void
}

const LG: React.CSSProperties = {
  background:           'rgba(18,18,22,0.82)',
  backdropFilter:       'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  border:               '1px solid rgba(255,255,255,0.13)',
  boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.14), 0 -8px 40px rgba(0,0,0,0.4)',
}

export function TransportRoutingPanel({ onClose }: TransportRoutingPanelProps) {
  const [origin,      setOrigin]      = useState<SearchResult | null>(null)
  const [destination, setDestination] = useState<SearchResult | null>(null)
  const [routes,      setRoutes]      = useState<TransportRoute[]>([])
  const [selected,    setSelected]    = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

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
      if (data.routes?.length > 0) { setRoutes(data.routes); setSelected(0) }
      else setError('Aucune connexion disponible.')
    } catch { setError('Calcul indisponible.') }
    finally  { setLoading(false) }
  }, [])

  useEffect(() => {
    if (origin && destination) calculate(origin, destination)
  }, [origin, destination, calculate])

  useEffect(() => {
    if (routes.length === 0) return
    const t = setInterval(() => {
      if (origin && destination) calculate(origin, destination)
    }, 180_000)
    return () => clearInterval(t)
  }, [routes.length, origin, destination, calculate])

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
        'fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl',
        'sm:absolute sm:bottom-auto sm:left-4 sm:right-auto sm:top-20',
        'sm:w-80 sm:rounded-2xl',
        'overflow-hidden',
      ].join(' ')}
      style={LG}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
        <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b"
           style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">🧭</span>
          <span className="text-sm font-semibold text-white/85">Itinéraire transports</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center
                       text-white/40 hover:text-white/70 transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Inputs */}
      <div className="p-3 space-y-2">
        <SearchBox placeholder="Point de départ..." icon="🔵" onSelect={setOrigin} />
        <SearchBox placeholder="Destination..."     icon="🔴" onSelect={setDestination} />
      </div>

      {loading && (
        <div className="px-4 pb-3 flex items-center gap-2 text-white/50">
          <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin"
               style={{ borderColor: '#0A84FF', borderTopColor: 'transparent' }} />
          <span className="text-xs">Recherche des connexions…</span>
        </div>
      )}
      {error && <div className="px-4 pb-3 text-xs text-red-400">{error}</div>}

      {routes.length > 0 && !loading && (
        <div className="max-h-72 overflow-y-auto pb-4">
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
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold"
                          style={{ color: idx === selected ? '#0A84FF' : 'rgba(255,255,255,0.85)' }}>
                      {fmtTime(route.summary.departure)}
                    </span>
                    <span className="text-[10px] text-white/30">→</span>
                    <span className="text-sm font-bold"
                          style={{ color: idx === selected ? '#0A84FF' : 'rgba(255,255,255,0.85)' }}>
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
                      {route.summary.transfers} corresp.
                    </span>
                  )}
                  {route.summary.walkDistance > 100 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/35">
                      🚶 {Math.round(route.summary.walkDistance)}m
                    </span>
                  )}
                  {route.summary.disrupted && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,69,58,0.15)', color: '#FF453A' }}>
                      ⚠ Perturbation
                    </span>
                  )}
                </div>

                {/* Leg detail */}
                {idx === selected && (
                  <div className="mt-2.5 space-y-1.5">
                    {route.legs.map((leg, li) => (
                      <div key={li} className="flex items-start gap-2">
                        <span className="text-sm w-5 flex-shrink-0">{legIcon(leg.type)}</span>
                        <div className="flex-1 min-w-0">
                          {leg.type === 'walk' ? (
                            <span className="text-[10px] text-white/30">
                              Marche {leg.walkDistance ? `${Math.round(leg.walkDistance)}m` : ''}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                    style={{ background: `${legColor(leg.type)}20`, color: legColor(leg.type) }}>
                                {leg.line}
                              </span>
                              <span className="text-[10px] truncate text-white/50">
                                {leg.from} → {leg.to}
                              </span>
                            </div>
                          )}
                          {leg.delayMinutes > 0 && (
                            <span className="text-[10px] text-red-400">+{leg.delayMinutes} min</span>
                          )}
                        </div>
                        <span className="text-[10px] text-white/30 flex-shrink-0">
                          {fmtTime(leg.departure)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div className="px-4 pt-1">
            <p className="text-[10px] text-white/20">TPG · CFF · Léman Express · Données temps réel</p>
          </div>
        </div>
      )}

      <div className="h-[env(safe-area-inset-bottom,0px)] sm:hidden" />
    </div>
  )
}
