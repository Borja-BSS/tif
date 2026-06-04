// Transport public routing via transport.opendata.ch (CFF/TPG/Léman Express)
// https://transport.opendata.ch — gratuit, pas de clé API
const OTD_BASE = 'https://transport.opendata.ch/v1'

export interface TransportRouteRequest {
  from: { lat: number; lng: number; name?: string }
  to:   { lat: number; lng: number; name?: string }
  departureTime?: string
}

export interface TransportLeg {
  type:          'walk' | 'tpg' | 'cff' | 'ceva' | 'other'
  line?:         string    // "46", "L4", "18"
  direction?:    string    // terminus
  from:          string    // nom arrêt départ
  to:            string    // nom arrêt arrivée
  departure:     string    // ISO 8601
  arrival:       string    // ISO 8601
  duration:      number    // secondes
  disrupted:     boolean
  delayMinutes:  number
  walkDistance?: number    // mètres si type=walk
}

export interface TransportRoute {
  id:      string
  legs:    TransportLeg[]
  summary: {
    duration:     number  // secondes
    walkDistance: number  // mètres total à pied
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
  const [fromName, toName] = await Promise.all([
    resolveStop(req.from),
    resolveStop(req.to),
  ])

  const url = new URL(`${OTD_BASE}/connections`)
  url.searchParams.set('from',  fromName)
  url.searchParams.set('to',    toName)
  url.searchParams.set('limit', '4')

  if (req.departureTime) {
    const d = new Date(req.departureTime)
    url.searchParams.set('date', d.toISOString().slice(0, 10))
    url.searchParams.set('time', d.toTimeString().slice(0, 5))
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
  if (!res.ok) return []

  const data = await res.json() as OtdResponse

  return (data.connections ?? []).map((conn, idx) => {
    const legs         = parseLegs(conn.sections ?? [])
    const totalWalk    = legs.filter(l => l.type === 'walk').reduce((s, l) => s + (l.walkDistance ?? 0), 0)
    const anyDisrupted = legs.some(l => l.disrupted)
    const durationSecs = parseDuration(conn.duration ?? '')

    return {
      id: `transport-${idx}`,
      legs,
      summary: {
        duration:     durationSecs,
        walkDistance: totalWalk,
        transfers:    conn.transfers ?? 0,
        departure:    conn.from?.departure ?? '',
        arrival:      conn.to?.arrival     ?? '',
        disrupted:    anyDisrupted,
      },
      alternative: idx > 0,
    }
  })
}

// ── Résolution d'arrêt ───────────────────────────────────────────────────────
// opendata.ch accepte directement "lat,lng" comme paramètre from/to
async function resolveStop(pos: { lat: number; lng: number; name?: string }): Promise<string> {
  return pos.name ?? `${pos.lat},${pos.lng}`
}

// ── Parsing des sections ──────────────────────────────────────────────────────
function parseLegs(sections: OtdSection[]): TransportLeg[] {
  return sections
    .filter(s => {
      // Ignorer les segments walk de durée 0 (transition entre arrêts adjacents)
      if (!s.journey) {
        const dur = s.walk?.duration ?? 0
        return dur > 30  // garder uniquement les marches > 30 secondes
      }
      return true
    })
    .map(s => {
      const j   = s.journey
      const dep = s.departure ?? {}
      const arr = s.arrival   ?? {}

      if (!j) {
        // Segment à pied
        const walkSec = s.walk?.duration ?? 0
        return {
          type:          'walk' as const,
          from:          dep.station?.name ?? '',
          to:            arr.station?.name ?? '',
          departure:     dep.departure ?? '',
          arrival:       arr.arrival   ?? '',
          duration:      walkSec,
          disrupted:     false,
          delayMinutes:  0,
          walkDistance:  Math.round(walkSec * 1.2),  // ~1.2 m/s vitesse marche
        }
      }

      // Ligne numéro = journey.number ("46", "L4", "S5") — PAS journey.name (ID interne)
      const lineNum   = j.number   ?? ''
      const category  = j.category ?? ''  // B=bus, R=train/tram, T=tram, S=S-Bahn
      const isCEVA    = lineNum.startsWith('L')   // Léman Express L1–L5
      const isCFF     = category === 'IC' || category === 'IR' || category === 'RE'
                     || category === 'S' || (category === 'R' && !isCEVA)
      const isTPG     = category === 'B' || category === 'T'

      const delayMin  = typeof dep.delay === 'number' ? dep.delay : 0

      return {
        type:         isCEVA ? 'ceva' : isCFF ? 'cff' : isTPG ? 'tpg' : 'other',
        line:         lineNum || undefined,
        direction:    j.to ?? undefined,
        from:         dep.station?.name ?? '',
        to:           arr.station?.name ?? '',
        departure:    dep.departure ?? '',
        arrival:      arr.arrival   ?? '',
        duration:     0,
        disrupted:    delayMin > 5,
        delayMinutes: Math.max(0, delayMin),
      }
    })
}

// ── Parseur durée "00d00:36:00" → secondes ───────────────────────────────────
function parseDuration(raw: string): number {
  const m = raw.match(/(?:\d+d)?(\d+):(\d+):(\d+)/)
  if (!m) return 0
  return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3])
}

// ── Types opendata.ch ─────────────────────────────────────────────────────────
interface OtdResponse {
  connections?: OtdConnection[]
}

interface OtdConnection {
  from?:      OtdEndpoint
  to?:        OtdEndpoint
  sections?:  OtdSection[]
  duration?:  string
  transfers?: number
}

interface OtdEndpoint {
  station?:   { name?: string }
  departure?: string
  arrival?:   string
}

interface OtdSection {
  journey?:   OtdJourney | null
  departure?: { station?: { name?: string }; departure?: string; delay?: number | null }
  arrival?:   { station?: { name?: string }; arrival?: string }
  walk?:      { duration?: number } | null
}

interface OtdJourney {
  name?:     string   // ID interne — ne pas utiliser pour l'affichage
  number?:   string   // numéro de ligne affiché ("46", "L4", "S5") ← utiliser celui-ci
  category?: string   // "B", "R", "T", "IC", "IR", "S"
  to?:       string   // terminus
}
