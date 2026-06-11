import { NextRequest }                from 'next/server'
import { redis }                       from '@/lib/redis'
import { getFirebaseUserFromRequest }  from '@/lib/auth-firebase'

export const dynamic = 'force-dynamic'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const fbUser = await getFirebaseUserFromRequest(req)
  if (!fbUser) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const key = `tif:journey:fb:${fbUser.uid}`
  const raw = await redis.get(key)
  if (!raw) return Response.json({ error: 'Not found' }, { status: 404 })

  const journeys = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Array<{ id: string }>
  const filtered = journeys.filter(j => j.id !== id)

  if (filtered.length === journeys.length) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (filtered.length === 0) {
    await redis.del(key)
  } else {
    await redis.set(key, JSON.stringify(filtered))
  }

  return Response.json({ ok: true })
}
