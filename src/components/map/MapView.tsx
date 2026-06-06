'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { MapGLProps } from './MapGL'
import type { FilterState } from './FilterPanel'
import { useTerritorialLayers }    from './useTerritorialLayers'
import { useHereMobilityLayer }    from './useHereMobilityLayer'
import { useTransitNetworkLayer }  from './useTransitNetworkLayer'

const MapGL                = dynamic(() => import('./MapGL'),                { ssr: false })
const RealtimeLayer        = dynamic(() => import('./RealtimeLayer'),        { ssr: false })
const AlertLayer           = dynamic(() => import('./AlertLayer'),           { ssr: false })
const TerritoryLayer       = dynamic(() => import('./TerritoryLayer'),       { ssr: false })
// G7Overlay supprimé — countdown remplacé par la carte G7 dans le BottomSheet
const FilterPanel          = dynamic(() => import('./FilterPanel'),          { ssr: false })
const BorderCrossingsLayer = dynamic(() => import('./BorderCrossingsLayer'), { ssr: false })
const RoadClosuresLayer    = dynamic(() => import('./RoadClosuresLayer'),    { ssr: false })
const ConstructionLayer    = dynamic(() => import('./ConstructionLayer'),    { ssr: false })
const HereIncidentsLayer   = dynamic(() => import('./HereIncidentsLayer'),   { ssr: false })

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

interface MapViewProps extends Omit<MapGLProps, 'onMapReady'> {
  filters?:     FilterState
  onMapReady?:  (map: mapboxgl.Map) => void
}

export default function MapView({ filters: externalFilters, onMapReady, ...props }: MapViewProps) {
  const [map,             setMap]             = useState<mapboxgl.Map | null>(null)
  const [internalFilters, setInternalFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const filters = externalFilters ?? internalFilters
  const [territoryToast,  setTerritoryToast]  = useState(false)
  const territoryShownRef = useRef(false)
  const searchPinRef      = useRef<mapboxgl.Marker | null>(null)

  // ── Territory toast — shown once per session on first activation ──────────────
  useEffect(() => {
    if (filters.territory && !territoryShownRef.current) {
      territoryShownRef.current = true
      setTerritoryToast(true)
      const t = setTimeout(() => setTerritoryToast(false), 3000)
      return () => clearTimeout(t)
    }
  }, [filters.territory])

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
      <MapGL {...props} onMapReady={m => { setMap(m); onMapReady?.(m) }} />

      <BorderCrossingsLayer map={map} />
      <RoadClosuresLayer    map={map} />
      <ConstructionLayer    map={map} />

      {map && (
        <>
          <TerritoryLayer map={map} visible={filters.territory} />
          <RealtimeLayer  map={map} visible={filters.heatmap} showTransport={filters.transport} />
          <AlertLayer     map={map} visible={filters.alerts} />
          <HereIncidentsLayer map={filters.alerts && !filters.transport ? map : null} />

          {/* Transport legend — compact Liquid Glass badge, bottom-right */}
          {filters.transport && (
            <TransportLegend />
          )}

          {/* FilterPanel — affiché seulement si pas de filtres externes */}
          {!externalFilters && (
            <FilterPanel
              filters={internalFilters}
              onChange={setInternalFilters}
            />
          )}
        </>
      )}

      {/* Territory toast — first activation of the session */}
      {territoryToast && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-3 rounded-2xl
                     text-sm font-medium text-white/90 text-center max-w-xs
                     animate-in fade-in slide-in-from-top-2 duration-300"
          style={{
            background:           'rgba(18,18,22,0.88)',
            backdropFilter:       'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border:               '1px solid rgba(255,196,0,0.35)',
            boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.12), 0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <span className="mr-1">🗺️</span>
          <span style={{ color: 'rgba(255,196,0,0.9)' }}>Zones G7</span>
          <span className="text-white/60"> — </span>
          <span className="text-[12px] text-white/75">
            Périmètres de sécurité, restrictions d&apos;accès et conditions d&apos;entrée pour le Grand Genève du 8 au 18 juin 2026.
          </span>
        </div>
      )}
    </>
  )
}

// ── Transport legend — compact Liquid Glass badge ─────────────────────────────
function TransportLegend() {
  return (
    <div
      className="absolute bottom-24 left-4 z-10 rounded-2xl px-3 py-2.5"
      style={{
        background:           'rgba(255,255,255,0.05)',
        backdropFilter:       'blur(40px) saturate(200%) brightness(1.05)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%) brightness(1.05)',
        border:               '0.5px solid rgba(255,255,255,0.20)',
        boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.25), 0 4px 20px rgba(0,0,0,0.08)',
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
