import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { getOverrides, setOverride, clearOverride } from '@/lib/territory/crossing-overrides'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = ['lostropicosbox@gmail.com', 'aruncalstas@gmail.com']

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  // Defense-in-depth: browsers never send custom headers cross-origin without CORS preflight
  if (req.headers.get('x-requested-with') !== 'fetch') return null
  const cookie = req.cookies.get('tif-firebase-token')?.value
  if (!cookie) return null
  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
    const { payload } = await jwtVerify(cookie, secret)
    const email = payload.email as string | undefined
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
