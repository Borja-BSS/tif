import { db } from '@/lib/db'

async function getStats() {
  const now    = new Date()
  const since7 = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
  const since1 = new Date(now.getTime() - 1  * 24 * 60 * 60 * 1000)

  const [
    patternCount,
    activeZones,
    recentResolutions,
    leadTimeByType,
    recentEvents,
  ] = await Promise.all([
    db.temporalPattern.count(),

    db.trafficZone.count({ where: { updatedAt: { gte: since1 } } }),

    db.eventResolution.count({ where: { detectedAt: { gte: since7 } } }),

    db.$queryRaw<{ event_type: string; avg_lead: number; count: bigint }[]>`
      SELECT
        "eventType"             AS event_type,
        AVG("leadTimeMinutes")  AS avg_lead,
        COUNT(*)                AS count
      FROM "EventResolution"
      WHERE "detectedAt" >= ${since7}
      GROUP BY "eventType"
      ORDER BY avg_lead DESC
    `,

    db.eventResolution.findMany({
      orderBy: { detectedAt: 'desc' },
      take:    15,
      select:  {
        id: true, eventType: true, geohash6: true, severity: true,
        detectedAt: true, resolvedAt: true, leadTimeMinutes: true,
      },
    }),
  ])

  return { patternCount, activeZones, recentResolutions, leadTimeByType, recentEvents }
}

function fmt(n: number): string {
  return n.toLocaleString('fr-CH', { maximumFractionDigits: 1 })
}

function severityColor(s: string): string {
  if (s === 'CRITICAL') return 'text-red-400'
  if (s === 'HIGH')     return 'text-orange-400'
  if (s === 'MEDIUM')   return 'text-yellow-400'
  return 'text-white/40'
}

export default async function AdminPage() {
  const { patternCount, activeZones, recentResolutions, leadTimeByType, recentEvents } = await getStats()

  return (
    <div className="min-h-screen bg-[#0d0d10] text-white p-6 font-mono">
      <header className="mb-8">
        <p className="text-[10px] text-white/30 uppercase tracking-[0.18em]">TIF — Admin</p>
        <h1 className="text-xl font-semibold text-white/90 mt-1">Territorial Memory</h1>
      </header>

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Patterns appris',   value: fmt(patternCount),     sub: 'buckets horaires (7j×24h)' },
          { label: 'Zones actives 24h', value: fmt(activeZones),      sub: 'geohash6 avec signaux' },
          { label: 'Résolutions 7j',    value: fmt(recentResolutions), sub: 'événements résolus' },
        ].map(k => (
          <div key={k.label} className="rounded-xl bg-white/5 px-5 py-4">
            <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">{k.label}</p>
            <p className="text-3xl font-semibold text-white/90">{k.value}</p>
            <p className="text-[10px] text-white/25 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Lead Time par type ───────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-[11px] text-white/35 uppercase tracking-widest mb-3">
          Lead Time — TIF vs sources officielles (7 derniers jours)
        </h2>
        {leadTimeByType.length === 0 ? (
          <p className="text-[12px] text-white/25 italic">Pas encore de résolutions enregistrées.</p>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-white/30 border-b border-white/[0.06]">
                <th className="pb-2 font-normal">Type d'événement</th>
                <th className="pb-2 font-normal text-right">Lead time moyen</th>
                <th className="pb-2 font-normal text-right">Événements</th>
              </tr>
            </thead>
            <tbody>
              {leadTimeByType.map(row => (
                <tr key={row.event_type} className="border-b border-white/[0.04]">
                  <td className="py-2 text-white/70">{row.event_type.replace(/_/g, ' ')}</td>
                  <td className={`py-2 text-right font-semibold ${row.avg_lead >= 4 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {fmt(row.avg_lead)} min
                  </td>
                  <td className="py-2 text-right text-white/40">{String(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-[10px] text-white/20 mt-3">
          Cible : lead time moyen &gt; 4 min sur incidents trafic
          {leadTimeByType.find(r => r.event_type === 'TRAFFIC_INCIDENT' && r.avg_lead >= 4)
            ? ' — ✓ ATTEINTE'
            : leadTimeByType.find(r => r.event_type === 'TRAFFIC_INCIDENT')
              ? ' — en cours'
              : ''}
        </p>
      </section>

      {/* ── Événements récents ───────────────────────────────────────── */}
      <section>
        <h2 className="text-[11px] text-white/35 uppercase tracking-widest mb-3">
          Résolutions récentes
        </h2>
        {recentEvents.length === 0 ? (
          <p className="text-[12px] text-white/25 italic">Aucune résolution encore.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentEvents.map(ev => (
              <div key={ev.id} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] font-semibold ${severityColor(ev.severity)}`}>
                    {ev.severity}
                  </span>
                  <span className="text-[11px] text-white/60">
                    {ev.eventType.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-white/25">{ev.geohash6}</span>
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className={`font-semibold ${ev.leadTimeMinutes >= 4 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    +{fmt(ev.leadTimeMinutes)} min
                  </span>
                  <span className="text-white/25">
                    {ev.detectedAt.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
