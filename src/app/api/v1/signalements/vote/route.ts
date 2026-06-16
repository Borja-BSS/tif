import { NextRequest, NextResponse } from 'next/server'
import { redis, ratelimit } from '@/lib/redis'
import { REDIS_KEY_SIGNALEMENTS, computeCredibility, TTL_SECONDS } from '@/data/signalement-categories'
import type { Signalement } from '@/data/signalement-categories'
import { haversineMeters } from '@/lib/haversine'

export const dynamic = 'force-dynamic'

const MAX_DENY_FOR_AUTO_DISABLE = 3
const DENY_PENALTY_MS = 10 * 60 * 1000

async function load(): Promise<Signalement[]> {
  try {
    const stored = await redis.get<Signalement[]>(REDIS_KEY_SIGNALEMENTS)
    return Array.isArray(stored) ? stored : []
  } catch { return [] }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-real-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
    ?? 'anon'
  const body = await req.json() as { id?: string; vote?: string; lat?: number; lng?: number }
  const { id, vote, lat, lng } = body

  if (!id || !vote || lat == null || lng == null) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }
  if (vote !== 'confirm' && vote !== 'deny') {
    return NextResponse.json({ error: 'vote doit être confirm ou deny' }, { status: 400 })
  }

  const rl = await ratelimit.limit(`vote:${ip}:${id}`)
  if (!rl.success) {
    return NextResponse.json({ error: 'Vous avez déjà voté pour ce signalement' }, { status: 429 })
  }

  const all = await load()
  const idx = all.findIndex(s => s.id === id)
  if (idx === -1) return NextResponse.json({ error: 'Signalement introuvable' }, { status: 404 })

  const s = all[idx]
  if (s.status !== 'approved') return NextResponse.json({ error: 'Signalement non actif' }, { status: 400 })
  if (!s.expiresAt || new Date(s.expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Signalement expiré' }, { status: 400 })
  }
  if (s.lat == null || s.lng == null) {
    return NextResponse.json({ error: 'Signalement sans coordonnées GPS' }, { status: 400 })
  }

  const dist = haversineMeters(lat, lng, s.lat, s.lng)
  if (dist > 100) {
    return NextResponse.json({ error: `Trop loin du signalement (${Math.round(dist)}m)` }, { status: 403 })
  }

  const confirmCount = (s.confirmCount ?? 0) + (vote === 'confirm' ? 1 : 0)
  const denyCount    = (s.denyCount    ?? 0) + (vote === 'deny'    ? 1 : 0)
  const credibility  = computeCredibility(confirmCount, denyCount)

  let expiresAt = s.expiresAt
  if (vote === 'deny') {
    if (denyCount >= MAX_DENY_FOR_AUTO_DISABLE) {
      expiresAt = new Date().toISOString()
    } else {
      const current = new Date(s.expiresAt).getTime()
      expiresAt = new Date(Math.max(Date.now(), current - DENY_PENALTY_MS)).toISOString()
    }
    const remainSec = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
    if (remainSec > 0) {
      await redis.expire(`tif:sig:ttl:${id}`, remainSec)
    } else {
      await redis.del(`tif:sig:ttl:${id}`)
    }
  }

  all[idx] = { ...s, confirmCount, denyCount, credibility, expiresAt }
  await redis.set(REDIS_KEY_SIGNALEMENTS, all)

  return NextResponse.json({ confirmCount, denyCount, credibility, expiresAt })
}
