import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db }   from '@/lib/db'
import { z }    from 'zod'

const ConsentSchema = z.object({
  location:       z.boolean(),
  mobility:       z.boolean(),
  devicePresence: z.boolean(),
})

export async function GET(): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const consent = await db.mobilityConsent.findUnique({ where: { userId: session.user.id } })
  return NextResponse.json(consent ?? { location: false, mobility: false, devicePresence: false })
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json().catch(() => null)
  const parsed = ConsentSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 422 })

  const { location, mobility, devicePresence } = parsed.data

  const consent = await db.mobilityConsent.upsert({
    where:  { userId: session.user.id },
    update: { location, mobility, devicePresence, updatedAt: new Date() },
    create: {
      userId: session.user.id,
      location,
      mobility,
      devicePresence,
      consentedAt:    new Date(),
      consentVersion: '1.0',
    },
  })

  return NextResponse.json(consent)
}
