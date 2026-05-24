import { inngest } from '@/lib/inngest'
import { broadcastSignals } from './broadcast-signals'
import { latLngToCell } from 'h3-js'

// SBB GTFS-RT — Open Data Swiss (licence Open)
// Données véhicules en temps réel : positions des transports publics
const GTFS_RT_URL = 'https://api.opentransportdata.swiss/gtfs-rt/vehicleposition'

interface VehiclePosition {
  vehicle?: {
    position?: { latitude: number; longitude: number; speed?: number }
    trip?: { routeId?: string }
    vehicle?: { id?: string }
  }
}

interface GtfsrtFeed {
  entity?: VehiclePosition[]
}

export const ingestSbb = inngest.createFunction(
  {
    id:       'ingest-sbb-gtfs-rt',
    name:     'SBB GTFS-RT — transports 30s',
    triggers: [{ cron: '*/1 * * * *' }], // Inngest min = 1min; GTFS-RT rafraîchi toutes les 30s
  },
  async ({ step }) => {
    const apiKey = process.env.OPENTRANSPORT_API_KEY

    if (!apiKey) {
      // Sans clé : simule des signaux réalistes sur les axes principaux GE
      const simulated = generateSimulatedTransport()
      await step.run('broadcast-simulated', async () => {
        await broadcastSignals(simulated)
      })
      return { source: 'simulated', count: simulated.length }
    }

    const feed = await step.run('fetch-gtfs-rt', async () => {
      const res = await fetch(GTFS_RT_URL, {
        signal: AbortSignal.timeout(10000),
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
      })
      if (!res.ok) throw new Error(`GTFS-RT ${res.status}`)
      return res.json() as Promise<GtfsrtFeed>
    })

    const signals = await step.run('process-vehicles', async () => {
      return (feed.entity ?? []).flatMap((e) => {
        const pos = e.vehicle?.position
        if (!pos) return []
        const { latitude: lat, longitude: lng } = pos
        if (lat < 45.8 || lat > 46.6 || lng < 5.9 || lng > 6.4) return []

        const speed  = pos.speed ?? 40
        const weight = Math.min(1, speed / 80) // normalise vitesse → weight heatmap

        return [{ lat, lng, weight, type: 'transport' }]
      })
    })

    if (signals.length) {
      await step.run('broadcast-ably', async () => {
        await broadcastSignals(signals)
      })
    }

    return { source: 'gtfs-rt', count: signals.length }
  }
)

// ── Simulation réaliste Grand Genève ──────────────────────────
const TRANSPORT_AXES = [
  // Tram 12 : Annemasse ↔ Cornavin
  [46.1942, 6.2234], [46.2020, 6.2050], [46.2080, 6.1900], [46.2180, 6.1420],
  // Tram 15 : Palettes ↔ Nations
  [46.1750, 6.1100], [46.1900, 6.1300], [46.2100, 6.1500], [46.2300, 6.1450],
  // Bus 10 : Rive ↔ Aéroport
  [46.2010, 6.1510], [46.2200, 6.1100], [46.2380, 6.1090],
  // Léman Express axe Cornavin
  [46.2180, 6.1420], [46.2050, 6.1300], [46.1870, 6.1150],
]

function generateSimulatedTransport() {
  return TRANSPORT_AXES.map(([baseLat, baseLng]) => ({
    lat:    baseLat + (Math.random() - 0.5) * 0.005,
    lng:    baseLng + (Math.random() - 0.5) * 0.005,
    weight: 0.3 + Math.random() * 0.5,
    type:   'transport',
  }))
}
