'use client'

import { useState, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { springs } from '@/lib/animations/springs'
import type { Session } from 'next-auth'
import type { FilterId } from './QuickFilters'
import type { JourneyStatusResult } from '@/lib/my-journey/types'

type SnapSize = 'compact' | 'mid' | 'full'

const SNAP_HEIGHT: Record<SnapSize, string> = {
  compact: '56px',
  mid:     '45vh',
  full:    '92vh',
}

const LG: React.CSSProperties = {
  background:           'color-mix(in srgb, var(--bg) 95%, transparent)',
  backdropFilter:       'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  borderTop:            '1px solid var(--border)',
  borderRadius:         '20px 20px 0 0',
}

interface DashboardData {
  myJourney?: JourneyStatusResult
  alerts:     { id: string; icon: string; title: string; severity: string; timeAgo: string }[]
  network:    { tpg: string; cff: string; ceva: string }
  globalStatus: string
  activeZones:  number
}

interface BottomSheetProps {
  session:      Session | null
  activeFilter: FilterId
}

function NetworkBadge({ name, status }: { name: string; status: string }) {
  const color = status === 'normal' ? '#30D158' : status === 'delayed' ? '#FF9F0A' : '#FF453A'
  return (
    <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: `${color}18`, color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {name}
    </span>
  )
}

export function BottomSheet({ session, activeFilter }: BottomSheetProps) {
  const [snap, setSnap] = useState<SnapSize>('compact')
  const touchStartY    = useRef(0)
  const touchStartSnap = useRef<SnapSize>('compact')
  const lastTouchY     = useRef(0)
  const lastTouchTime  = useRef(0)
  const velocity       = useRef(0)

  const { data } = useQuery<DashboardData>({
    queryKey: ['dashboard', activeFilter],
    queryFn:  () => fetch('/api/v1/dashboard').then(r => r.json()),
    refetchInterval: 30000,
    staleTime:       30000,
    placeholderData: { alerts: [], network: { tpg: 'normal', cff: 'normal', ceva: 'normal' }, globalStatus: 'calm', activeZones: 0 },
  })

  const snapOrder: SnapSize[] = ['compact', 'mid', 'full']

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current    = e.touches[0].clientY
    touchStartSnap.current = snap
    lastTouchY.current     = e.touches[0].clientY
    lastTouchTime.current  = Date.now()
    velocity.current       = 0
  }, [snap])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const now = Date.now()
    const dy  = lastTouchY.current - e.touches[0].clientY
    const dt  = now - lastTouchTime.current
    velocity.current   = dt > 0 ? dy / dt : 0
    lastTouchY.current = e.touches[0].clientY
    lastTouchTime.current = now
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const delta = touchStartY.current - e.changedTouches[0].clientY
    const v     = velocity.current
    if (v > 1.5)  { setSnap('full');    return }
    if (v < -1.5) { setSnap('compact'); return }
    const idx = snapOrder.indexOf(touchStartSnap.current)
    if (delta > 60 && idx < 2) setSnap(snapOrder[idx + 1])
    else if (delta < -60 && idx > 0) setSnap(snapOrder[idx - 1])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapOrder])

  const compactContent = () => {
    if (data?.myJourney) {
      const color = data.myJourney.status === 'normal' ? '#30D158' : data.myJourney.status === 'delayed' ? '#FF9F0A' : '#FF453A'
      return (
        <span className="flex items-center gap-1.5 text-sm font-semibold truncate" style={{ color }}>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          {data.myJourney.headline}
        </span>
      )
    }
    const count = data?.alerts.length ?? 0
    const color = count === 0 ? 'var(--text-secondary)' : '#FF9F0A'
    return (
      <span className="text-sm font-medium" style={{ color }}>
        {count === 0 ? 'Grand Genève · Situation normale' : `Grand Genève · ${count} alerte${count > 1 ? 's' : ''} ⚠️`}
      </span>
    )
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 flex flex-col overflow-hidden"
      style={{ ...LG, height: SNAP_HEIGHT[snap], transition: `height ${springs.sheet}` }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Drag handle */}
      <button
        className="flex justify-center pt-2.5 pb-1 flex-shrink-0"
        onClick={() => setSnap(s => s === 'compact' ? 'mid' : 'compact')}
        aria-label="Ouvrir/fermer le panneau"
      >
        <div className="w-9 h-1 rounded-full" style={{ background: 'var(--border)' }} />
      </button>

      {/* Compact content — always visible */}
      <div className="flex items-center justify-between px-4 py-1 flex-shrink-0">
        {compactContent()}
        {(data?.alerts.length ?? 0) > 0 && snap === 'compact' && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full ml-2"
            style={{ background: 'rgba(255,159,10,0.15)', color: '#FF9F0A' }}>
            {data!.alerts.length}
          </span>
        )}
      </div>

      {/* Mid + Full content */}
      {snap !== 'compact' && (
        <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {/* Network status */}
          {data?.network && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <NetworkBadge name="TPG"  status={data.network.tpg} />
              <NetworkBadge name="CFF"  status={data.network.cff} />
              <NetworkBadge name="CEVA" status={data.network.ceva} />
            </div>
          )}

          {/* Alerts */}
          {(data?.alerts ?? []).length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Alertes actives
              </p>
              {(data?.alerts ?? []).slice(0, snap === 'full' ? 20 : 5).map(a => (
                <div key={a.id} className="flex items-start gap-3 rounded-2xl p-3"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <span className="text-base flex-shrink-0">{a.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{a.timeAgo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(data?.alerts ?? []).length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
              Aucune alerte active · Grand Genève calme
            </p>
          )}
        </div>
      )}

      <div className="flex-shrink-0" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
    </div>
  )
}
