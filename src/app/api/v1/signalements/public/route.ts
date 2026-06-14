import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { REDIS_KEY_SIGNALEMENTS } from '@/data/signalement-categories'
import type { Signalement } from '@/data/signalement-categories'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const stored = await redis.get<Signalement[]>(REDIS_KEY_SIGNALEMENTS)
    const all    = Array.isArray(stored) ? stored : []
    const approved = all
      .filter(s => s.status === 'approved' && s.lat != null && s.lng != null)
      .map(({ id, category, subcategory, priority, description, lat, lng, address, createdAt }) => ({
        id, category, subcategory, priority, description, lat, lng, address, createdAt,
      }))
    return NextResponse.json({ signalements: approved }, {
      headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
    })
  } catch {
    return NextResponse.json({ signalements: [] })
  }
}
