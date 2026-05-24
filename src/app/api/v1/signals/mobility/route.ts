import { NextRequest, NextResponse } from 'next/server'
import { auth }            from '@/lib/auth'
import { redis }           from '@/lib/redis'
import { inngest }         from '@/lib/inngest'
import { Ratelimit }       from '@upstash/ratelimit'
import { cellInBbox }      from '@/lib/sdk/anonymize'
import { withMetrics }     from '@/lib/route-utils'
import { z }               from 'zod'

// Rate limit : 10 req/min par userId (spec Composant 3)
const rl = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1m'),
  prefix:  'tif:rl:mob',
})

const SignalSchema = z.object({
  geohash6:        z.string().min(5).max(20),
  speedBucket:     z.number().int().min(0).max(5),
  direction:       z.number().int().min(0).max(7),
  minuteTimestamp: z.number().int().positive(),
  sessionToken:    z.string().length(64),
})

const BatchSchema = z.array(SignalSchema).min(1).max(30)

async function handler(req: NextRequest): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const { success } = await rl.limit(session.user.id)
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
  }

  // ── Parse + Zod validation ────────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 422 })
  }

  // ── Bbox filter (drop silencieux si hors Grand Genève) ────────────────────
  const valid = parsed.data.filter(s => cellInBbox(s.geohash6))
  // Retourne 202 même si tout est filtré — ne pas révéler la logique de filtrage
  if (valid.length === 0) {
    return NextResponse.json({ accepted: 0 }, { status: 202 })
  }

  // ── Enqueue async — retour immédiat 202 ───────────────────────────────────
  await inngest.send({
    name: 'tif/signals.mobility',
    data: { signals: valid, userId: session.user.id },
  })

  return NextResponse.json({ accepted: valid.length }, { status: 202 })
}

export const POST = withMetrics('/api/v1/signals/mobility', handler)
