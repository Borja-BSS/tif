import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const key = req.headers.get('x-api-key')
  if (!key || key !== process.env.TIF_ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const week  = new Date(today.getTime() - 7  * 86400000)
  const month = new Date(today.getTime() - 30 * 86400000)

  const [todaySessions, weekSessions, monthSessions, eventsByType, recentEvents] =
    await Promise.all([
      db.tifAnalytic.findMany({
        where: { createdAt: { gte: today } },
        select: { sessionId: true },
        distinct: ['sessionId'],
      }),
      db.tifAnalytic.findMany({
        where: { createdAt: { gte: week } },
        select: { sessionId: true },
        distinct: ['sessionId'],
      }),
      db.tifAnalytic.findMany({
        where: { createdAt: { gte: month } },
        select: { sessionId: true },
        distinct: ['sessionId'],
      }),
      db.tifAnalytic.groupBy({
        by: ['event'],
        _count: { event: true },
        where: { createdAt: { gte: week } },
        orderBy: { _count: { event: 'desc' } },
      }),
      db.tifAnalytic.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { event: true, data: true, country: true, createdAt: true },
      }),
    ])

  return NextResponse.json({
    sessions: {
      today: todaySessions.length,
      week:  weekSessions.length,
      month: monthSessions.length,
    },
    eventsByType: eventsByType.map(e => ({ event: e.event, count: e._count.event })),
    recentEvents,
  })
}
