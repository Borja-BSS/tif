'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import type { MapGLProps } from './MapGL'
import type { FilterState } from './FilterPanel'
import { useTerritorialLayers }  from './useTerritorialLayers'
import { useHereMobilityLayer }  from './useHereMobilityLayer'
import { useHereAlertsLayer }    from './useHereAlertsLayer'
import { useGtfsTransportLayer } from './useGtfsTransportLayer'
import { G7Banner }              from './transport/G7Banner'

const MapGL                = dynamic(() => import('./MapGL'),                { ssr: false })
const RealtimeLayer        = dynamic(() => import('./RealtimeLayer'),        { ssr: false })
const AlertLayer           = dynamic(() => import('./AlertLayer'),           { ssr: false })
const TerritoryLayer       = dynamic(() => import('./TerritoryLayer'),       { ssr: false })
const G7Overlay            = dynamic(() => import('./G7Overlay'),            { ssr: false })
const FilterPanel          = dynamic(() => import('./FilterPanel'),          { ssr: false })
const BorderCrossingsLayer = dynamic(() => import('./BorderCrossingsLayer'), { ssr: false })

const DEFAULT_FILTERS: FilterState = {
  heatmap:   true,
  alerts:    true,
  transport: true,
  territory: true,
}

const TRANSPORT_LEGEND = [
  { color: '#FF9500', label: 'Tram TPG' },
  { color: '#34C759', label: 'Bus TPG'  },
  { color: '#0040FF', label: 'Train CFF' },
  { color: '#AF52DE', label: 'Léman Express' },
]

export default function MapView(props: Omit<MapGLProps, 'onMapReady'>) {
  const [map, setMap]         = useState<mapboxgl.Map | null>(null)
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  // HERE Maps — trafic temps réel (lignes colorées)
  useHereMobilityLayer(filters.heatmap ? map : null)

  // HERE Maps — incidents/alertes (markers emoji)
  useHereAlertsLayer(filters.alerts ? map : null)

  // GTFS-RT — positions véhicules TPG/CFF + perturbations
  useGtfsTransportLayer(filters.transport ? map : null)

  // TIF — événements territoriaux détectés (TerritorialEvent DB)
  useTerritorialLayers(filters.alerts ? map : null)

  return (
    <>
      <MapGL {...props} onMapReady={setMap} />
      {/* G7Banner mounted early — listens to custom event from transport hook */}
      <G7Banner />
      {/* Prefetch démarre immédiatement, markers appliqués dès que la carte est prête */}
      <BorderCrossingsLayer map={map} />
      {map && (
        <>
          <TerritoryLayer map={map} visible={filters.territory} />
          <RealtimeLayer  map={map} visible={filters.heatmap} showTransport={filters.transport} />
          <AlertLayer     map={map} visible={filters.alerts} />
          <G7Overlay      map={map} />
          <FilterPanel    filters={filters} onChange={setFilters} />
          {filters.transport && (
            <div
              className="absolute bottom-52 left-4 z-10 rounded-xl border border-white/10 px-3 py-2"
              style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)' }}
            >
              <div className="flex flex-col gap-1.5">
                {TRANSPORT_LEGEND.map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{item.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 border-t border-white/10 mt-0.5 pt-1.5">
                  <span className="text-xs">🚧</span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Perturbation</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
