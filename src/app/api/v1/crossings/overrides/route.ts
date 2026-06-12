import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { getOverrides, setOverride, clearOverride } from '@/lib/territory/crossing-overrides'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = ['lostropicosbox@gmail.com', 'aruncalstas@gmail.com']

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) },
    )
    const json = await res.json() as { users?: { email?: string }[] }
    const email = json.users?.[0]?.email ?? null
    if (!email || !ADMIN_EMAILS.includes(email)) return null
    return email
  } catch { return null }
}

// ── GET — public, no auth ─────────────────────────────────────────────────────
export async function GET() {
  const overrides = await getOverrides()
  return NextResponse.json(overrides, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

// ── POST — set one override ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json() as {
    id: string; status?: string; waitMinutes?: number; lat?: number; lng?: number
  }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await setOverride(body.id, {
    status:      body.status,
    waitMinutes: body.waitMinutes,
    lat:         body.lat,
    lng:         body.lng,
  })
  return NextResponse.json({ ok: true })
}

// ── DELETE — clear one override ───────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await req.json() as { id: string }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await clearOverride(id)
  return NextResponse.json({ ok: true })
}
