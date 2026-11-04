import { NextRequest, NextResponse } from 'next/server'
import { db }    from '@/lib/db'
import { redis, getPersistenceStatus } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { createHash, timingSafeEqual } from 'node:crypto'

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

/** Comparaison en temps constant : hachages SHA-256 (même longueur) puis timingSafeEqual. */
function cleValide(given: string, attendue: string): boolean {
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(attendue).digest()
  return timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  const start = Date.now()

  const [db, redis] = await Promise.all([checkDb(), checkRedis()])

  const healthy = db.ok && redis.ok
  const status  = healthy ? 200 : 503

  if (!healthy) {
    // Le détail (hôte, utilisateur de la base) va au journal, jamais dans la réponse publique.
    logger.error({ checks: { db, redis } }, 'health check failed')
  }

  const publicBody = {
    status: healthy ? 'ok' : 'degraded',
    uptime: Math.round(process.uptime()),
  }

  // Détail réservé à l'administration (même clé que /api/metrics).
  const adminKey = process.env.TIF_ADMIN_API_KEY
  const given    = req.headers.get('x-api-key')
  if (adminKey && given && cleValide(given, adminKey)) {
    return NextResponse.json({
      ...publicBody,
      checks:      { db, redis },
      persistence: getPersistenceStatus(),
      ts:          new Date().toISOString(),
      duration:    Date.now() - start,
    }, { status, headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json(publicBody, { status, headers: { 'Cache-Control': 'no-store' } })
}
