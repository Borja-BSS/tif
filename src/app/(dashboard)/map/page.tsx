'use client'

export const dynamic = 'force-dynamic'

import { useState, useCallback, useMemo } from 'react'
import { useSession }             from '@/context/AuthContext'
import dynamicImport              from 'next/dynamic'
import mapboxgl                   from 'mapbox-gl'
import { SearchBar }              from '@/components/map/ui/SearchBar'
import SearchHandle              from '@/components/map/SearchHandle'
import TpgLineStopsLayer         from '@/components/map/TpgLineStopsLayer'
import { QuickFilters }           from '@/components/map/ui/QuickFilters'
import { FloatingControls }       from '@/components/map/ui/FloatingControls'
import { BottomSheet }            from '@/components/map/ui/BottomSheet'
import { SmartAlertManager }      from '@/components/map/ui/SmartAlert'
import { G7Mode, useG7Active }    from '@/components/map/modes/G7Mode'
import type { FilterId }          from '@/components/map/ui/QuickFilters'
import type { FilterState }       from '@/components/map/FilterPanel'

const MapView = dynamicImport(() => import('@/components/map/MapView'), { ssr: false })

function toFilterState(active: FilterId): FilterState {
  return {
    heatmap:   active === 'all' || active === 'traffic' || active === 'parking',
    alerts:    active === 'all' || active === 'alerts',
    transport: active === 'transit',
    territory: active === 'all' || active === 'borders' || active === 'g7',
    parking:   active === 'all' || active === 'parking',
  }
}

export default function MapPage() {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')
  const [mapRef,       setMapRef]       = useState<mapboxgl.Map | null>(null)
  const session                         = useSession()?.data ?? null
  const isG7Active                      = useG7Active()

  const handleMapReady = useCallback((m: mapboxgl.Map) => setMapRef(m), [])

  const filterState = useMemo(() => toFilterState(activeFilter), [activeFilter])

  return (
    <div className="h-screen w-full overflow-hidden relative" style={{ background: '#000' }}>

      {/* Layer 1: Carte — reçoit les filtres depuis la page + expose le map ref */}
      {/* MapView cadre automatiquement sur le Grand Genève complet au chargement */}
      <MapView
        filters={filterState}
        activeFilter={activeFilter}
        onMapReady={handleMapReady}
      />

      {/* Layer 2: SearchBar */}
      <SearchBar map={mapRef} />

      {/* Layer 3: QuickFilters */}
      <QuickFilters
        active={activeFilter}
        onChange={setActiveFilter}
        showJourney={!!session}
      />

      {/* Layer 4: SmartAlerts */}
      <SmartAlertManager />

      {/* Layer 5: FloatingControls — GPS uniquement */}
      <FloatingControls map={mapRef} />

      {/* Layer 6: G7Mode overlay */}
      {isG7Active && <G7Mode map={mapRef} />}

      {/* Layer 7: BottomSheet */}
      <BottomSheet session={session ?? null} activeFilter={activeFilter} map={mapRef} onFilterChange={setActiveFilter} />

      {/* Layer 8: SearchHandle — itinéraire (activé par tif:route-to) */}
      <SearchHandle map={mapRef} />

      {/* Layer 9: TPG line stop pins (activé par tif:line-select) */}
      <TpgLineStopsLayer map={mapRef} />

    </div>
  )
}
