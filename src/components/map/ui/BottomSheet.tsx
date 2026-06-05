'use client'

import { useState, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { springs } from '@/lib/animations/springs'
import { ALL_CROSSINGS, computeInstantStatus } from '@/lib/territory/border-crossings-client'
import type { Session } from 'next-auth'
import type { FilterId } from './QuickFilters'
import type { JourneyStatusResult } from '@/lib/my-journey/types'

type SnapSize  = 'compact' | 'mid' | 'full'
type DetailView = 'overview' | 'douanes' | 'transport' | 'alertes' | 'g7'

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

// ── Badge statut réseau ───────────────────────────────────────────────────────
function NetBadge({ name, status }: { name: string; status: string }) {
  const color = status === 'normal' ? '#30D158' : status === 'delayed' ? '#FF9F0A' : '#FF453A'
  return (
    <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: `${color}18`, color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {name}
    </span>
  )
}

// ── Carte catégorie cliquable ─────────────────────────────────────────────────
function CategoryCard({
  icon, title, subtitle, badge, badgeColor, onPress,
}: {
  icon: string; title: string; subtitle: string
  badge?: string; badgeColor?: string; onPress: () => void
}) {
  return (
    <button
      onClick={onPress}
      className="w-full flex items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
        <p className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
      </div>
      {badge && (
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: `${badgeColor ?? '#FF9F0A'}18`, color: badgeColor ?? '#FF9F0A' }}>
          {badge}
        </span>
      )}
      <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" className="flex-shrink-0">
        <path d="M1 1l5 5-5 5"/>
      </svg>
    </button>
  )
}

// ── Détail Douanes ────────────────────────────────────────────────────────────
function DouanesDetail() {
  const now      = new Date()
  const crossings = ALL_CROSSINGS.map(c => ({ c, s: computeInstantStatus(c, now) }))
    .sort((a, b) => {
      const order = { BLOCKED: 0, HEAVY: 1, MODERATE: 2, LIGHT: 3, CLEAR: 4 }
      return order[a.s.status] - order[b.s.status]
    })

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
        {crossings.length} passages frontière · Grand Genève
      </p>
      {crossings.map(({ c, s }) => (
        <div key={c.id} className="flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: 'var(--bg-card)', border: `1px solid ${s.color}30` }}>
          <span className="text-base">{s.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {c.hours} · {c.vehicles[0]}
              {c.pedestrian ? ' · 🚶' : ''}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${s.color}18`, color: s.color }}>
              {s.status === 'BLOCKED' ? 'Fermé'
                : s.status === 'HEAVY' ? 'Chargé'
                : s.status === 'MODERATE' ? 'Ralenti'
                : s.status === 'LIGHT' ? `${s.waitMinutes} min`
                : 'Libre'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Détail Transport ──────────────────────────────────────────────────────────
function TransportDetail({ network }: { network?: DashboardData['network'] }) {
  const lines = [
    { name: 'TPG — Tram & Bus', key: 'tpg' as const, icon: '🚌', color: '#FF9500' },
    { name: 'CFF / SBB', key: 'cff' as const, icon: '🚂', color: '#0040FF' },
    { name: 'Léman Express CEVA', key: 'ceva' as const, icon: '🚆', color: '#AF52DE' },
  ]

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
        Statut réseau temps réel
      </p>
      {lines.map(l => {
        const st    = network?.[l.key] ?? 'normal'
        const color = st === 'normal' ? '#30D158' : st === 'delayed' ? '#FF9F0A' : '#FF453A'
        const label = st === 'normal' ? 'Normal' : st === 'delayed' ? 'Retards' : 'Perturbé'
        return (
          <div key={l.key} className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <span className="text-xl">{l.icon}</span>
            <p className="flex-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{l.name}</p>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${color}18`, color }}>
              {label}
            </span>
          </div>
        )
      })}
      <p className="text-[11px] text-center pt-2" style={{ color: 'var(--text-tertiary)' }}>
        Source : opendata.ch · TPG · CFF en temps réel
      </p>
    </div>
  )
}

