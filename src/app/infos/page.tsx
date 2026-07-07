import type { Metadata } from 'next'
import { Suspense }      from 'react'
import { Header }        from '@/components/layout/Header'
import { BorjaTitle }    from '@/components/ui/BorjaTitle'
import { SectionLabel }  from '@/components/ui/SectionLabel'
import { Card }          from '@/components/ui/Card'
import { getTpgDisruptions }  from '@/lib/transport/tpg-disruptions'
import { getCffDisruptions }  from '@/lib/transport/cff-disruptions'
import { getBorderCrossings } from '@/lib/territory/border-crossings'
import type { TpgDisruption, CffDisruption } from '@/lib/transport/types'
import type { FeatureCollection } from 'geojson'

export const metadata: Metadata = { title: 'Flash Infos — TIF' }

// ISR: page cached at Vercel Edge for 30s — sous-50ms pour mobile après la 1re requête
export const revalidate = 30

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2,'0')}h${d.getMinutes().toString().padStart(2,'0')}`
}

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)  return `${s}s`
  if (s < 3600) return `${Math.floor(s/60)} min`
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60)
  return m > 0 ? `${h}h${m.toString().padStart(2,'0')}` : `${h}h`
}

const TYPE_COLOR: Record<string, string> = {
  suppression: 'var(--red)',
  retard:      'var(--orange)',
  deviation:   'var(--yellow)',
  travaux:     'var(--yellow)',
  perturbation:'var(--orange)',
}

const STATUS_COLOR: Record<string, string> = {
  CLEAR:    'var(--green)',
  LIGHT:    'var(--green)',
  MODERATE: 'var(--yellow)',
  HEAVY:    'var(--orange)',
  BLOCKED:  'var(--red)',
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl animate-pulse"
          style={{
            background: 'var(--bg-secondary)',
            height: '88px',
            animationDelay: `${i * 60}ms`,
          }}
        />
      ))}
    </>
  )
}

function SidebarSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl animate-pulse"
          style={{ background: 'var(--bg-secondary)', height: '64px', animationDelay: `${i*80}ms` }}
        />
      ))}
    </>
  )
}

// ── Async server components (stream independently) ────────────────────────────

interface BorderFeatureProps {
  id:              string
  name:            string
  status:          string
  waitTimeMinutes: number
  lastUpdated:     string
  color:           string
  crossingType:    string
}

async function BordersSection() {
  const borderFC: FeatureCollection = await getBorderCrossings().catch(
    () => ({ type: 'FeatureCollection', features: [] }),
  )

  const borders = borderFC.features
    .map(f => f.properties as BorderFeatureProps)
    .filter(p => p.status !== 'CLEAR' || p.waitTimeMinutes > 5)
    .sort((a, b) => b.waitTimeMinutes - a.waitTimeMinutes)

  if (borders.length === 0) {
    return (
      <Card variant="default">
        <div className="flex items-center gap-3 py-2">
          <span className="text-lg">🟢</span>
          <div>
            <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>
              Toutes les douanes fluides
            </p>
            <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
              Aucune attente signalée · HERE Traffic
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <>
      {borders.map(b => (
        <Card key={b.id} variant="default">
          <div className="flex items-start gap-3">
            <div
              className="w-1 self-stretch rounded-full flex-shrink-0"
              style={{ background: STATUS_COLOR[b.status] ?? 'var(--yellow)' }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
                  >
                    🛂 Douane
                  </span>
                  <span className="text-[11px] font-medium" style={{ color: STATUS_COLOR[b.status] ?? 'var(--yellow)' }}>
                    {b.waitTimeMinutes > 0 ? `+${b.waitTimeMinutes} min` : b.status}
                  </span>
                </div>
                <span className="text-[12px] tabular-nums flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                  {fmt(b.lastUpdated)}
                </span>
              </div>
              <h3 className="text-[15px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                Frontière {b.name}
              </h3>
              <p className="text-[13px] mb-1" style={{ color: 'var(--text-secondary)' }}>
                {b.waitTimeMinutes > 0
                  ? `Temps d'attente estimé : ${b.waitTimeMinutes} min`
                  : 'Passage fluide'}
              </p>
              <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                Il y a {ago(b.lastUpdated)} · HERE Traffic
              </span>
            </div>
          </div>
        </Card>
      ))}
    </>
  )
}

