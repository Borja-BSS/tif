'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { SearchBox }    from './SearchBox'
import { RouteDisplay } from './RouteDisplay'
import type { SearchResult } from '@/lib/routing/shared/search-engine'
import type { CarRoute }     from '@/lib/routing/car/here-router'
import type mapboxgl         from 'mapbox-gl'

interface CarRoutingPanelProps {
  map:      mapboxgl.Map | null
  onClose?: () => void
}

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
  const [geoState,    setGeoState]    = useState<'loading' | 'ok' | 'denied' | 'idle'>('idle')
  const watchRef = useRef<number | null>(null)

  // ── Auto-acquire GPS when panel opens ────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return
    setGeoState('loading')

    navigator.geolocation.getCurrentPosition(
      pos => {
        setOrigin({
          id:    'gps',
          title: 'Ma position',
          lat:   pos.coords.latitude,
          lng:   pos.coords.longitude,
          type:  'address',
        })
        setGeoState('ok')
      },
      () => setGeoState('denied'),
      { enableHighAccuracy: true, timeout: 6000 },
    )

    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
    }
  }, [])

  // ── Manually refresh GPS position ────────────────────────────────────────────
  const refreshGPS = useCallback(() => {
    if (!navigator.geolocation) return
    setGeoState('loading')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setOrigin({
          id:    'gps',
          title: 'Ma position',
          lat:   pos.coords.latitude,
          lng:   pos.coords.longitude,
          type:  'address',
        })
        setGeoState('ok')
        map?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, duration: 600 })
      },
      () => setGeoState('denied'),
      { enableHighAccuracy: true, timeout: 6000 },
    )
  }, [map])

  // ── Route calculation ─────────────────────────────────────────────────────────
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
            [[Math.min(...coords.map((c: [number,number]) => c[0])), Math.min(...coords.map((c: [number,number]) => c[1]))],
             [Math.max(...coords.map((c: [number,number]) => c[0])), Math.max(...coords.map((c: [number,number]) => c[1]))]],
            { padding: { top: 80, bottom: 300, left: 40, right: 40 }, duration: 900, essential: true },
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

  // Recalcul auto toutes les 2 minutes
  useEffect(() => {
    if (routes.length === 0) return
    const t = setInterval(() => {
      if (origin && destination) calculate(origin, destination)
    }, 120_000)
    return () => clearInterval(t)
  }, [routes.length, origin, destination, calculate])

  // ── Formatters ────────────────────────────────────────────────────────────────
  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${(m % 60).toString().padStart(2, '0')}`
  }
  const fmtDist = (m: number) => m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)} km`

  // ── GPS origin button ─────────────────────────────────────────────────────────
  const handleGPSSelect = () => {
    if (geoState === 'ok' && origin?.id === 'gps') return
    refreshGPS()
  }

  // ── Zoom immediat sur l'adresse selectionnée (Waze/GMaps style) ──────────────
  const handleOriginSelect = (result: SearchResult) => {
    setOrigin(result)
    setGeoState('idle')
    if (map) {
      map.flyTo({ center: [result.lng, result.lat], zoom: 15, duration: 600, essential: true })
    }
  }

  const handleDestinationSelect = (result: SearchResult) => {
    setDestination(result)
    if (map) {
      // Si l'origine est déjà définie, on reste à un zoom intermédiaire (le fitBounds du calcul prendra le relais)
      if (!origin) {
        map.flyTo({ center: [result.lng, result.lat], zoom: 14, duration: 600, essential: true })
      }
    }
  }

  return (
    <>
      <RouteDisplay
        map={map}
        routes={routes}
        selectedIndex={selected}
        origin={origin}
        destination={destination}
      />

      <div
        className={[
          'fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl',
          'sm:absolute sm:bottom-auto sm:left-4 sm:right-auto sm:top-20',
          'sm:w-80 sm:rounded-2xl overflow-hidden',
        ].join(' ')}
        style={LG}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
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
          {onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center
                         text-white/35 hover:text-white/70 transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)' }}
              aria-label="Fermer"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M1 1l8 8M9 1L1 9"/>
              </svg>
            </button>
          )}
        </div>

        {/* Origin + Destination fields */}
        <div className="px-3 pt-3 pb-2 space-y-2">
          {/* Origin — with GPS hint */}
          <SearchBox
            placeholder="Point de départ"
            icon="🔵"
            value={origin?.title}
            loading={geoState === 'loading'}
            gpsHint
            onGPSSelect={handleGPSSelect}
            onSelect={handleOriginSelect}
          />
          <SearchBox
            placeholder="Destination"
            icon="🔴"
            value={destination?.title}
            onSelect={handleDestinationSelect}
          />
        </div>

        {/* Progress / error states */}
        {loading && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <span className="flex gap-0.5">
              {[0,1,2].map(i => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </span>
            <span className="text-xs text-white/45">Calcul de l&apos;itinéraire…</span>
          </div>
        )}
        {error && <div className="px-4 pb-3 text-xs" style={{ color: '#FF453A' }}>{error}</div>}

        {/* Route results */}
        {routes.length > 0 && !loading && (
          <div className="pb-3">
            {routes.map((route, idx) => (
              <button
                key={route.id}
                onClick={() => setSelected(idx)}
                className="w-full px-4 py-3 flex items-start justify-between
                           transition-colors text-left"
                style={{
                  background: idx === selected ? 'rgba(10,132,255,0.12)' : 'transparent',
                  borderTop:  idx > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-base font-bold"
                      style={{ color: idx === selected ? '#0A84FF' : 'rgba(255,255,255,0.85)' }}
                    >
                      {fmt(route.summary.durationInTraffic)}
                    </span>
                    {route.trafficDelay > 60 && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,159,10,0.18)', color: '#FF9F0A' }}
                      >
                        +{fmt(route.trafficDelay)} trafic
                      </span>
                    )}
                    {route.alternative && (
                      <span className="text-[10px] text-white/25">Alternative</span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/35">
                    {fmtDist(route.summary.distance)}
                    {route.warnings.length > 0 && (
                      <span className="ml-2 text-amber-400/70">⚠ {route.warnings[0]}</span>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-white/30 text-right mt-0.5">
                  <div>Arrivée</div>
                  <div className="font-medium text-white/50">
                    {new Date(route.summary.arrivalTime).toLocaleTimeString('fr-CH', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
              </button>
            ))}

            <div className="px-4 pt-1">
              <p className="text-[10px] text-white/20">
                Recalcul auto · 2 min · Trafic temps réel HERE
              </p>
            </div>
          </div>
        )}

        <div className="h-[env(safe-area-inset-bottom,0px)] sm:hidden" />
      </div>
    </>
  )
}
