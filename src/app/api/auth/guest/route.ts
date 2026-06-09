// src/app/api/auth/guest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT }      from 'jose'
import { env }         from '@/lib/env'
import { logger }      from '@/lib/logger'
import { ratelimit }   from '@/lib/redis'

export const dynamic = 'force-dynamic'

const GUEST_TTL = 60  // secondes

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous'
  try {
    const { success } = await ratelimit.limit(`guest:${ip}`)
    if (!success) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 })
  } catch { /* fail-open */ }

  const secret = new TextEncoder().encode(env.NEXTAUTH_SECRET)
  const now    = Date.now()
  const expSec = Math.floor(now / 1000) + GUEST_TTL

  try {
    const token = await new SignJWT({ sub: 'guest', role: 'guest' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expSec)
      .sign(secret)

    const res = NextResponse.json({ ok: true, expiresAt: now + GUEST_TTL * 1000 })
    res.cookies.set('tif-guest-token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   GUEST_TTL,
      path:     '/',
    })
    return res
  } catch (err) {
    logger.error({ err }, 'guest JWT signing failed')
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
