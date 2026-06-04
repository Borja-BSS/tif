import { calculateCarRoute, getActiveIncidentAreas } from '@/lib/routing/car/here-router'
import { ratelimit } from '@/lib/redis'
import { z }         from 'zod'

const CarRouteSchema = z.object({
  from: z.object({ lat: z.number(), lng: z.number() }),
  to:   z.object({ lat: z.number(), lng: z.number() }),
  departureTime:  z.string().optional(),
  avoidIncidents: z.boolean().default(true),
})

export async function POST(req: Request) {
  try {
    const ip          = req.headers.get('x-forwarded-for') ?? 'anonymous'
    const { success } = await ratelimit.limit(`routing:${ip}`)
    if (!success) return Response.json({ error: 'RATE_LIMIT_EXCEEDED' }, { status: 429 })

    const body   = await req.json().catch(() => null)
    if (!body)   return Response.json({ error: 'INVALID_JSON' }, { status: 400 })

    const parsed = CarRouteSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 })
    }

    const { from, to, departureTime, avoidIncidents } = parsed.data

    // Get incident zones — fail silently if Redis unavailable
    const avoidAreas = avoidIncidents
      ? await getActiveIncidentAreas().catch(() => [])
      : []

    const routes = await calculateCarRoute({ from, to, departureTime, avoidAreas })

    return Response.json({
      success: true,
      routes,
      meta: {
        avoidedZones:   avoidAreas.length,
        trafficDataAge: 30,
        timestamp:      new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error('[routing/car] error:', err)
    return Response.json({ error: 'ROUTING_FAILED', routes: [] }, { status: 200 })
  }
}
