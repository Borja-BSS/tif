'use client'

export const dynamic = 'force-dynamic'

import { useState, useCallback, useMemo, useEffect, useRef, Suspense } from 'react'
import { useSession }             from '@/context/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { useGuest }           from '@/context/GuestContext'
import { GuestBanner }        from '@/components/guest/GuestBanner'
import { GuestExpiredModal }  from '@/components/guest/GuestExpiredModal'
import { GuestWelcomeModal }  from '@/components/guest/GuestWelcomeModal'
import { WelcomeModals }      from '@/components/map/WelcomeModals'
import { AiAssistant }       from '@/components/map/ui/AiAssistant'

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

function SubmittedConfetti({ setShowThanks }: { setShowThanks: (v: boolean) => void }) {
  const searchParams = useSearchParams()
  const firedRef     = useRef(false)

  useEffect(() => {
    if (searchParams?.get('submitted') !== '1' || firedRef.current) return
    firedRef.current = true
    setShowThanks(true)
    import('canvas-confetti').then(({ default: confetti }) => {
      const launch = () => confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.55 },
        colors: ['#FF2D55','#FF9500','#30D158','#0A84FF','#AF52DE','#FFD60A'],
        zIndex: 9999,
      })
      launch()
      setTimeout(launch, 350)
    })
    const t = setTimeout(() => {
      setShowThanks(false)
      const url = new URL(window.location.href)
      url.searchParams.delete('submitted')
      window.history.replaceState({}, '', url.toString())
    }, 5500)
    return () => clearTimeout(t)
  }, [searchParams, setShowThanks])

  return null
}

export default function MapPage() {
  const [activeFilter, setActiveFilter]   = useState<FilterId>('all')
  const [mapRef,       setMapRef]         = useState<mapboxgl.Map | null>(null)
  const [showThanks,   setShowThanks]     = useState(false)
  const sessionResult                     = useSession()
  const session                           = sessionResult?.data ?? null
  const isG7Active                        = useG7Active()
  const router                            = useRouter()
  const { isGuest, endGuest }             = useGuest()

  useEffect(() => {
    if (sessionResult.status !== 'loading' && !session && !isGuest) router.replace('/login')
  }, [sessionResult.status, session, isGuest, router])

  useEffect(() => {
    if (session && isGuest) endGuest()
  }, [session, isGuest, endGuest])

  const handleMapReady = useCallback((m: mapboxgl.Map) => {
    setMapRef(m)
    // Auto-fly to user location if geo consent was given
    try {
      const raw = localStorage.getItem('tif-consent-v1')
      if (raw) {
        const consent = JSON.parse(raw) as { geo?: boolean }
        if (consent?.geo && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              m.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13, duration: 2200 })
              import('@/lib/analytics/track').then(({ track }) => track('geo_granted'))
            },
            () => {
              import('@/lib/analytics/track').then(({ track }) => track('geo_denied'))
            },
            { timeout: 8000 }
          )
        }
      }
    } catch { /* silent */ }
  }, [])

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

      {/* Layer 5b: AI Assistant — bouton flottant gauche */}
      <AiAssistant />

      {/* Layer 6: G7Mode overlay */}
      {isG7Active && <G7Mode map={mapRef} />}

      {/* Layer 7: BottomSheet */}
      <BottomSheet session={session ?? null} activeFilter={activeFilter} map={mapRef} onFilterChange={setActiveFilter} />

      {/* Layer 8: SearchHandle — itinéraire (activé par tif:route-to) */}
      <SearchHandle map={mapRef} />

      {/* Layer 9: TPG line stop pins (activé par tif:line-select) */}
      <TpgLineStopsLayer map={mapRef} />

      {/* ── Confetti + merci après signalement ─────────────────────────── */}
      <Suspense fallback={null}>
        <SubmittedConfetti setShowThanks={setShowThanks} />
      </Suspense>

      {/* ── Toast Merci après signalement ──────────────────────────────── */}
      {showThanks && (
        <div className="fixed left-1/2 z-50 -translate-x-1/2 pointer-events-none"
          style={{ top: 'calc(52px + 56px + 16px)', animation: 'fadeUp 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          <div className="rounded-3xl px-5 py-4 text-center max-w-xs mx-auto"
            style={{
              background: 'rgba(18,18,20,0.96)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              border: '0.5px solid rgba(255,255,255,0.18)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
            }}>
            <p className="text-3xl mb-1">🙏</p>
            <p className="text-[16px] font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>Merci pour votre signalement !</p>
            <p className="text-[12px] mb-3" style={{ color: 'var(--text-secondary)' }}>Il sera examiné et publié si pertinent.</p>
            <a href="/donate"
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold pointer-events-auto active:scale-95 transition-transform"
              style={{ background: 'rgba(52,199,89,0.15)', border: '1px solid rgba(52,199,89,0.35)', color: '#30D158' }}>
              💚 Soutenir TIF
            </a>
          </div>
        </div>
      )}

      {/* Welcome modals — G7 zone info + features list (once per localStorage) */}
      <WelcomeModals />

      {/* Guest mode — welcome popup + countdown banner + expiry modal */}
      <GuestWelcomeModal />
      <GuestBanner />
      <GuestExpiredModal />

    </div>
  )
}
