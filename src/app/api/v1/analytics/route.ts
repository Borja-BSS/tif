import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const ALLOWED_EVENTS = new Set([
  'page_view', 'map_open', 'filter_click', 'crossing_open',
  'route_search', 'consent_given', 'consent_refused',
  'geo_granted', 'geo_denied',
])

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, event, data } = body as {
      sessionId?: string
      event?: string
      data?: Record<string, unknown>
    }

    if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 36) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    if (!event || !ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const country = req.headers.get('x-vercel-ip-country') ?? null

    await db.tifAnalytic.create({
      data: {
        sessionId,
        event,
        data: data ? (data as Prisma.InputJsonValue) : undefined,
        country,
      },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
