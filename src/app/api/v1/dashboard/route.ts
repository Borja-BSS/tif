import { auth }           from '@/lib/auth'
import { db }              from '@/lib/db'
import { redis }           from '@/lib/redis'
import { Ratelimit }       from '@upstash/ratelimit'
import { NextRequest }     from 'next/server'
import type { EventType }  from '@prisma/client'
import type { JourneyStatusResult } from '@/lib/my-journey/types'

export const dynamic = 'force-dynamic'

const rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1m') })

function eventTypeToIcon(type: EventType): string {
  const map: Partial<Record<EventType, string>> = {
    TRAFFIC_INCIDENT:             '🚦',
    ROAD_CLOSURE:                 '🚫',
    BORDER_CONGESTION:            '🛂',
    PUBLIC_TRANSPORT_DISRUPTION:  '🚌',
    DEMONSTRATION:                '📢',
    CONSTRUCTION:                 '🚧',
    EMERGENCY:                    '🚨',
    WEATHER_IMPACT:               '⛈️',
  }
  return map[type] ?? '⚠️'
}

function timeAgo(date: Date): string {
  const m = Math.floor((Date.now() - date.getTime()) / 60000)
  if (m < 1)  return "À l'instant"
  if (m < 60) return `Il y a ${m} min`
  return `Il y a ${Math.floor(m / 60)}h`
}

export async function GET(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await rl.limit(ip)
  if (!success) return Response.json({ error: 'Too many requests' }, { status: 429 })

  // Journey status — spécifique à l'utilisateur si connecté
  const session = await auth()
  let myJourney: JourneyStatusResult | undefined
  if (session?.user?.id) {
    const raw = await redis.get(`tif:journey:${session.user.id}:status`)
    if (raw) myJourney = (typeof raw === 'string' ? JSON.parse(raw) : raw) as JourneyStatusResult
  }

  // Données globales depuis cache ou DB
  const cacheKey = 'tif:dashboard:global'
  const cached   = await redis.get(cacheKey)
  let globalData: Record<string, unknown>

  if (cached) {
    globalData = (typeof cached === 'string' ? JSON.parse(cached) : cached) as Record<string, unknown>
  } else {
    const now    = new Date()
    const alerts = await db.territorialEvent.findMany({
      where: { resolvedAt: null, expiresAt: { gt: now } },
      orderBy: { detectedAt: 'desc' },
      take: 10,
      select: { id: true, titleFr: true, severity: true, detectedAt: true, type: true },
    })

    const [tpgStatus, cffStatus, cevaStatus, activeZonesRaw] = await Promise.all([
      redis.get('tif:network:tpg:status'),
      redis.get('tif:network:cff:status'),
      redis.get('tif:network:ceva:status'),
      redis.get('tif:active-zones-count'),
    ])

    globalData = {
      alerts: alerts.map(a => ({
        id:       a.id,
        icon:     eventTypeToIcon(a.type),
        title:    a.titleFr,
        severity: a.severity,
        timeAgo:  timeAgo(a.detectedAt),
      })),
      network: {
        tpg:  (tpgStatus  as string) ?? 'normal',
        cff:  (cffStatus  as string) ?? 'normal',
        ceva: (cevaStatus as string) ?? 'normal',
      },
      globalStatus: alerts.length === 0 ? 'calm'
        : alerts.some(a => a.severity === 'CRITICAL') ? 'critical'
        : 'active',
      activeZones: parseInt((activeZonesRaw as string) ?? '4'),
      lastUpdated: now.toISOString(),
    }

    await redis.set(cacheKey, JSON.stringify(globalData), { ex: 30 })
  }

  const response = Response.json({ ...globalData, myJourney })
  response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=30')
  return response
}
