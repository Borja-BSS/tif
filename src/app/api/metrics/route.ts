import { NextRequest, NextResponse } from 'next/server'
import { getMetrics, SLO_TARGETS }  from '@/lib/metrics'

const MONITORED_ROUTES = Object.keys(SLO_TARGETS)
const ADMIN_KEY = process.env.TIF_ADMIN_API_KEY

export async function GET(req: NextRequest) {
  const key = req.headers.get('x-api-key')
  if (!ADMIN_KEY || !key || key !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
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
