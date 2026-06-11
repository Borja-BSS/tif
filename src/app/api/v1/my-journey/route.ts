import { NextRequest }                  from 'next/server'
import { redis }                         from '@/lib/redis'
import { Ratelimit }                     from '@upstash/ratelimit'
import { z }                             from 'zod'
import { sendJourneyConfirmation }       from '@/lib/email'
import { getFirebaseUserFromRequest }    from '@/lib/auth-firebase'

const rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1m') })

const CreateSchema = z.object({
  name:                z.string().min(1).max(100),
  fromLat:             z.number(),
  fromLng:             z.number(),
  fromLabel:           z.string().max(200),
  toLat:               z.number(),
  toLng:               z.number(),
  toLabel:             z.string().max(200),
  dayOfWeek:           z.array(z.number().int().min(0).max(6)).min(1),
  departureHour:       z.number().int().min(0).max(23),
  departureMinute:     z.number().int().min(0).max(59),
  flexMinutes:         z.number().int().min(0).max(60).optional().default(15),
  preferredMode:       z.enum(['car', 'transit', 'both']).optional().default('both'),
  notifyMinutesBefore: z.number().int().min(5).max(60).optional().default(15),
})

function journeyKey(uid: string) {
  return `tif:journey:fb:${uid}`
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const fbUser = await getFirebaseUserFromRequest(req)
  if (!fbUser) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await redis.get(journeyKey(fbUser.uid))
  const journeys = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : []
  return Response.json({ journeys })
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  try {
    const { success } = await rl.limit(ip)
    if (!success) return Response.json({ error: 'Too many requests' }, { status: 429 })
  } catch { /* Redis indisponible — fail open */ }

  const fbUser = await getFirebaseUserFromRequest(req)
  if (!fbUser) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const journey = {
    id:                  crypto.randomUUID(),
    userId:              fbUser.uid,
    name:                d.name,
    fromLat:             d.fromLat,
    fromLng:             d.fromLng,
    fromLabel:           d.fromLabel,
    toLat:               d.toLat,
    toLng:               d.toLng,
    toLabel:             d.toLabel,
    dayOfWeek:           d.dayOfWeek,
    departureHour:       d.departureHour,
    departureMinute:     d.departureMinute,
    flexMinutes:         d.flexMinutes,
    preferredMode:       d.preferredMode,
    notifyMinutesBefore: d.notifyMinutesBefore,
    emailNotify:         fbUser.email,
    active:              true,
    createdAt:           new Date().toISOString(),
  }

  // Persist (single journey per user — overwrite)
  await redis.set(journeyKey(fbUser.uid), JSON.stringify([journey]))

  // Confirmation email — fire and forget
  sendJourneyConfirmation({
    to:                  fbUser.email,
    journeyName:         journey.name,
    fromLabel:           d.fromLabel,
    toLabel:             d.toLabel,
    departureHour:       d.departureHour,
    departureMin:        d.departureMinute,
    dayOfWeek:           d.dayOfWeek,
    notifyMinutesBefore: d.notifyMinutesBefore,
    preferredMode:       d.preferredMode,
  }).catch(() => {})

  return Response.json({ journey }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const fbUser = await getFirebaseUserFromRequest(req)
  if (!fbUser) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await redis.del(journeyKey(fbUser.uid))
  await redis.del(`tif:journey:${fbUser.uid}:status`)

  return Response.json({ ok: true })
}
