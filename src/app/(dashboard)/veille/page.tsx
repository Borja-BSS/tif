export const dynamic = 'force-dynamic'
export const revalidate = 0

import type { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Veille G7 — TIF' }

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  ARMY_DEPLOYMENT:    'Armée',
  BORDER_CONTROL:     'Frontières',
  AIRSPACE_RESTRICTION: 'Espace aérien',
  SECURITY_MEASURE:   'Sécurité',
  DEMONSTRATION_RULES: 'Manifestations',
  COST_SHARING:       'Financement',
  MOBILITY_IMPACT:    'Mobilité',
  DIPLOMATIC:         'Diplomatique',
  MACARON_SYSTEM:     'Macarons',
  OTHER:              'Autre',
}

const CATEGORY_COLOR: Record<string, string> = {
  ARMY_DEPLOYMENT:     'text-red-400 border-red-500/20 bg-red-950/40',
  BORDER_CONTROL:      'text-orange-400 border-orange-500/20 bg-orange-950/40',
  AIRSPACE_RESTRICTION:'text-purple-400 border-purple-500/20 bg-purple-950/40',
  SECURITY_MEASURE:    'text-amber-400 border-amber-500/20 bg-amber-950/40',
  DEMONSTRATION_RULES: 'text-yellow-400 border-yellow-500/20 bg-yellow-950/40',
  COST_SHARING:        'text-zinc-400 border-zinc-500/20 bg-zinc-900/60',
  MOBILITY_IMPACT:     'text-blue-400 border-blue-500/20 bg-blue-950/40',
  DIPLOMATIC:          'text-teal-400 border-teal-500/20 bg-teal-950/40',
  MACARON_SYSTEM:      'text-green-400 border-green-500/20 bg-green-950/40',
  OTHER:               'text-zinc-400 border-zinc-700/20 bg-zinc-900/40',
}

const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: 'bg-white',
  HIGH:     'bg-red-500',
  MEDIUM:   'bg-amber-500',
  LOW:      'bg-zinc-500',
}

