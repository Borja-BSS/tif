import type { Metadata } from 'next'
import { Header }       from '@/components/layout/Header'
import { BorjaTitle }   from '@/components/ui/BorjaTitle'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { Card }         from '@/components/ui/Card'
import { getTpgDisruptions } from '@/lib/transport/tpg-disruptions'
import { getCffDisruptions } from '@/lib/transport/cff-disruptions'
import { getG7Impact }       from '@/lib/transport/g7-impact'
import { getBorderCrossings } from '@/lib/territory/border-crossings'
import type { TpgDisruption, CffDisruption, G7Impact } from '@/lib/transport/types'
import type { FeatureCollection } from 'geojson'

export const metadata: Metadata = { title: 'Flash Infos — TIF' }
export const dynamic    = 'force-dynamic'
export const revalidate = 30

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}h${m}`
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)  return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  return `${Math.floor(diff / 3600)}h${Math.floor((diff % 3600) / 60).toString().padStart(2,'0')}`
}

const TYPE_LABEL: Record<string, string> = {
  retard:       'Retard',
  suppression:  'Suppression',
  deviation:    'Déviation',
  travaux:      'Travaux',
  perturbation: 'Perturbation',
}

const TYPE_COLOR: Record<string, string> = {
  suppression: 'var(--red)',
  retard:      'var(--orange)',
  deviation:   'var(--yellow)',
  travaux:     'var(--yellow)',
  perturbation:'var(--orange)',
}

// ── Data fetching ──────────────────────────────────────────────────────────────

interface BorderFeatureProps {
  id:              string
  name:            string
  status:          string
  waitTimeMinutes: number
  jamFactor:       number
  lastUpdated:     string
  color:           string
  crossingType:    string
}

async function getData() {
  const fetchedAt = new Date().toISOString()

  const [tpgResult, cffResult, borderResult] = await Promise.allSettled([
    getTpgDisruptions(),
    getCffDisruptions(),
    getBorderCrossings(),
  ])

  const g7 = getG7Impact()

  const tpgDisruptions: TpgDisruption[] =
    tpgResult.status === 'fulfilled' ? tpgResult.value : []

  const cffDisruptions: CffDisruption[] =
    cffResult.status === 'fulfilled' ? cffResult.value : []

  const borderFC: FeatureCollection =
    borderResult.status === 'fulfilled'
      ? borderResult.value
      : { type: 'FeatureCollection', features: [] }

  // Only show borders with congestion or notable wait time
  const activeBorders = borderFC.features
    .map(f => f.properties as BorderFeatureProps)
    .filter(p => p.waitTimeMinutes > 5 || p.status === 'HEAVY' || p.status === 'BLOCKED' || p.status === 'MODERATE')
    .sort((a, b) => b.waitTimeMinutes - a.waitTimeMinutes)

  const sources = {
    tpg:    { ok: tpgResult.status === 'fulfilled',    label: 'TPG / transport.opendata.ch' },
    cff:    { ok: cffResult.status === 'fulfilled',    label: 'CFF / SBB GTFS-RT'          },
    border: { ok: borderResult.status === 'fulfilled', label: 'HERE Traffic (frontières)'  },
  }

  return { tpgDisruptions, cffDisruptions, activeBorders, g7, sources, fetchedAt }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function InfosPage() {
  const { tpgDisruptions, cffDisruptions, activeBorders, g7, sources, fetchedAt } = await getData()

  const totalAlerts = tpgDisruptions.length + cffDisruptions.length + activeBorders.length
  const hasG7       = g7.isActive || g7.isWarningPeriod
  const isEmpty     = totalAlerts === 0 && !hasG7

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Header />

      {/* Hero */}
      <section className="px-6 md:px-8 py-16 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <SectionLabel className="mb-0">Centre de renseignement · Grand Genève</SectionLabel>
          <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
            style={{ background: 'var(--brand-subtle)', color: 'var(--brand)', border: '1px solid var(--brand-glow)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--brand)' }} />
            Live
          </span>
        </div>
        <BorjaTitle as="h1" accent="direct." className="mb-4">
          Informations en
        </BorjaTitle>
        <p className="text-[17px] leading-[1.65] max-w-xl" style={{ color: 'var(--text-secondary)' }}>
          Toutes les perturbations, alertes et informations territoriales du Grand Genève, agrégées en temps réel.
        </p>
        <p className="text-[12px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Actualisé à {formatTime(fetchedAt)} · {totalAlerts} alerte{totalAlerts !== 1 ? 's' : ''} active{totalAlerts !== 1 ? 's' : ''}
        </p>
      </section>

      {/* Content */}
      <section className="px-6 md:px-8 pb-24 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* ── Feed principal ── */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase mb-4"
              style={{ color: 'var(--text-tertiary)' }}>
              Dernières informations
            </h2>

            {/* G7 alert */}
            {hasG7 && (
              <Card variant="featured">
                <SectionLabel className="mb-2">
                  G7 · {g7.isActive ? 'Priorité haute' : 'Pré-alerte'}
                </SectionLabel>
                <h3 className="text-[17px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {g7.isActive
                    ? 'G7 Évian 2026 — Périmètre sécurisé actif'
                    : 'G7 Évian 2026 — Période de pré-alerte'}
                </h3>
                <p className="text-[15px] leading-[1.6] mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {g7.suspendedLines.length > 0
                    ? `Lignes suspendues : ${g7.suspendedLines.join(', ')}. `
                    : ''}
                  {g7.affectedLines.length > 0
                    ? `${g7.affectedLines.length} lignes TPG impactées (perturbations possibles).`
                    : 'Contrôles systématiques en vigueur aux postes frontaliers.'}
                </p>
                <div className="flex items-center gap-4 text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                  <span>Source : TPG / Autorités GE</span>
                  <span>·</span>
                  <span>{formatTime(g7.startDate)}</span>
                </div>
              </Card>
            )}

            {/* TPG disruptions */}
            {tpgDisruptions.map((d) => (
              <Card key={d.id} variant="default">
                <div className="flex items-start gap-3">
                  <div className="w-1 self-stretch rounded-full flex-shrink-0"
                    style={{ background: TYPE_COLOR[d.type] ?? 'var(--orange)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                          TPG · Ligne {d.lineNumber}
                        </span>
                        <span className="text-[11px] font-medium"
                          style={{ color: TYPE_COLOR[d.type] ?? 'var(--orange)' }}>
                          {TYPE_LABEL[d.type] ?? d.type}
                        </span>
                      </div>
                      <span className="text-[12px] tabular-nums flex-shrink-0"
                        style={{ color: 'var(--text-tertiary)' }}>
                        {formatTime(fetchedAt)}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                      {d.description}
                    </h3>
                    {d.affectedStops.length > 0 && (
                      <p className="text-[13px] leading-[1.5] mb-2" style={{ color: 'var(--text-secondary)' }}>
                        Arrêts : {d.affectedStops.join(', ')}
                      </p>
                    )}
                    <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                      Il y a {relativeTime(fetchedAt)} · source : transport.opendata.ch
                    </span>
                  </div>
                </div>
              </Card>
            ))}

            {/* CFF disruptions */}
            {cffDisruptions.map((d) => (
              <Card key={d.id} variant="default">
                <div className="flex items-start gap-3">
                  <div className="w-1 self-stretch rounded-full flex-shrink-0"
                    style={{ background: TYPE_COLOR[d.type] ?? 'var(--red)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                          {d.isCEVA ? 'LÉMAN EXPRESS' : 'CFF'} · {d.line}
                        </span>
                        <span className="text-[11px] font-medium"
                          style={{ color: TYPE_COLOR[d.type] ?? 'var(--red)' }}>
                          {TYPE_LABEL[d.type] ?? d.type}
                          {d.delayMinutes ? ` +${d.delayMinutes} min` : ''}
                        </span>
                      </div>
                      <span className="text-[12px] tabular-nums flex-shrink-0"
                        style={{ color: 'var(--text-tertiary)' }}>
                        {formatTime(fetchedAt)}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                      {d.description}
                    </h3>
                    <p className="text-[13px] mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {d.from} → {d.to}
                    </p>
                    <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                      Il y a {relativeTime(fetchedAt)} · source : transport.opendata.ch
                    </span>
                  </div>
                </div>
              </Card>
            ))}

            {/* Border congestion */}
            {activeBorders.map((b) => (
              <Card key={b.id} variant="default">
                <div className="flex items-start gap-3">
                  <div className="w-1 self-stretch rounded-full flex-shrink-0"
                    style={{ background: b.color ?? 'var(--yellow)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                          Frontière
                        </span>
                        <span className="text-[11px] font-medium" style={{ color: b.color ?? 'var(--yellow)' }}>
                          {b.status}
                        </span>
                      </div>
                      <span className="text-[12px] tabular-nums flex-shrink-0"
                        style={{ color: 'var(--text-tertiary)' }}>
                        {formatTime(b.lastUpdated)}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                      Attente frontière {b.name}
                    </h3>
                    <p className="text-[13px] leading-[1.5] mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Temps d&apos;attente estimé : {b.waitTimeMinutes} min
                    </p>
                    <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                      Il y a {relativeTime(b.lastUpdated)} · source : HERE Traffic
                    </span>
                  </div>
                </div>
              </Card>
            ))}

            {/* Empty state */}
            {isEmpty && (
              <Card variant="default">
                <div className="text-center py-8">
                  <div className="text-3xl mb-3">✅</div>
                  <h3 className="text-[17px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Aucune perturbation détectée
                  </h3>
                  <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>
                    Trafic fluide, transports normaux, frontières dégagées.
                  </p>
                  <p className="text-[12px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
                    Dernière vérification à {formatTime(fetchedAt)}
                  </p>
                </div>
              </Card>
            )}
          </div>

          {/* ── Sidebar sources ── */}
          <div className="space-y-4">
            <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase mb-4"
              style={{ color: 'var(--text-tertiary)' }}>
              Sources actives
            </h2>

            {[
              { name: 'TPG · transport.opendata.ch', ok: sources.tpg.ok,    count: tpgDisruptions.length,    unit: 'perturbation' },
              { name: 'CFF / SBB GTFS-RT',           ok: sources.cff.ok,    count: cffDisruptions.length,    unit: 'perturbation' },
              { name: 'HERE Traffic (frontières)',    ok: sources.border.ok, count: activeBorders.length,     unit: 'poste actif'  },
            ].map((src) => (
              <Card key={src.name} variant="bordered" style={{ padding: '16px 20px' }}>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: src.ok ? 'var(--green)' : 'var(--red)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                      {src.name}
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {src.ok
                        ? `${src.count} ${src.unit}${src.count !== 1 ? 's' : ''} · ${formatTime(fetchedAt)}`
                        : 'Indisponible'}
                    </div>
                  </div>
                  <span className="text-[11px]"
                    style={{ color: src.ok ? 'var(--green)' : 'var(--red)' }}>
                    {src.ok ? 'OK' : 'ERR'}
                  </span>
                </div>
              </Card>
            ))}

            <Card variant="bordered" style={{ padding: '16px 20px' }}>
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: g7.isActive ? 'var(--orange)' : g7.isWarningPeriod ? 'var(--yellow)' : 'var(--green)' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                    G7 Évian 2026
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {g7.isActive ? 'Période active' : g7.isWarningPeriod ? 'Pré-alerte' : 'Inactif'}
                    {' · '}{formatTime(fetchedAt)}
                  </div>
                </div>
                <span className="text-[11px]"
                  style={{ color: g7.isActive ? 'var(--orange)' : g7.isWarningPeriod ? 'var(--yellow)' : 'var(--green)' }}>
                  {g7.isActive ? 'ACT' : g7.isWarningPeriod ? 'WARN' : 'OK'}
                </span>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
