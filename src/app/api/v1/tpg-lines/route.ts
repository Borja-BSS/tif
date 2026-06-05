import { NextResponse } from 'next/server'
import { withMetrics }  from '@/lib/route-utils'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// Lignes TPG clés avec leurs arrêts de référence (IDs opendata.ch vérifiés)
const TPG_LINE_STOPS: { line: string; stopId: string; stopName: string }[] = [
  { line: '12', stopId: '8587057', stopName: 'Cornavin'    },
  { line: '14', stopId: '8587057', stopName: 'Cornavin'    },
  { line: '15', stopId: '8587057', stopName: 'Cornavin'    },
  { line: '18', stopId: '8587057', stopName: 'Cornavin'    },
  { line: '25', stopId: '8587057', stopName: 'Cornavin'    },
  { line: '6',  stopId: '8587387', stopName: 'Bel-Air'     },
  { line: '7',  stopId: '8587387', stopName: 'Bel-Air'     },
  { line: '36', stopId: '8587387', stopName: 'Bel-Air'     },
  { line: '1',  stopId: '8587061', stopName: 'Rive'        },
  { line: '2',  stopId: '8587061', stopName: 'Rive'        },
  { line: '5',  stopId: '8587061', stopName: 'Rive'        },
  { line: '9',  stopId: '8587907', stopName: 'Plainpalais' },
  { line: '10', stopId: '8587907', stopName: 'Plainpalais' },
  { line: '19', stopId: '8587907', stopName: 'Plainpalais' },
]

export interface TpgLineStatus {
  line:        string
  status:      'normal' | 'delayed' | 'disrupted'
  delayMin:    number
  direction:   string
  stopName:    string
  departure:   string | null  // ISO
}

interface StopEntry {
  number?:   string
  category?: string
  operator?: string
  to?:       string
  stop?: { delay?: number | null; departure?: string | null }
}

async function fetchLineStatus(stopId: string): Promise<StopEntry[]> {
  const url = `https://transport.opendata.ch/v1/stationboard?id=${stopId}&limit=30&transportations[]=tram&transportations[]=bus`
  const res = await fetch(url, { signal: AbortSignal.timeout(7000), cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json() as { stationboard?: StopEntry[] }
  return data.stationboard ?? []
}

async function handler(_req: NextRequest): Promise<NextResponse> {
  // Fetch the 4 key stops in parallel
  const stopIds = [...new Set(TPG_LINE_STOPS.map(l => l.stopId))]
  const results = await Promise.allSettled(stopIds.map(id => fetchLineStatus(id)))

  const byStop: Record<string, StopEntry[]> = {}
  stopIds.forEach((id, i) => {
    byStop[id] = results[i].status === 'fulfilled' ? results[i].value : []
  })

  // Build per-line status — toutes les lignes configurées, normal par défaut si non trouvée
  const lineMap = new Map<string, TpgLineStatus>()

  // Initialise toutes les lignes à "normal"
  for (const { line, stopName } of TPG_LINE_STOPS) {
    if (!lineMap.has(line)) {
      lineMap.set(line, { line, status: 'normal', delayMin: 0, direction: '—', stopName, departure: null })
    }
  }

  // Met à jour depuis les données stationboard (sans filtre opérateur strict)
  for (const { line, stopId, stopName } of TPG_LINE_STOPS) {
    if (lineMap.get(line)?.status !== 'normal') continue  // déjà mis à jour avec un retard

    const entries = byStop[stopId] ?? []
    const next = entries.find(e => (e.number ?? e.category ?? '').trim() === line)
    if (!next) continue

    const delay = next.stop?.delay ?? 0
    lineMap.set(line, {
      line,
      status:    delay >= 10 ? 'disrupted' : delay >= 3 ? 'delayed' : 'normal',
      delayMin:  delay,
      direction: next.to ?? '—',
      stopName,
      departure: next.stop?.departure ?? null,
    })
  }

  const lines = [...lineMap.values()]

  // Sort: disrupted → delayed → normal, then by line number
  lines.sort((a, b) => {
    const order = { disrupted: 0, delayed: 1, normal: 2 }
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    return Number(a.line) - Number(b.line)
  })

  return NextResponse.json({ lines, generatedAt: new Date().toISOString() }, {
    headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' },
  })
}

export const GET = withMetrics('/api/v1/tpg-lines', handler)
