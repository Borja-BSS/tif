import { auth }        from '@/lib/auth'
import { NextRequest } from 'next/server'
import { redis }       from '@/lib/redis'
import type { JourneyStatusResult } from '@/lib/my-journey/types'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await redis.get(`tif:journey:${session.user.id}:status`)
  if (!raw) return Response.json({ status: null })

  const result = (typeof raw === 'string' ? JSON.parse(raw) : raw) as JourneyStatusResult
  return Response.json(result, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
