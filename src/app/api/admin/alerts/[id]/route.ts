import { NextRequest, NextResponse } from 'next/server'
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as Partial<CustomAlert>
  const alerts = await loadAlerts()
  const idx = alerts.findIndex(a => a.id === id)

  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated: CustomAlert = {
    ...alerts[idx],
    ...body,
    id,
    color: body.color || (body.type ? TYPE_COLOR[body.type] : alerts[idx].color) || '#636366',
  }
  alerts[idx] = updated
  await saveAlerts(alerts)

  return NextResponse.json({ alert: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const alerts = await loadAlerts()
  const filtered = alerts.filter(a => a.id !== id)

  if (filtered.length === alerts.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await saveAlerts(filtered)
  return NextResponse.json({ ok: true })
}
