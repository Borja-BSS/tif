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
          const lngs   = coords.map(c => c[0])
          const lats   = coords.map(c => c[1])
          map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: 80, duration: 800 },
          )
        }
      } else {
        setError('Aucun itinéraire trouvé.')
      }
    } catch {
      setError('Calcul indisponible. Vérifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }, [map])

  useEffect(() => {
    if (origin && destination) calculate(origin, destination)
  }, [origin, destination, calculate])

  // Recalcul auto toutes les 2 minutes si trajet actif
  useEffect(() => {
    if (routes.length === 0) return
    const timer = setInterval(() => {
      if (origin && destination) calculate(origin, destination)
    }, 120_000)
    return () => clearInterval(timer)
  }, [routes.length, origin, destination, calculate])

  const handlePositionUpdate = (lat: number, lng: number) => {
    setOrigin({ id: 'gps', title: 'Ma position', lat, lng, type: 'address' })
  }

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${(m % 60).toString().padStart(2, '0')}`
  }

  const formatDistance = (m: number) =>
    m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`

  return (
    <>
      <RouteDisplay map={map} routes={routes} selectedIndex={selected} />

      <div
        className="absolute top-20 left-4 w-80 rounded-2xl border shadow-xl z-20 overflow-hidden"
        style={{ background: 'rgba(0,0,0,0.88)', borderColor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b"
             style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <span className="text-sm font-semibold text-white/85">🚗 Itinéraire voiture</span>
          <div className="flex items-center gap-2">
            <RecenterButton map={map} onPositionUpdate={handlePositionUpdate} />
            {onClose && (
              <button onClick={onClose} className="text-lg leading-none text-white/35 hover:text-white/70">×</button>
            )}
          </div>
        </div>

        {/* Champs */}
        <div className="p-3 space-y-2">
          <SearchBox placeholder="Point de départ..." icon="🔵" value={origin?.title}      onSelect={setOrigin} />
          <SearchBox placeholder="Destination..."     icon="🔴" value={destination?.title} onSelect={setDestination} />
        </div>

        {loading && (
          <div className="px-4 py-3 flex items-center gap-2 text-white/50">
            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                 style={{ borderColor: '#0A84FF', borderTopColor: 'transparent' }} />
            <span className="text-sm">Calcul en cours...</span>
          </div>
        )}

        {error && <div className="px-4 py-3 text-sm text-red-400">{error}</div>}

        {routes.length > 0 && !loading && (
          <div className="pb-3">
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
                      {formatDuration(route.summary.durationInTraffic)}
                    </span>
                    {route.trafficDelay > 60 && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(255,149,10,0.15)', color: '#FF9F0A' }}>
                        +{formatDuration(route.trafficDelay)} trafic
                      </span>
                    )}
                    {route.alternative && (
                      <span className="text-xs text-white/35">Alternative</span>
                    )}
                  </div>
                  <div className="text-xs mt-1 text-white/40">
                    {formatDistance(route.summary.distance)}
                    {route.warnings.length > 0 && (
                      <span className="ml-2">⚠️ {route.warnings[0]}</span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-white/35">
                  Arrivée {new Date(route.summary.arrivalTime).toLocaleTimeString('fr-CH', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </button>
            ))}

            <div className="px-4 pt-2">
              <p className="text-xs text-white/25">Recalcul auto toutes les 2 min · Données trafic temps réel</p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
