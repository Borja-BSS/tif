import { NextRequest, NextResponse } from 'next/server'
import { z }                        from 'zod'
import { Ratelimit }                from '@upstash/ratelimit'
import { redis }                    from '@/lib/redis'

const rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1m') })

const SignalSchema = z.object({
  lat:    z.number().min(45.8).max(46.6),
  lng:    z.number().min(5.9).max(6.4),
  weight: z.number().min(0).max(1).default(0.5),
  type:   z.string().default('mobility'),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon'
  try {
    const { success } = await rl.limit(`signals:${ip}`)
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  } catch { /* fail-open */ }

  const body   = await req.json().catch(() => null)
  const parsed = SignalSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (!process.env.ABLY_API_KEY || process.env.ABLY_API_KEY === 'REMPLACER') {
    return NextResponse.json({ error: 'Ably not configured' }, { status: 503 })
  }

  // Import lazy — évite l'instanciation Ably au build
  const Ably    = (await import('ably')).default
  const client  = new Ably.Rest({ key: process.env.ABLY_API_KEY })
  const channel = client.channels.get('tif:signals:grand-geneve')
  await channel.publish('signal', parsed.data)

  return NextResponse.json({ ok: true })
}
