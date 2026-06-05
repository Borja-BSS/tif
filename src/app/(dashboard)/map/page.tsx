'use client'

export const dynamic = 'force-dynamic'

import { useState }             from 'react'
import { useSession }           from 'next-auth/react'
import { useQuery }             from '@tanstack/react-query'
import dynamicImport            from 'next/dynamic'
import { SearchBar }            from '@/components/map/ui/SearchBar'
import { QuickFilters }         from '@/components/map/ui/QuickFilters'
import { FloatingControls }     from '@/components/map/ui/FloatingControls'
import { BottomSheet }          from '@/components/map/ui/BottomSheet'
import { SmartAlertManager }    from '@/components/map/ui/SmartAlert'
import { G7Mode, useG7Active }  from '@/components/map/modes/G7Mode'
import { VoiceStatus }          from '@/components/accessibility/VoiceStatus'
import type { FilterId }        from '@/components/map/ui/QuickFilters'

// Keep MapView dynamic (no SSR) — preserve existing behavior
// MapView manages its own filters and map instance internally
const MapView = dynamicImport(() => import('@/components/map/MapView'), { ssr: false })

interface DashboardData {
  globalStatus: string
  alerts:       { id: string }[]
  myJourney?:   { headline: string }
}

export default function MapPage() {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')
  const session                         = useSession()?.data ?? null
  const isG7Active                      = useG7Active()

  const { data: dashboard } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn:  () => fetch('/api/v1/dashboard').then(r => r.json()),
    refetchInterval: 30000,
    staleTime:       30000,
    placeholderData: { globalStatus: 'calm', alerts: [] },
  })

  return (
    <div className="h-screen w-full overflow-hidden relative" style={{ background: '#000' }}>

      {/* Layer 1: Map (background) — MapView owns its own filters and map ref */}
      <MapView initialLat={46.2044} initialLng={6.1432} initialZoom={11} />

      {/* Layer 2: SearchBar */}
      <SearchBar map={null} />

      {/* Layer 3: QuickFilters */}
      <QuickFilters
        active={activeFilter}
        onChange={setActiveFilter}
        showJourney={!!session}
      />

      {/* Layer 4: SmartAlerts */}
      <SmartAlertManager />

      {/* Layer 5: FloatingControls + VoiceStatus */}
      <div className="fixed z-20 flex flex-col gap-2.5" style={{ right: 16, bottom: 'calc(56px + 80px)' }}>
        <VoiceStatus
          globalStatus={dashboard?.globalStatus ?? 'calm'}
          alertCount={dashboard?.alerts?.length ?? 0}
          journeyHeadline={dashboard?.myJourney?.headline}
        />
        <FloatingControls map={null} />
      </div>

      {/* Layer 6: G7Mode overlay */}
      {isG7Active && <G7Mode map={null} />}

      {/* Layer 7: BottomSheet */}
      <BottomSheet session={session ?? null} activeFilter={activeFilter} />

    </div>
  )
}
