import { calculateTransportRoute } from '@/lib/routing/transport/transport-router'
import { ratelimit, redis }         from '@/lib/redis'
import { z }                         from 'zod'

const TransportRouteSchema = z.object({
  from: z.object({ lat: z.number(), lng: z.number(), name: z.string().optional() }),
  to:   z.object({ lat: z.number(), lng: z.number(), name: z.string().optional() }),
  departureTime: z.string().optional(),
})

export async function POST(req: Request) {
  const ip          = req.headers.get('x-forwarded-for') ?? 'anonymous'
  const { success } = await ratelimit.limit(`routing-transport:${ip}`)
  if (!success) return Response.json({ error: 'RATE_LIMIT_EXCEEDED' }, { status: 429 })

  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'INVALID_JSON' }, { status: 400 })

  const parsed = TransportRouteSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'INVALID_INPUT' }, { status: 400 })

  const cacheKey = `tif:routing:transport:${JSON.stringify(parsed.data)}`
  const cached   = await redis.get(cacheKey)
  if (cached) return Response.json({ success: true, routes: JSON.parse(cached as string) })

  const routes = await calculateTransportRoute(parsed.data)

  if (routes.length > 0) {
    await redis.setex(cacheKey, 120, JSON.stringify(routes))
  }

  return Response.json({ success: true, routes })
}
