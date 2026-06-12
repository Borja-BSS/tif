import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { redis } from '@/lib/redis'
import { getFirebaseUserFromRequest } from '@/lib/auth-firebase'
import type { CustomAlert } from '@/data/custom-alerts'
import { TYPE_COLOR, REDIS_KEY_ALERTS } from '@/data/custom-alerts'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'lostropicosbox@gmail.com')
  .split(',').map(s => s.trim().toLowerCase())

async function isAdmin(req: NextRequest): Promise<boolean> {
  const user = await getFirebaseUserFromRequest(req)
  return !!user && ADMIN_EMAILS.includes(user.email.toLowerCase())
}

async function loadAlerts(): Promise<CustomAlert[]> {
  try {
    const stored = await redis.get<CustomAlert[]>(REDIS_KEY_ALERTS)
    return Array.isArray(stored) ? stored : []
  } catch { return [] }
}

async function saveAlerts(alerts: CustomAlert[]): Promise<void> {
  await redis.set(REDIS_KEY_ALERTS, alerts)
}

export async function GET(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ alerts: await loadAlerts() })
}

export async function POST(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Partial<CustomAlert>

  if (!body.type || !body.title || body.lat == null || body.lng == null || !body.activeFrom) {
    return NextResponse.json({ error: 'Champs requis : type, title, lat, lng, activeFrom' }, { status: 400 })
  }

  const alert: CustomAlert = {
    id:          randomUUID(),
    type:        body.type,
    title:       body.title.trim(),
    description: body.description?.trim() || undefined,
    source:      (() => { const s = body.source?.trim(); if (!s) return undefined; try { const u = new URL(s); return (u.protocol === 'http:' || u.protocol === 'https:') ? s : undefined; } catch { return undefined; } })(),
    lat:         Number(body.lat),
    lng:         Number(body.lng),
    radius:      body.radius ? Number(body.radius) : undefined,
    color:       body.color || TYPE_COLOR[body.type] || '#636366',
    activeFrom:  body.activeFrom,
    activeTo:    body.activeTo || undefined,
    createdAt:   new Date().toISOString(),
  }

  const alerts = await loadAlerts()
  alerts.push(alert)
  await saveAlerts(alerts)

  return NextResponse.json({ alert }, { status: 201 })
}
