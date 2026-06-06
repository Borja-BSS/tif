import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

interface StationEntry {
  number?:   string
  category?: string
  to?:       string
  stop?: { departure?: string | null; delay?: number | null }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)
  const stopName = searchParams.get('stopName')
  const line     = searchParams.get('line')

  if (!stopName || !line) return NextResponse.json({ departures: [] }, { status: 400 })

  try {
    // Resolve stop ID via locations API
    const locRes = await fetch(
      `https://transport.opendata.ch/v1/locations?query=${encodeURIComponent(stopName)}&type=station`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!locRes.ok) return NextResponse.json({ departures: [] })
    const locData = await locRes.json() as { stations?: { id?: string; name?: string }[] }
    const stopId = locData.stations?.[0]?.id
    const resolvedName = locData.stations?.[0]?.name ?? stopName
    if (!stopId) return NextResponse.json({ departures: [] })

    // Fetch stationboard
    const sbRes = await fetch(
      `https://transport.opendata.ch/v1/stationboard?id=${stopId}&limit=20&transportations[]=tram&transportations[]=bus`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (!sbRes.ok) return NextResponse.json({ departures: [] })
    const sbData = await sbRes.json() as { stationboard?: StationEntry[] }

    const departures = (sbData.stationboard ?? [])
      .filter(e => (e.number ?? e.category ?? '').trim() === line)
      .slice(0, 5)
      .map(e => ({
        time:      e.stop?.departure ?? null,
        direction: e.to ?? '—',
        delay:     e.stop?.delay ?? 0,
      }))

    return NextResponse.json({ stopName: resolvedName, departures }, {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    })
  } catch {
    return NextResponse.json({ departures: [] })
  }
}
