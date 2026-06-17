'use client'

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PARKINGS_PR, TOTAL_PR_CAPACITY } from '@/lib/parking/pr-data'
import { TPG_LINES } from '@/lib/transport/tpg-line-stops'
import { ALL_CROSSINGS, computeInstantStatus } from '@/lib/territory/border-crossings-client'
import type { CrossingStatic } from '@/lib/territory/border-crossings-client'
import type { AuthUser } from '@/context/AuthContext'
import type { FilterId } from './QuickFilters'
import type { JourneyStatusResult } from '@/lib/my-journey/types'
import type mapboxgl from 'mapbox-gl'
import { JourneySetup } from '@/components/my-journey/JourneySetup'
import { firebaseAuth } from '@/lib/firebase'
import { G7BulletinsPanel } from './G7Bulletins'
import { useMapT } from '@/i18n/map'
import type { MapT } from '@/i18n/map'
import { events, CATEGORY_LABELS, CATEGORY_ICONS } from '@/data/events'
import type { EventItem } from '@/data/types'
import { getAlertsForDay } from '@/data/g7-alerts'
import { IMPACT_ZONES } from '@/data/impact-zones'
import type { ImpactZone } from '@/data/impact-zones'

type DetailView = 'overview' | 'douanes' | 'transport' | 'alertes' | 'g7' | 'meteo' | 'parking' | 'journey' | 'events' | 'impact-zone'

// Type partagé entre AlertesDetail et le composant parent (navigation hiérarchique)
type AlertDetailItem = {
  id: string; type: string; title: string; description: string; source: string
  color: string; icon: string; lng: number; lat: number
}

const COMPACT_H = 56
// Safe area insets — populated on mount, used by getFullH to ensure the sheet
// doesn't overlap the top UI (SearchBar + QuickFilters) on notched iPhones.
let _sat = 0  // safe-area-inset-top
let _sab = 0  // safe-area-inset-bottom
const getFullH  = () => {
  if (typeof window === 'undefined') return 600
  return window.innerHeight - _sat - _sab - 120
}
// Spring iOS-like pour les snaps automatiques
const SPRING    = 'height 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)'
// Transition douce pour les repositionnements libres
const EASE      = 'height 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94)'

const LG: React.CSSProperties = {
  background:           'rgba(255,255,255,0.04)',
  backdropFilter:       'blur(48px) saturate(200%) brightness(1.05)',
  WebkitBackdropFilter: 'blur(48px) saturate(200%) brightness(1.05)',
  borderTop:            '0.5px solid rgba(255,255,255,0.25)',
  borderRadius:         '24px 24px 0 0',
  boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.28), 0 -8px 48px rgba(0,0,0,0.08)',
}

interface DashboardData {
  myJourney?: JourneyStatusResult
  alerts:     { id: string; icon: string; title: string; severity: string; timeAgo: string }[]
  network:    { tpg: string; cff: string; ceva: string }
  globalStatus: string
  activeZones:  number
}

interface BottomSheetProps {
  session:        { user: AuthUser } | null
  activeFilter:   FilterId
  map:            mapboxgl.Map | null
  onFilterChange: (id: FilterId) => void
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
    { label: 'TIF · Börja Swiss Solutions', url: 'https://borja-swiss-solutions.ch' },
    { label: 'Douanes suisses (BAZG)', url: 'https://www.bazg.admin.ch' },
  ]
  if (GENEVA_IDS.has(id)) {
    sources.push({ label: 'Canton de Genève', url: 'https://www.ge.ch' })
    sources.push({ label: 'Ville de Genève', url: 'https://www.ville-geneve.ch' })
  }
  if (VAUD_IDS.has(id)) {
    sources.push({ label: 'Canton de Vaud', url: 'https://www.vd.ch' })
  }
  if (HAUTE_SAVOIE_IDS.has(id)) {
    sources.push({ label: 'Préfecture Haute-Savoie', url: 'https://www.haute-savoie.gouv.fr' })
  }
  if (AIN_IDS.has(id)) {
    sources.push({ label: "Préfecture de l'Ain", url: 'https://www.ain.gouv.fr' })
  }
  if (JURA_IDS.has(id)) {
    sources.push({ label: 'Préfecture du Jura', url: 'https://www.jura.gouv.fr' })
  }
  sources.push({ label: 'TCS — Info trafic Suisse', url: 'https://www.tcs.ch/fr/routes-voyages/info-trafic/' })
  if (isG7) {
    sources.push({ label: 'G7 Évian 2026 — Élysée', url: 'https://www.elysee.fr' })
    sources.push({ label: 'Confédération suisse', url: 'https://www.admin.ch' })
  }
  return sources
}

// ── Fiche détail d'une douane ─────────────────────────────────────────────────
const LIVE_STATUS_COLOR: Record<string, string> = {
  CLEAR:    '#34C759',
  LIGHT:    '#30D158',
  MODERATE: '#FF9500',
  HEAVY:    '#FF3B30',
  BLOCKED:  '#636366',
}

function CrossingDetail({ crossing, onBack: _onBack, onLocate, waitDirection, waitFrCh, waitChFr, liveStatus, liveWaitMinutes }: {
  crossing:        CrossingStatic
  onBack:          () => void
  onLocate:        (c: CrossingStatic) => void
  waitDirection?:  string | null
  waitFrCh?:       number | null
  waitChFr?:       number | null
  liveStatus?:     string | null
  liveWaitMinutes?: number | null
}) {
  const t        = useMapT()
  const now      = new Date()
  const s        = computeInstantStatus(crossing, now)
  const liveData = useLiveCrossings()
  const live     = liveData[crossing.id]

  const G7_START   = new Date('2026-06-08T00:00:00Z')
  const G7_END     = new Date('2026-06-18T23:59:59Z')
  const isG7Period = now >= G7_START && now <= G7_END

  const sources = getCrossingSources(crossing.id, isG7Period)

  // Utilise le statut live (HERE/dispatch) s'il est disponible, sinon le calcul synthétique
  const displayStatus   = liveStatus      ?? live?.status      ?? s.status
  const displayWait     = liveWaitMinutes ?? live?.waitMinutes ?? s.waitMinutes
  const displayColor    = LIVE_STATUS_COLOR[displayStatus]     ?? s.color

  const statusLabel = crossing.type === 'rail'
    ? (isG7Period ? 'Arrivez 45 min avant le départ' : 'Arrivez 30 min avant le départ')
    : displayStatus === 'BLOCKED'  ? t.crossing.closed
    : displayStatus === 'HEAVY'    ? t.crossing.heavy.replace('{n}', String(displayWait))
    : displayStatus === 'MODERATE' ? t.crossing.moderate.replace('{n}', String(displayWait))
    : displayStatus === 'LIGHT'    ? t.crossing.light.replace('{n}', String(displayWait))
    : t.crossing.clear

  const typeLabel = crossing.type === 'motorway' ? t.crossing.motorway
    : crossing.type === 'main'      ? t.crossing.main
    : crossing.type === 'secondary' ? t.crossing.secondary
    : crossing.type === 'rail'      ? t.crossing.rail
    : t.crossing.local

  return (
    <div>
      {/* Header */}
      <div className="rounded-2xl p-4 mb-3"
        style={{ background: `${displayColor}10`, border: `1px solid ${displayColor}35` }}>
        <div className="flex items-start gap-3">
          <span className="text-3xl">{s.icon}</span>
          <div className="flex-1">
            <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {crossing.name}
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{typeLabel}</p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: displayColor }} />
            <span className="text-sm font-semibold" style={{ color: displayColor }}>{statusLabel}</span>
          </div>
          {displayStatus !== 'BLOCKED' && (
            <div className="mt-2 space-y-1">
              {crossing.type === 'rail' ? (<>
                <div className="flex items-center justify-between pl-4 pr-1">
                  <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>🚂 Départ CH → FR</span>
                  <span className="text-[12px] font-semibold" style={{ color: displayColor }}>
                    {isG7Period ? '45 min avant' : '30 min avant'}
                  </span>
                </div>
                <div className="flex items-center justify-between pl-4 pr-1">
                  <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>🚂 Arrivée FR → CH</span>
                  <span className="text-[12px] font-semibold" style={{ color: displayColor }}>~5–10 min</span>
                </div>
              </>) : (<>
                <div className="flex items-center justify-between pl-4 pr-1">
                  <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    🚗 France → Suisse
                  </span>
                  <span className="text-[12px] font-semibold" style={{ color: displayColor }}>
                    {waitFrCh != null
                      ? (waitFrCh === 0 ? 'Libre' : `${waitFrCh} min`)
                      : (displayWait === 0 ? 'Libre' : `${displayWait} min`)}
                  </span>
                </div>
                <div className="flex items-center justify-between pl-4 pr-1">
                  <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    🚗 Suisse → France
                  </span>
                  <span className="text-[12px] font-semibold" style={{ color: displayColor }}>
                    {waitChFr != null
                      ? (waitChFr === 0 ? 'Libre' : `${waitChFr} min`)
                      : (displayWait === 0 ? 'Libre' : `${displayWait} min`)}
                  </span>
                </div>
              </>)}
            </div>
          )}
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
        {t.crossing.viewOnMap}
      </button>

      {/* Infos pratiques */}
      <div className="rounded-2xl p-4 mb-3 space-y-2.5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          {t.crossing.practicalInfo}
        </p>
        <div className="flex items-start gap-2.5">
          <span className="text-base flex-shrink-0">🕐</span>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.crossing.schedule}</p>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{crossing.hours}</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="text-base flex-shrink-0">{crossing.type === 'rail' ? '🚂' : '🚗'}</span>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.crossing.vehicles}</p>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              {crossing.vehicles.join(' · ')}
            </p>
          </div>
        </div>
        {crossing.type !== 'rail' && crossing.pedestrian && (
          <div className="flex items-center gap-2.5">
            <span className="text-base">🚶</span>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{t.crossing.pedestrian}</p>
          </div>
        )}
        {crossing.type === 'rail' && (<>
          <div className="flex items-start gap-2.5">
            <span className="text-base flex-shrink-0">🔵</span>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Départ Genève → Paris / Lyon</p>
              <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                Présentez-vous au quai {isG7Period ? '45' : '30'} min avant le départ · Contrôle Douane CH + PAF France à quai · Pièce d&apos;identité obligatoire
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-base flex-shrink-0">🟢</span>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Arrivée Paris → Genève</p>
              <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                Contrôle PAF France à bord ou sur quai à l&apos;arrivée · ~5–10 min
              </p>
            </div>
          </div>
        </>)}
      </div>

      {/* Info G7 */}
      {crossing.g7Info && (
        <div className="rounded-2xl p-4 mb-3"
          style={{
            background: displayStatus === 'BLOCKED' ? 'rgba(255,69,58,0.08)' : 'rgba(255,149,0,0.08)',
            border:     displayStatus === 'BLOCKED' ? '1px solid rgba(255,69,58,0.25)' : '1px solid rgba(255,149,0,0.25)',
          }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: displayStatus === 'BLOCKED' ? '#FF453A' : '#FF9F0A' }}>
            🏛️ G7 · 12 au 18 juin 2026
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {crossing.g7Info}
          </p>
          {crossing.nearestOpen && displayStatus === 'BLOCKED' && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,69,58,0.15)' }}>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: '#30D158' }}>{t.crossing.alternative}</span>
                {crossing.nearestOpen}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sources officielles — liens cliquables */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
          {t.crossing.officialSources}
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

// ── Live crossing data (partagé depuis BorderCrossingsLayer via event) ────────
type LiveEntry = { status: string; waitMinutes: number; color: string }

// Cache module-level : persist le dernier dispatch même quand les composants démontent/remontent.
// Sans ce cache, DouanesDetail monté après le premier dispatch (carte déjà chargée) resterait
// vide jusqu'au prochain refresh (2 min), affichant les valeurs client au lieu des valeurs live.
let _liveCache: Record<string, LiveEntry> = {}

function useLiveCrossings(): Record<string, LiveEntry> {
  const [liveData, setLiveData] = useState<Record<string, LiveEntry>>(_liveCache)
  useEffect(() => {
    const handler = (e: Event) => {
      _liveCache = (e as CustomEvent<Record<string, LiveEntry>>).detail
      setLiveData(_liveCache)
    }
    window.addEventListener('tif:crossings-live-update', handler)
    return () => window.removeEventListener('tif:crossings-live-update', handler)
  }, [])
  return liveData
}

// ── Liste des douanes ─────────────────────────────────────────────────────────
function DouanesDetail({ onSelect, map }: {
  onSelect: (c: CrossingStatic) => void
  map:      mapboxgl.Map | null
}) {
  const t        = useMapT()
  const now      = new Date()
  const liveData = useLiveCrossings()
  const crossings = ALL_CROSSINGS.map(c => {
    const s    = computeInstantStatus(c, now)
    const live = liveData[c.id]
    return { c, s: live ? { ...s, status: live.status as typeof s.status, waitMinutes: live.waitMinutes, color: live.color } : s }
  })
    .sort((a, b) => {
      // Fermées toujours en dernier
      if (a.s.status === 'BLOCKED' && b.s.status !== 'BLOCKED') return 1
      if (b.s.status === 'BLOCKED' && a.s.status !== 'BLOCKED') return -1
      // Sinon : plus d'attente en premier
      return b.s.waitMinutes - a.s.waitMinutes
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
        {crossings.length} {t.crossing.crossings} · {open24} {t.crossing.open24}
        {blocked > 0 ? ` · ${blocked} ${t.crossing.closedG7}` : ''}
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
              {s.status === 'BLOCKED' ? t.crossing.closedShort
                : s.status === 'HEAVY' ? `${s.waitMinutes} min`
                : s.status === 'MODERATE' ? `${s.waitMinutes} min`
                : s.status === 'LIGHT' ? `${s.waitMinutes} min`
                : t.crossing.freeShort}
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

// ── Helpers de formatage de période ──────────────────────────────────────────
function fmtTime(d: Date) {
  return d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })
}
function fmtPeriod(from: Date, to: Date) {
  const diffMs = to.getTime() - from.getTime()
  if (diffMs >= 86400000) {
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'Europe/Zurich' }
    return `${from.toLocaleDateString('fr-CH', opts)} – ${to.toLocaleDateString('fr-CH', opts)}`
  }
  return `${fmtTime(from)}–${fmtTime(to)}`
}
function timeRemaining(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expiré'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 0) return `${h}h${m > 0 ? ' ' + m + 'min' : ''}`
  return `${m}min`
}

// ── Transport ─────────────────────────────────────────────────────────────────
interface TpgDisruptionItem { lineNumber: string; type: string; description: string; detectedAt?: string }
interface CffDisruptionItem { line: string; type: string; description: string; isCEVA?: boolean; delayMinutes?: number; detectedAt?: string }
interface TransportData {
  disruptions: { tpg: TpgDisruptionItem[]; cff: CffDisruptionItem[] }
}
interface TpgLineStatus {
  line: string; status: 'normal' | 'delayed' | 'disrupted'
  delayMin: number; direction: string; stopName: string; departure: string | null
}
interface TpgLinesData { lines: TpgLineStatus[]; generatedAt: string }

interface StopDeparture { time: string | null; direction: string; delay: number }
interface StopDeparturesData { stopName: string; departures: StopDeparture[] }

function StopDeparturesPanel({ name, line, onClose }: { name: string; line: string; onClose: () => void }) {
  const t = useMapT()
  const { data, isLoading } = useQuery<StopDeparturesData>({
    queryKey:  ['tpg-stop-departures', name, line],
    queryFn:   () => fetch(`/api/v1/tpg-stop-departures?stopName=${encodeURIComponent(name)}&line=${line}`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
    staleTime: 15_000,
  })

  const fmt = (iso: string | null) => iso
    ? new Date(iso).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })
    : '—'

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t.transport.stopLine} {line}</p>
          <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{name}</p>
        </div>
        <button onClick={onClose} className="text-[18px] leading-none" style={{ color: 'var(--text-tertiary)' }}>×</button>
      </div>
      {isLoading && (
        <div className="flex gap-2 py-1">
          {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: `${i*150}ms` }} />)}
        </div>
      )}
      {!isLoading && (data?.departures ?? []).length === 0 && (
        <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>{t.transport.noDeparts}</p>
      )}
      {!isLoading && (data?.departures ?? []).map((d, i) => {
        const delay = d.delay ?? 0
        const c = delay >= 10 ? '#FF453A' : delay >= 3 ? '#FF9F0A' : '#30D158'
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)', minWidth: 40 }}>{fmt(d.time)}</span>
            {delay > 0 && <span className="text-[11px] font-semibold" style={{ color: c }}>+{delay}&apos;</span>}
            <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>→ {d.direction}</span>
          </div>
        )
      })}
    </div>
  )
}

