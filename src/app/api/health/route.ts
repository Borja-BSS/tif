import { NextResponse } from 'next/server'
import { db }    from '@/lib/db'
import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'

interface Check {
  ok:      boolean
  latency: number   // ms
  error?:  string
}

async function checkDb(): Promise<Check> {
  const t = Date.now()
  try {
    await db.$queryRaw`SELECT 1`
    return { ok: true, latency: Date.now() - t }
  } catch (e) {
    return { ok: false, latency: Date.now() - t, error: String(e) }
  }
}

async function checkRedis(): Promise<Check> {
  const t = Date.now()
  try {
    await redis.ping()
    return { ok: true, latency: Date.now() - t }
  } catch (e) {
    return { ok: false, latency: Date.now() - t, error: String(e) }
  }
}

export async function GET() {
  const start = Date.now()

  const [db, redis] = await Promise.all([checkDb(), checkRedis()])

  const healthy = db.ok && redis.ok
  const status  = healthy ? 200 : 503
  const body = {
    status:   healthy ? 'ok' : 'degraded',
    checks:   { db, redis },
    uptime:   process.uptime(),
    ts:       new Date().toISOString(),
    duration: Date.now() - start,
  }

  if (!healthy) {
    logger.error({ checks: body.checks }, 'health check failed')
  }

  return NextResponse.json(body, { status })
}
