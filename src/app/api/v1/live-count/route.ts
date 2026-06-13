import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

const KEY = 'tif:live:sessions'
const TTL = 300 // 5 minutes

const CORS = {
  'Access-Control-Allow-Origin': 'https://borja-swiss-solutions.ch',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json().catch(() => ({}))
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS })
  }
  const now = Date.now()
  const cutoff = now - TTL * 1000
  await redis.zremrangebyscore(KEY, '-inf', cutoff)
  await redis.zadd(KEY, { score: now, member: sessionId.slice(0, 64) })
  const count = await redis.zcard(KEY)
  return NextResponse.json({ ok: true, count }, { headers: CORS })
}

export async function GET() {
  const cutoff = Date.now() - TTL * 1000
  await redis.zremrangebyscore(KEY, '-inf', cutoff)
  const count = await redis.zcard(KEY)
  return NextResponse.json({ ok: true, count }, { headers: CORS })
}
