import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/', '/login', '/register', '/api/auth']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const requestId = crypto.randomUUID()

  // Security headers (ADR-001 edge layer)
  const res = NextResponse.next()
  res.headers.set('X-Request-Id', requestId)
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://*.mapbox.com wss://*.mapbox.com https://*.ably.io wss://*.ably.io https://*.ably-realtime.com wss://*.ably-realtime.com https://accounts.google.com https://*.googleapis.com; frame-src https://accounts.google.com; worker-src blob:;"
  )

  // Routes publiques — pas de vérification JWT
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return res

  // Vérification JWT (Edge-compatible, jose uniquement)
  const token = req.cookies.get('next-auth.session-token')?.value
    ?? req.cookies.get('__Secure-next-auth.session-token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)
    await jwtVerify(token, secret)
    return res
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
