import { searchPlaces } from '@/lib/routing/shared/search-engine'
import { ratelimit }    from '@/lib/redis'
import { z }            from 'zod'

const QuerySchema = z.object({
  q: z.string().min(2).max(200),
})

export async function GET(req: Request) {
  try {
    const ip          = req.headers.get('x-forwarded-for') ?? 'anonymous'
    const { success } = await ratelimit.limit(`geocode:${ip}`)
    if (!success) return Response.json([], { status: 429 })

    const { searchParams } = new URL(req.url)
    const parsed = QuerySchema.safeParse({ q: searchParams.get('q') })
    if (!parsed.success) return Response.json([])

    const results = await searchPlaces(parsed.data.q)
    return Response.json(results)
  } catch (err) {
    console.error('[geocode] error:', err)
    return Response.json([], { status: 200 }) // Return empty array, never 500
  }
}
