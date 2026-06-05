'use client'

export const dynamic = 'force-dynamic'

import { useState, useCallback, useMemo } from 'react'
import { useSession }             from 'next-auth/react'
import { useQuery }               from '@tanstack/react-query'
import dynamicImport              from 'next/dynamic'
import mapboxgl                   from 'mapbox-gl'
import { SearchBar }              from '@/components/map/ui/SearchBar'
import { QuickFilters }           from '@/components/map/ui/QuickFilters'
import { FloatingControls }       from '@/components/map/ui/FloatingControls'
import { BottomSheet }            from '@/components/map/ui/BottomSheet'
import { SmartAlertManager }      from '@/components/map/ui/SmartAlert'
import { G7Mode, useG7Active }    from '@/components/map/modes/G7Mode'
import { VoiceStatus }            from '@/components/accessibility/VoiceStatus'
import type { FilterId }          from '@/components/map/ui/QuickFilters'
import type { FilterState }       from '@/components/map/FilterPanel'

const MapView = dynamicImport(() => import('@/components/map/MapView'), { ssr: false })

interface DashboardData {
  globalStatus: string
  alerts:       { id: string }[]
  myJourney?:   { headline: string }
}

function toFilterState(active: FilterId): FilterState {
  return {
    heatmap:   active === 'all' || active === 'traffic',
    alerts:    active === 'all' || active === 'alerts',
    transport: active === 'transit',
    territory: active === 'all' || active === 'borders' || active === 'g7',
  }
}

export default function MapPage() {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')
  const [mapRef,       setMapRef]       = useState<mapboxgl.Map | null>(null)
  const session                         = useSession()?.data ?? null
  const isG7Active                      = useG7Active()

  const handleMapReady = useCallback((m: mapboxgl.Map) => setMapRef(m), [])

  const { data: dashboard } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn:  () => fetch('/api/v1/dashboard').then(r => r.json()),
    refetchInterval: 30000,
    staleTime:       30000,
    placeholderData: { globalStatus: 'calm', alerts: [] },
  })

  const filterState = useMemo(() => toFilterState(activeFilter), [activeFilter])

  return (
    <div className="h-screen w-full overflow-hidden relative" style={{ background: '#000' }}>

      {/* Layer 1: Carte — reçoit les filtres depuis la page + expose le map ref */}
      <MapView
        initialLat={46.2044}
        initialLng={6.1432}
        initialZoom={11}
        filters={filterState}
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

      {/* Layer 5: FloatingControls + VoiceStatus */}
      <FloatingControls map={mapRef} />
      <div className="fixed z-20" style={{ right: 16, bottom: 'calc(56px + 80px + 54px + 10px)' }}>
        <VoiceStatus
          globalStatus={dashboard?.globalStatus ?? 'calm'}
          alertCount={dashboard?.alerts?.length ?? 0}
          journeyHeadline={dashboard?.myJourney?.headline}
        />
      </div>

      {/* Layer 6: G7Mode overlay */}
      {isG7Active && <G7Mode map={mapRef} />}

      {/* Layer 7: BottomSheet */}
      <BottomSheet session={session ?? null} activeFilter={activeFilter} />

    </div>
  )
}
