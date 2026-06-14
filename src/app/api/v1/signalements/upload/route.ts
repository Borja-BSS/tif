import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

const MAX_SIZE    = 8 * 1024 * 1024 // 8 MB
const ALLOWED     = new Set(['image/jpeg','image/png','image/webp','image/gif','image/heic','video/mp4','video/quicktime','video/webm'])
const TTL_SECONDS = 60 * 60 * 24 * 30 // 30 jours

export async function POST(req: NextRequest) {
  let formData: FormData
  try { formData = await req.formData() }
  catch { return NextResponse.json({ error: 'Requête invalide' }, { status: 400 }) }

  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (file.size > MAX_SIZE)    return NextResponse.json({ error: 'Fichier trop grand (max 8 Mo)' }, { status: 413 })
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'Type non supporté' }, { status: 415 })

  const bytes  = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const id     = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  await redis.set(`tif:media:${id}`, { base64, type: file.type }, { ex: TTL_SECONDS })

  return NextResponse.json({ url: `/api/v1/media/${id}` }, { status: 201 })
}
