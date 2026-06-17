import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

const KEY_PREFIX = 'tif:ratings:v1'
const KEY_LIST   = `${KEY_PREFIX}:list`
const MAX_LIST   = 500

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { stars, comment } = body as { stars?: unknown; comment?: unknown }

    const s = Number(stars)
    if (!Number.isInteger(s) || s < 1 || s > 5) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const text = typeof comment === 'string' ? comment.trim().slice(0, 500) : ''

    const pipeline = redis.pipeline()
    pipeline.incr(`${KEY_PREFIX}:count:${s}`)
    pipeline.lpush(KEY_LIST, JSON.stringify({
      stars: s,
      comment: text || null,
      ts:      Date.now(),
      country: req.headers.get('x-vercel-ip-country') ?? null,
    }))
    pipeline.ltrim(KEY_LIST, 0, MAX_LIST - 1)
    await pipeline.exec()

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
