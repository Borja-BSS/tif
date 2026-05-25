import { NextResponse }        from 'next/server'
import { cellToLatLng }        from 'h3-js'
import { db }                  from '@/lib/db'
import { withMetrics }         from '@/lib/route-utils'
import type { NextRequest }    from 'next/server'

export const dynamic = 'force-dynamic'

async function handler(_req: NextRequest): Promise<NextResponse> {
  const now = new Date()

  const events = await db.territorialEvent.findMany({
    where: {
      resolvedAt: null,
      expiresAt:  { gt: now },
    },
    orderBy: { detectedAt: 'desc' },
    take:    100,
    select: {
      id: true, type: true, geohash: true,
      severity: true, confidence: true,
      titleFr: true, detectedAt: true, expiresAt: true,
    },
  })

  const features = events.flatMap(e => {
    try {
      const [lat, lng] = cellToLatLng(e.geohash)
      return [{
        type:     'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [lng, lat] },
        properties: {
          id:          e.id,
          type:        e.type,
          severity:    e.severity,
          confidence:  e.confidence,
          title:       e.titleFr ?? e.type,
          detectedAt:  e.detectedAt.toISOString(),
          expiresAt:   e.expiresAt.toISOString(),
        },
      }]
    } catch {
      return []  // géohash invalide — ignoré
    }
  })

  return NextResponse.json({
    type:     'FeatureCollection',
    features,
  })
}

export const GET = withMetrics('/api/v1/territory/events', handler)
