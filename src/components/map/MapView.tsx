'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { MapGLProps } from './MapGL'
import type { FilterState } from './FilterPanel'
import type { FilterId } from './ui/QuickFilters'
import { useTerritorialLayers }    from './useTerritorialLayers'
import { useHereMobilityLayer }    from './useHereMobilityLayer'
import { useTransitNetworkLayer }  from './useTransitNetworkLayer'
import { useMapT } from '@/i18n/map'

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
const ParkingLayer         = dynamic(() => import('./ParkingLayer'),         { ssr: false })
const EventsLayer          = dynamic(() => import('./EventsLayer'),          { ssr: false })
const G7ClosuresLayer      = dynamic(() => import('./G7ClosuresLayer'),      { ssr: false })
const CustomAlertsLayer    = dynamic(() => import('./CustomAlertsLayer'),    { ssr: false })
const ImpactZonesLayer     = dynamic(() => import('./ImpactZonesLayer'),     { ssr: false })
const SignalementsLayer    = dynamic(() => import('./SignalementsLayer'),    { ssr: false })

import VoteToast from '@/components/map/ui/VoteToast'

const DEFAULT_FILTERS: FilterState = {
  heatmap:   true,
  alerts:    true,
  transport: false,
  territory: true,
  parking:   false,
}


interface MapViewProps extends Omit<MapGLProps, 'onMapReady'> {
  filters?:      FilterState
  activeFilter?: FilterId
  onMapReady?:   (map: mapboxgl.Map) => void
}

export default function MapView({ filters: externalFilters, activeFilter = 'all', onMapReady, ...props }: MapViewProps) {
  const [map,             setMap]             = useState<mapboxgl.Map | null>(null)
  const [internalFilters, setInternalFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const filters = externalFilters ?? internalFilters
  const searchPinRef = useRef<mapboxgl.Marker | null>(null)

  useHereMobilityLayer(map, filters.heatmap && !filters.transport)
  useTransitNetworkLayer(map, filters.transport)
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

      <BorderCrossingsLayer map={map} activeFilter={activeFilter} />
      <RoadClosuresLayer    map={map} />
      <ConstructionLayer    map={map} />

      {map && (
        <>
          <TerritoryLayer map={map} visible={filters.territory} />
          <RealtimeLayer  map={map} visible={filters.heatmap} showTransport={filters.transport} />
          <AlertLayer         map={map} visible={filters.alerts} />
          <CustomAlertsLayer  map={filters.alerts ? map : null} />
          <SignalementsLayer  map={map} />
          <VoteToast />
          <HereIncidentsLayer map={filters.alerts && !filters.transport ? map : null} />
          <ParkingLayer       map={filters.parking ? map : null} />
          <EventsLayer        map={activeFilter === 'events' ? map : null} />
          <ImpactZonesLayer   map={map} activeFilter={activeFilter} />

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


    </>
  )
}

// ── Transport legend — compact Liquid Glass badge ─────────────────────────────
function TransportLegend() {
  const t = useMapT()
  const TRANSPORT_LEGEND = [
    { color: '#FF9500', label: t.mapView.tramTpg },
    { color: '#34C759', label: t.mapView.busTpg  },
    { color: '#0040FF', label: t.mapView.trainCff },
    { color: '#AF52DE', label: t.mapView.leman },
    { color: '#FF3B30', label: t.mapView.disrupted, dashed: true },
  ]
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
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              {item.label}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 border-t pt-1 mt-0.5" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <span className="text-[10px]">🚧</span>
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t.mapView.stopDisruption}
          </span>
        </div>
      </div>
    </div>
  )
}
