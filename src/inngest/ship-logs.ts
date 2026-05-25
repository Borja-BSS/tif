/**
 * Ship SLO metrics vers Axiom toutes les 5 minutes.
 * Axiom ingère via son API REST (pas de SDK nécessaire).
 * Les logs pino sont collectés par Vercel et poussés via drain Axiom.
 * Ce job ship les métriques SLO structurées (error rate, latence par route).
 */
import { inngest }    from '@/lib/inngest'
import { getMetrics, SLO_TARGETS } from '@/lib/metrics'
import type { RouteMetrics }        from '@/lib/metrics'
import { logger }     from '@/lib/logger'

const MONITORED_ROUTES = Object.keys(SLO_TARGETS)

export const shipLogs = inngest.createFunction(
  {
    id:       'ship-logs',
    name:     'Observability — SLO metrics → Axiom toutes 5min',
    triggers: [{ cron: '*/5 * * * *' }],
  },
  async ({ step }) => {
    const axiomToken   = process.env.AXIOM_TOKEN
    const axiomDataset = process.env.AXIOM_DATASET

    if (!axiomToken || !axiomDataset) {
      logger.debug('Axiom non configuré — skip ship-logs')
      return { skipped: true }
    }

    const metrics: RouteMetrics[] = await step.run('fetch-slo-metrics', () =>
      getMetrics(MONITORED_ROUTES),
    )

    const events = metrics.map(m => ({
      _time:     new Date().toISOString(),
      type:      'slo_metric',
      route:     m.route,
      window:    m.window,
      total:     m.total,
      errors:    m.errors,
      errorRate: m.errorRate,
      avgLatency: m.avgLatency,
      sloBreached: SLO_TARGETS[m.route]
        ? m.errorRate > SLO_TARGETS[m.route].errorRateMax
        : false,
    }))

    await step.run('push-to-axiom', async () => {
      const res = await fetch(`https://api.axiom.co/v1/datasets/${axiomDataset}/ingest`, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${axiomToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(events),
      })

      if (!res.ok) {
        logger.error({ status: res.status }, 'Axiom ingest failed')
      }

      return { pushed: events.length, status: res.status }
    })

    // Alerter si un SLO est breached
    const breached = events.filter(e => e.sloBreached)
    if (breached.length > 0) {
      logger.warn({ breached }, 'SLO breach detected')
    }

    return { metrics: metrics.length, breached: breached.length }
  },
)
