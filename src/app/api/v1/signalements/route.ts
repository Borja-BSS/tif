import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { redis, ratelimit } from '@/lib/redis'
import { getFirebaseUserFromRequest } from '@/lib/auth-firebase'
import { REDIS_KEY_SIGNALEMENTS } from '@/data/signalement-categories'
import type { Signalement } from '@/data/signalement-categories'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'lostropicosbox@gmail.com,aruncalstas@gmail.com')
  .split(',').map(s => s.trim().toLowerCase())

async function isAdmin(req: NextRequest): Promise<boolean> {
  const user = await getFirebaseUserFromRequest(req)
  return !!user && ADMIN_EMAILS.includes(user.email.toLowerCase())
}

async function load(): Promise<Signalement[]> {
  try {
    const stored = await redis.get<Signalement[]>(REDIS_KEY_SIGNALEMENTS)
    return Array.isArray(stored) ? stored : []
  } catch { return [] }
}

async function save(items: Signalement[]): Promise<void> {
  await redis.set(REDIS_KEY_SIGNALEMENTS, items)
}

// POST public — envoi d'un signalement (rate-limited)
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anon'
  const { success } = await ratelimit.limit(`signalement:${ip}`)
  if (!success) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })

  const body = await req.json() as Partial<Signalement>

  if (!body.category || !body.subcategory || !body.priority || !body.description?.trim()) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }
  if (!body.address?.trim() && (body.lat == null || body.lng == null)) {
    return NextResponse.json({ error: 'Adresse ou coordonnées GPS requises' }, { status: 400 })
  }

  const item: Signalement = {
    id:          randomUUID(),
    category:    body.category,
    subcategory: body.subcategory,
    priority:    body.priority,
    description: body.description.trim(),
    address:     body.address?.trim() || undefined,
    lat:         body.lat != null ? Number(body.lat) : undefined,
    lng:         body.lng != null ? Number(body.lng) : undefined,
    mediaUrls:   Array.isArray(body.mediaUrls) ? body.mediaUrls : undefined,
    createdAt:   new Date().toISOString(),
    status:      'pending',
  }

  const all = await load()
  all.unshift(item) // plus récents en premier
  await save(all)

  return NextResponse.json({ id: item.id }, { status: 201 })
}

// GET admin — liste des signalements
export async function GET(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const items = await load()
  return NextResponse.json({ signalements: items })
}

// PATCH admin — approve / reject
export async function PATCH(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, status } = await req.json() as { id: string; status: 'approved' | 'rejected' }
  if (!id || !['approved','rejected'].includes(status)) {
    return NextResponse.json({ error: 'id et status requis' }, { status: 400 })
  }
  const all = await load()
  const idx = all.findIndex(s => s.id === id)
  if (idx === -1) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
  all[idx] = { ...all[idx], status, ...(status === 'approved' ? { approvedAt: new Date().toISOString() } : { rejectedAt: new Date().toISOString() }) }
  await save(all)
  return NextResponse.json({ signalement: all[idx] })
}

// DELETE admin — suppression définitive
export async function DELETE(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json() as { id: string }
  const all    = await load()
  await save(all.filter(s => s.id !== id))
  return NextResponse.json({ ok: true })
}
