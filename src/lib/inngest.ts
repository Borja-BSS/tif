/**
 * Remplaçant interne d'Inngest (04.11.2026, décision « TIF sans abonnement »).
 * Même forme d'appel que le SDK pour les fichiers de `src/inngest/` : `createFunction(config, handler)`,
 * `step.run`, `step.sendEvent`, `inngest.send`. Les tâches s'exécutent dans le processus Node, par le
 * planificateur de `src/lib/scheduler.ts`. Le registre vit sur globalThis : les routes et l'instrumentation,
 * qui peuvent être empaquetées à part, voient le même registre.
 */
export interface JobEvent { name: string; data?: unknown }
export interface JobStep {
  run<T>(id: string, fn: () => Promise<T> | T): Promise<T>
  sendEvent(id: string, payload: JobEvent | JobEvent[]): Promise<void>
}
export type JobHandler = (ctx: { event: { name: string; data: unknown }; step: JobStep }) => Promise<unknown>
export interface JobDef {
  id: string
  name?: string
  triggers: Array<{ cron?: string; event?: string }>
  handler: JobHandler
}

interface JobState {
  defs: Map<string, JobDef>
  enabled: Set<string> | null // null = pas encore décidé
  running: Set<string>
  lastRun: Map<string, string>
}
const g = globalThis as unknown as { __tifJobs?: JobState }
export const jobs: JobState = (g.__tifJobs ??= { defs: new Map(), enabled: null, running: new Set(), lastRun: new Map() })

export const step: JobStep = {
  async run<T>(_id: string, fn: () => Promise<T> | T): Promise<T> { return await fn() },
  async sendEvent(_id, payload) { await inngest.send(payload) },
}

export async function runJob(def: JobDef, event: { name: string; data: unknown }) {
  if (jobs.running.has(def.id)) return // pas de chevauchement
  jobs.running.add(def.id)
  const t0 = Date.now()
  try {
    await def.handler({ event, step })
    console.info(JSON.stringify({ scope: 'planificateur', job: def.id, ok: true, ms: Date.now() - t0 }))
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', scope: 'planificateur', job: def.id, msg: String((err as Error)?.message ?? err) }))
  } finally {
    jobs.running.delete(def.id)
  }
}

export const inngest = {
  createFunction(
    config: { id: string; name?: string; triggers?: Array<{ cron?: string; event?: string }> },
    handler: JobHandler,
  ): JobDef {
    const def: JobDef = { id: config.id, name: config.name, triggers: config.triggers ?? [], handler }
    jobs.defs.set(def.id, def)
    return def
  },
  /** Envoi d'événement : exécute en arrière-plan les tâches actives qui l'écoutent, sans bloquer l'appelant. */
  async send(payload: JobEvent | JobEvent[]): Promise<void> {
    for (const ev of Array.isArray(payload) ? payload : [payload]) {
      for (const def of jobs.defs.values()) {
        if (!def.triggers.some(t => t.event === ev.name)) continue
        if (!jobs.enabled?.has(def.id)) continue
        void runJob(def, { name: ev.name, data: ev.data })
      }
    }
  },
}
