import Link from 'next/link'
import { db } from '@/lib/db'
import { computeTerritoryScore, LEVEL_COLOR } from '@/lib/scoring/territory-score'
import type { TerritoryScore } from '@/lib/scoring/territory-score'

type RawActive = {
  id: string; type: string; geohash: string; severity: string
  confidence: number; detectedAt: Date; expiresAt: Date; titleFr: string | null
}
type ActiveEvent = RawActive & { territoryScore: TerritoryScore }
type RecentEvent = {
  id: string; type: string; geohash: string; severity: string
  detectedAt: Date; resolvedAt: Date | null; titleFr: string | null
}
type ZoneRow = { geohash6: string; congestionScore: number | null }

async function getActiveAlerts() {
  const now = new Date()

  const [active, recent] = await Promise.all([
    // Événements actifs (non résolus, non expirés)
    db.territorialEvent.findMany({
      where: {
        resolvedAt: null,
        expiresAt:  { gt: now },
      },
      orderBy: { detectedAt: 'desc' },
      select: {
        id: true, type: true, geohash: true, severity: true,
        confidence: true, detectedAt: true, expiresAt: true,
        titleFr: true,
      },
    }),

    // 24h d'historique résolu
    db.territorialEvent.findMany({
      where: {
        resolvedAt: { not: null, gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { detectedAt: 'desc' },
      take:    50,
      select: {
        id: true, type: true, geohash: true, severity: true,
        detectedAt: true, resolvedAt: true, titleFr: true,
      },
    }),
  ])

  // Zones avec congestionScore pour scoring territorial
  const rawActive = active as RawActive[]
  const rawRecent = recent as RecentEvent[]

  const geohashes = [...new Set(rawActive.map((e: RawActive) => e.geohash.slice(0, 6)))]
  const zones: ZoneRow[] = geohashes.length
    ? await db.trafficZone.findMany({
        where:  { geohash6: { in: geohashes } },
        select: { geohash6: true, congestionScore: true },
      })
    : []

  const congestionMap = new Map(zones.map((z: ZoneRow) => [z.geohash6, z.congestionScore ?? 0]))

  const activeWithScore: ActiveEvent[] = rawActive.map((e: RawActive) => {
    const g6   = e.geohash.slice(0, 6)
    const cong = congestionMap.get(g6) ?? 0
    const ts   = computeTerritoryScore(cong, e.severity === 'HIGH' || e.severity === 'CRITICAL')
    return { ...e, territoryScore: ts }
  })

  return { active: activeWithScore, recent: rawRecent }
}

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: 'bg-white/10 text-white border-white/20',
  HIGH:     'bg-red-950/60 text-red-400 border-red-500/20',
  MEDIUM:   'bg-amber-950/60 text-amber-400 border-amber-500/20',
  LOW:      'bg-zinc-900 text-zinc-400 border-zinc-700/40',
}

function fmt(d: Date | string): string {
  return new Date(d).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(a: Date | string, b: Date | string | null): string {
  if (!b) return '—'
  const m = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000)
  return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

export default async function AlertsPage() {
  const { active, recent } = await getActiveAlerts()

  return (
    <div className="min-h-screen bg-[#0d0d10] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono tracking-[0.18em] text-white/30 uppercase">TIF</span>
          <span className="w-px h-3 bg-white/10" />
          <span className="text-sm font-medium text-white/80">Alertes Territoriales</span>
        </div>
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-3 text-[11px] font-mono">
            <Link href="/map"    className="text-white/50 hover:text-white/80 transition-colors">Carte</Link>
            <Link href="/alerts" className="text-white/80">Alertes</Link>
            <Link href="/admin"  className="text-white/50 hover:text-white/80 transition-colors">Admin</Link>
          </nav>
          {active.length > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {active.length} actif{active.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-6 space-y-8 max-w-4xl">

        {/* ── Alertes actives ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-[11px] font-mono tracking-[0.14em] text-white/30 uppercase mb-3">
            Actifs — {active.length}
          </h2>

          {active.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-8 text-center">
              <p className="text-sm text-white/25 font-mono">Aucune alerte active</p>
            </div>
          ) : (
            <div className="space-y-2">
              {active.map((e: ActiveEvent) => {
                const color = LEVEL_COLOR[e.territoryScore.level]
                return (
                  <div
                    key={e.id}
                    className="flex items-start gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                  >
                    {/* Level indicator */}
                    <div
                      className="mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: color, boxShadow: `0 0 6px ${color}60` }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium text-white/90 truncate">
                          {e.titleFr ?? e.type}
                        </span>
                        <span
                          className={[
                            'text-[9px] font-mono px-1.5 py-0.5 rounded border',
                            SEVERITY_BADGE[e.severity] ?? SEVERITY_BADGE.LOW,
                          ].join(' ')}
                        >
                          {e.severity}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-white/30">
                        <span>{e.geohash.slice(0, 6)}</span>
                        <span>·</span>
                        <span>Détecté {fmt(e.detectedAt)}</span>
                        <span>·</span>
                        <span>Expire {fmt(e.expiresAt)}</span>
                        <span>·</span>
                        <span>Score {e.territoryScore.score}/100</span>
                      </div>
                    </div>

                    {/* Confidence */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-[11px] font-mono text-white/50">
                        {Math.round(e.confidence * 100)}%
                      </div>
                      <div className="text-[9px] font-mono text-white/20">conf.</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Historique 24h ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-[11px] font-mono tracking-[0.14em] text-white/30 uppercase mb-3">
            Résolus — 24h
          </h2>

          {recent.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-center">
              <p className="text-sm text-white/25 font-mono">Aucun événement résolu dans les 24 dernières heures</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-[11px] font-mono">
                <thead>
                  <tr className="border-b border-white/[0.06] text-white/25">
                    <th className="text-left px-4 py-2">Zone</th>
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-left px-4 py-2">Sévérité</th>
                    <th className="text-left px-4 py-2">Détecté</th>
                    <th className="text-left px-4 py-2">Durée</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((e: RecentEvent, i: number) => (
                    <tr
                      key={e.id}
                      className={i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'}
                    >
                      <td className="px-4 py-2 text-white/50">{e.geohash.slice(0, 6)}</td>
                      <td className="px-4 py-2 text-white/60">{e.titleFr ?? e.type}</td>
                      <td className="px-4 py-2">
                        <span className={[
                          'px-1.5 py-0.5 rounded border text-[9px]',
                          SEVERITY_BADGE[e.severity] ?? SEVERITY_BADGE.LOW,
                        ].join(' ')}>
                          {e.severity}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-white/40">{fmt(e.detectedAt)}</td>
                      <td className="px-4 py-2 text-white/40">{fmtDuration(e.detectedAt, e.resolvedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
