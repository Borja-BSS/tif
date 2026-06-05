'use client'

import { useState, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { springs } from '@/lib/animations/springs'
import { ALL_CROSSINGS, computeInstantStatus } from '@/lib/territory/border-crossings-client'
import type { CrossingStatic } from '@/lib/territory/border-crossings-client'
import type { Session } from 'next-auth'
import type { FilterId } from './QuickFilters'
import type { JourneyStatusResult } from '@/lib/my-journey/types'
import type mapboxgl from 'mapbox-gl'

type SnapSize   = 'compact' | 'mid' | 'full'
type DetailView = 'overview' | 'douanes' | 'transport' | 'alertes' | 'g7'

const SNAP_HEIGHT: Record<SnapSize, string> = {
  compact: '56px',
  mid:     '50vh',
  full:    '92vh',
}

const LG: React.CSSProperties = {
  background:           'color-mix(in srgb, var(--bg) 96%, transparent)',
  backdropFilter:       'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
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
  map:          mapboxgl.Map | null
}

// ── Carte catégorie cliquable ─────────────────────────────────────────────────
function CategoryCard({ icon, title, subtitle, badge, badgeColor, onPress }: {
  icon: string; title: string; subtitle: string
  badge?: string; badgeColor?: string; onPress: () => void
}) {
  return (
    <button onClick={onPress}
      className="w-full flex items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
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

// ── Sources officielles par douane ────────────────────────────────────────────
const GENEVA_IDS = new Set([
  'bardonnex','thonex-vallard','moillesulaz','meyrin','ferney-voltaire','perly','anieres',
  'croix-de-rozon','veyrier','fossard','mategnin','mon-idee','monniaz','chancy','avully',
  'la-plaine','communaux-ambilly','hermance','soral','landecy','bossey','troinex',
  'compesieres','bernex','ecogia','veigy',
])
const VAUD_IDS = new Set(['la-cure','saint-cergue','vallorbe','bois-d-amont','saint-Laurent','les-hopitaux-neufs'])
const HAUTE_SAVOIE_IDS = new Set(['douvaine','sciez','excenevex','thonon','evian','annemasse-gaillard','collonges'])
const AIN_IDS = new Set(['prevessin-moens','sauverny','thoiry','peron','divonne','leaz','saint-julien'])
const JURA_IDS = new Set(['bois-d-amont','saint-Laurent'])

interface OfficialSource { label: string; url: string }

function getCrossingSources(id: string, isG7: boolean): OfficialSource[] {
  const sources: OfficialSource[] = [
    { label: 'Douanes suisses (BAZG)', url: 'https://www.bazg.admin.ch/bazg/fr/home/services/fuer_reisende.html' },
  ]
  if (GENEVA_IDS.has(id)) {
    sources.push({ label: 'Canton de Genève — mobilité', url: 'https://www.ge.ch/mobilite-deplacements-grand-geneve' })
    sources.push({ label: 'Ville de Genève — circulation', url: 'https://www.ville-geneve.ch/themes/mobilite-circulation/' })
  }
  if (VAUD_IDS.has(id)) {
    sources.push({ label: 'Canton de Vaud — mobilité', url: 'https://www.vd.ch/themes/mobilite' })
  }
  if (HAUTE_SAVOIE_IDS.has(id)) {
    sources.push({ label: 'Préfecture Haute-Savoie', url: 'https://www.haute-savoie.gouv.fr/Politiques-publiques/Transports-et-securite-routiere' })
  }
  if (AIN_IDS.has(id)) {
    sources.push({ label: 'Préfecture de l\'Ain', url: 'https://www.ain.gouv.fr/Actions-de-l-Etat/Transports-et-deplacement' })
  }
  if (JURA_IDS.has(id)) {
    sources.push({ label: 'Préfecture du Jura', url: 'https://www.jura.gouv.fr/Politiques-publiques/Transports-securite-routiere' })
  }
  sources.push({ label: 'Inforoute.ch — trafic live', url: 'https://www.inforoute.ch' })
  if (isG7) {
    sources.push({ label: 'G7 Évian 2026 — Restrictions', url: 'https://www.elysee.fr/g7' })
    sources.push({ label: 'Admin.ch — mesures G7', url: 'https://www.admin.ch/gov/fr/accueil.html' })
  }
  return sources
}

// ── Fiche détail d'une douane ─────────────────────────────────────────────────
function CrossingDetail({ crossing, onBack: _onBack, onLocate }: {
  crossing: CrossingStatic
  onBack:   () => void
  onLocate: (c: CrossingStatic) => void
}) {
  const now = new Date()
  const s   = computeInstantStatus(crossing, now)

  const G7_START   = new Date('2026-06-08T00:00:00Z')
  const G7_END     = new Date('2026-06-18T23:59:59Z')
  const isG7Period = now >= G7_START && now <= G7_END

  const sources = getCrossingSources(crossing.id, isG7Period)

  const statusLabel = s.status === 'BLOCKED'  ? 'Fermé'
    : s.status === 'HEAVY'    ? `Chargé · ~${s.waitMinutes} min d'attente`
    : s.status === 'MODERATE' ? `Ralenti · ~${s.waitMinutes} min d'attente`
    : s.status === 'LIGHT'    ? `Fluide · ~${s.waitMinutes} min`
    : 'Libre · Sans attente'

  const typeLabel = crossing.type === 'motorway' ? 'Autoroute'
    : crossing.type === 'main'      ? 'Route principale'
    : crossing.type === 'secondary' ? 'Route secondaire'
    : 'Voie locale / piétonne'

  return (
    <div>
      {/* Header */}
      <div className="rounded-2xl p-4 mb-3"
        style={{ background: `${s.color}10`, border: `1px solid ${s.color}35` }}>
        <div className="flex items-start gap-3">
          <span className="text-3xl">{s.icon}</span>
          <div className="flex-1">
            <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {crossing.name}
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{typeLabel}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
          <span className="text-sm font-semibold" style={{ color: s.color }}>{statusLabel}</span>
        </div>
      </div>

      {/* Bouton localiser sur la carte */}
      <button
        onClick={() => onLocate(crossing)}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 mb-3 font-semibold text-sm"
        style={{ background: 'var(--brand)', color: '#fff' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        Voir sur la carte
      </button>

      {/* Infos pratiques */}
      <div className="rounded-2xl p-4 mb-3 space-y-2.5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          Infos pratiques
        </p>
        <div className="flex items-start gap-2.5">
          <span className="text-base flex-shrink-0">🕐</span>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Horaires</p>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{crossing.hours}</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="text-base flex-shrink-0">🚗</span>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Véhicules autorisés</p>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              {crossing.vehicles.join(' · ')}
            </p>
          </div>
        </div>
        {crossing.pedestrian && (
          <div className="flex items-center gap-2.5">
            <span className="text-base">🚶</span>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Passage piétons / vélos autorisé</p>
          </div>
        )}
      </div>

      {/* Info G7 */}
      {crossing.g7Info && (
        <div className="rounded-2xl p-4 mb-3"
          style={{
            background: s.status === 'BLOCKED' ? 'rgba(255,69,58,0.08)' : 'rgba(255,149,0,0.08)',
            border:     s.status === 'BLOCKED' ? '1px solid rgba(255,69,58,0.25)' : '1px solid rgba(255,149,0,0.25)',
          }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: s.status === 'BLOCKED' ? '#FF453A' : '#FF9F0A' }}>
            🏛️ G7 · 12 au 18 juin 2026
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {crossing.g7Info}
          </p>
          {crossing.nearestOpen && s.status === 'BLOCKED' && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,69,58,0.15)' }}>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: '#30D158' }}>✓ Alternative : </span>
                {crossing.nearestOpen}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sources officielles — liens cliquables */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
          Sources officielles
        </p>
        <div className="space-y-2">
          {sources.map(src => (
            <a
              key={src.url}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl px-3 py-2.5 active:scale-[0.98] transition-transform"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <span className="text-[13px] font-medium" style={{ color: 'var(--brand)' }}>
                {src.label}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 ml-2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Liste des douanes ─────────────────────────────────────────────────────────
function DouanesDetail({ onSelect, map }: {
  onSelect: (c: CrossingStatic) => void
  map:      mapboxgl.Map | null
}) {
  const now      = new Date()
  const crossings = ALL_CROSSINGS.map(c => ({ c, s: computeInstantStatus(c, now) }))
    .sort((a, b) => {
      const order = { BLOCKED: 0, HEAVY: 1, MODERATE: 2, LIGHT: 3, CLEAR: 4 }
      return order[a.s.status] - order[b.s.status]
    })

  const handleTap = (c: CrossingStatic) => {
    // Fly to crossing on map
    if (map) {
      map.flyTo({ center: [c.lng, c.lat], zoom: 14, duration: 800, essential: true })
    }
    onSelect(c)
  }

  const open24  = crossings.filter(x => x.c.type === 'motorway' || x.c.type === 'main').length
  const blocked = crossings.filter(x => x.s.status === 'BLOCKED').length

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
        {crossings.length} passages · {open24} ouverts 24h/24
        {blocked > 0 ? ` · ${blocked} fermés G7` : ''}
      </p>
      {crossings.map(({ c, s }) => (
        <button
          key={c.id}
          onClick={() => handleTap(c)}
          className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left active:scale-[0.98] transition-transform"
          style={{ background: 'var(--bg-card)', border: `1px solid ${s.color}25` }}>
          <span className="text-base flex-shrink-0">{s.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {c.hours}
              {c.pedestrian ? ' · 🚶' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${s.color}18`, color: s.color }}>
              {s.status === 'BLOCKED' ? 'Fermé'
                : s.status === 'HEAVY' ? `${s.waitMinutes} min`
                : s.status === 'MODERATE' ? `${s.waitMinutes} min`
                : s.status === 'LIGHT' ? `${s.waitMinutes} min`
                : 'Libre'}
            </span>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 1l4 4-4 4"/>
            </svg>
          </div>
        </button>
      ))}
    </div>
  )
}

// ── Transport ─────────────────────────────────────────────────────────────────
function TransportDetail({ network }: { network?: DashboardData['network'] }) {
  const lines = [
    { name: 'TPG — Tram & Bus', key: 'tpg' as const, icon: '🚌' },
    { name: 'CFF / SBB', key: 'cff' as const, icon: '🚂' },
    { name: 'Léman Express CEVA', key: 'ceva' as const, icon: '🚆' },
  ]
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
        Statut réseau temps réel
      </p>
      {lines.map(l => {
        const st = network?.[l.key] ?? 'normal'
        const c  = st === 'normal' ? '#30D158' : st === 'delayed' ? '#FF9F0A' : '#FF453A'
        return (
          <div key={l.key} className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <span className="text-xl">{l.icon}</span>
            <p className="flex-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{l.name}</p>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${c}18`, color: c }}>
              {st === 'normal' ? 'Normal' : st === 'delayed' ? 'Retards' : 'Perturbé'}
            </span>
          </div>
        )
      })}
      <p className="text-[11px] text-center pt-2" style={{ color: 'var(--text-tertiary)' }}>
        opendata.ch · TPG.ch · CFF.ch
      </p>
    </div>
  )
}

// ── Alertes ───────────────────────────────────────────────────────────────────
function AlertesDetail({ alerts }: { alerts: DashboardData['alerts'] }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
        Incidents · Accidents · Travaux
      </p>
      {alerts.length === 0 ? (
        <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--bg-card)' }}>
          <p className="text-2xl mb-2">✅</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Aucun incident actif</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>Grand Genève · Trafic normal</p>
        </div>
      ) : alerts.map(a => (
        <div key={a.id} className="flex items-start gap-3 rounded-2xl p-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <span className="text-base flex-shrink-0">{a.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{a.timeAgo}</p>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-center pt-1" style={{ color: 'var(--text-tertiary)' }}>
        TIF · inforoute.ch · Waze · HERE Maps
      </p>
    </div>
  )
}

// ── G7 ────────────────────────────────────────────────────────────────────────
function G7Detail() {
  const now     = new Date()
  const isActive = now >= new Date('2026-06-08') && now <= new Date('2026-06-18')
  return isActive ? (
    <div className="space-y-3">
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.25)' }}>
        <p className="text-sm font-bold mb-1" style={{ color: '#FF453A' }}>🏛️ G7 EN COURS · 8–18 juin 2026</p>
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Restrictions de circulation en vigueur dans le Grand Genève.
        </p>
      </div>
      <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Postes macaron</p>
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Bardonnex · Thônex-Vallard</p>
        <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>Voie rapide · Personnel indispensable uniquement</p>
      </div>
    </div>
  ) : (
    <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <p className="text-xl mb-3">🏛️</p>
      <p className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>G7 — Grand Genève · 8–18 juin 2026</p>
      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Cette bannière sera disponible pour mieux vous aider à anticiper vos déplacements durant le G7.
        Directives officielles, postes de contrôle et restrictions d'accès en temps réel.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#FF9F0A' }} />
        <p className="text-[11px]" style={{ color: '#FF9F0A' }}>Activation le 8 juin 2026</p>
      </div>
    </div>
  )
}

// ── Vue d'ensemble "Tout" — 4 cartes ─────────────────────────────────────────
function ToutOverview({ data, onSelect }: {
  data?: DashboardData
  onSelect: (v: DetailView) => void
}) {
  const now       = new Date()
  const alertCount = data?.alerts.length ?? 0
  const hasIssue   = data?.network && Object.values(data.network).some(v => v !== 'normal')
  const blocked    = ALL_CROSSINGS.filter(c => computeInstantStatus(c, now).status === 'BLOCKED').length
  const heavy      = ALL_CROSSINGS.find(c => {
    const s = computeInstantStatus(c, now)
    return s.status === 'HEAVY' || s.status === 'MODERATE'
  })

  return (
    <div className="space-y-2.5 pt-1">
      <CategoryCard icon="🛂" title="Douanes"
        subtitle={heavy ? `⚠️ ${heavy.name} · trafic chargé` : `${ALL_CROSSINGS.length} postes · ${blocked > 0 ? `${blocked} fermés G7` : 'tous ouverts'}`}
        onPress={() => onSelect('douanes')} />
      <CategoryCard icon="🚌" title="Transport public"
        subtitle="TPG · CFF · Léman Express · CEVA"
        badge={hasIssue ? 'Perturbation' : undefined} badgeColor="#FF9F0A"
        onPress={() => onSelect('transport')} />
      <CategoryCard icon="⚠️" title="Alertes & Incidents"
        subtitle={alertCount > 0 ? `${alertCount} incident${alertCount > 1 ? 's' : ''} actif${alertCount > 1 ? 's' : ''}` : 'Aucun incident · Trafic normal'}
        badge={alertCount > 0 ? String(alertCount) : undefined} badgeColor="#FF453A"
        onPress={() => onSelect('alertes')} />
      <CategoryCard icon="🏛️" title="G7 — 8 au 18 juin 2026"
        subtitle="Directives officielles · Restrictions d'accès"
        onPress={() => onSelect('g7')} />
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export function BottomSheet({ session: _session, activeFilter, map }: BottomSheetProps) {
  const [snap,             setSnap]             = useState<SnapSize>('compact')
  const [detailView,       setDetailView]       = useState<DetailView>('overview')
  const [selectedCrossing, setSelectedCrossing] = useState<CrossingStatic | null>(null)

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
    setSelectedCrossing(null)
    setSnap('mid')
  }, [])

  const openCrossing = useCallback((c: CrossingStatic) => {
    setSelectedCrossing(c)
    setSnap('full')
  }, [])

  const locateCrossing = useCallback((c: CrossingStatic) => {
    if (!map) return
    map.flyTo({ center: [c.lng, c.lat], zoom: 15, duration: 900, essential: true })
    setSnap('compact')  // réduit le sheet pour voir la carte
  }, [map])

  const goBack = useCallback(() => {
    if (selectedCrossing) {
      setSelectedCrossing(null)
      setSnap('full')
    } else {
      setDetailView('overview')
      setSnap('mid')
    }
  }, [selectedCrossing])

  // Compact headline
  const alertCount  = data?.alerts.length ?? 0
  const compactText = activeFilter === 'all'     ? (alertCount > 0 ? `Grand Genève · ${alertCount} alerte${alertCount > 1 ? 's' : ''} ⚠️` : 'Tout · Trafic · Douanes · Alertes')
    : activeFilter === 'transit'  ? 'Transport public · TPG · CFF · CEVA'
    : activeFilter === 'traffic'  ? 'Trafic routier · Grand Genève'
    : activeFilter === 'alerts'   ? 'Alertes & Incidents routes'
    : activeFilter === 'borders'  ? 'Douanes · 47 passages frontière'
    : activeFilter === 'g7'       ? 'G7 · 8–18 juin 2026 · Évian'
    : 'Grand Genève'

  const showBack = detailView !== 'overview' || selectedCrossing !== null

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
          else { setSnap('compact'); setDetailView('overview'); setSelectedCrossing(null) }
        }}
        aria-label="Ouvrir/fermer">
        <div className="w-9 h-1 rounded-full" style={{ background: 'var(--border)' }} />
      </button>

      {/* Compact row */}
      <div className="flex items-center justify-between px-4 py-1 flex-shrink-0">
        <span className="text-sm font-medium truncate" style={{ color: alertCount > 0 ? '#FF9F0A' : 'var(--text-secondary)' }}>
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
        <div className="flex-1 overflow-y-auto px-4 pb-6" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>

          {/* Bouton retour */}
          {showBack && (
            <button onClick={goBack}
              className="flex items-center gap-2 mb-4 text-sm font-medium"
              style={{ color: 'var(--brand)' }}>
              <svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M7 1L1 6.5 7 12"/>
              </svg>
              {selectedCrossing ? 'Toutes les douanes' : 'Retour'}
            </button>
          )}

          {/* Fiche douane sélectionnée */}
          {selectedCrossing ? (
            <CrossingDetail
              crossing={selectedCrossing}
              onBack={goBack}
              onLocate={locateCrossing}
            />
          ) : activeFilter === 'all' ? (
            detailView === 'overview'   ? <ToutOverview data={data} onSelect={openDetail} />
            : detailView === 'douanes'  ? <DouanesDetail onSelect={openCrossing} map={map} />
            : detailView === 'transport'? <TransportDetail network={data?.network} />
            : detailView === 'alertes'  ? <AlertesDetail alerts={data?.alerts ?? []} />
            : <G7Detail />
          ) : (
            <div className="space-y-3">
              {activeFilter === 'transit'  && <TransportDetail network={data?.network} />}
              {activeFilter === 'borders'  && <DouanesDetail onSelect={openCrossing} map={map} />}
              {activeFilter === 'alerts'   && <AlertesDetail alerts={data?.alerts ?? []} />}
              {activeFilter === 'g7'       && <G7Detail />}
              {activeFilter === 'traffic'  && (
                <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--bg-card)' }}>
                  <p className="text-2xl mb-2">🚦</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Trafic routier</p>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Mapbox Traffic · HERE Maps · Temps réel
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
