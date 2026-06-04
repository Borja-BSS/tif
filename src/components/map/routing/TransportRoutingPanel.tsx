'use client'

import { useState, useCallback, useEffect } from 'react'
import { SearchBox } from './SearchBox'
import type { SearchResult }   from '@/lib/routing/shared/search-engine'
import type { TransportRoute } from '@/lib/routing/transport/transport-router'

interface TransportRoutingPanelProps {
  onClose?: () => void
}

export function TransportRoutingPanel({ onClose }: TransportRoutingPanelProps) {
  const [origin,      setOrigin]      = useState<SearchResult | null>(null)
  const [destination, setDestination] = useState<SearchResult | null>(null)
  const [routes,      setRoutes]      = useState<TransportRoute[]>([])
  const [selected,    setSelected]    = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const calculate = useCallback(async (from: SearchResult, to: SearchResult) => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/v1/routing/transport', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          from: { lat: from.lat, lng: from.lng, name: from.type === 'station' ? from.title : undefined },
          to:   { lat: to.lat,   lng: to.lng,   name: to.type   === 'station' ? to.title   : undefined },
        }),
        signal: AbortSignal.timeout(15000),
      })

      const data = await res.json()
      if (data.routes?.length > 0) {
        setRoutes(data.routes)
        setSelected(0)
      } else {
        setError('Aucune connexion disponible.')
      }
    } catch {
      setError('Calcul indisponible.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (origin && destination) calculate(origin, destination)
  }, [origin, destination, calculate])

  // Recalcul auto toutes les 3 minutes
  useEffect(() => {
    if (routes.length === 0) return
    const timer = setInterval(() => {
      if (origin && destination) calculate(origin, destination)
    }, 180_000)
    return () => clearInterval(timer)
  }, [routes.length, origin, destination, calculate])

  const formatTime = (iso: string) =>
    iso ? new Date(iso).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }) : '—'

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${(m % 60).toString().padStart(2, '0')}`
  }

  const legIcon  = (type: string) => ({ walk: '🚶', tpg: '🚌', cff: '🚄', ceva: '🚆', other: '🚍' }[type] ?? '🚌')
  const legColor = (type: string) => ({
    tpg: '#FF9F0A', cff: '#0A84FF', ceva: '#AF52DE',
    walk: 'rgba(255,255,255,0.35)', other: 'rgba(255,255,255,0.5)',
  }[type] ?? 'rgba(255,255,255,0.5)')

  return (
    <div
      className="absolute top-20 left-4 w-80 rounded-2xl border shadow-xl z-20 overflow-hidden"
      style={{ background: 'rgba(0,0,0,0.88)', borderColor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b"
           style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <span className="text-sm font-semibold text-white/85">🚌 Itinéraire transport</span>
        {onClose && (
          <button onClick={onClose} className="text-lg text-white/35 hover:text-white/70">×</button>
        )}
      </div>

      {/* Champs */}
      <div className="p-3 space-y-2">
        <SearchBox placeholder="Point de départ..." icon="🔵" onSelect={setOrigin} />
        <SearchBox placeholder="Destination..."     icon="🔴" onSelect={setDestination} />
      </div>

      {loading && (
        <div className="px-4 py-3 flex items-center gap-2 text-white/50">
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
               style={{ borderColor: '#0A84FF', borderTopColor: 'transparent' }} />
          <span className="text-sm">Recherche des connexions...</span>
        </div>
      )}

      {error && <div className="px-4 py-3 text-sm text-red-400">{error}</div>}

      {routes.length > 0 && !loading && (
        <div className="max-h-96 overflow-y-auto pb-3">
          {routes.map((route, idx) => (
            <div
              key={route.id}
              onClick={() => setSelected(idx)}
              className="cursor-pointer transition-colors"
              style={{
                background: idx === selected ? 'rgba(10,132,255,0.10)' : 'transparent',
                borderTop:  idx > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              }}
            >
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold"
                          style={{ color: idx === selected ? '#0A84FF' : 'rgba(255,255,255,0.85)' }}>
                      {formatTime(route.summary.departure)}
                    </span>
                    <span className="text-xs text-white/35">→</span>
                    <span className="text-base font-bold"
                          style={{ color: idx === selected ? '#0A84FF' : 'rgba(255,255,255,0.85)' }}>
                      {formatTime(route.summary.arrival)}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-white/55">
                    {formatDuration(route.summary.duration)}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {route.summary.transfers > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40">
                      {route.summary.transfers} correspondance{route.summary.transfers > 1 ? 's' : ''}
                    </span>
                  )}
                  {route.summary.walkDistance > 100 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40">
                      🚶 {Math.round(route.summary.walkDistance)}m
                    </span>
                  )}
                  {route.summary.disrupted && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,69,58,0.15)', color: '#FF453A' }}>
                      ⚠️ Perturbation
                    </span>
                  )}
                </div>

                {idx === selected && (
                  <div className="mt-3 space-y-1.5">
                    {route.legs.map((leg, li) => (
                      <div key={li} className="flex items-start gap-2">
                        <span className="text-sm w-5 flex-shrink-0">{legIcon(leg.type)}</span>
                        <div className="flex-1 min-w-0">
                          {leg.type === 'walk' ? (
                            <span className="text-xs text-white/35">
                              Marche {leg.walkDistance ? `${Math.round(leg.walkDistance)}m` : ''}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                                    style={{ background: `${legColor(leg.type)}20`, color: legColor(leg.type) }}>
                                {leg.line}
                              </span>
                              <span className="text-xs truncate text-white/55">
                                {leg.from} → {leg.to}
                              </span>
                            </div>
                          )}
                          {leg.delayMinutes > 0 && (
                            <span className="text-xs text-red-400">+{leg.delayMinutes} min</span>
                          )}
                        </div>
                        <span className="text-xs flex-shrink-0 text-white/35">
                          {formatTime(leg.departure)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="px-4 pt-1">
            <p className="text-xs text-white/25">TPG · CFF · Léman Express · Données temps réel</p>
          </div>
        </div>
      )}
    </div>
  )
}