// ── Détail Alertes ────────────────────────────────────────────────────────────
function AlertesDetail({ alerts }: { alerts: DashboardData['alerts'] }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
        Incidents routes · Accidents · Travaux
      </p>
      {alerts.length === 0 ? (
        <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--bg-card)' }}>
          <p className="text-2xl mb-2">✅</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Aucun incident actif</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>
            Grand Genève · Trafic normal
          </p>
        </div>
      ) : alerts.map(a => (
        <div key={a.id} className="flex items-start gap-3 rounded-2xl p-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <span className="text-base flex-shrink-0">{a.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{a.timeAgo}</p>
          </div>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{
              background: a.severity === 'CRITICAL' ? 'rgba(255,69,58,0.15)' : 'rgba(255,159,10,0.15)',
              color:      a.severity === 'CRITICAL' ? '#FF453A' : '#FF9F0A',
            }}>
            {a.severity === 'CRITICAL' ? 'CRITIQUE' : a.severity === 'HIGH' ? 'ÉLEVÉ' : ''}
          </span>
        </div>
      ))}
      <p className="text-[11px] text-center pt-1" style={{ color: 'var(--text-tertiary)' }}>
        Sources : TIF · inforoute.ch · Waze · HERE Maps
      </p>
    </div>
  )
}

// ── Détail G7 ─────────────────────────────────────────────────────────────────
function G7Detail() {
  const g7Start = new Date('2026-06-08')
  const g7End   = new Date('2026-06-17')
  const now     = new Date()
  const isActive = now >= g7Start && now <= g7End

  if (isActive) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.25)' }}>
          <p className="text-sm font-bold mb-1" style={{ color: '#FF453A' }}>🏛️ G7 EN COURS · 8–18 juin 2026</p>
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Des restrictions de circulation sont en vigueur dans le Grand Genève. Consultez les directives officielles avant tout déplacement.
          </p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Postes macaron</p>
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Bardonnex · Thônex-Vallard</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>Voie rapide réservée personnel indispensable</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <p className="text-xl mb-3">🏛️</p>
      <p className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        G7 — Grand Genève · 8–18 juin 2026
      </p>
      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Cette bannière sera disponible pour mieux vous aider à anticiper vos déplacements durant le G7.
        Directives officielles, postes de contrôle et restrictions d'accès en temps réel.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#FF9F0A' }} />
        <p className="text-[11px]" style={{ color: '#FF9F0A' }}>
          Activation le 8 juin 2026
        </p>
      </div>
    </div>
  )
}

