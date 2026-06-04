const OTD_BASE = 'https://transport.opendata.ch/v1'

export interface TransportRouteRequest {
  from: { lat: number; lng: number; name?: string }
  to:   { lat: number; lng: number; name?: string }
  departureTime?: string
}

export interface TransportLeg {
  type:          'walk' | 'tpg' | 'cff' | 'ceva' | 'other'
  line?:         string
  direction?:    string
  from:          string
  to:            string
  departure:     string
  arrival:       string
  duration:      number
  platform?:     string
  disrupted:     boolean
  delayMinutes:  number
  walkDistance?: number
}

export interface TransportRoute {
  id:      string
  legs:    TransportLeg[]
  summary: {
    duration:     number
    walkDistance: number
    transfers:    number
    departure:    string
    arrival:      string
    disrupted:    boolean
  }
  alternative: boolean
}

export async function calculateTransportRoute(
  req: TransportRouteRequest,
): Promise<TransportRoute[]> {
  const [fromStop, toStop] = await Promise.all([
    resolveStop(req.from),
    resolveStop(req.to),
  ])

  const url = new URL(`${OTD_BASE}/connections`)
  url.searchParams.set('from',      fromStop)
  url.searchParams.set('to',        toStop)
  url.searchParams.set('limit',     '4')
  url.searchParams.append('fields[]', 'connections/sections')
  url.searchParams.append('fields[]', 'connections/duration')
  url.searchParams.append('fields[]', 'connections/transfers')

  if (req.departureTime) {
    const d = new Date(req.departureTime)
    url.searchParams.set('date', d.toISOString().slice(0, 10))
    url.searchParams.set('time', d.toTimeString().slice(0, 5))
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
  if (!res.ok) return []

  const data = await res.json()

  return (data.connections ?? []).map((conn: Record<string, unknown>, idx: number) => {
    const legs         = parseConnectionLegs((conn.sections as Record<string, unknown>[]) ?? [])
    const totalWalk    = legs.filter(l => l.type === 'walk').reduce((s, l) => s + (l.walkDistance ?? 0), 0)
    const anyDisrupted = legs.some(l => l.disrupted)
    const durationStr  = String(conn.duration ?? '0d00:00:00')

    // parse "0d00:30:00" → seconds
    const durationSecs = parseDuration(durationStr)

    const from = conn.from as Record<string, unknown> | undefined
    const to   = conn.to   as Record<string, unknown> | undefined

    return {
      id: `transport-${idx}`,
      legs,
      summary: {
        duration:     durationSecs,
        walkDistance: totalWalk,
        transfers:    Number(conn.transfers ?? 0),
        departure:    String(from?.departure ?? ''),
        arrival:      String(to?.arrival     ?? ''),
        disrupted:    anyDisrupted,
      },
      alternative: idx > 0,
    }
  })
}

async function resolveStop(pos: { lat: number; lng: number; name?: string }): Promise<string> {
  if (pos.name) return pos.name

  const url = new URL(`${OTD_BASE}/locations`)
  url.searchParams.set('x',     pos.lng.toString())
  url.searchParams.set('y',     pos.lat.toString())
  url.searchParams.set('type',  'station')
  url.searchParams.set('limit', '1')

  try {
    const res  = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    return String(data.stations?.[0]?.name ?? `${pos.lat},${pos.lng}`)
  } catch {
    return `${pos.lat},${pos.lng}`
  }
}

function parseDuration(raw: string): number {
  // Format: "0d00:30:00" or "00:30:00"
  const match = raw.match(/(?:\d+d)?(\d+):(\d+):(\d+)/)
  if (!match) return 0
  return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3])
}

function parseConnectionLegs(sections: Record<string, unknown>[]): TransportLeg[] {
  return sections.map(section => {
    const journey    = section.journey as Record<string, unknown> | null | undefined
    const isWalk     = !journey
    const line       = String(journey?.name ?? '')
    const isCEVA     = line.startsWith('L')
    const isCFF      = line.startsWith('IC') || line.startsWith('IR') || line.startsWith('RE') || line.startsWith('S')
    const isTPG      = !isCEVA && !isCFF && line.length <= 2

    const departure  = section.departure as Record<string, unknown> | undefined
    const arrival    = section.arrival   as Record<string, unknown> | undefined
    const deptReal   = String(departure?.realtime  ?? '')
    const deptPlanned = String(departure?.departure ?? '')
    const delayMin   = deptReal && deptPlanned
      ? Math.round((new Date(deptReal).getTime() - new Date(deptPlanned).getTime()) / 60000)
      : 0

    const walk = section.walk as Record<string, unknown> | undefined

    return {
      type:         isWalk ? 'walk' : isCEVA ? 'ceva' : isCFF ? 'cff' : isTPG ? 'tpg' : 'other',
      line:         line || undefined,
      direction:    journey ? String(journey.to ?? '') || undefined : undefined,
      from:         String((departure?.station as Record<string, unknown>)?.name ?? ''),
      to:           String((arrival?.station   as Record<string, unknown>)?.name ?? ''),
      departure:    String(departure?.departure ?? ''),
      arrival:      String(arrival?.arrival     ?? ''),
      duration:     0,
      disrupted:    delayMin > 5,
      delayMinutes: Math.max(0, delayMin),
      walkDistance: isWalk ? Number(walk?.duration ?? 0) : undefined,
    }
  })
}