async function TransportSection() {
  const fetchedAt = new Date().toISOString()
  const [tpgResult, cffResult] = await Promise.allSettled([
    getTpgDisruptions(),
    getCffDisruptions(),
  ])

  const tpg: TpgDisruption[] = tpgResult.status === 'fulfilled' ? tpgResult.value : []
  const cff: CffDisruption[] = cffResult.status === 'fulfilled' ? cffResult.value : []

  if (tpg.length === 0 && cff.length === 0) {
    return (
      <Card variant="default">
        <div className="flex items-center gap-3 py-2">
          <span className="text-lg">🚌</span>
          <div>
            <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>
              Transports normaux
            </p>
            <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
              Aucun retard TPG/CFF détecté · {fmt(fetchedAt)}
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <>
      {tpg.map(d => (
        <Card key={d.id} variant="default">
          <div className="flex items-start gap-3">
            <div
              className="w-1 self-stretch rounded-full flex-shrink-0"
              style={{ background: TYPE_COLOR[d.type] ?? 'var(--orange)' }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
                  >
                    TPG · L{d.lineNumber}
                  </span>
                  <span className="text-[11px] font-medium" style={{ color: TYPE_COLOR[d.type] ?? 'var(--orange)' }}>
                    {d.type === 'suppression' ? 'Supprimé' : d.type === 'retard' ? 'Retard' : d.type}
                  </span>
                </div>
                <span className="text-[12px] tabular-nums flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                  {fmt(fetchedAt)}
                </span>
              </div>
              <h3 className="text-[15px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                {d.description}
              </h3>
              {d.affectedStops.length > 0 && (
                <p className="text-[13px] mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {d.affectedStops.join(' · ')}
                </p>
              )}
              <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                Il y a {ago(fetchedAt)} · transport.opendata.ch
              </span>
            </div>
          </div>
        </Card>
      ))}

      {cff.map(d => (
        <Card key={d.id} variant="default">
          <div className="flex items-start gap-3">
            <div
              className="w-1 self-stretch rounded-full flex-shrink-0"
              style={{ background: TYPE_COLOR[d.type] ?? 'var(--red)' }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
                  >
                    {d.isCEVA ? 'LÉMAN EXPRESS' : 'CFF'} · {d.line}
                  </span>
                  <span className="text-[11px] font-medium" style={{ color: TYPE_COLOR[d.type] ?? 'var(--red)' }}>
                    {d.delayMinutes ? `+${d.delayMinutes} min` : d.type}
                  </span>
                </div>
                <span className="text-[12px] tabular-nums flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                  {fmt(fetchedAt)}
                </span>
              </div>
              <h3 className="text-[15px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                {d.description}
              </h3>
              <p className="text-[13px] mb-1" style={{ color: 'var(--text-secondary)' }}>
                {d.from} → {d.to}
              </p>
              <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                Il y a {ago(fetchedAt)} · transport.opendata.ch
              </span>
            </div>
          </div>
        </Card>
      ))}
    </>
  )
}

async function SourcesSidebar() {
  const fetchedAt = new Date().toISOString()

  const [tpgResult, cffResult, borderResult] = await Promise.allSettled([
    getTpgDisruptions(),
    getCffDisruptions(),
    getBorderCrossings(),
  ])

  const tpgCount    = tpgResult.status    === 'fulfilled' ? tpgResult.value.length : -1
  const cffCount    = cffResult.status    === 'fulfilled' ? cffResult.value.length : -1
  const borderFC    = borderResult.status === 'fulfilled' ? borderResult.value : null
  const borderCount = borderFC
    ? borderFC.features.filter(f => {
        const p = f.properties as BorderFeatureProps
        return p.status !== 'CLEAR' || p.waitTimeMinutes > 5
      }).length
    : -1

  const rows = [
    { label: 'TPG · opendata.ch',       ok: tpgCount >= 0,    info: tpgCount >= 0    ? `${tpgCount} perturbation${tpgCount!==1?'s':''}` : 'Erreur' },
    { label: 'CFF / LÉMAN EXPRESS',      ok: cffCount >= 0,    info: cffCount >= 0    ? `${cffCount} perturbation${cffCount!==1?'s':''}` : 'Erreur' },
    { label: 'HERE Traffic · Douanes',  ok: borderCount >= 0, info: borderCount >= 0 ? `${borderCount} poste${borderCount!==1?'s':''} actif${borderCount!==1?'s':''}` : 'Erreur' },
  ]

  return (
    <>
      {rows.map(r => (
        <Card key={r.label} variant="bordered" style={{ padding: '14px 18px' }}>
          <div className="flex items-center gap-3">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: r.ok ? 'var(--green)' : 'var(--red)' }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {r.label}
              </div>
              <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {r.info} · {fmt(fetchedAt)}
              </div>
            </div>
            <span className="text-[11px] flex-shrink-0" style={{ color: r.ok ? 'var(--green)' : 'var(--red)' }}>
              {r.ok ? 'OK' : 'ERR'}
            </span>
          </div>
        </Card>
      ))}
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function InfosPage() {
  const now = new Date().toISOString()

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Header />

      {/* Hero — rendu immédiatement, aucune attente réseau */}
      <section className="px-6 md:px-8 pt-16 pb-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <SectionLabel className="mb-0">Centre de renseignement · Grand Genève</SectionLabel>
          <span
            className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
            style={{ background: 'var(--brand-subtle)', color: 'var(--brand)', border: '1px solid var(--brand-glow)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--brand)' }} />
            Live
          </span>
        </div>
        <BorjaTitle as="h1" accent="direct." className="mb-3">
          Informations en
        </BorjaTitle>
        <p className="text-[16px] leading-[1.65] max-w-xl mb-1" style={{ color: 'var(--text-secondary)' }}>
          Perturbations trafic, douanes et transports du Grand Genève.
        </p>
        <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
          Actualisé à {fmt(now)} · Données officielles
        </p>
      </section>

      {/* Main grid */}
      <section className="px-6 md:px-8 pb-24 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* ── Feed principal ── */}
          <div className="md:col-span-2 space-y-4">

            {/* 1. DOUANES — priorité haute, stream en premier */}
            <div>
              <h2
                className="text-[11px] font-semibold tracking-[0.08em] uppercase mb-3"
                style={{ color: 'var(--text-tertiary)' }}
              >
                🛂 Passages douaniers
              </h2>
              <div className="space-y-3">
                <Suspense fallback={<CardSkeleton count={2} />}>
                  <BordersSection />
                </Suspense>
              </div>
            </div>

            {/* 2. TRAFIC & TRANSPORTS */}
            <div>
              <h2
                className="text-[11px] font-semibold tracking-[0.08em] uppercase mb-3 mt-6"
                style={{ color: 'var(--text-tertiary)' }}
              >
                🚌 Trafic & Transports publics
              </h2>
              <div className="space-y-3">
                <Suspense fallback={<CardSkeleton count={4} />}>
                  <TransportSection />
                </Suspense>
              </div>
            </div>
          </div>

          {/* ── Sidebar sources ── */}
          <div>
            <h2
              className="text-[11px] font-semibold tracking-[0.08em] uppercase mb-3"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Sources actives
            </h2>
            <div className="space-y-3">
              <Suspense fallback={<SidebarSkeleton />}>
                <SourcesSidebar />
              </Suspense>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
