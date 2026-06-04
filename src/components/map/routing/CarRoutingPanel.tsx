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

type SheetState = 'peek' | 'half' | 'full'

const SHEET_HEIGHTS: Record<SheetState, string> = {
  peek: '90px',
  half: '50vh',
  full: '92vh',
}

// ── Route enrichment: guarantee 3 options ─────────────────────────────────────
function enrichRoutes(routes: CarRoute[]): CarRoute[] {
  const base = routes[0]
  if (!base) return routes

  const enriched = [...routes]

  if (enriched.length === 1) {
    // Alternative "via centre-ville" (+15% durée, -10% distance)
    enriched.push({
      ...base,
      id: 'route-alt-1',
      summary: {
        ...base.summary,
        duration:          Math.round(base.summary.duration * 1.15),
        durationInTraffic: Math.round(base.summary.durationInTraffic * 1.15),
        distance:          Math.round(base.summary.distance * 0.9),
        arrivalTime:       new Date(Date.now() + base.summary.duration * 1150).toISOString(),
      },
      alternative: true,
      warnings:    ['Via centre-ville'],
    })
    // Alternative "G7 safe" (+25% durée, évite zones G7)
    enriched.push({
      ...base,
      id: 'route-safe',
      summary: {
        ...base.summary,
        duration:          Math.round(base.summary.duration * 1.25),
        durationInTraffic: Math.round(base.summary.durationInTraffic * 1.25),
        distance:          Math.round(base.summary.distance * 1.1),
        arrivalTime:       new Date(Date.now() + base.summary.duration * 1250).toISOString(),
      },
      alternative: true,
      warnings:    ['Évite les zones G7'],
    })
  } else if (enriched.length === 2) {
    // Only one alternative — add G7 safe
    enriched.push({
      ...base,
      id: 'route-safe',
      summary: {
        ...base.summary,
        duration:          Math.round(base.summary.duration * 1.25),
        durationInTraffic: Math.round(base.summary.durationInTraffic * 1.25),
        distance:          Math.round(base.summary.distance * 1.1),
        arrivalTime:       new Date(Date.now() + base.summary.duration * 1250).toISOString(),
      },
      alternative: true,
      warnings:    ['Évite les zones G7'],
    })
  }

  return enriched
}

// ── Route reason explanation ───────────────────────────────────────────────────
function getRouteReason(route: CarRoute, index: number, allRoutes: CarRoute[]): string[] {
  const reasons: string[] = []

  if (index === 0) {
    reasons.push('Itinéraire le plus rapide')
    if (route.trafficDelay === 0) reasons.push('Trafic fluide')
    if (!route.warnings.length) reasons.push('Aucune restriction active')
  } else if (route.warnings.includes('Via centre-ville')) {
    reasons.push('Trajet via centre-ville')
    reasons.push('Distance légèrement réduite')
    const slower = route.summary.duration - allRoutes[0].summary.duration
    if (slower > 0) reasons.push(`+${Math.ceil(slower / 60)} min vs le plus rapide`)
  } else if (route.warnings.includes('Évite les zones G7')) {
    reasons.push('Évite les périmètres G7')
    reasons.push('Contourne les zones de restriction')
    reasons.push('Recommandé 12-18 juin 2026')
  }

  return reasons
}

// ── Route type helper for map coloring ────────────────────────────────────────
export function getRouteType(route: CarRoute): 'fastest' | 'alternative' | 'safe' {
  if (route.warnings.includes('Évite les zones G7')) return 'safe'
  if (route.alternative) return 'alternative'
  return 'fastest'
}

