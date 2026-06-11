import { NextRequest }                from 'next/server'
import { redis }                       from '@/lib/redis'
import { getFirebaseUserFromRequest }  from '@/lib/auth-firebase'
import type { JourneyStatusResult }    from '@/lib/my-journey/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const fbUser = await getFirebaseUserFromRequest(req)
  if (!fbUser) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await redis.get(`tif:journey:${fbUser.uid}:status`)
  if (!raw) return Response.json({ status: null })

  const result = (typeof raw === 'string' ? JSON.parse(raw) : raw) as JourneyStatusResult
  return Response.json(result, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
