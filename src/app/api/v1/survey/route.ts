import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

const KEY_YES      = 'tif:survey:v1:yes'
const KEY_NO       = 'tif:survey:v1:no'
const KEY_FEEDBACK = 'tif:survey:v1:feedback'
const MAX_FEEDBACK = 500

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { vote, feedback } = body as { vote?: string; feedback?: string }

    if (vote !== 'yes' && vote !== 'no') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const pipeline = redis.pipeline()
    pipeline.incr(vote === 'yes' ? KEY_YES : KEY_NO)

    const text = typeof feedback === 'string' ? feedback.trim().slice(0, 500) : ''
    if (text) {
      pipeline.lpush(KEY_FEEDBACK, JSON.stringify({
        vote,
        text,
        ts: Date.now(),
        country: req.headers.get('x-vercel-ip-country') ?? null,
      }))
      pipeline.ltrim(KEY_FEEDBACK, 0, MAX_FEEDBACK - 1)
    }

    await pipeline.exec()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
