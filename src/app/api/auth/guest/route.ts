// src/app/api/auth/guest/route.ts
import { NextResponse } from 'next/server'
import { SignJWT }      from 'jose'

export const dynamic = 'force-dynamic'

const GUEST_TTL = 60  // secondes

export async function POST(): Promise<NextResponse> {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)
  const now    = Date.now()
  const expSec = Math.floor(now / 1000) + GUEST_TTL

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
}
