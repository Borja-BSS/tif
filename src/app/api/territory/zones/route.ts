import { NextRequest, NextResponse } from 'next/server'
import { db }                    from '@/lib/db'
import { getConsensus }          from '@/lib/consensus/store'
import { computeTerritoryScore } from '@/lib/scoring/territory-score'
import { withMetrics }           from '@/lib/route-utils'

// Fenêtre de zones "actives" pour l'état initial de la carte
const ACTIVE_WINDOW_MS = 2 * 60 * 60 * 1000  // 2h

async function handler(_req: NextRequest) {
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS)

  const zones = await db.trafficZone.findMany({
    where:  { updatedAt: { gte: cutoff } },
    select: { geohash6: true, congestionScore: true },
  })

  if (!zones.length) return NextResponse.json([])

  const results = await Promise.all(
    zones.map(async zone => {
      // Priorité : consensus Redis (données fraîches) → fallback DB
      const consensus = await getConsensus(zone.geohash6)
      const cong      = consensus?.congestionScore ?? zone.congestionScore ?? 0
      const div       = consensus?.divergence ?? false
      const ts        = computeTerritoryScore(cong, div)

      return {
        geohash6:   zone.geohash6,
        score:      ts.score,
        level:      ts.level,
        congestion: cong,
        divergence: div,
        computedAt: (consensus?.computedAt ?? new Date()).toString(),
      }
    }),
  )

  return NextResponse.json(results.filter(z => z.level !== 'GREEN'))
}

export const GET = withMetrics('/api/territory/zones', handler)
