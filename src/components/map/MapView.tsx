'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import type { MapGLProps } from './MapGL'
import type { FilterState } from './FilterPanel'

const MapGL          = dynamic(() => import('./MapGL'),          { ssr: false })
const RealtimeLayer  = dynamic(() => import('./RealtimeLayer'),  { ssr: false })
const AlertLayer     = dynamic(() => import('./AlertLayer'),     { ssr: false })
const TerritoryLayer = dynamic(() => import('./TerritoryLayer'), { ssr: false })
const G7Overlay      = dynamic(() => import('./G7Overlay'),      { ssr: false })
const FilterPanel    = dynamic(() => import('./FilterPanel'),    { ssr: false })

const DEFAULT_FILTERS: FilterState = {
  heatmap:   true,
  alerts:    true,
  transport: true,
  territory: true,
}

export default function MapView(props: Omit<MapGLProps, 'onMapReady'>) {
  const [map, setMap]         = useState<mapboxgl.Map | null>(null)
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  return (
    <>
      <MapGL {...props} onMapReady={setMap} />
      {map && (
        <>
          <TerritoryLayer map={map} visible={filters.territory} />
          <RealtimeLayer  map={map} visible={filters.heatmap} showTransport={filters.transport} />
          <AlertLayer     map={map} visible={filters.alerts} />
          <G7Overlay      map={map} />
          <FilterPanel    filters={filters} onChange={setFilters} />
        </>
      )}
    </>
  )
}
