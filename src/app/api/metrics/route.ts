import { NextResponse } from 'next/server'
import { getMetrics, SLO_TARGETS } from '@/lib/metrics'

const MONITORED_ROUTES = Object.keys(SLO_TARGETS)

export async function GET() {
  const metrics = await getMetrics(MONITORED_ROUTES)

  const sloStatus = metrics.map(m => {
    const target = SLO_TARGETS[m.route]
    const breached = target
      ? m.errorRate > target.errorRateMax
      : false

    return { ...m, slo: { target, breached } }
  })

  const anyBreached = sloStatus.some(s => s.slo.breached)

  return NextResponse.json({
    ts:      new Date().toISOString(),
    status:  anyBreached ? 'slo_breach' : 'ok',
    routes:  sloStatus,
  })
}
