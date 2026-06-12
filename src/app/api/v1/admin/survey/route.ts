import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = ['lostropicosbox@gmail.com', 'aruncalstas@gmail.com']

const KEY_YES      = 'tif:survey:v1:yes'
const KEY_NO       = 'tif:survey:v1:no'
const KEY_FEEDBACK = 'tif:survey:v1:feedback'

export async function GET(req: NextRequest) {
  // Auth via tif-firebase-token cookie (set by /api/auth/firebase-session)
  const firebaseToken = req.cookies.get('tif-firebase-token')?.value
  if (!firebaseToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let email: string
  try {
    const secret  = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
    const { payload } = await jwtVerify(firebaseToken, secret)
    email = (payload.email as string) ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  if (!ADMIN_EMAILS.includes(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const [yes, no, rawFeedback] = await Promise.all([
      redis.get<number>(KEY_YES),
      redis.get<number>(KEY_NO),
      redis.lrange(KEY_FEEDBACK, 0, 199),
    ])

    const feedback = (Array.isArray(rawFeedback) ? rawFeedback : []).map((s: unknown) => {
      if (typeof s === 'object' && s !== null) return s
      if (typeof s === 'string') { try { return JSON.parse(s) } catch {} }
      return { text: String(s ?? '') }
    })

    return NextResponse.json({
      yes:      yes  ?? 0,
      no:       no   ?? 0,
      total:    (yes ?? 0) + (no ?? 0),
      feedback,
    })
  } catch {
    return NextResponse.json({ error: 'Redis error' }, { status: 500 })
  }
}