function TransportDetail({ onExpand }: { onExpand?: () => void }) {
  const t = useMapT()
  const [selectedLine, setSelectedLine] = useState<string | null>(null)
  const [selectedStop, setSelectedStop] = useState<{ name: string; coord: [number, number]; line: string } | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ name: string; coord: [number, number]; line: string }>).detail
      setSelectedStop(detail)
      onExpand?.()
    }
    window.addEventListener('tif:stop-select', handler)
    return () => window.removeEventListener('tif:stop-select', handler)
  }, [onExpand])

  const handleLineBadgeClick = (l: TpgLineStatus) => {
    const c = l.status === 'disrupted' ? '#FF453A' : l.status === 'delayed' ? '#FF9F0A' : '#30D158'
    const newLine = selectedLine === l.line ? null : l.line
    setSelectedLine(newLine)
    setSelectedStop(null)
    window.dispatchEvent(new CustomEvent('tif:line-select', { detail: { line: newLine, color: c } }))
    if (newLine) onExpand?.()
  }

  const { data, isLoading } = useQuery<TransportData>({
    queryKey:        ['transport-layer'],
    queryFn:         () => fetch('/api/v1/layers/transport', { signal: AbortSignal.timeout(8000) }).then(r => r.json()),
    refetchInterval: 30_000,
    staleTime:       15_000,
  })

  const { data: tpgLines, isLoading: linesLoading } = useQuery<TpgLinesData>({
    queryKey:        ['tpg-lines'],
    queryFn:         () => fetch('/api/v1/tpg-lines', { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
    refetchInterval: 60_000,
    staleTime:       20_000,
  })

  // Garde uniquement les départs dans les 45 prochaines minutes, triés par heure croissante
  const now45 = Date.now() + 45 * 60 * 1000
  const byTime = <T extends { detectedAt?: string }>(arr: T[]) =>
    [...arr]
      .filter(d => !d.detectedAt || new Date(d.detectedAt).getTime() <= now45)
      .sort((a, b) => (a.detectedAt ?? '').localeCompare(b.detectedAt ?? ''))

  const tpgDisruptions  = byTime(data?.disruptions.tpg ?? [])
  const cffDisruptions  = byTime(data?.disruptions.cff?.filter(d => !d.isCEVA) ?? [])
  const cevaDisruptions = byTime(data?.disruptions.cff?.filter(d =>  d.isCEVA) ?? [])

  const tpgStatus  = tpgDisruptions.length  === 0 ? 'normal' : 'delayed'
  const cffStatus  = cffDisruptions.length  === 0 ? 'normal' : 'delayed'
  const cevaStatus = cevaDisruptions.length === 0 ? 'normal' : 'delayed'

  const statusColor = (s: string) => s === 'normal' ? '#30D158' : '#FF9F0A'
  const statusLabel = (s: string) => s === 'normal' ? t.transport.statusNormal : t.transport.statusDelays

  const TYPE_ICON: Record<string, string> = {
    travaux: '🚧', deviation: '🔀', suppression: '🚫', retard: '⏱️', perturbation: '⚠️',
  }

  const d = new Date().toLocaleDateString('fr-CH', { timeZone: 'Europe/Zurich' })
  const isNOG7Day = ['14.06.2026','15.06.2026','16.06.2026','17.06.2026'].includes(d)

  return (
    <div className="space-y-3">
      {/* ── Bannière A1 fermée ────────────────────────────────────────── */}
      {isNOG7Day && (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.40)' }}>
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">🛑</span>
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#FF453A' }}>
                ⛔ A1 FERMÉE — 14 AU 17 JUIN 2026
              </p>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Autoroute A1 bloquée jusqu&apos;à Bardonnex
              </p>
              <p className="text-[12px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                Douane de Bardonnex inaccessible · Évitez la A1 dans les deux sens
              </p>
              <div className="mt-2.5 space-y-1">
                <p className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Alternatives :</p>
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>✓ Ferney-Voltaire (D1005)</p>
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>✓ Thônex-Vallard (N201)</p>
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>✓ Moillesulaz (N205)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Zones d'impact TPG ───────────────────────────────────────── */}
      {IMPACT_ZONES.filter(z => z.type === 'TRANSPORT_DISRUPTION').map(zone => {
        const color = zone.strokeColor
        return (
          <div key={zone.id} className="rounded-2xl p-4 space-y-3"
            style={{ background: `${color}12`, border: `1px solid ${color}35` }}>
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">🟠</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
                  Réseau TPG · Perturbations G7
                </p>
                <p className="text-sm font-bold leading-snug mt-0.5" style={{ color: 'var(--text-primary)' }}>
                  {zone.title}
                </p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 text-center"
                style={{ background: `${color}20`, color, minWidth: 60 }}>
                {fmtPeriod(zone.activeFrom, zone.activeTo)}
              </span>
            </div>
            {zone.lines && zone.lines.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {zone.lines.map(l => (
                  <span key={l} className="text-[11px] font-bold px-2 py-0.5 rounded-lg"
                    style={{ background: `${color}22`, color, border: `1px solid ${color}40` }}>
                    {l}
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-1">
              {zone.description.split('\n').map((line, i) => {
                if (!line.trim()) return null
                const isBullet = line.startsWith('*')
                const isHeader = !isBullet && /[A-ZÉÈÊÀÙÂÎÛÔ]{3,}/.test(line)
                if (isBullet) return (
                  <p key={i} className="pl-3 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    {line.replace(/^\*\s*/, '· ')}
                  </p>
                )
                if (isHeader) return (
                  <p key={i} className="text-[10px] font-bold uppercase tracking-wider pt-1.5"
                    style={{ color: `${color}CC` }}>
                    {line}
                  </p>
                )
                return (
                  <p key={i} className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {line}
                  </p>
                )
              })}
            </div>
            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {zone.source} · {zone.sourceRef}
            </p>
          </div>
        )
      })}

      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
        {t.transport.networkStatus}
      </p>

      {isLoading && (
        <div className="flex items-center gap-2 py-3">
          {[0,1,2].map(i => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: `${i*150}ms` }} />
          ))}
        </div>
      )}

      {/* Status rows */}
      {[
        { icon: '🚌', name: 'TPG — Tram & Bus', status: tpgStatus },
        { icon: '🚂', name: 'CFF / SBB',         status: cffStatus },
        { icon: '🚆', name: 'Léman Express CEVA', status: cevaStatus },
      ].map(l => {
        const c = statusColor(l.status)
        return (
          <div key={l.name} className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <span className="text-xl">{l.icon}</span>
            <p className="flex-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{l.name}</p>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${c}18`, color: c }}>
              {statusLabel(l.status)}
            </span>
          </div>
        )
      })}

      {/* Section lignes TPG par ligne */}
      <div className="pt-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
          {t.transport.tpgLines}
        </p>
        {linesLoading && (
          <div className="flex items-center gap-2 py-2">
            {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: `${i*150}ms` }} />)}
          </div>
        )}
        {!linesLoading && (tpgLines?.lines ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(tpgLines?.lines ?? []).map(l => {
              const c       = l.status === 'disrupted' ? '#FF453A' : l.status === 'delayed' ? '#FF9F0A' : '#30D158'
              const active  = selectedLine === l.line
              return (
                <button key={l.line}
                  onClick={() => handleLineBadgeClick(l)}
                  title={l.status !== 'normal' ? `+${l.delayMin} min vers ${l.direction}` : `Normal · ${l.direction}`}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 transition-all active:scale-95"
                  style={{
                    background: active ? c : `${c}15`,
                    border:     `1px solid ${active ? c : `${c}35`}`,
                    cursor:     'pointer',
                  }}>
                  <span className="text-[12px] font-bold" style={{ color: active ? '#000' : c }}>{l.line}</span>
                  {l.status !== 'normal' && (
                    <span className="text-[10px]" style={{ color: active ? '#000' : c }}>+{l.delayMin}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Ligne sélectionnée — info terminus */}
        {selectedLine && !selectedStop && (() => {
          const cfg      = (tpgLines?.lines ?? []).find(l => l.line === selectedLine)
          const lineCfg  = TPG_LINES[selectedLine]
          const c        = cfg ? (cfg.status === 'disrupted' ? '#FF453A' : cfg.status === 'delayed' ? '#FF9F0A' : '#30D158') : '#30D158'
          const termA    = lineCfg?.terminusA ?? '—'
          const termB    = lineCfg?.terminusB ?? '—'
          return (
            <div key={selectedLine} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${c}30`, animation: 'fadeUp 0.18s cubic-bezier(0.23, 1, 0.32, 1)' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ background: `${c}12` }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-bold px-2 py-0.5 rounded flex-shrink-0" style={{ background: c, color: '#000' }}>
                    {selectedLine}
                  </span>
                  <p className="text-[12px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                    {termA} ↔ {termB}
                  </p>
                </div>
                <button onClick={() => {
                  setSelectedLine(null)
                  setSelectedStop(null)
                  window.dispatchEvent(new CustomEvent('tif:line-clear'))
                }} className="text-[18px] leading-none ml-2 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>×</button>
              </div>

              {/* Temps réel */}
              {cfg && (
                <div className="px-4 py-1.5 flex items-center gap-2" style={{ background: `${c}08`, borderBottom: `1px solid ${c}20` }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
                  <p className="text-[11px]" style={{ color: c }}>
                    {cfg.status !== 'normal' ? `+${cfg.delayMin} min` : 'Normal'} · vers {cfg.direction}
                  </p>
                </div>
              )}

              {/* Liste des arrêts */}
              <div className="max-h-52 overflow-y-auto divide-y divide-white/5">
                {(lineCfg?.stops ?? []).map((stop, i) => {
                  const isFirst = i === 0
                  const isLast  = i === (lineCfg?.stops.length ?? 1) - 1
                  return (
                    <button
                      key={stop.name}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('tif:stop-select', {
                          detail: { name: stop.name, coord: stop.coord, line: selectedLine },
                        }))
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:scale-[0.98] transition-transform"
                      style={{ background: 'rgba(255,255,255,0.02)' }}
                    >
                      {/* Ligne de trajet */}
                      <div className="flex flex-col items-center flex-shrink-0 gap-0.5" style={{ width: 12 }}>
                        {!isFirst && <div className="w-px flex-1 min-h-[8px]" style={{ background: `${c}50` }} />}
                        <div className="w-2.5 h-2.5 rounded-full border-2 flex-shrink-0" style={{ borderColor: c, background: (isFirst || isLast) ? c : 'transparent' }} />
                        {!isLast  && <div className="w-px flex-1 min-h-[8px]" style={{ background: `${c}50` }} />}
                      </div>
                      <p className="flex-1 text-[13px] font-medium" style={{ color: (isFirst || isLast) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {stop.name}
                      </p>
                      <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" className="flex-shrink-0">
                        <path d="M1 1l4 4-4 4"/>
                      </svg>
                    </button>
                  )
                })}
              </div>
              <p className="text-center text-[10px] py-2" style={{ color: 'var(--text-tertiary)' }}>
                {t.transport.tapStop}
              </p>
            </div>
          )
        })()}

        {/* Arrêt sélectionné — prochains départs */}
        {selectedStop && (
          <div key={`${selectedStop.name}|${selectedStop.line}`} style={{ animation: 'fadeUp 0.18s cubic-bezier(0.23, 1, 0.32, 1)' }}>
            <StopDeparturesPanel
              name={selectedStop.name}
              line={selectedStop.line}
              onClose={() => setSelectedStop(null)}
            />
          </div>
        )}
        {!linesLoading && (tpgLines?.lines ?? []).length === 0 && (
          <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>{t.transport.noLines}</p>
        )}
      </div>

      {/* Disruption details */}
      {tpgDisruptions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider pt-1" style={{ color: 'var(--text-tertiary)' }}>
            {t.transport.tpgDelays}
          </p>
          {tpgDisruptions.map((d, i) => (
            <div key={i} className="flex gap-3 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.15)' }}>
              <span className="text-base flex-shrink-0">{TYPE_ICON[d.type] ?? '⏱️'}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: '#FF9500', color: '#000' }}>
                    {d.lineNumber}
                  </span>
                  {d.detectedAt && (
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                      {t.transport.depPrefix}{new Date(d.detectedAt).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })}
                    </span>
                  )}
                </div>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-primary)' }}>{d.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {[...cffDisruptions, ...cevaDisruptions].length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider pt-1" style={{ color: 'var(--text-tertiary)' }}>
            {t.transport.cffDelays}
          </p>
          {[...cffDisruptions, ...cevaDisruptions].map((d, i) => (
            <div key={i} className="flex gap-3 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(0,64,255,0.08)', border: '1px solid rgba(0,64,255,0.15)' }}>
              <span className="text-base flex-shrink-0">{TYPE_ICON[d.type] ?? '⏱️'}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: d.isCEVA ? '#AF52DE' : '#0040FF', color: '#fff' }}>
                    {d.line}
                  </span>
                  {d.detectedAt && (
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                      {t.transport.depPrefix}{new Date(d.detectedAt).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })}
                    </span>
                  )}
                </div>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-primary)' }}>{d.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-center pt-1" style={{ color: 'var(--text-tertiary)' }}>
        {t.transport.rtFooter}
      </p>
    </div>
  )
}

// ── Fiche détail d'une alerte admin (composant autonome) ─────────────────────
function AlertDetailView({ alert: a, map, onBack }: {
  alert:  AlertDetailItem
  map:    mapboxgl.Map | null
  onBack: () => void
}) {
  const t = useMapT()
  const [shareCopied, setShareCopied] = useState(false)

  const flyTo = (lng: number, lat: number) => {
    if (!map || !lng || !lat) return
    map.flyTo({ center: [lng, lat], zoom: 14, duration: 900, essential: true })
  }

  const customAlertTypeLabel = (type: string) =>
    type === 'barrage'      ? t.alertsSection.barrage
    : type === 'accident'   ? t.alertsSection.accident
    : type === 'restriction'? t.alertsSection.restriction
    : t.alertsSection.incident

  let validSource: string | null = null
  try {
    const u = new URL(a.source)
    if (u.protocol === 'http:' || u.protocol === 'https:') validSource = a.source
  } catch { /* URL invalide */ }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl p-4" style={{ background: `${a.color}12`, border: `1px solid ${a.color}35` }}>
        <div className="flex items-start gap-3">
          <span className="text-3xl flex-shrink-0">{a.icon}</span>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: a.color }}>
              {customAlertTypeLabel(a.type)}
            </span>
            <h2 className="text-base font-bold leading-snug mt-0.5" style={{ color: 'var(--text-primary)' }}>{a.title}</h2>
          </div>
        </div>
        {a.description && (
          <p className="text-[13px] leading-relaxed mt-3" style={{ color: 'var(--text-secondary)' }}>
            {a.description}
          </p>
        )}
      </div>

      <button
        onClick={() => { flyTo(a.lng, a.lat); onBack() }}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm active:scale-[0.97] transition-transform"
        style={{ background: 'var(--brand)', color: '#fff' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        Voir sur la carte
      </button>

      <button
        onClick={async () => {
          const shareText = [a.title, a.description].filter(Boolean).join(' — ')
          const shareUrl  = window.location.href
          if (typeof navigator.share === 'function') {
            try { await navigator.share({ title: a.title, text: shareText, url: shareUrl }); return } catch { /* annulé */ }
          }
          try {
            await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
            setShareCopied(true)
            setTimeout(() => setShareCopied(false), 2000)
          } catch { /* ignore */ }
        }}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm transition-colors active:scale-[0.97] transition-transform"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: shareCopied ? '#30D158' : 'var(--text-primary)' }}
      >
        {shareCopied ? (
          <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Copié !</>
        ) : (
          <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Partager cette alerte</>
        )}
      </button>

      {validSource && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Source officielle</p>
          <a href={validSource} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl px-3 py-2.5 active:scale-[0.98] transition-transform"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <span className="text-[13px] font-medium truncate" style={{ color: 'var(--brand)' }}>
              {(() => { try { return new URL(validSource).host } catch { return validSource } })()}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 ml-2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>
      )}
    </div>
  )
}

// ── Alertes — fetch direct depuis layers/alerts (HERE + OFROU + TPG + météo) ───
function AlertesDetail({ map, onAlertSelect }: { map: mapboxgl.Map | null; onAlertSelect: (a: AlertDetailItem) => void }) {
  const t = useMapT()
  const { data: geoJson, isLoading } = useQuery<{ type: string; features: { properties: Record<string, unknown>; geometry: { coordinates: number[] } }[] }>({
    queryKey:        ['layers-alerts'],
    queryFn:         () => fetch('/api/v1/layers/alerts', { signal: AbortSignal.timeout(6000) }).then(r => r.json()),
    refetchInterval: 60000,
    staleTime:       60000,
  })
  const [showBanner, setShowBanner] = useState(false)

  const { data: customAlertsGeo } = useQuery<{ features: { properties: { id: string; type: string; title: string; description: string; source: string; color: string; icon: string }; geometry: { coordinates: [number, number] } }[] }>({
    queryKey:        ['tif-custom-alerts-panel'],
    queryFn:         () => fetch('/api/v1/layers/custom-alerts').then(r => r.json()),
    refetchInterval: 30_000,
    staleTime:       30_000,
  })

  const alerts = (geoJson?.features ?? []).map((f, i) => ({
    id:          String(f.properties.id ?? i),
    icon:        String(f.properties.icon ?? '⚠️'),
    title:       String(f.properties.description ?? f.properties.label ?? 'Incident'),
    type:        String(f.properties.type ?? ''),
    lng:         f.geometry?.coordinates?.[0],
    lat:         f.geometry?.coordinates?.[1],
  }))

  const typeLabel = (type: string) =>
    type === 'ACCIDENT'     ? t.alertsSection.accident
    : type === 'CONSTRUCTION' ? t.alertsSection.construction
    : type === 'CONGESTION'   ? t.alertsSection.congestion
    : type === 'ROAD_CLOSURE' ? t.alertsSection.roadClosure
    : type === 'tpg'          ? t.alertsSection.tpgDisruption
    : type === 'weather'      ? t.alertsSection.weather
    : t.alertsSection.incident

  const flyTo = (lng: number, lat: number) => {
    if (!map || !lng || !lat) return
    map.flyTo({ center: [lng, lat], zoom: 14, duration: 900, essential: true })
  }

  const nowAlert  = new Date()
  const isG7Alert = nowAlert >= new Date('2026-06-11T22:01:00Z') && nowAlert <= new Date('2026-06-18T21:59:00Z')
  const blockedCrossings = isG7Alert
    ? ALL_CROSSINGS
        .filter(c => computeInstantStatus(c, nowAlert).status === 'BLOCKED' && c.nearestOpen != null)
        .sort((a, b) => a.name.localeCompare(b.name))
    : []

  const customAlerts = (customAlertsGeo?.features ?? []).map(f => ({
    id:          f.properties.id,
    type:        f.properties.type,
    title:       f.properties.title,
    description: f.properties.description,
    source:      f.properties.source,
    color:       f.properties.color,
    icon:        f.properties.icon,
    lng:         f.geometry.coordinates[0],
    lat:         f.geometry.coordinates[1],
  }))

  const customAlertTypeLabel = (type: string) =>
    type === 'barrage'     ? t.alertsSection.barrage
    : type === 'accident'  ? t.alertsSection.accident
    : type === 'restriction' ? t.alertsSection.restriction
    : type === 'info'      ? t.alertsSection.incident
    : t.alertsSection.incident

  useEffect(() => {
    if (!isLoading && alerts.length === 0) {
      setShowBanner(true)
      const timer = setTimeout(() => setShowBanner(false), 4500)
      return () => clearTimeout(timer)
    }
  }, [isLoading, alerts.length])

  const totalActive = customAlerts.length + blockedCrossings.length + alerts.length

  return (
    <div className="space-y-3">

      {/* ══ ALERTES ACTIVES ═══════════════════════════════════════════════ */}
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: '#FF453A' }} />
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#FF453A' }}>
          Alertes actives
        </p>
        {totalActive > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(255,69,58,0.18)', color: '#FF453A' }}>
            {totalActive}
          </span>
        )}
        {isLoading && (
          <div className="flex gap-1 ml-1">
            {[0,1,2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: `${i*150}ms` }} />)}
          </div>
        )}
      </div>

      {/* ── Alertes admin (opérateur) ─────────────────────────────────── */}
      {customAlerts.map(a => (
        <button
          key={a.id}
          className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left active:scale-[0.98] transition-transform"
          style={{ background: `${a.color}15`, border: `0.5px solid ${a.color}40`, backdropFilter: 'blur(20px)' }}
          onClick={() => onAlertSelect(a)}
        >
          <span className="text-xl flex-shrink-0">{a.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
            {a.description && (
              <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{a.description}</p>
            )}
          </div>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke={a.color} strokeWidth="1.5" strokeLinecap="round" className="flex-shrink-0 opacity-60">
            <path d="M1 1l4 4-4 4"/>
          </svg>
        </button>
      ))}

      {/* ── Passages fermés G7 ────────────────────────────────────────── */}
      {blockedCrossings.map(c => (
        <button
          key={c.id}
          className="w-full flex items-center gap-3 rounded-2xl px-3 py-2 text-left active:scale-[0.98] transition-transform"
          style={{ background: 'rgba(255,59,48,0.10)', border: '0.5px solid rgba(255,59,48,0.35)', backdropFilter: 'blur(20px)' }}
          onClick={() => c.lng != null && c.lat != null && flyTo(c.lng!, c.lat!)}
        >
          <span className="text-base flex-shrink-0">🚫</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
            {c.nearestOpen && (
              <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {t.alertsSection.nearestOpen}: {c.nearestOpen}
              </p>
            )}
          </div>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
            <path d="M5 3l4 4-4 4" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      ))}

      {/* ── Incidents temps réel (HERE / OFROU) ──────────────────────── */}
      {showBanner && (
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: 'rgba(52,199,89,0.12)', border: '0.5px solid rgba(52,199,89,0.40)', backdropFilter: 'blur(20px)', animation: 'slideDown 0.28s ease forwards' }}>
          <span className="text-xl flex-shrink-0">✅</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#34C759' }}>{t.alertsSection.noAlertTitle}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{t.alertsSection.noAlertSub}</p>
          </div>
        </div>
      )}
      {!isLoading && alerts.length === 0 && !showBanner && customAlerts.length === 0 && blockedCrossings.length === 0 && (
        <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--bg-card)' }}>
          <p className="text-2xl mb-2">✅</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.alertsSection.noIncidentTitle}</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>{t.alertsSection.noIncidentSub}</p>
        </div>
      )}
      {isLoading && (
        <div className="flex items-center justify-center py-6 gap-2">
          {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}
        </div>
      )}
      {alerts.map(a => (
        <button key={a.id}
          onClick={() => flyTo(a.lng, a.lat)}
          className="w-full flex items-start gap-3 rounded-2xl p-3 text-left active:scale-[0.98] transition-transform"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <span className="text-xl flex-shrink-0 mt-0.5">{a.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{typeLabel(a.type)}</p>
            <p className="text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
          </div>
          {a.lng && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-1">
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          )}
        </button>
      ))}

      {/* ══ BULLETINS G7 ══════════════════════════════════════════════════ */}
      <div className="pt-1">
        <G7BulletinsPanel categories={['route']} title={t.alertsSection.g7RouteTpg} />
      </div>

      {/* ══ ZONES D'IMPACT ════════════════════════════════════════════════ */}
      <div className="space-y-2 pt-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          ⚠️ Zones d&apos;impact — NO-G7 · 14.06.2026
        </p>
        {IMPACT_ZONES.map(zone => {
          const color = zone.strokeColor
          const zoneIcon = zone.type === 'DEMONSTRATION' ? '🔴'
            : zone.type === 'TRANSPORT_DISRUPTION' ? '🟠'
            : zone.type === 'ROAD_CLOSURE' ? '🛑'
            : '⚠️'
          const zoneLabel = zone.type === 'DEMONSTRATION' ? 'Manifestation · Périmètre'
            : zone.type === 'TRANSPORT_DISRUPTION' ? 'Réseau TPG · Perturbations G7'
            : zone.type === 'ROAD_CLOSURE' ? 'A1 — Fermeture totale'
            : zone.type
          return (
            <div key={zone.id} className="rounded-2xl p-4 space-y-3"
              style={{ background: `${color}12`, border: `1px solid ${color}35` }}>
              {/* Header */}
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{zoneIcon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
                    {zoneLabel}
                  </p>
                  <p className="text-sm font-bold leading-snug mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    {zone.title}
                  </p>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 text-center"
                  style={{ background: `${color}20`, color, minWidth: 60 }}>
                  {fmtPeriod(zone.activeFrom, zone.activeTo)}
                </span>
              </div>

              {/* Lignes */}
              {zone.lines && zone.lines.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {zone.lines.map(l => (
                    <span key={l}
                      className="text-[11px] font-bold px-2 py-0.5 rounded-lg"
                      style={{ background: `${color}22`, color, border: `1px solid ${color}40` }}>
                      {l}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              <div className="space-y-1">
                {zone.description.split('\n').map((line, i) => {
                  if (!line.trim()) return null
                  const isBullet = line.startsWith('*')
                  const isHeader = !isBullet && /[A-ZÉÈÊÀÙÂÎÛÔ]{3,}/.test(line)
                  if (isBullet) return (
                    <p key={i} className="pl-3 text-[12px]"
                      style={{ color: 'var(--text-secondary)' }}>
                      {line.replace(/^\*\s*/, '· ')}
                    </p>
                  )
                  if (isHeader) return (
                    <p key={i} className="text-[10px] font-bold uppercase tracking-wider pt-1.5"
                      style={{ color: `${color}CC` }}>
                      {line}
                    </p>
                  )
                  return (
                    <p key={i} className="text-[12px] font-semibold"
                      style={{ color: 'var(--text-primary)' }}>
                      {line}
                    </p>
                  )
                })}
              </div>

              {/* Source */}
              <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                {zone.source} · {zone.sourceRef}
              </p>
            </div>
          )
        })}
      </div>

      {/* ══ SOURCES ═══════════════════════════════════════════════════════ */}
      <div className="pt-1 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          {t.alertsSection.sources}
        </p>
        {[
          { label: 'RTS — Info Trafic', url: 'https://www.rts.ch/info/trafic/' },
          { label: 'TCS — Info trafic Suisse', url: 'https://www.tcs.ch/fr/routes-voyages/info-trafic/' },
          { label: 'Inforoute — ASTRA', url: 'https://www.astra.admin.ch' },
          { label: 'Börja Swiss Solutions', url: 'https://borja-swiss-solutions.ch' },
        ].map(src => (
          <a key={src.url} href={src.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl px-3 py-2.5 active:scale-[0.98] transition-transform"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <span className="text-[13px] font-medium" style={{ color: 'var(--brand)' }}>{src.label}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 ml-2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Parkings P+R ─────────────────────────────────────────────────────────────
function ParkingDetail({ map }: { map: mapboxgl.Map | null }) {
  const t      = useMapT()
  const sorted = [...PARKINGS_PR].sort((a, b) => b.capacity - a.capacity)
  const rtCount = PARKINGS_PR.filter(p => p.hasRT).length

  const flyTo = (lng: number, lat: number) => {
    if (!map) return
    map.flyTo({ center: [lng, lat], zoom: 15, duration: 900, essential: true })
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
        {PARKINGS_PR.length} {t.parkingSection.parcRelais} · {TOTAL_PR_CAPACITY.toLocaleString('fr-CH')} {t.parkingSection.places} · Grand Genève
      </p>

      {/* Avertissement temps réel */}
      <div className="flex items-start gap-3 rounded-2xl px-4 py-3 mb-1"
        style={{ background: 'rgba(10,132,255,0.08)', border: '0.5px solid rgba(10,132,255,0.22)' }}>
        <span className="text-base flex-shrink-0">ℹ️</span>
        <div>
          <p className="text-[12px] font-semibold" style={{ color: 'rgba(10,132,255,0.9)' }}>{t.parkingSection.rtTitle}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {rtCount} {t.parkingSection.rtSubPart}
          </p>
        </div>
      </div>

      {sorted.map(p => (
        <button key={p.id}
          onClick={() => flyTo(p.lng, p.lat)}
          className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left active:scale-[0.98] transition-transform"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <span className="text-xl flex-shrink-0">🅿️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
            {p.tpg && (
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>🚌 {p.tpg}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {p.hasRT && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(48,209,88,0.15)', color: '#30D158' }}>RT</span>
            )}
            <span className="text-[12px] font-bold tabular-nums"
              style={{ color: p.capacity >= 500 ? '#30D158' : p.capacity >= 200 ? '#0A84FF' : 'var(--text-secondary)' }}>
              {p.capacity > 0 ? `${p.capacity}` : '?'}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{t.parkingSection.plAbbr}</span>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 1l4 4-4 4"/>
            </svg>
          </div>
        </button>
      ))}

      <div className="mt-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t.parkingSection.source}</p>
        <a href="https://ge.ch/sitg" target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between rounded-xl px-3 py-2.5 active:scale-[0.98] transition-transform"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <span className="text-[13px] font-medium" style={{ color: 'var(--brand)' }}>SITG · OTC Canton de Genève</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 ml-2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
        <a href="https://www.geneve-parking.ch" target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between rounded-xl px-3 py-2.5 active:scale-[0.98] transition-transform"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <span className="text-[13px] font-medium" style={{ color: 'var(--brand)' }}>Fondation des Parkings — temps réel</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 ml-2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      </div>
    </div>
  )
}

// ── Mon Trajet ────────────────────────────────────────────────────────────────
type SavedJourney = {
  id: string; name: string
  fromLabel: string; toLabel: string
  dayOfWeek: number[]; departureHour: number; departureMinute: number
  preferredMode: string; notifyMinutesBefore: number
}

const DAY_SHORT = ['D','L','M','M','J','V','S']

const STRIPE_LINK = 'https://buy.stripe.com/fZu5kCar71V38erfdR97G00'

function MonTrajetDetail() {
  const t  = useMapT()
  const qc = useQueryClient()
  const [showSetup,    setShowSetup]    = useState(false)
  const [showThankYou, setShowThankYou] = useState(false)

  async function authFetch(url: string, opts?: RequestInit) {
    const token = await firebaseAuth.currentUser?.getIdToken() ?? ''
    return fetch(url, { ...opts, headers: { ...(opts?.headers ?? {}), 'Authorization': `Bearer ${token}` } })
  }

  const { data, isLoading } = useQuery<{ journeys: SavedJourney[] }>({
    queryKey: ['my-journeys'],
    queryFn:  () => authFetch('/api/v1/my-journey').then(r => r.json()),
    staleTime: 15000,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => authFetch(`/api/v1/my-journey/${id}`, { method: 'DELETE' }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['my-journeys'] }),
  })

  const journeys = data?.journeys ?? []

  if (showSetup) {
    return (
      <JourneySetup
        onComplete={() => {
          setShowSetup(false)
          setShowThankYou(true)
          qc.invalidateQueries({ queryKey: ['my-journeys'] })
        }}
        onClose={() => setShowSetup(false)}
      />
    )
  }

  if (showThankYou) {
    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{
          borderRadius: '20px',
          padding:      '28px 24px',
          background:   'var(--bg-card)',
          border:       '1px solid var(--border)',
          textAlign:    'center',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '14px', lineHeight: 1 }}>🎉</div>
          <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.01em' }}>
            {t.journey.thankyouTitle}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '20px' }}>
            {t.journey.thankyouBody}
          </p>
          <a
            href={STRIPE_LINK}
            target="_blank"
            rel="noreferrer"
            style={{
              display:       'block',
              background:    'var(--green)',
              color:         '#fff',
              borderRadius:  '13px',
              padding:       '13px',
              fontSize:      '14px',
              fontWeight:    600,
              textDecoration:'none',
              marginBottom:  '9px',
              letterSpacing: '-0.01em',
            }}
          >
            {t.journey.supportBtn}
          </a>
          <button
            onClick={() => setShowThankYou(false)}
            style={{
              width:        '100%',
              background:   'transparent',
              color:        'var(--text-tertiary)',
              border:       '1px solid var(--border)',
              borderRadius: '13px',
              padding:      '12px',
              fontSize:     '13px',
              cursor:       'pointer',
            }}
          >
            {t.journey.viewJourney}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          {t.journey.header}
        </p>
        <button
          onClick={() => setShowSetup(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold"
          style={{ background: 'var(--brand)', color: '#fff' }}>
          {t.journey.addBtn}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
        </div>
      )}

      {!isLoading && journeys.length === 0 && (
        <div className="rounded-2xl px-4 py-8 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-3xl mb-3">🛤️</p>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {t.journey.emptyTitle}
          </p>
          <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            {t.journey.emptySub}
          </p>
        </div>
      )}

      {journeys.map(j => {
        const dep = `${String(j.departureHour).padStart(2,'0')}h${String(j.departureMinute).padStart(2,'0')}`
        const days = j.dayOfWeek.sort((a,b)=>a-b).map(d => DAY_SHORT[d]).join(' · ')
        const modeIcon = j.preferredMode === 'CAR' ? '🚗' : j.preferredMode === 'TRANSIT' ? '🚌' : '🔄'
        return (
          <div key={j.id} className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{modeIcon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{j.name}</p>
                <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                  {j.fromLabel.split(',')[0]} → {j.toLabel.split(',')[0]}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
                    style={{ background: 'rgba(10,132,255,0.12)', color: 'var(--brand)' }}>
                    {dep}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{days}</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    · {t.journey.alertPrefix} {j.notifyMinutesBefore} {t.journey.alertSuffix}
                  </span>
                </div>
              </div>
              <button
                onClick={() => { if (!deleteMut.isPending) deleteMut.mutate(j.id) }}
                disabled={deleteMut.isPending}
                className="flex-shrink-0 p-1.5 rounded-xl"
                style={{ color: 'var(--text-tertiary)', opacity: deleteMut.isPending ? 0.5 : 1 }}
                aria-label="Supprimer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
              </button>
            </div>
          </div>
        )
      })}

      <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
        style={{ background: 'rgba(10,132,255,0.06)', border: '0.5px solid rgba(10,132,255,0.18)' }}>
        <span className="text-[11px] leading-relaxed" style={{ color: 'rgba(10,132,255,0.8)' }}>
          {t.journey.infoAlert}
        </span>
      </div>
    </div>
  )
}

// ── G7 ────────────────────────────────────────────────────────────────────────
function G7Detail() {
  const t        = useMapT()
  const now      = new Date()
  const isActive = now >= new Date('2026-06-08') && now <= new Date('2026-06-18')

  return (
    <div className="space-y-4">
      {/* Statut sommet */}
      <div
        className="rounded-2xl p-4"
        style={isActive
          ? { background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.25)' }
          : { background: 'var(--bg-card)', border: '1px solid var(--border)' }
        }
      >
        <p className="text-sm font-bold mb-1" style={{ color: isActive ? '#FF453A' : 'var(--text-primary)' }}>
          {isActive ? t.g7Section.activeBadge : t.g7Section.upcomingBadge}
        </p>
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {isActive ? t.g7Section.activeDesc : t.g7Section.upcomingDesc}
        </p>
        {isActive && (
          <div className="mt-2 rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
            <p className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{t.g7Section.macaronPosts}</p>
            <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>Bardonnex · Thônex-Vallard</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t.g7Section.macaronSub}</p>
          </div>
        )}
      </div>

      {/* Tous les bulletins G7 — route, TPG, accès */}
      <G7BulletinsPanel title={t.g7Section.bulletinsTitle} />
    </div>
  )
}

// ── Météo : helpers + banner + détail ────────────────────────────────────────
function wmoIcon(c: number) {
  if (c === 0)   return '☀️'
  if (c <= 2)    return '🌤️'
  if (c === 3)   return '☁️'
  if (c <= 48)   return '🌫️'
  if (c <= 55)   return '🌦️'
  if (c <= 67)   return '🌧️'
  if (c <= 77)   return '❄️'
  if (c <= 82)   return '🌦️'
  if (c <= 86)   return '🌨️'
  return '⛈️'
}
function wmoLabel(c: number, t: MapT) {
  if (c === 0)   return t.weather.clear
  if (c <= 2)    return t.weather.fewClouds
  if (c === 3)   return t.weather.cloudy
  if (c <= 48)   return t.weather.fog
  if (c <= 55)   return t.weather.drizzle
  if (c <= 67)   return t.weather.rain
  if (c <= 77)   return t.weather.snow
  if (c <= 82)   return t.weather.showers
  if (c <= 86)   return t.weather.snowShowers
  return t.weather.storm
}

const METEO_URL = 'https://api.open-meteo.com/v1/forecast?latitude=46.2044&longitude=6.1432&hourly=temperature_2m,precipitation_probability,weathercode&timezone=Europe%2FZurich&forecast_days=2'

interface WeatherHourly { time: string[]; temperature_2m: number[]; precipitation_probability: number[]; weathercode: number[] }

function useWeather() {
  return useQuery<{ hourly: WeatherHourly }>({
    queryKey:        ['open-meteo'],
    queryFn:         () => fetch(METEO_URL).then(r => r.json()),
    staleTime:       20 * 60 * 1000,
    refetchInterval: 20 * 60 * 1000,
  })
}

function meteoStartIdx(times: string[]): number {
  const now = new Date()
  const idx = times.findIndex(t => new Date(t) >= now)
  return idx >= 0 ? idx : 0
}

function WeatherBanner({ onPress }: { onPress: () => void }) {
  const t = useMapT()
  const { data } = useWeather()
  if (!data?.hourly) return null
  const { hourly } = data
  const s     = meteoStartIdx(hourly.time)
  const temps = hourly.temperature_2m.slice(s, s + 4)
  const probs = hourly.precipitation_probability.slice(s, s + 4)
  const codes = hourly.weathercode.slice(s, s + 4)
  const minT  = Math.round(Math.min(...temps))
  const maxT  = Math.round(Math.max(...temps))
  const maxP  = Math.max(...probs)
  const code  = codes.reduce((a, b) => Math.max(a, b), 0)
  const tempStr   = minT === maxT ? `${minT}°C` : `${minT}–${maxT}°C`
  const precipStr = maxP >= 20 ? ` · 💧 ${maxP}%` : ''
  return (
    <button onClick={onPress}
      className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 mb-0.5 text-left active:scale-[0.98] transition-transform"
      style={{ background: 'rgba(10,132,255,0.10)', border: '0.5px solid rgba(10,132,255,0.22)' }}>
      <span className="text-2xl flex-shrink-0">{wmoIcon(code)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(10,132,255,0.75)' }}>{t.weather.next4h}</p>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{tempStr} · {wmoLabel(code, t)}{precipStr}</p>
      </div>
      <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round">
        <path d="M1 1l5 5-5 5"/>
      </svg>
    </button>
  )
}

function MeteoDetail() {
  const t = useMapT()
  const { data, isLoading } = useWeather()
  if (isLoading) return (
    <div className="flex justify-center py-10 gap-2">
      {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: `${i*150}ms` }}/>)}
    </div>
  )
  if (!data?.hourly) return null
  const { hourly } = data
  const s = meteoStartIdx(hourly.time)
  const hours = hourly.time.slice(s, s + 24)
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
        {t.weather.header}
      </p>
      <div className="space-y-0.5">
        {hours.map((ts, i) => {
          const hour = new Date(ts).getHours()
          const temp = Math.round(hourly.temperature_2m[s + i])
          const prob = hourly.precipitation_probability[s + i]
          const code = hourly.weathercode[s + i]
          return (
            <div key={ts} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: i === 0 ? 'rgba(10,132,255,0.12)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)' }}>
              <span className="w-10 text-[12px] font-semibold" style={{ color: i === 0 ? '#0A84FF' : 'var(--text-secondary)' }}>
                {String(hour).padStart(2, '0')}h
              </span>
              <span className="text-lg w-7 text-center">{wmoIcon(code)}</span>
              <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{temp}°C</span>
              <span className="text-[11px] w-12 text-right" style={{ color: prob >= 50 ? '#0A84FF' : 'var(--text-tertiary)' }}>
                {prob > 0 ? `💧 ${prob}%` : ''}
              </span>
              <span className="text-[11px] w-20 text-right truncate" style={{ color: 'var(--text-secondary)' }}>
                {wmoLabel(code, t)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Carte don ─────────────────────────────────────────────────────────────────
function DonationCard() {
  const t = useMapT()
  const [selected, setSelected] = useState<number | null>(null)

  function handleDonate() {
    if (!selected) return
    window.open(`${STRIPE_LINK}?prefilled_amount=${selected * 100}`, '_blank')
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, rgba(52,199,89,0.10) 0%, rgba(52,199,89,0.04) 100%)', border: '1px solid rgba(52,199,89,0.28)' }}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xl flex-shrink-0">💚</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t.donation.title}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{t.donation.subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {[5, 10, 20, 50].map(v => (
          <button
            key={v}
            onClick={() => setSelected(selected === v ? null : v)}
            className="rounded-xl py-1.5 text-[12px] font-semibold"
            style={{
              background: selected === v ? 'rgba(52,199,89,0.22)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${selected === v ? 'rgba(52,199,89,0.55)' : 'rgba(255,255,255,0.10)'}`,
              color: selected === v ? '#34C759' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            CHF {v}
          </button>
        ))}
      </div>
      <button
        onClick={handleDonate}
        style={{
          width: '100%', borderRadius: '12px', padding: '10px',
          fontSize: '13px', fontWeight: 600,
          background: selected ? '#34C759' : 'rgba(52,199,89,0.18)',
          color: selected ? '#fff' : 'rgba(52,199,89,0.55)',
          border: 'none', cursor: selected ? 'pointer' : 'default',
          transition: 'background .15s, color .15s',
        }}
      >
        💚 {selected ? `${t.donation.donateCTA} ${selected}` : t.donation.chooseCTA}
      </button>
    </div>
  )
}

// ── Vue d'ensemble "Tout" — 4 cartes ─────────────────────────────────────────
function ToutOverview({ data, onSelect }: {
  data?: DashboardData
  onSelect: (v: DetailView) => void
}) {
  const t          = useMapT()
  const now        = new Date()
  const liveData   = useLiveCrossings()
  const getStatus  = (c: CrossingStatic) => liveData[c.id]?.status ?? computeInstantStatus(c, now).status
  const alertCount = data?.alerts.length ?? 0
  const hasIssue   = data?.network && Object.values(data.network).some(v => v !== 'normal')
  const blocked    = ALL_CROSSINGS.filter(c => getStatus(c) === 'BLOCKED').length
  const heavy      = ALL_CROSSINGS.find(c => {
    const st = getStatus(c)
    return st === 'HEAVY' || st === 'MODERATE'
  })

  return (
    <div className="space-y-2.5 pt-1">
      <WeatherBanner onPress={() => onSelect('meteo')} />
      <CategoryCard icon="🛂" title={t.overview.douanes}
        subtitle={heavy ? `⚠️ ${heavy.name} · ${t.overview.trafficHeavy}` : `${ALL_CROSSINGS.length} postes · ${blocked > 0 ? `${blocked} ${t.overview.closedG7}` : t.overview.allOpen}`}
        onPress={() => onSelect('douanes')} />
      <CategoryCard icon="🚌" title={t.overview.transport}
        subtitle={t.overview.transportSub}
        badge={hasIssue ? t.overview.disruption : undefined} badgeColor="#FF9F0A"
        onPress={() => onSelect('transport')} />
      <CategoryCard icon="🗓️" title={t.eventsSection.filterLabel}
        subtitle={t.welcome.feat7D}
        badge={t.welcome.newBadge} badgeColor="#AF52DE"
        onPress={() => onSelect('events')} />
      <CategoryCard icon="🅿️" title={t.overview.parking}
        subtitle={`${PARKINGS_PR.length} ${t.overview.parcRelais} · ${TOTAL_PR_CAPACITY.toLocaleString('fr-CH')} ${t.overview.placesUnit}`}
        onPress={() => onSelect('parking')} />
      <CategoryCard icon="⚠️" title={t.overview.alertsTitle}
        subtitle={alertCount > 0 ? `${alertCount} ${alertCount > 1 ? t.overview.incidentPlural : t.overview.incidentSingular}` : t.overview.noIncident}
        badge={alertCount > 0 ? String(alertCount) : undefined} badgeColor="#FF453A"
        onPress={() => onSelect('alertes')} />
      <CategoryCard icon="🛤️" title={t.overview.journey}
        subtitle={t.overview.journeySub}
        onPress={() => onSelect('journey')} />
      <CategoryCard icon="🏛️" title={t.overview.g7Title}
        subtitle={t.overview.g7Sub}
        onPress={() => onSelect('g7')} />

      {/* Carte Borja Swiss Solutions */}
      <a
        href="https://borja-swiss-solutions.ch"
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex flex-col gap-2 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">🇨🇭</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Börja Swiss Solutions</p>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{t.overview.borjaSub}</p>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </div>
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {t.overview.borjaDesc}
        </p>
        <span className="text-[11px] font-medium" style={{ color: 'var(--brand)' }}>
          {t.overview.borjaLink}
        </span>
      </a>

      <DonationCard />
    </div>
  )
}

// ── Événements — helpers ──────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' })
}

function G7AccessPanel({ item }: { item: EventItem }) {
  const t = useMapT()
  const G7_START = '2026-06-11'
  const G7_END   = '2026-06-18'

  const g7Dates = item.occurrences.filter(o => o.date >= G7_START && o.date <= G7_END)
  if (g7Dates.length === 0) return null

  const allAlerts = g7Dates.flatMap(o => getAlertsForDay(o.date))
  const seen      = new Set<string>()
  const unique    = allAlerts.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true })
  const mobilityAlerts = unique.filter(a =>
    ['frontiere', 'route', 'transport', 'aerien', 'manifestation'].includes(a.category)
  )

  const sevColor = (s: string) =>
    s === 'critical' ? '#FF453A' : s === 'warning' ? '#FF9F0A' : 'rgba(255,255,255,0.45)'

  const areaNote = () => {
    if (item.venue.area === 'Grand-Saconnex')
      return "⚠️ Lieu proche de l'aéroport et du périmètre G7 : prévoir du temps supplémentaire. Restriction espace aérien active."
    if (item.occurrences.some(o => o.date === '2026-06-14'))
      return "⚠️ 14 juin : manifestation No-G7 rive droite, Pont du Mont-Blanc interdit. Prévoir un itinéraire alternatif."
    return null
  }

  const note = areaNote()

  return (
    <div className="rounded-2xl p-3 mb-4" style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.25)' }}>
      <p className="text-[12px] font-bold mb-2" style={{ color: '#FF9F0A' }}>{t.eventsSection.g7AccessTitle}</p>
      {note && (
        <p className="text-[11px] mb-2" style={{ color: 'var(--text-primary)' }}>{note}</p>
      )}
      {mobilityAlerts.map(a => (
        <div key={a.id} className="flex items-start gap-2 mb-1.5">
          <span className="text-[10px] font-bold mt-0.5 flex-shrink-0" style={{ color: sevColor(a.severity) }}>
            {a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟠' : 'ℹ️'}
          </span>
          <div>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{a.detail}</p>
          </div>
        </div>
      ))}
      {mobilityAlerts.length === 0 && (
        <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{t.eventsSection.g7Lifted}</p>
      )}
    </div>
  )
}

function EventDetail({ slug, onBack }: { slug: string; onBack: () => void }) {
  const t   = useMapT()
  const item = events.find(e => e.slug === slug)
  if (!item) return null

  const verifLabel = item.verif === 'confirmed' ? t.eventsSection.verifConfirmed
    : item.verif === 'plausible' ? t.eventsSection.verifPlausible
    : t.eventsSection.verifUnverified
  const verifColor = item.verif === 'confirmed' ? '#30D158' : item.verif === 'plausible' ? '#FF9F0A' : '#FF453A'

  const linkStatusLabel = (s: string) =>
    s === 'verified' ? t.eventsSection.linkVerified
    : s === 'to_confirm' ? t.eventsSection.linkToConfirm
    : t.eventsSection.linkFallback

  return (
    <div>
      {/* Titre + badge */}
      <div className="flex items-start gap-2 mb-3">
        <span className="text-2xl flex-shrink-0">{CATEGORY_ICONS[item.category] ?? '🎟️'}</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold leading-tight mb-1" style={{ color: 'var(--text-primary)' }}>{item.title}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              {CATEGORY_LABELS[item.category] ?? item.category}
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-card)', color: verifColor, border: `1px solid ${verifColor}33` }}>
              {verifLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-[13px] mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.description}</p>

      {/* Encart G7 */}
      <G7AccessPanel item={item} />

      {/* Lieu */}
      <div className="rounded-2xl p-3 mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>{t.eventsSection.venue}</p>
        <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{item.venue.name}</p>
        {item.venue.address && (
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{item.venue.address}</p>
        )}
        {item.venue.phone && (
          <a href={`tel:${item.venue.phone}`} className="text-[11px] mt-0.5 block active:opacity-70" style={{ color: 'var(--brand)' }}>
            📞 {item.venue.phone}
          </a>
        )}
      </div>

      {/* Prix */}
      <div className="rounded-2xl p-3 mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>{t.eventsSection.price}</p>
        <p className="text-[13px] font-medium" style={{ color: item.priceInfo ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
          {item.priceInfo ?? t.eventsSection.priceUnknown}
        </p>
      </div>

      {/* Dates */}
      <div className="rounded-2xl p-3 mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>{t.eventsSection.dates}</p>
        <div className="space-y-1">
          {item.occurrences.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{formatDate(o.date)}</span>
              {(o.start || o.note) && (
                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {o.start ? `${o.start}${o.end ? `–${o.end}` : ''}` : ''}{o.note ? ` · ${o.note}` : ''}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Liens */}
      <div className="rounded-2xl p-3 mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>{t.eventsSection.links}</p>
        {item.links.length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>{t.eventsSection.noLink}</p>
        ) : (
          <div className="space-y-2">
            {item.links.map((lk, i) => (
              <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 w-full text-left active:opacity-70 transition-opacity">
                <span className="text-[13px] font-medium" style={{ color: 'var(--brand)' }}>{lk.label}</span>
                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{linkStatusLabel(lk.status)}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EventsPanel({ onSelect }: { onSelect: (slug: string) => void }) {
  const t = useMapT()
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all')
  const [todayOnly,   setTodayOnly]   = useState(false)
  const [venueFilter, setVenueFilter] = useState('')
  const [viewMode,    setViewMode]    = useState<'category' | 'agenda'>('category')
  const [catFilter,   setCatFilter]   = useState<string>('all')

  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const venueNames = [...new Set(events.map(e => e.venue.name))].sort((a, b) => a.localeCompare(b, 'fr'))

  const isFree = (ev: EventItem): boolean => {
    if (!ev.priceInfo) return true
    const p = ev.priceInfo.toLowerCase()
    return p.includes('gratuit') || p.includes('libre') || p === '0' || p === 'free'
  }

  let filteredEvents = events
  if (todayOnly)            filteredEvents = filteredEvents.filter(ev => ev.occurrences.some(o => o.date === today))
  if (venueFilter)          filteredEvents = filteredEvents.filter(ev => ev.venue.name === venueFilter)
  if (catFilter !== 'all')  filteredEvents = filteredEvents.filter(ev => ev.category === catFilter)
  filteredEvents = priceFilter === 'free' ? filteredEvents.filter(isFree)
    : priceFilter === 'paid' ? filteredEvents.filter(ev => !ev.priceInfo || !isFree(ev))
    : filteredEvents

  // ── Vue Catégorie ─────────────────────────────────────────────────────────
  const byCategory = filteredEvents.reduce<Record<string, EventItem[]>>((acc, ev) => {
    const cat = ev.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(ev)
    return acc
  }, {})

  const categoryOrder = ['festival', 'football', 'concert', 'classique', 'theatre', 'comedie', 'nightlife', 'danse', 'sport', 'art']
  const orderedKeys   = categoryOrder.filter(k => byCategory[k]).concat(
    Object.keys(byCategory).filter(k => !categoryOrder.includes(k))
  )

  // Catégories présentes dans le jeu de données (pour les chips)
  const allCats = categoryOrder.filter(k => events.some(e => e.category === k))

  // ── Vue Agenda ────────────────────────────────────────────────────────────
  const allDates = [...new Set(
    filteredEvents.flatMap(ev => ev.occurrences.map(o => o.date))
  )].sort()

  const byDate: Record<string, EventItem[]> = {}
  for (const date of allDates) {
    byDate[date] = filteredEvents.filter(ev => ev.occurrences.some(o => o.date === date))
  }

  const fmtDateHeader = (iso: string): string => {
    const date = new Date(iso + 'T12:00:00')
    const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }
    const label = date.toLocaleDateString('fr-CH', opts)
    return iso === today ? `Aujourd'hui — ${label}` : label
  }

  const PRICE_TABS: { id: 'all' | 'free' | 'paid'; label: string }[] = [
    { id: 'all',  label: 'Tous'    },
    { id: 'free', label: 'Gratuit' },
    { id: 'paid', label: 'Payant'  },
  ]

  return (
    <div className="space-y-4">
      {/* Toggle vue Catégories / Agenda */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        {(['category', 'agenda'] as const).map(mode => (
          <button key={mode}
            onClick={() => setViewMode(mode)}
            className="flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition-all"
            style={{
              background: viewMode === mode ? 'rgba(175,82,222,0.18)' : 'transparent',
              color: viewMode === mode ? '#AF52DE' : 'var(--text-secondary)',
            }}>
            {mode === 'category' ? '🗂️ Catégories' : '📅 Agenda'}
          </button>
        ))}
      </div>

      {/* Chips catégorie (vue Catégories seulement) */}
      {viewMode === 'category' && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
          <button
            onClick={() => setCatFilter('all')}
            className="flex-shrink-0 rounded-xl py-1 px-2.5 text-[11px] font-semibold transition-all"
            style={{
              background: catFilter === 'all' ? 'rgba(175,82,222,0.18)' : 'var(--bg-card)',
              color: catFilter === 'all' ? '#AF52DE' : 'var(--text-secondary)',
              border: `1px solid ${catFilter === 'all' ? 'rgba(175,82,222,0.35)' : 'var(--border)'}`,
            }}>
            Tous
          </button>
          {allCats.map(cat => (
            <button key={cat}
              onClick={() => setCatFilter(catFilter === cat ? 'all' : cat)}
              className="flex-shrink-0 rounded-xl py-1 px-2.5 text-[11px] font-semibold transition-all"
              style={{
                background: catFilter === cat ? 'rgba(175,82,222,0.18)' : 'var(--bg-card)',
                color: catFilter === cat ? '#AF52DE' : 'var(--text-secondary)',
                border: `1px solid ${catFilter === cat ? 'rgba(175,82,222,0.35)' : 'var(--border)'}`,
                whiteSpace: 'nowrap',
              }}>
              {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      )}

      {/* Filtre Aujourd'hui + Lieu */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTodayOnly(v => !v)}
          className="flex-shrink-0 rounded-xl py-2 px-3 text-[12px] font-semibold transition-all"
          style={{
            background: todayOnly ? 'var(--brand)' : 'var(--bg-card)',
            color:      todayOnly ? '#fff'         : 'var(--text-secondary)',
            border:     `1px solid ${todayOnly ? 'transparent' : 'var(--border)'}`,
          }}
        >
          📅 Aujourd&apos;hui
        </button>
        <div className="flex-1 relative">
          <select
            value={venueFilter}
            onChange={e => setVenueFilter(e.target.value)}
            className="w-full rounded-xl py-2 pl-3 pr-7 text-[12px] font-semibold appearance-none"
            style={{
              background: venueFilter ? 'var(--brand)' : 'var(--bg-card)',
              color:      venueFilter ? '#fff'         : 'var(--text-secondary)',
              border:     `1px solid ${venueFilter ? 'transparent' : 'var(--border)'}`,
              outline:    'none',
            }}
          >
            <option value="">🏛️ Lieu</option>
            {venueNames.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" width="8" height="5" viewBox="0 0 8 5" fill="none">
            <path d="M1 1l3 3 3-3" stroke={venueFilter ? '#fff' : 'var(--text-tertiary)'} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* Filtre prix */}
      <div className="flex gap-2">
        {PRICE_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setPriceFilter(tab.id)}
            className="flex-1 rounded-xl py-2 text-[12px] font-semibold transition-all"
            style={{
              background: priceFilter === tab.id ? 'var(--brand)' : 'var(--bg-card)',
              color:      priceFilter === tab.id ? '#fff'         : 'var(--text-secondary)',
              border:     `1px solid ${priceFilter === tab.id ? 'transparent' : 'var(--border)'}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredEvents.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
          {t.eventsSection.noEvents}
        </p>
      ) : viewMode === 'agenda' ? (
        // ── Vue Agenda — groupée par date ────────────────────────────────
        <div className="space-y-5">
          {allDates.map(date => {
            const isToday = date === today
            const isPast  = date < today
            return (
              <div key={date}>
                <div className="flex items-center gap-2 mb-2">
                  {isToday && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: '#AF52DE' }} />
                  )}
                  <p className="text-[11px] font-bold uppercase tracking-wider flex-1"
                    style={{ color: isToday ? '#AF52DE' : isPast ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
                    {fmtDateHeader(date)}
                  </p>
                  <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {byDate[date].length} évt{byDate[date].length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {byDate[date].map(ev => {
                    const occ = ev.occurrences.find(o => o.date === date)
                    return (
                      <button key={ev.slug} onClick={() => onSelect(ev.slug)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left active:scale-[0.98] transition-transform"
                        style={{
                          background: isToday ? 'rgba(175,82,222,0.07)' : 'var(--bg-card)',
                          border: isToday ? '1px solid rgba(175,82,222,0.18)' : '1px solid var(--border)',
                        }}>
                        <span className="text-base flex-shrink-0">{CATEGORY_ICONS[ev.category] ?? '🎟️'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ev.title}</p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>
                            {occ?.start ? `${occ.start}${occ.end ? `–${occ.end}` : ''} · ` : ''}{ev.venue.name}
                            {occ?.note ? ` · ${occ.note}` : ''}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold flex-shrink-0 px-1.5 py-0.5 rounded-lg"
                          style={{
                            background: !ev.priceInfo ? 'rgba(255,255,255,0.04)' : isFree(ev) ? 'rgba(52,199,89,0.12)' : 'rgba(255,255,255,0.06)',
                            color:      !ev.priceInfo ? 'var(--text-tertiary)'   : isFree(ev) ? '#30D158'               : 'var(--text-tertiary)',
                          }}>
                          {!ev.priceInfo ? t.eventsSection.priceUnknown : isFree(ev) ? 'Gratuit' : ev.priceInfo}
                        </span>
                        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M1 1l4 4-4 4"/>
                        </svg>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // ── Vue Catégories (existante, enrichie) ─────────────────────────
        orderedKeys.map(cat => (
          <div key={cat}>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
              {CATEGORY_ICONS[cat] ?? '🎟️'} {CATEGORY_LABELS[cat] ?? cat}
            </p>
            <div className="space-y-1.5">
              {byCategory[cat].map(ev => {
                const firstDate = ev.occurrences[0]
                return (
                  <button key={ev.slug} onClick={() => onSelect(ev.slug)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left active:scale-[0.98] transition-transform"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ev.title}</p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>
                        {ev.venue.name}
                        {firstDate ? ` · ${formatDate(firstDate.date)}${ev.occurrences.length > 1 ? ` +${ev.occurrences.length - 1}` : ''}` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold flex-shrink-0 px-1.5 py-0.5 rounded-lg"
                      style={{
                        background: !ev.priceInfo ? 'rgba(255,255,255,0.04)' : isFree(ev) ? 'rgba(52,199,89,0.12)' : 'rgba(255,255,255,0.06)',
                        color:      !ev.priceInfo ? 'var(--text-tertiary)'   : isFree(ev) ? '#30D158'               : 'var(--text-tertiary)',
                      }}>
                      {!ev.priceInfo ? t.eventsSection.priceUnknown : isFree(ev) ? 'Gratuit' : ev.priceInfo}
                    </span>
                    <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M1 1l4 4-4 4"/>
                    </svg>
                  </button>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ── Zone d'impact — fiche détail ─────────────────────────────────────────────
function ImpactZoneDetail({ zone, map, onClose }: { zone: ImpactZone; map: mapboxgl.Map | null; onClose: () => void }) {
  const typeLabel: Record<string, string> = {
    DEMONSTRATION:        '⚠️ Manifestation',
    SECURITY_PERIMETER:   '🔒 Périmètre sécurité',
    TRANSPORT_DISRUPTION: '🚌 Réseau TPG perturbé',
    ROAD_CLOSURE:         '🚧 Route fermée',
  }
  const typeColor: Record<string, string> = {
    DEMONSTRATION:        '#FF453A',
    SECURITY_PERIMETER:   '#FF453A',
    TRANSPORT_DISRUPTION: '#FF9F0A',
    ROAD_CLOSURE:         '#636366',
  }

  const color   = typeColor[zone.type]   ?? '#FF9F0A'
  const label   = typeLabel[zone.type]   ?? zone.type

  const fmt = (d: Date) => d.toLocaleTimeString('fr-CH', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich',
  })

  // Centre approximatif du polygone pour le fly-to
  const flyToZone = () => {
    if (!map || !zone.coordinates.length) return
    const lngs = zone.coordinates.map(c => c[0])
    const lats = zone.coordinates.map(c => c[1])
    const lng  = (Math.min(...lngs) + Math.max(...lngs)) / 2
    const lat  = (Math.min(...lats) + Math.max(...lats)) / 2
    map.flyTo({ center: [lng, lat], zoom: 14, duration: 900, essential: true })
    onClose()
  }

  const lines: string[] = zone.lines ?? []

  return (
    <div className="space-y-3">
      {/* Badge type + titre */}
      <div className="rounded-2xl p-4" style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
        <h2 className="text-[15px] font-bold leading-snug mt-1.5" style={{ color: 'var(--text-primary)' }}>
          {zone.title}
        </h2>
        <p className="text-[11px] mt-2 tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
          {fmt(zone.activeFrom)} – {fmt(zone.activeTo)}
        </p>
      </div>

      {/* Description */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-[13px] leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>
          {zone.description}
        </p>
      </div>

      {/* Lignes impactées — badges */}
      {lines.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Lignes supprimées
          </p>
          <div className="flex flex-wrap gap-2">
            {lines.map(l => (
              <span key={l}
                className="text-[12px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: `${color}18`, color, border: `1px solid ${color}35` }}>
                {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Voir sur la carte */}
      <button onClick={flyToZone}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm"
        style={{ background: 'var(--brand)', color: '#fff' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11"/>
        </svg>
        Voir la zone sur la carte
      </button>

      {/* Source */}
      <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          Source : {zone.source} · {zone.sourceRef}
        </p>
      </div>
    </div>
  )
}

// ── Fiche détail signalement ──────────────────────────────────────────────────
interface SignalDetailItem {
  createdAt:    string
  approvedAt?:  string
  expiresAt?:   string
  credibility?: string
  confirmCount?: number
  denyCount?:    number
}

interface SignalDetailProps {
  signalement: SignalDetailItem
  onBack: () => void
}

function SignalDetailView({ signalement: s, onBack: _onBack }: SignalDetailProps) {
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('fr-CH', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Zurich',
    })

  return (
    <div className="space-y-3">
      {/* Dates */}
      <div className="rounded-2xl p-4 space-y-2"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Signalé le
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {fmtDate(s.createdAt)}
          </span>
        </div>
        {s.approvedAt && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Publié le
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {fmtDate(s.approvedAt)}
            </span>
          </div>
        )}

        {/* Expiry + crédibilité */}
        {s.expiresAt && (
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ⏱ Expire dans
              </span>
              <span style={{ fontSize: 12, color: new Date(s.expiresAt).getTime() - Date.now() < 600000 ? '#FF9500' : 'var(--text-secondary)' }}>
                {timeRemaining(s.expiresAt)}
              </span>
            </div>
            {(() => {
              const cred = s.credibility ?? 'neutral'
              const credMap = {
                confirmed: { label: `✅ Confirmé par ${s.confirmCount ?? 0} utilisateur${(s.confirmCount ?? 0) > 1 ? 's' : ''}`, color: '#30D158' },
                contested:  { label: `⚠️ Contesté (${s.confirmCount ?? 0} confirm, ${s.denyCount ?? 0} faux)`, color: '#FF9500' },
                false:      { label: `❌ Signalé faux par la communauté`, color: '#FF453A' },
                neutral:    null,
              }
              const meta = credMap[cred as keyof typeof credMap]
              if (!meta) return null
              return (
                <span style={{ fontSize: 12, color: meta.color, fontWeight: 600 }}>{meta.label}</span>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export function BottomSheet({ session: _session, activeFilter, map, onFilterChange }: BottomSheetProps) {
  const t = useMapT()
  const [isOpen,              setIsOpen]              = useState(false)
  const [detailView,          setDetailView]          = useState<DetailView>('overview')
  const [selectedCrossing,    setSelectedCrossing]    = useState<CrossingStatic | null>(null)
  const [selectedWaitDir,        setSelectedWaitDir]        = useState<string | null>(null)
  const [selectedWaitFrCh,      setSelectedWaitFrCh]      = useState<number | null>(null)
  const [selectedWaitChFr,      setSelectedWaitChFr]      = useState<number | null>(null)
  const [selectedLiveStatus,    setSelectedLiveStatus]    = useState<string | null>(null)
  const [selectedLiveWaitMin,   setSelectedLiveWaitMin]   = useState<number | null>(null)
  const [selectedEvent,       setSelectedEvent]       = useState<string | null>(null)
  const [selectedImpactZone, setSelectedImpactZone] = useState<ImpactZone | null>(null)
  const [selectedAlertItem,  setSelectedAlertItem]  = useState<AlertDetailItem | null>(null)

  // ── Refs drag ──────────────────────────────────────────────────────────────
  const heightRef    = useRef(COMPACT_H)
  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef    = useRef<HTMLDivElement>(null)
  const contentRef   = useRef<HTMLDivElement>(null)

  // ── Safe area insets (viewport-fit=cover) ─────────────────────────────────
  useLayoutEffect(() => {
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;pointer-events:none;visibility:hidden;top:-9999px'
    el.style.paddingTop    = 'env(safe-area-inset-top,0px)'
    el.style.paddingBottom = 'env(safe-area-inset-bottom,0px)'
    document.body.appendChild(el)
    const cs = getComputedStyle(el)
    _sat = parseFloat(cs.paddingTop)    || 0
    _sab = parseFloat(cs.paddingBottom) || 0
    document.body.removeChild(el)
  }, [])

  const { data } = useQuery<DashboardData>({
    queryKey:        ['dashboard'],
    queryFn:         () => fetch('/api/v1/dashboard').then(r => r.json()),
    refetchInterval: 30000,
    staleTime:       30000,
    placeholderData: { alerts: [], network: { tpg: 'normal', cff: 'normal', ceva: 'normal' }, globalStatus: 'calm', activeZones: 0 },
  })

  // ── animateTo : anime le sheet vers une hauteur cible ─────────────────────
  const animateTo = useCallback((targetH: number, useSpring = true) => {
    heightRef.current = targetH
    const open = targetH > COMPACT_H + 20
    setIsOpen(open)
    if (containerRef.current) {
      containerRef.current.style.transition = useSpring ? SPRING : EASE
      containerRef.current.style.height = `${targetH}px`
    }
  }, [])

  // ── Init + drag natif (non-passif, iOS-safe) ─────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !headerRef.current) return
    const container: HTMLDivElement = containerRef.current
    const header: HTMLDivElement    = headerRef.current

    // Init hauteur
    container.style.transition = 'none'
    container.style.height     = `${COMPACT_H}px`

    let startY = 0
    let startH = COMPACT_H
    let lastY  = 0
    let lastT  = 0
    let velo   = 0

    function onMove(e: TouchEvent) {
      e.preventDefault()
      const now = Date.now()
      const dy  = lastY - e.touches[0].clientY   // + = doigt monte
      const dt  = now - lastT
      velo  = dt > 0 ? dy / dt : velo
      lastY = e.touches[0].clientY
      lastT = now
      const delta = startY - e.touches[0].clientY
      const newH  = Math.max(COMPACT_H, Math.min(getFullH(), startH + delta))
      heightRef.current       = newH
      container.style.height  = `${newH}px`
    }

    function onEnd() {
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend',  onEnd)
      const h     = container.offsetHeight
      const fullH = getFullH()
      if      (velo >  1.2)        animateTo(fullH,    true)
      else if (velo < -1.2)        animateTo(COMPACT_H, true)
      else if (h < COMPACT_H + 40) animateTo(COMPACT_H, false)
      else if (h > fullH - 40)     animateTo(fullH,     false)
      else {
        heightRef.current          = h
        setIsOpen(h > COMPACT_H + 20)
        container.style.transition = EASE
      }
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length > 1) return
      e.preventDefault()
      startY = e.touches[0].clientY
      startH = container.offsetHeight   // hauteur réelle DOM
      lastY  = startY
      lastT  = Date.now()
      velo   = 0
      container.style.transition = 'none'
      window.addEventListener('touchmove', onMove, { passive: false })
      window.addEventListener('touchend',  onEnd)
    }

    header.addEventListener('touchstart', onStart, { passive: false })
    return () => {
      header.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend',  onEnd)
    }
  }, [animateTo])

  // ── Overscroll-to-close : swipe-down depuis le haut du contenu ferme le sheet ──
  useEffect(() => {
    if (!contentRef.current || !containerRef.current) return
    const content:   HTMLDivElement = contentRef.current
    const container: HTMLDivElement = containerRef.current

    let startY       = 0
    let startST      = 0
    let startH       = 0
    let isResizing   = false
    let lastY        = 0
    let lastT        = 0
    let velo         = 0

    function onStart(e: TouchEvent) {
      if (e.touches.length > 1) return
      startY     = e.touches[0].clientY
      startST    = content.scrollTop
      startH     = container.offsetHeight
      lastY      = startY
      lastT      = Date.now()
      velo       = 0
      isResizing = false
    }

    function onMove(e: TouchEvent) {
      if (e.touches.length > 1) return
      const cy  = e.touches[0].clientY
      const dy  = startY - cy       // >0 = swipe up, <0 = swipe down
      const now = Date.now()
      const dv  = lastY - cy
      const dt  = now - lastT
      velo  = dt > 0 ? dv / dt : velo
      lastY = cy
      lastT = now

      // Engage resize only when at top of scroll AND pulling down
      if (!isResizing && startST === 0 && dy < -3) {
        isResizing              = true
        container.style.transition = 'none'
      }

      if (isResizing) {
        e.preventDefault()
        const newH = Math.max(COMPACT_H, Math.min(getFullH(), startH + dy))
        heightRef.current      = newH
        container.style.height = `${newH}px`
      }
    }

    function onEnd() {
      if (!isResizing) return
      isResizing = false
      const h     = container.offsetHeight
      const fullH = getFullH()
      if      (velo >  1.2)        animateTo(fullH,    true)
      else if (velo < -1.2)        animateTo(COMPACT_H, true)
      else if (h < COMPACT_H + 60) animateTo(COMPACT_H, true)
      else                          animateTo(h > fullH - 40 ? fullH : h, false)
    }

    content.addEventListener('touchstart', onStart, { passive: true })
    content.addEventListener('touchmove',  onMove,  { passive: false })
    content.addEventListener('touchend',   onEnd)
    return () => {
      content.removeEventListener('touchstart', onStart)
      content.removeEventListener('touchmove',  onMove)
      content.removeEventListener('touchend',   onEnd)
    }
  }, [animateTo])

  // Sync activeFilter 'journey' / 'events' → ouvre directement la vue correspondante
  useEffect(() => {
    if (activeFilter === 'journey') {
      setDetailView('journey')
      animateTo(getFullH(), true)
    }
    if (activeFilter === 'events') {
      setDetailView('events')
      setSelectedEvent(null)
      animateTo(Math.round(window.innerHeight * 0.50), true)
    }
  }, [activeFilter, animateTo])

  // ── Ouverture programmatique ───────────────────────────────────────────────
  const expandToFull = useCallback(() => animateTo(getFullH(), true), [animateTo])

  const openDetail = useCallback((v: DetailView) => {
    setDetailView(v)
    setSelectedCrossing(null)
    animateTo(getFullH(), true)
    const viewToFilter: Partial<Record<DetailView, FilterId>> = {
      'douanes':   'borders',
      'transport': 'transit',
      'alertes':   'alerts',
      'g7':        'g7',
      'parking':   'parking',
      'journey':   'journey',
      'events':    'events',
      'overview':  'all',
    }
    const filterId = viewToFilter[v]
    if (filterId) onFilterChange(filterId)
  }, [animateTo, onFilterChange])

  const openCrossing = useCallback((c: CrossingStatic, waitDir?: string | null, frCh?: number | null, chFr?: number | null, liveStatus?: string | null, liveWaitMin?: number | null) => {
    setSelectedCrossing(c)
    setSelectedWaitDir(waitDir ?? null)
    setSelectedWaitFrCh(frCh ?? null)
    setSelectedWaitChFr(chFr ?? null)
    setSelectedLiveStatus(liveStatus ?? null)
    setSelectedLiveWaitMin(liveWaitMin ?? null)
    animateTo(getFullH(), true)
  }, [animateTo])

  // Écoute les clics sur les pastilles de douane depuis la carte
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, waitDirection, waitFrCh, waitChFr, liveStatus, liveWaitMinutes } = (e as CustomEvent<{ id: string; waitDirection?: string | null; waitFrCh?: number | null; waitChFr?: number | null; liveStatus?: string | null; liveWaitMinutes?: number | null }>).detail
      const crossing = ALL_CROSSINGS.find(c => c.id === id)
      if (crossing) openCrossing(crossing, waitDirection, waitFrCh, waitChFr, liveStatus, liveWaitMinutes)
    }
    window.addEventListener('tif:crossing-select', handler)
    return () => window.removeEventListener('tif:crossing-select', handler)
  }, [openCrossing])

  // Écoute les clics sur les pastilles d'événements depuis la carte
  useEffect(() => {
    const handler = (e: Event) => {
      const { slug } = (e as CustomEvent<{ slug: string }>).detail
      if (!slug) return
      setDetailView('events')
      setSelectedEvent(slug)
      setSelectedCrossing(null)
      animateTo(getFullH(), true)
    }
    window.addEventListener('tif:event-click', handler)
    return () => window.removeEventListener('tif:event-click', handler)
  }, [animateTo])

  // Écoute les clics sur les zones d'impact (polygones NO-G7)
  useEffect(() => {
    const handler = (e: Event) => {
      const zone = (e as CustomEvent<ImpactZone>).detail
      if (!zone) return
      setSelectedImpactZone(zone)
      setDetailView('impact-zone')
      setSelectedCrossing(null)
      setSelectedEvent(null)
      animateTo(getFullH(), true)
    }
    window.addEventListener('tif:impact-zone-click', handler)
    return () => window.removeEventListener('tif:impact-zone-click', handler)
  }, [animateTo])

  const locateCrossing = useCallback((c: CrossingStatic) => {
    if (!map) return
    map.flyTo({ center: [c.lng, c.lat], zoom: 15, duration: 900, essential: true })
    animateTo(COMPACT_H, true)
  }, [map, animateTo])

  // Scroll to top + reset on every view change
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [detailView, selectedCrossing, selectedEvent])

  const goBack = useCallback(() => {
    if (selectedCrossing) {
      setSelectedCrossing(null)
      animateTo(getFullH(), true)
    } else if (selectedAlertItem) {
      setSelectedAlertItem(null)
      animateTo(getFullH(), true)
    } else if (selectedEvent) {
      setSelectedEvent(null)
      animateTo(getFullH(), true)
    } else if (selectedImpactZone) {
      setSelectedImpactZone(null)
      setDetailView('overview')
      animateTo(getFullH(), true)
    } else {
      setDetailView('overview')
      animateTo(getFullH(), true)
    }
  }, [selectedCrossing, selectedAlertItem, selectedEvent, selectedImpactZone, animateTo])

  // Compact headline
  const alertCount  = data?.alerts.length ?? 0
  const compactText = activeFilter === 'all'     ? (alertCount > 0 ? `${t.compact.alertPrefix}${alertCount} ${alertCount > 1 ? t.compact.alertSuffixP : t.compact.alertSuffixS}` : t.compact.all)
    : activeFilter === 'transit'  ? t.compact.transit
    : activeFilter === 'traffic'  ? t.compact.traffic
    : activeFilter === 'alerts'   ? t.compact.alertsFilter
    : activeFilter === 'borders'  ? t.compact.borders
    : activeFilter === 'g7'       ? t.compact.g7
    : activeFilter === 'journey'  ? t.compact.journey
    : activeFilter === 'parking'  ? t.compact.parkingFilter
    : activeFilter === 'events'   ? t.eventsSection.filterLabel
    : t.compact.default

  const showBack = detailView !== 'overview' || selectedCrossing !== null || selectedAlertItem !== null || selectedEvent !== null || selectedImpactZone !== null

  return (
    <>
    {isOpen && (
      <div
        className="fixed inset-0 z-20"
        style={{ background: 'transparent' }}
        onClick={() => { animateTo(COMPACT_H, true); setDetailView('overview'); setSelectedCrossing(null); setSelectedEvent(null); setSelectedImpactZone(null) }}
      />
    )}
    <div
      ref={containerRef}
      className="fixed left-0 right-0 z-30 flex flex-col overflow-hidden"
      style={{
        ...LG,
        bottom:             'env(safe-area-inset-bottom, 0px)',
        '--text-primary':   'rgba(255,255,255,0.92)',
        '--text-secondary': 'var(--text-secondary)',
        '--text-tertiary':  'rgba(255,255,255,0.40)',
        '--bg-card':        'rgba(255,255,255,0.06)',
        '--bg':             'rgba(255,255,255,0.03)',
        '--border':         'rgba(255,255,255,0.10)',
      } as React.CSSProperties}
    >
      {/* Header drag zone — touch géré par listeners natifs (useEffect) */}
      <div ref={headerRef}>
        {/* Drag handle */}
        <button
          className="flex justify-center pt-2.5 pb-1 w-full"
          onClick={() => {
            if (!isOpen) animateTo(getFullH(), true)
            else { animateTo(COMPACT_H, true); setDetailView('overview'); setSelectedCrossing(null); setSelectedEvent(null); setSelectedImpactZone(null) }
          }}
          aria-label="Ouvrir/fermer">
          <div className="w-9 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </button>

        {/* Compact row */}
        <div className="flex items-center justify-between px-4 py-1 flex-shrink-0">
          <span className="text-sm font-medium truncate" style={{ color: alertCount > 0 ? '#FF9F0A' : 'var(--text-secondary)' }}>
            {compactText}
          </span>
          {alertCount > 0 && !isOpen && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full ml-2 flex-shrink-0"
              style={{ background: 'rgba(255,159,10,0.15)', color: '#FF9F0A' }}>
              {alertCount}
            </span>
          )}
        </div>
      </div>

      {/* Expanded content — always rendered, height+overflow-hidden masque quand compact */}
      <div ref={contentRef} className="flex-1 overflow-y-auto px-4 pb-6" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        <div key={`${detailView}|${selectedCrossing?.id ?? ''}|${selectedAlertItem?.id ?? ''}|${selectedEvent ?? ''}|${selectedImpactZone?.id ?? ''}`}
             style={{ animation: 'fadeUp 0.18s cubic-bezier(0.23, 1, 0.32, 1)' }}>

          {/* Bouton retour */}
          {showBack && (
            <button onClick={goBack}
              className="flex items-center gap-2 mb-4 text-sm font-medium"
              style={{ color: 'var(--brand)' }}>
              <svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M7 1L1 6.5 7 12"/>
              </svg>
              {selectedAlertItem ? 'Retour aux alertes'
                : selectedCrossing ? (detailView === 'douanes' ? t.back.allBorders : t.back.back)
                : selectedEvent ? t.eventsSection.backToList
                : selectedImpactZone ? 'Retour'
                : t.back.back}
            </button>
          )}

          {/* Fiche douane sélectionnée */}
          {selectedCrossing ? (
            <CrossingDetail
              crossing={selectedCrossing}
              onBack={goBack}
              onLocate={locateCrossing}
              waitDirection={selectedWaitDir}
              waitFrCh={selectedWaitFrCh}
              waitChFr={selectedWaitChFr}
              liveStatus={selectedLiveStatus}
              liveWaitMinutes={selectedLiveWaitMin}
            />
          ) : selectedAlertItem ? (
            <AlertDetailView alert={selectedAlertItem} map={map} onBack={() => setSelectedAlertItem(null)} />
          ) : selectedImpactZone ? (
            <ImpactZoneDetail zone={selectedImpactZone} map={map} onClose={() => { setSelectedImpactZone(null); setDetailView('overview') }} />
          ) : selectedEvent ? (
            <EventDetail slug={selectedEvent} onBack={() => setSelectedEvent(null)} />
          ) : detailView === 'impact-zone' ? null
            : detailView === 'overview'   ? <ToutOverview data={data} onSelect={openDetail} />
            : detailView === 'douanes'    ? <DouanesDetail onSelect={openCrossing} map={map} />
            : detailView === 'transport'  ? <TransportDetail onExpand={expandToFull} />
            : detailView === 'alertes'    ? <AlertesDetail map={map} onAlertSelect={setSelectedAlertItem} />
            : detailView === 'meteo'      ? <MeteoDetail />
            : detailView === 'parking'    ? <ParkingDetail map={map} />
            : detailView === 'journey'    ? <MonTrajetDetail />
            : detailView === 'events'     ? <EventsPanel onSelect={slug => {
                setSelectedEvent(slug)
                animateTo(getFullH(), true)
                const ev = events.find(e => e.slug === slug)
                if (ev?.venue.lat != null && ev?.venue.lng != null && map) {
                  map.flyTo({ center: [ev.venue.lng, ev.venue.lat], zoom: 15, duration: 800, essential: true })
                }
              }} />
            : <G7Detail />
          }
        </div>
      </div>

    </div>
    </>
  )
}
