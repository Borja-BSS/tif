'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import type { MapGLProps } from './MapGL'
import type { FilterState } from './FilterPanel'
import { useTerritorialLayers }    from './useTerritorialLayers'
import { useHereMobilityLayer }    from './useHereMobilityLayer'
import { useHereAlertsLayer }      from './useHereAlertsLayer'
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
const WazeLayer            = dynamic(() => import('./WazeLayer'),            { ssr: false })

const DEFAULT_FILTERS: FilterState = {
  heatmap:   true,
  alerts:    true,
  transport: false,
  territory: true,
  waze:      false,
}

const TRANSPORT_LEGEND = [
  { color: '#FF9500', label: 'Tram TPG' },
  { color: '#34C759', label: 'Bus TPG'  },
  { color: '#0040FF', label: 'Train CFF' },
  { color: '#AF52DE', label: 'Léman Express' },
  { color: '#FF3B30', label: 'Ligne perturbée', dashed: true },
]

export default function MapView(props: Omit<MapGLProps, 'onMapReady'>) {
  const [map, setMap]         = useState<mapboxgl.Map | null>(null)
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  // HERE trafic : masqué quand le filtre transport est actif (le réseau UNIRESO le remplace)
  useHereMobilityLayer(filters.heatmap && !filters.transport ? map : null)

  // HERE alertes incidents
  useHereAlertsLayer(filters.alerts ? map : null)

  // Réseau UNIRESO — toutes lignes TPG/CFF/CEVA + perturbations
  useTransitNetworkLayer(filters.transport ? map : null)

  // TIF — événements territoriaux
  useTerritorialLayers(filters.alerts ? map : null)

  return (
    <>
      <MapGL {...props} onMapReady={setMap} />

      {/* Bannières — montées tôt, écoutent des custom events */}
      <G7Banner />
      {filters.transport && <DisruptionsPanel />}

      {/* Douanes — prefetch immédiat hors garde map */}
      <BorderCrossingsLayer map={map} />

      {/* Routes fermées — layer permanent, hachures rouges/blanches */}
      <RoadClosuresLayer map={map} />

      {map && (
        <>
          <TerritoryLayer map={map} visible={filters.territory} />
          <RealtimeLayer  map={map} visible={filters.heatmap} showTransport={filters.transport} />
          <AlertLayer     map={map} visible={filters.alerts} />
          <G7Overlay      map={map} />
          <FilterPanel    filters={filters} onChange={setFilters} />

          {/* Waze — bouchons crowdsourcés + alertes + fermetures */}
          <WazeLayer map={map} visible={filters.waze} />

          {/* Légende transport */}
          {filters.transport && (
            <div
              className="absolute bottom-52 left-4 z-10 rounded-xl border border-white/10 px-3 py-2.5"
              style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
            >
              <div className="flex flex-col gap-1.5">
                {TRANSPORT_LEGEND.map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <svg width="20" height="6" className="flex-shrink-0">
                      <line
                        x1="0" y1="3" x2="20" y2="3"
                        stroke={item.color}
                        strokeWidth="3"
                        strokeDasharray={item.dashed ? '4 2' : undefined}
                      />
                    </svg>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {item.label}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-2 border-t border-white/10 mt-0.5 pt-1.5">
                  <span className="text-xs">🚧</span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Perturbation arrêt
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