function fmt(d: Date | string): string {
  return new Date(d).toLocaleDateString('fr-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function fmtTs(d: Date | string): string {
  return new Date(d).toLocaleString('fr-CH', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

// ── Data ─────────────────────────────────────────────────────────────────────

async function getData() {
  const [directives, sources, watchAlerts] = await Promise.all([
    db.g7Directive.findMany({ orderBy: { publishedAt: 'desc' } }),
    db.g7Source.findMany({
      where:   { active: true },
      orderBy: { label: 'asc' },
      include: { _count: { select: { alerts: true } } },
    }),
    db.g7WatchAlert.findMany({
      orderBy: { detectedAt: 'desc' },
      take:    10,
      include: { source: { select: { label: true } } },
    }),
  ])
  return { directives, sources, watchAlerts }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function VeillePage() {
  const { directives, sources, watchAlerts } = await getData()

  const newAlerts = watchAlerts.length

  return (
    <div className="min-h-screen bg-[#0d0d10] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono tracking-[0.18em] text-white/30 uppercase">TIF</span>
          <span className="w-px h-3 bg-white/10" />
          <span className="text-sm font-medium text-white/80">Veille G7</span>
          {newAlerts > 0 && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400 bg-amber-950/40 border border-amber-500/20 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              {newAlerts} changement{newAlerts > 1 ? 's' : ''} détecté{newAlerts > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <nav className="flex items-center gap-3 text-[11px] font-mono">
          <Link href="/map"    className="text-white/50 hover:text-white/80 transition-colors">Carte</Link>
          <Link href="/alerts" className="text-white/50 hover:text-white/80 transition-colors">Alertes</Link>
          <Link href="/veille" className="text-white/80">Veille G7</Link>
          <Link href="/admin"  className="text-white/50 hover:text-white/80 transition-colors">Admin</Link>
        </nav>
      </div>

      <div className="px-6 py-6 space-y-10 max-w-5xl">

        {/* ── Contexte ─────────────────────────────────────────────────────── */}
        <section className="rounded-xl border border-amber-500/20 bg-amber-950/10 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="text-amber-400 text-lg mt-0.5">⚠</span>
            <div>
              <p className="text-[13px] font-medium text-amber-300">Sommet du G7 — Évian-les-Bains, 15–17 juin 2026</p>
              <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
                Dispositif sécuritaire exceptionnel dans la région lémanique. Contrôles aux frontières
                CH-FR du 12 au 18 juin. 7 passages autorisés. Espace aérien restreint 10–18 juin.
                Jusqu'à 5000 militaires en service d'appui.
              </p>
            </div>
          </div>
        </section>

        {/* ── Changements détectés ─────────────────────────────────────────── */}
        {watchAlerts.length > 0 && (
          <section>
            <h2 className="text-[11px] font-mono tracking-[0.14em] text-white/30 uppercase mb-3">
              Changements détectés — {watchAlerts.length} récent{watchAlerts.length > 1 ? 's' : ''}
            </h2>
            <div className="space-y-2">
              {watchAlerts.map(a => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 rounded-xl border border-amber-500/15 bg-amber-950/10 px-4 py-3"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-white/80">{a.source.label}</p>
                    <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed line-clamp-2">
                      {a.summary}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-white/25 flex-shrink-0">{fmtTs(a.detectedAt)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Sources surveillées ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-[11px] font-mono tracking-[0.14em] text-white/30 uppercase mb-3">
            Sources surveillées — {sources.length} actives · vérification horaire
          </h2>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="border-b border-white/[0.06] text-white/25">
                  <th className="text-left px-4 py-2 font-normal">Source</th>
                  <th className="text-left px-4 py-2 font-normal">Catégorie</th>
                  <th className="text-left px-4 py-2 font-normal">Dernière vérif.</th>
                  <th className="text-left px-4 py-2 font-normal">Statut</th>
                  <th className="text-left px-4 py-2 font-normal">Alertes</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'}>
                    <td className="px-4 py-2">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/70 hover:text-white transition-colors truncate block max-w-[280px]"
                      >
                        {s.label}
                      </a>
                    </td>
                    <td className="px-4 py-2 text-white/40 capitalize">{s.category}</td>
                    <td className="px-4 py-2 text-white/40">
                      {s.lastChecked ? fmtTs(s.lastChecked) : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {s.lastStatus ? (
                        <span className={
                          s.lastStatus === 200
                            ? 'text-green-400'
                            : s.lastStatus >= 400
                            ? 'text-red-400'
                            : 'text-amber-400'
                        }>
                          {s.lastStatus}
                        </span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-white/40">
                      {s._count.alerts > 0
                        ? <span className="text-amber-400">{s._count.alerts}</span>
                        : '0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Directives officielles ───────────────────────────────────────── */}
        <section>
          <h2 className="text-[11px] font-mono tracking-[0.14em] text-white/30 uppercase mb-3">
            Directives officielles — {directives.length} répertoriées
          </h2>
          <div className="space-y-3">
            {directives.map(d => (
              <div
                key={d.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  {/* Severity dot */}
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${SEVERITY_DOT[d.severity] ?? SEVERITY_DOT.LOW}`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-white/90">{d.title}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${CATEGORY_COLOR[d.category] ?? CATEGORY_COLOR.OTHER}`}>
                        {CATEGORY_LABEL[d.category] ?? d.category}
                      </span>
                    </div>

                    <p className="text-[11px] text-white/50 mt-1 leading-relaxed">{d.summary}</p>

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-[10px] font-mono text-white/25">{fmt(d.publishedAt)}</span>
                      <span className="text-white/10">·</span>
                      <span className="text-[10px] font-mono text-white/30">{d.authority}</span>
                      {d.impact.map(tag => (
                        <span key={tag} className="text-[9px] font-mono text-white/20 bg-white/[0.04] px-1.5 py-0.5 rounded">
                          {tag.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {d.url && (
                        <>
                          <span className="text-white/10">·</span>
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors"
                          >
                            source ↗
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
