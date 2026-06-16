import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { REDIS_KEY_SIGNALEMENTS } from '@/data/signalement-categories'
import type { Signalement } from '@/data/signalement-categories'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const stored = await redis.get<Signalement[]>(REDIS_KEY_SIGNALEMENTS)
    const all    = Array.isArray(stored) ? stored : []
    const now    = Date.now()

    // Garbage collect : retirer les entrées dont la clé TTL Redis a expiré
    const expiredIds = new Set<string>()
    await Promise.all(
      all
        .filter(s => s.status === 'approved' && s.expiresAt && new Date(s.expiresAt).getTime() <= now)
        .map(async s => {
          const exists = await redis.exists(`tif:sig:ttl:${s.id}`)
          if (!exists) expiredIds.add(s.id)
        })
    )

    if (expiredIds.size > 0) {
      const cleaned = all.map(s =>
        expiredIds.has(s.id) ? { ...s, status: 'disabled' as const, disabledAt: new Date().toISOString() } : s
      )
      await redis.set(REDIS_KEY_SIGNALEMENTS, cleaned)
    }

    const approved = all.filter(s =>
      s.status === 'approved' &&
      s.lat != null &&
      s.lng != null &&
      (!s.expiresAt || new Date(s.expiresAt).getTime() > now)
    )

    const public_ = approved.map(({ id, category, subcategory, priority, description, lat, lng, address, createdAt, expiresAt, confirmCount, denyCount, credibility }) => ({
      id, category, subcategory, priority, description, lat, lng, address, createdAt,
      expiresAt:    expiresAt    ?? null,
      confirmCount: confirmCount ?? 0,
      denyCount:    denyCount    ?? 0,
      credibility:  credibility  ?? 'neutral',
    }))

    return NextResponse.json({ signalements: public_ }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ signalements: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
