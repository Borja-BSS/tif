import { auth }        from '@/lib/auth'
import { NextRequest } from 'next/server'
import { db }          from '@/lib/db'
import { redis }       from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const journey = await db.userJourney.findUnique({ where: { id } })
  if (!journey || journey.userId !== session.user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  await db.userJourney.update({ where: { id }, data: { active: false } })
  await redis.del(`tif:journey:${session.user.id}:status`)

  return Response.json({ ok: true })
}
