import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { CustomAlert } from '@/data/custom-alerts'
import { TYPE_COLOR, TYPE_ICON, REDIS_KEY_ALERTS } from '@/data/custom-alerts'

export const dynamic = 'force-dynamic'

export async function GET() {
  let alerts: CustomAlert[] = []

  try {
    const stored = await redis.get<CustomAlert[]>(REDIS_KEY_ALERTS)
    if (Array.isArray(stored)) alerts = stored
  } catch { /* Redis indisponible — retourne tableau vide */ }

  const now = Date.now()
  const active = alerts.filter(a => {
    const from = new Date(a.activeFrom).getTime()
    const to   = a.activeTo ? new Date(a.activeTo).getTime() : Infinity
    return now >= from && now <= to
  })

  return NextResponse.json({
    type: 'FeatureCollection',
    features: active.map(a => ({
      type:     'Feature',
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      properties: {
        id:          a.id,
        type:        a.type,
        title:       a.title,
        description: a.description ?? '',
        color:       a.color ?? TYPE_COLOR[a.type] ?? '#636366',
        icon:        TYPE_ICON[a.type] ?? '⚠️',
        radius:      a.radius ?? 0,
        activeFrom:  a.activeFrom,
        activeTo:    a.activeTo ?? '',
      },
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
