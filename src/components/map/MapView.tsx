'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { MapGLProps } from './MapGL'
import type { FilterState } from './FilterPanel'
import { useTerritorialLayers }    from './useTerritorialLayers'
import { useHereMobilityLayer }    from './useHereMobilityLayer'
import { useTransitNetworkLayer }  from './useTransitNetworkLayer'
import { G7Banner }                from './transport/G7Banner'
import { DisruptionsPanel }        from './transport/DisruptionsPanel'

const MapGL                = dynamic(() => import('./MapGL'),                { ssr: false })
const RealtimeLayer        = dynamic(() => import('./RealtimeLayer'),        { ssr: false })
const AlertLayer           = dynamic(() => import('./AlertLayer'),           { ssr: false })
const TerritoryLayer       = dynamic(() => import('./TerritoryLayer'),       { ssr: false })
const G7Overlay            = dynamic(() => import('./G7Overlay'),            { ssr: false })
const FilterPanel          = dynamic(() => import('./FilterPanel'),          { ssr: false })
const BorderCrossingsLayer = dynamic(() => import('./BorderCrossingsLayer'), { ssr: false })
const RoadClosuresLayer    = dynamic(() => import('./RoadClosuresLayer'),    { ssr: false })
const HereIncidentsLayer   = dynamic(() => import('./HereIncidentsLayer'),   { ssr: false })
const CarRoutingPanel      = dynamic(() => import('./routing/CarRoutingPanel').then(m => ({ default: m.CarRoutingPanel })),       { ssr: false })
const TransportRoutingPanel = dynamic(() => import('./routing/TransportRoutingPanel').then(m => ({ default: m.TransportRoutingPanel })), { ssr: false })

const DEFAULT_FILTERS: FilterState = {
  heatmap:   true,
  alerts:    true,
  transport: false,
  territory: true,
}

const TRANSPORT_LEGEND = [
  { color: '#FF9500', label: 'Tram TPG' },
  { color: '#34C759', label: 'Bus TPG'  },
  { color: '#0040FF', label: 'Train CFF' },
  { color: '#AF52DE', label: 'Léman Express' },
  { color: '#FF3B30', label: 'Ligne perturbée', dashed: true },
]

export default function MapView(props: Omit<MapGLProps, 'onMapReady'>) {
  const [map,         setMap]         = useState<mapboxgl.Map | null>(null)
  const [filters,     setFilters]     = useState<FilterState>(DEFAULT_FILTERS)
  const [routingMode, setRoutingMode] = useState<'car' | 'transport' | null>(null)
  const searchPinRef = useRef<mapboxgl.Marker | null>(null)

  useHereMobilityLayer(filters.heatmap && !filters.transport ? map : null)
  useTransitNetworkLayer(filters.transport ? map : null)
  useTerritorialLayers(filters.alerts ? map : null)

  // Listen for tif:search-pin events and place a red marker on the map
  useEffect(() => {
    if (!map) return

    const handleSearchPin = (e: Event) => {
      const { lat, lng } = (e as CustomEvent<{ lat: number; lng: number; title: string }>).detail

      // Remove previous search pin if any
      if (searchPinRef.current) {
        searchPinRef.current.remove()
        searchPinRef.current = null
      }

      // Create Liquid Glass red dot marker element
      const el = document.createElement('div')
      el.style.cssText = 'width:28px;height:28px;border-radius:50%;background:rgba(255,69,58,0.9);border:2.5px solid white;box-shadow:0 0 12px rgba(255,69,58,0.5)'

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map)

      searchPinRef.current = marker
    }

    window.addEventListener('tif:search-pin', handleSearchPin)
    return () => window.removeEventListener('tif:search-pin', handleSearchPin)
  }, [map])

  return (
    <>
      <MapGL {...props} onMapReady={setMap} />

      <G7Banner />
      {filters.transport && <DisruptionsPanel />}

      <BorderCrossingsLayer map={map} />
      <RoadClosuresLayer    map={map} />

      {map && (
        <>
          <TerritoryLayer map={map} visible={filters.territory} />
          <RealtimeLayer  map={map} visible={filters.heatmap} showTransport={filters.transport} />
          <AlertLayer     map={map} visible={filters.alerts} />
          <G7Overlay      map={map} />
          <HereIncidentsLayer map={filters.alerts && !filters.transport ? map : null} />

          {/* Transport legend — compact Liquid Glass badge, bottom-right */}
          {filters.transport && (
            <TransportLegend />
          )}

          {/* Control bar — Liquid Glass pill, bottom center */}
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            routingMode={routingMode}
            onRouting={setRoutingMode}
          />
        </>
      )}

      {/* Routing bottom sheets */}
      {routingMode === 'car' && (
        <CarRoutingPanel
          map={map}
          onClose={() => setRoutingMode(null)}
        />
      )}
      {routingMode === 'transport' && (
        <TransportRoutingPanel
          map={map}
          onClose={() => setRoutingMode(null)}
        />
      )}
    </>
  )
}

// ── Transport legend — compact Liquid Glass badge ─────────────────────────────
function TransportLegend() {
  return (
    <div
      className="absolute bottom-24 right-4 z-10 rounded-2xl px-3 py-2.5"
      style={{
        background:           'rgba(18,18,22,0.72)',
        backdropFilter:       'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border:               '1px solid rgba(255,255,255,0.11)',
        boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.12), 0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div className="flex flex-col gap-1.5">
        {TRANSPORT_LEGEND.map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <svg width="18" height="5" className="flex-shrink-0">
              <line
                x1="0" y1="2.5" x2="18" y2="2.5"
                stroke={item.color}
                strokeWidth="2.5"
                strokeDasharray={item.dashed ? '4 2' : undefined}
              />
            </svg>
            <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {item.label}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 border-t pt-1 mt-0.5" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <span className="text-[10px]">🚧</span>
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Perturbation arrêt
          </span>
        </div>
      </div>
    </div>
  )
}
