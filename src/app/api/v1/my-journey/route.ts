import { auth }                    from '@/lib/auth'
import { NextRequest }             from 'next/server'
import { db }                      from '@/lib/db'
import { redis }                   from '@/lib/redis'
import { Ratelimit }               from '@upstash/ratelimit'
import { z }                       from 'zod'
import { sendJourneyConfirmation } from '@/lib/email'

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

const MODE_DB: Record<string, 'CAR' | 'TRANSIT' | 'BOTH'> = {
  car: 'CAR', transit: 'TRANSIT', both: 'BOTH',
}

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const journeys = await db.userJourney.findMany({
    where: { userId: session.user.id, active: true },
    orderBy: { createdAt: 'asc' },
  })

  return Response.json({ journeys })
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await rl.limit(ip)
  if (!success) return Response.json({ error: 'Too many requests' }, { status: 429 })

  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data

  // Email pour notifications : toujours depuis la session (pas de relay arbitraire)
  const emailNotify = session.user.email ?? undefined

  let journey
  try {
    journey = await db.userJourney.create({
      data: {
        userId:              session.user.id,
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
        preferredMode:       MODE_DB[d.preferredMode],
        notifyMinutesBefore: d.notifyMinutesBefore,
        emailNotify,
      },
    })
  } catch (err) {
    console.error('[my-journey POST] db.create failed:', err)
    return Response.json({ error: 'Erreur base de données' }, { status: 500 })
  }

  // Confirmation email — fire and forget
  if (emailNotify) {
    sendJourneyConfirmation({
      to:                  emailNotify,
      journeyName:         journey.name,
      fromLabel:           d.fromLabel,
      toLabel:             d.toLabel,
      departureHour:       d.departureHour,
      departureMin:        d.departureMinute,
      dayOfWeek:           d.dayOfWeek,
      notifyMinutesBefore: d.notifyMinutesBefore,
      preferredMode:       d.preferredMode,
    }).catch(() => {})
  }

  return Response.json({ journey }, { status: 201 })
}

// DELETE all journeys for the user (legacy — kept for compatibility)
export async function DELETE(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await db.userJourney.updateMany({
    where: { userId: session.user.id, active: true },
    data:  { active: false },
  })
  await redis.del(`tif:journey:${session.user.id}:status`)

  return Response.json({ ok: true })
}