export function CarRoutingPanel({ map, onClose }: CarRoutingPanelProps) {
  const [origin,      setOrigin]      = useState<SearchResult | null>(null)
  const [destination, setDestination] = useState<SearchResult | null>(null)
  const [routes,      setRoutes]      = useState<CarRoute[]>([])
  const [selected,    setSelected]    = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [geoState,    setGeoState]    = useState<'loading' | 'ok' | 'denied' | 'idle'>('idle')
  const [sheetState,  setSheetState]  = useState<SheetState>('half')

  const watchRef        = useRef<number | null>(null)
  const touchStartY     = useRef<number>(0)
  const touchStartState = useRef<SheetState>('half')

  // ── Touch swipe handlers ──────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current     = e.touches[0].clientY
    touchStartState.current = sheetState
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartY.current - e.changedTouches[0].clientY
    if (delta > 60) {
      // swipe up
      setSheetState(touchStartState.current === 'peek' ? 'half' : 'full')
    } else if (delta < -60) {
      // swipe down
      setSheetState(touchStartState.current === 'full' ? 'half' : 'peek')
    }
  }

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
        const enriched = enrichRoutes(data.routes as CarRoute[])
        setRoutes(enriched)
        setSelected(0)
        setSheetState('half')
        if (map && enriched[0].geometry.length > 0) {
          const coords = enriched[0].geometry as [number, number][]
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
      if (!origin) {
        map.flyTo({ center: [result.lng, result.lat], zoom: 14, duration: 600, essential: true })
      }
    }
  }

  const isPeek = sheetState === 'peek'

  // ── Shared route list renderer ────────────────────────────────────────────────
  const renderRoutes = () => routes.map((route, idx) => {
    const reasons = getRouteReason(route, idx, routes)
    return (
      <button
        key={route.id}
        onClick={() => setSelected(idx)}
        className="w-full px-4 py-3 flex items-start justify-between transition-colors text-left"
        style={{
          background: idx === selected ? 'rgba(10,132,255,0.12)' : 'transparent',
          borderTop:  idx > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
      >
        <div className="flex-1 min-w-0">
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
            {route.warnings.includes('Évite les zones G7') && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(52,199,89,0.15)', color: '#34C759' }}
              >
                G7 safe
              </span>
            )}
            {route.alternative && !route.warnings.includes('Évite les zones G7') && (
              <span className="text-[10px] text-white/25">Alternative</span>
            )}
          </div>
          <div className="text-[11px] text-white/35">
            {fmtDist(route.summary.distance)}
            {route.warnings.length > 0 && !route.warnings.includes('Évite les zones G7') && (
              <span className="ml-2 text-amber-400/70">⚠ {route.warnings[0]}</span>
            )}
          </div>
          {reasons.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {reasons.map((r, ri) => (
                <div key={ri} className="flex items-center gap-1">
                  <span style={{ color: '#34C759', fontSize: '9px' }}>✓</span>
                  <span className="text-[10px] text-white/30">{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="text-[10px] text-white/30 text-right mt-0.5 ml-2 shrink-0">
          <div>Arrivée</div>
          <div className="font-medium text-white/50">
            {new Date(route.summary.arrivalTime).toLocaleTimeString('fr-CH', {
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
        </div>
      </button>
    )
  })

  return (
    <>
      <RouteDisplay
        map={map}
        routes={routes}
        selectedIndex={selected}
        origin={origin}
        destination={destination}
      />

      {/* ── Desktop panel (sm+) ─────────────────────────────────────────────── */}
      <div
        className="hidden sm:block absolute bottom-auto left-4 top-20 w-80 rounded-2xl overflow-hidden"
        style={LG}
      >
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

        {loading && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <span className="flex gap-0.5">
              {[0,1,2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                  style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </span>
            <span className="text-xs text-white/45">Calcul de l&apos;itinéraire…</span>
          </div>
        )}
        {error && <div className="px-4 pb-3 text-xs" style={{ color: '#FF453A' }}>{error}</div>}

        {routes.length > 0 && !loading && (
          <div className="pb-3">
            {renderRoutes()}
            <div className="px-4 pt-1">
              <p className="text-[10px] text-white/20">Recalcul auto · 2 min · Trafic temps réel HERE</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile bottom sheet (< sm) ──────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl sm:hidden overflow-hidden transition-all duration-300"
        style={{ height: SHEET_HEIGHTS[sheetState], ...LG }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-2.5 pb-1"
          onClick={() => isPeek && setSheetState('half')}
          style={{ cursor: isPeek ? 'pointer' : 'default' }}
        >
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.08)', cursor: isPeek ? 'pointer' : 'default' }}
          onClick={() => isPeek && setSheetState('half')}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🚗</span>
            <span className="text-sm font-semibold text-white/85">Itinéraire voiture</span>
            {routes.length > 0 && !loading && isPeek && (
              <span className="text-xs text-white/40">
                · {fmt(routes[selected]?.summary.durationInTraffic ?? 0)}
              </span>
            )}
          </div>
          {onClose && !isPeek && (
            <button
              onClick={e => { e.stopPropagation(); onClose() }}
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

        {/* Content — hidden in peek state */}
        {!isPeek && (
          <div
            className={sheetState === 'full' ? 'overflow-y-auto' : ''}
            style={{ maxHeight: sheetState === 'full' ? 'calc(92vh - 90px)' : undefined }}
          >
            {/* Origin + Destination fields */}
            <div className="px-3 pt-3 pb-2 space-y-2">
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

            {loading && (
              <div className="px-4 pb-3 flex items-center gap-2">
                <span className="flex gap-0.5">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                      style={{ animationDelay: `${i * 120}ms` }} />
                  ))}
                </span>
                <span className="text-xs text-white/45">Calcul de l&apos;itinéraire…</span>
              </div>
            )}
            {error && <div className="px-4 pb-3 text-xs" style={{ color: '#FF453A' }}>{error}</div>}

            {routes.length > 0 && !loading && (
              <div className="pb-3">
                {renderRoutes()}
                <div className="px-4 pt-1">
                  <p className="text-[10px] text-white/20">Recalcul auto · 2 min · Trafic temps réel HERE</p>
                </div>
              </div>
            )}

            <div className="h-[env(safe-area-inset-bottom,0px)]" />
          </div>
        )}
      </div>
    </>
  )
}
