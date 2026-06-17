import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = ['lostropicosbox@gmail.com', 'aruncalstas@gmail.com']
const KEY_PREFIX   = 'tif:ratings:v1'
const KEY_LIST     = `${KEY_PREFIX}:list`

export async function GET(req: NextRequest) {
  const firebaseToken = req.cookies.get('tif-firebase-token')?.value
  if (!firebaseToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let email: string
  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
    const { payload } = await jwtVerify(firebaseToken, secret)
    email = (payload.email as string) ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  if (!ADMIN_EMAILS.includes(email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const [c1, c2, c3, c4, c5, rawList] = await Promise.all([
      redis.get<number>(`${KEY_PREFIX}:count:1`),
      redis.get<number>(`${KEY_PREFIX}:count:2`),
      redis.get<number>(`${KEY_PREFIX}:count:3`),
      redis.get<number>(`${KEY_PREFIX}:count:4`),
      redis.get<number>(`${KEY_PREFIX}:count:5`),
      redis.lrange(KEY_LIST, 0, 199),
    ])

    const counts = [c1 ?? 0, c2 ?? 0, c3 ?? 0, c4 ?? 0, c5 ?? 0]
    const total  = counts.reduce((a, b) => a + b, 0)
    const sum    = counts.reduce((a, b, i) => a + b * (i + 1), 0)
    const avg    = total > 0 ? Math.round((sum / total) * 10) / 10 : 0

    const list = (Array.isArray(rawList) ? rawList : []).map((s: unknown) => {
      if (typeof s === 'object' && s !== null) return s
      if (typeof s === 'string') { try { return JSON.parse(s) } catch {} }
      return { stars: 0, comment: null, ts: null, country: null }
    })

    return NextResponse.json({ counts, total, avg, list })
  } catch {
    return NextResponse.json({ error: 'Redis error' }, { status: 500 })
  }
}
