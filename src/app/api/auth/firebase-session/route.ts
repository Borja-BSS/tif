import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'

export const dynamic = 'force-dynamic'

// Public — Firebase project API key (not a secret)
const FIREBASE_API_KEY = 'AIzaSyDhuxQLCNDRNz9L7hVCFnQYjpiUZTitzLM'
const TOKEN_TTL = 30 * 24 * 60 * 60 // 30 days

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json() as { idToken?: string }
    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    // Verify token via Firebase REST API
    const fbRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    )
    if (!fbRes.ok) {
      return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 })
    }

    const data = await fbRes.json() as { users?: { email?: string; localId?: string }[] }
    const fbUser = data.users?.[0]
    if (!fbUser?.localId) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 401 })
    }

    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
    const token = await new SignJWT({
      sub:      fbUser.localId,
      email:    fbUser.email ?? '',
      provider: 'firebase',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + TOKEN_TTL)
      .sign(secret)

    const res = NextResponse.json({ ok: true })
    res.cookies.set('tif-firebase-token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   TOKEN_TTL,
      path:     '/',
    })
    return res
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
