import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id || !/^[\w-]+$/.test(id)) return new NextResponse('Not found', { status: 404 })

  const data = await redis.get<{ base64: string; type: string }>(`tif:media:${id}`)
  if (!data) return new NextResponse('Not found', { status: 404 })

  const buffer = Buffer.from(data.base64, 'base64')
  return new NextResponse(buffer, {
    headers: {
      'Content-Type':  data.type,
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  })
}