// ── Vue d'ensemble "Tout" — 4 cartes ─────────────────────────────────────────
function ToutOverview({
  data, onSelect,
}: {
  data?: DashboardData
  onSelect: (v: DetailView) => void
}) {
  const alertCount  = data?.alerts.length ?? 0
  const netStatus   = data?.network
  const hasNetIssue = netStatus && (netStatus.tpg !== 'normal' || netStatus.cff !== 'normal' || netStatus.ceva !== 'normal')

  const now = new Date()
  const open24    = ALL_CROSSINGS.filter(c => c.type === 'motorway' || c.type === 'main').length
  const topCrossing = ALL_CROSSINGS.find(c => {
    const s = computeInstantStatus(c, now)
    return s.status === 'HEAVY' || s.status === 'MODERATE'
  })

  return (
    <div className="space-y-2.5 pt-1">
      {/* Douanes */}
      <CategoryCard
        icon="🛂"
        title="Douanes"
        subtitle={topCrossing
          ? `⚠️ ${topCrossing.name} · trafic chargé`
          : `${ALL_CROSSINGS.length} postes · ${open24} ouverts 24h/24`}
        onPress={() => onSelect('douanes')}
      />

      {/* Transport */}
      <CategoryCard
        icon="🚌"
        title="Transport public"
        subtitle="TPG · CFF · Léman Express · CEVA"
        badge={hasNetIssue ? 'Perturbation' : undefined}
        badgeColor={hasNetIssue ? '#FF9F0A' : undefined}
        onPress={() => onSelect('transport')}
      />

      {/* Alertes */}
      <CategoryCard
        icon="⚠️"
        title="Alertes & Incidents"
        subtitle={alertCount > 0
          ? `${alertCount} incident${alertCount > 1 ? 's' : ''} actif${alertCount > 1 ? 's' : ''} · Accidents · Travaux`
          : 'Aucun incident · Trafic normal'}
        badge={alertCount > 0 ? String(alertCount) : undefined}
        badgeColor="#FF453A"
        onPress={() => onSelect('alertes')}
      />

      {/* G7 */}
      <CategoryCard
        icon="🏛️"
        title="G7 — 8 au 18 juin 2026"
        subtitle="Directives officielles · Restrictions d'accès"
        onPress={() => onSelect('g7')}
      />
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export function BottomSheet({ session: _session, activeFilter }: BottomSheetProps) {
  const [snap,       setSnap]       = useState<SnapSize>('compact')
  const [detailView, setDetailView] = useState<DetailView>('overview')

  const touchStartY    = useRef(0)
  const touchStartSnap = useRef<SnapSize>('compact')
  const lastTouchY     = useRef(0)
  const lastTouchTime  = useRef(0)
  const velocity       = useRef(0)

  const { data } = useQuery<DashboardData>({
    queryKey:        ['dashboard'],
    queryFn:         () => fetch('/api/v1/dashboard').then(r => r.json()),
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
    velocity.current      = dt > 0 ? dy / dt : 0
    lastTouchY.current    = e.touches[0].clientY
    lastTouchTime.current = now
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const delta = touchStartY.current - e.changedTouches[0].clientY
    const v     = velocity.current
    if (v > 1.5)  { setSnap('full');    return }
    if (v < -1.5) { setSnap('compact'); return }
    const idx = snapOrder.indexOf(touchStartSnap.current)
    if (delta > 60 && idx < 2)  setSnap(snapOrder[idx + 1])
    else if (delta < -60 && idx > 0) setSnap(snapOrder[idx - 1])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapOrder])

  const openDetail = useCallback((v: DetailView) => {
    setDetailView(v)
    setSnap('full')
  }, [])

  const backToOverview = useCallback(() => {
    setDetailView('overview')
    setSnap('mid')
  }, [])

  // Compact headline
  const alertCount = data?.alerts.length ?? 0
  const compactText = activeFilter === 'all'
    ? (alertCount > 0 ? `Grand Genève · ${alertCount} alerte${alertCount > 1 ? 's' : ''} ⚠️` : 'Grand Genève · Trafic + Douanes + Alertes')
    : activeFilter === 'transit' ? 'Transport public · TPG · CFF · CEVA'
    : activeFilter === 'traffic' ? 'Trafic routier · Grand Genève'
    : activeFilter === 'alerts'  ? 'Alertes & Incidents routes'
    : activeFilter === 'borders' ? 'Douanes · 47 passages frontière'
    : activeFilter === 'g7'      ? 'G7 · 8–18 juin 2026 · Évian'
    : 'Grand Genève'

  const compactColor = alertCount > 0 ? '#FF9F0A' : 'var(--text-secondary)'

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
        onClick={() => {
          if (snap === 'compact') setSnap('mid')
          else { setSnap('compact'); setDetailView('overview') }
        }}
        aria-label="Ouvrir/fermer"
      >
        <div className="w-9 h-1 rounded-full" style={{ background: 'var(--border)' }} />
      </button>

      {/* Compact row */}
      <div className="flex items-center justify-between px-4 py-1 flex-shrink-0">
        <span className="text-sm font-medium truncate" style={{ color: compactColor }}>
          {compactText}
        </span>
        {alertCount > 0 && snap === 'compact' && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full ml-2 flex-shrink-0"
            style={{ background: 'rgba(255,159,10,0.15)', color: '#FF9F0A' }}>
            {alertCount}
          </span>
        )}
      </div>

      {/* Expanded content */}
      {snap !== 'compact' && (
        <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>

          {/* Back button quand on est dans le détail */}
          {detailView !== 'overview' && (
            <button
              onClick={backToOverview}
              className="flex items-center gap-2 mb-4 text-sm font-medium"
              style={{ color: 'var(--brand)' }}
            >
              <svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M7 1L1 6.5 7 12"/>
              </svg>
              Retour
            </button>
          )}

          {/* Contenu selon activeFilter et detailView */}
          {activeFilter === 'all' ? (
            detailView === 'overview' ? (
              <ToutOverview data={data} onSelect={openDetail} />
            ) : detailView === 'douanes' ? (
              <DouanesDetail />
            ) : detailView === 'transport' ? (
              <TransportDetail network={data?.network} />
            ) : detailView === 'alertes' ? (
              <AlertesDetail alerts={data?.alerts ?? []} />
            ) : (
              <G7Detail />
            )
          ) : (
            /* Autres filtres — vue générique */
            <div className="space-y-3">
              {data?.network && activeFilter === 'transit' && (
                <TransportDetail network={data.network} />
              )}
              {activeFilter === 'borders' && <DouanesDetail />}
              {activeFilter === 'alerts'  && <AlertesDetail alerts={data?.alerts ?? []} />}
              {activeFilter === 'g7'      && <G7Detail />}
              {activeFilter === 'traffic' && (
                <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--bg-card)' }}>
                  <p className="text-2xl mb-2">🚦</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Trafic routier</p>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Données Mapbox · HERE Maps · Mise à jour temps réel
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex-shrink-0" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
    </div>
  )
}
