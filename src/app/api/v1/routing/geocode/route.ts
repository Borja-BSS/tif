import { searchPlaces } from '@/lib/routing/shared/search-engine'
import { ratelimit }    from '@/lib/redis'
import { z }            from 'zod'

const QuerySchema = z.object({
  q: z.string().min(2).max(200),
})

export async function GET(req: Request) {
  const startMs = Date.now()
  try {
    const ip          = req.headers.get('x-forwarded-for') ?? 'anonymous'
    const { success } = await ratelimit.limit(`geocode:${ip}`)
    if (!success) return Response.json([], { status: 429 })

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''
    const parsed = QuerySchema.safeParse({ q })
    if (!parsed.success) return Response.json([])

    console.log(`[geocode] query="${parsed.data.q}"`)
    const results = await searchPlaces(parsed.data.q)
    console.log(`[geocode] query="${parsed.data.q}" → ${results.length} results in ${Date.now()-startMs}ms`)
    return Response.json(results)
  } catch (err) {
    console.error('[geocode] CAUGHT ERROR:', String(err), err instanceof Error ? err.cause : '')
    return Response.json([], { status: 200 })
  }
}
