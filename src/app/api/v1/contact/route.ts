import { NextRequest }    from 'next/server'
import { Ratelimit }      from '@upstash/ratelimit'
import { z }              from 'zod'
import { redis }          from '@/lib/redis'
import { sendContactForm } from '@/lib/email'

const rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '15m') })

const ContactSchema = z.object({
  type:         z.enum(['contact', 'pro', 'audit', 'partner']),
  name:         z.string().min(2).max(100),
  email:        z.string().email(),
  subject:      z.string().max(200).optional(),
  message:      z.string().max(2000).optional(),
  organisation: z.string().max(200).optional(),
  fonction:     z.string().max(100).optional(),
  institution:  z.string().max(200).optional(),
  expertise:    z.string().max(2000).optional(),
})

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  try {
    const { success } = await rl.limit(`contact:${ip}`)
    if (!success) return Response.json({ error: 'Too many requests' }, { status: 429 })
  } catch { /* Redis indisponible — fail open */ }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ContactSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    await sendContactForm(parsed.data)
  } catch (err) {
    console.error('[contact POST] sendContactForm failed:', err)
    return Response.json({ error: 'Erreur envoi email' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
