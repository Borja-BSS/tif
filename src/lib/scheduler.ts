import { jobs, runJob } from '@/lib/inngest'

/**
 * Planificateur interne au processus Node (remplace Inngest).
 *
 * Tâches actives par défaut : celles dont dépend une fonction visible ou une obligation légale.
 *  - purge-rgpd               : purge de rétention 90 jours (obligation, ADR-002)
 *  - compute-consensus        : consensus des zones, alimente la carte du territoire
 *  - detect-anomalies         : alertes d'anomalie (déclenchée par compute-consensus)
 *  - process-mobility-signals : signaux de mobilité envoyés par les visiteurs
 *  - resolve-events           : clôture des événements territoriaux expirés
 *  - predict-journeys         : statut des trajets enregistrés (/my-journey/status)
 *  - morning-briefing         : briefing du matin aux utilisateurs avec trajet
 * Inactives (listées pour plus tard) : ingest-sig-geneve (point d'accès SITG disparu, déjà sans effet),
 * ingest-sbb (sans clé il diffuse une SIMULATION : refusé tant qu'il n'y a pas de vraie source),
 * learn-patterns (apprentissage invisible), ship-logs (envoie vers Axiom, service externe).
 * Réglage : TIF_JOBS = identifiants séparés par des virgules, « all » ou « none ».
 */
export const JOBS_PAR_DEFAUT = [
  'purge-rgpd', 'compute-consensus', 'detect-anomalies', 'process-mobility-signals',
  'resolve-events', 'predict-journeys', 'morning-briefing',
]

function champ(expr: string, valeur: number): boolean {
  if (expr === '*') return true
  const pas = /^\*\/(\d+)$/.exec(expr)
  if (pas) return valeur % Number(pas[1]) === 0
  return expr.split(',').some(x => Number(x) === valeur)
}

/** Cron à cinq champs, UTC, minute et heure seulement (jour, mois, jour de semaine : « * »). */
export function cronCorrespond(expr: string, d: Date): boolean {
  const [m, h, dom, mon, dow] = expr.trim().split(/\s+/)
  if (dom !== '*' || mon !== '*' || dow !== '*') throw new Error(`Cron non géré: ${expr}`)
  return champ(m, d.getUTCMinutes()) && champ(h, d.getUTCHours())
}

export function startScheduler() {
  const g = globalThis as unknown as { __tifSchedulerStarted?: boolean }
  if (g.__tifSchedulerStarted) return
  g.__tifSchedulerStarted = true

  const reglage = (process.env.TIF_JOBS ?? '').trim()
  const voulus = reglage === 'none' ? [] : reglage === 'all' ? Array.from(jobs.defs.keys())
    : reglage ? reglage.split(',').map(s => s.trim()).filter(Boolean) : JOBS_PAR_DEFAUT
  jobs.enabled = new Set(voulus.filter(id => jobs.defs.has(id)))
  const inconnus = voulus.filter(id => !jobs.defs.has(id))
  console.info(JSON.stringify({ scope: 'planificateur', actives: Array.from(jobs.enabled), inconnues: inconnus }))

  const tick = () => {
    const d = new Date()
    const minute = d.toISOString().slice(0, 16)
    for (const id of jobs.enabled ?? []) {
      const def = jobs.defs.get(id)
      if (!def || jobs.lastRun.get(id) === minute) continue
      if (def.triggers.some(t => t.cron && cronCorrespond(t.cron, d))) {
        jobs.lastRun.set(id, minute)
        void runJob(def, { name: 'cron', data: null })
      }
    }
  }
  const iv = setInterval(tick, 20_000)
  if (typeof iv === 'object' && 'unref' in iv) iv.unref()
}
