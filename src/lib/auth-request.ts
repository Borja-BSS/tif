import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'

export interface AuthUser {
  id:    string
  email: string | null
  role:  string
}

/**
 * Read and verify the NextAuth session-token cookie directly with jose.
 * Works in Next.js 16 regardless of next-auth version or next/headers API changes.
 * Same approach as the middleware.
 */
export async function getUserFromRequest(req: NextRequest): Promise<AuthUser | null> {
  const secureToken  = req.cookies.get('__Secure-next-auth.session-token')?.value
  const plainToken   = req.cookies.get('next-auth.session-token')?.value
  const raw          = secureToken ?? plainToken

  console.error('[auth-request] cookies present:', {
    secure:     !!secureToken,
    plain:      !!plainToken,
    all_keys:   req.cookies.getAll().map(c => c.name),
    secret_set: !!(process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET),
  })

  if (!raw) return null

  const secret = new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET
  )

  try {
    const { payload } = await jwtVerify(raw, secret)
    const id = (payload['id'] as string | undefined) ?? (payload.sub as string | undefined)
    if (!id) return null
    return {
      id,
      email: (payload['email'] as string | undefined) ?? null,
      role:  (payload['role'] as string | undefined) ?? 'USER',
    }
  } catch (err) {
    console.error('[auth-request] jwtVerify failed:', (err as Error).message)
    return null
  }
}
