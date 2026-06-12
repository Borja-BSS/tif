import { NextRequest, NextResponse } from 'next/server'
import { redis }                    from '@/lib/redis'

export const dynamic = 'force-dynamic'

const ADMIN_KEY = process.env.TIF_ADMIN_API_KEY

// DELETE /api/v1/layers/alerts/flush — invalide le cache Redis pour forcer un refresh
export async function DELETE(req: NextRequest) {
  const key = req.headers.get('x-api-key')
  if (!ADMIN_KEY || !key || key !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await redis.del('tif:layer:alerts:merged')
    await redis.del('tif:tpg:disruptions')
    return NextResponse.json({ ok: true, flushed: ['tif:layer:alerts:merged', 'tif:tpg:disruptions'] })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
