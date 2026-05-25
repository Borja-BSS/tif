import Ably            from 'ably'
import { cellToLatLng } from 'h3-js'
import { inngest } from '@/lib/inngest'
import { db }     from '@/lib/db'
import { detectZoneAnomalies }  from '@/lib/anomaly/detector'
import type { AnomalyDetectPayload, DetectedAnomaly } from '@/lib/anomaly/types'
import type { EventType, Severity }                  from '@prisma/client'

const BATCH = 50

const CRITICAL_CONFIDENCE = 0.75
const EVENT_TTL_HOURS     = 2

let _ably: Ably.Rest | null = null
function getAbly(): Ably.Rest {
  if (!_ably) _ably = new Ably.Rest({ key: process.env.ABLY_API_KEY! })
  return _ably
}

async function broadcastCritical(a: DetectedAnomaly): Promise<void> {
  const [lat, lng] = cellToLatLng(a.geohash6)
  try {
    await getAbly()
      .channels.get('tif:events:territorial')
      .publish('alert.critical', {
        geohash6:  a.geohash6,
        lat,
        lng,
        pattern:   a.pattern,
        severity:  a.severity,
        zScore:    a.zScore,
        detectedAt: a.detectedAt,
      })
  } catch {
    // non-bloquant
  }
}

function patternToEventType(pattern: DetectedAnomaly['pattern']): EventType {
  switch (pattern) {
    case 'MASS_ROUTE_CHANGE':      return 'TRAFFIC_INCIDENT'
    case 'SPEED_DROP_COLLECTIVE':  return 'TRAFFIC_INCIDENT'
    case 'DENSITY_SPIKE':          return 'TRAFFIC_INCIDENT'
    case 'DENSITY_VOID':           return 'UNKNOWN'
    case 'CONSENSUS_DIVERGENCE':   return 'TRAFFIC_INCIDENT'
  }
}

function patternToSeverity(pattern: DetectedAnomaly['pattern']): Severity {
  if (pattern === 'DENSITY_VOID') return 'MEDIUM'
  return 'HIGH'
}

function buildTitleFr(a: DetectedAnomaly): string {
  switch (a.pattern) {
    case 'SPEED_DROP_COLLECTIVE':
      return `Ralentissement collectif détecté (zone ${a.geohash6})`
    case 'DENSITY_SPIKE':
      return `Hausse inhabituelle de densité (zone ${a.geohash6})`
    case 'DENSITY_VOID':
      return `Évitement de zone détecté (zone ${a.geohash6})`
    case 'MASS_ROUTE_CHANGE':
      return `Changement massif d'itinéraire (zone ${a.geohash6})`
    case 'CONSENSUS_DIVERGENCE':
      return `Divergence officiel/réalité persistante (zone ${a.geohash6})`
  }
}

async function createTerritorialEvent(a: DetectedAnomaly): Promise<void> {
  const expiresAt = new Date(a.detectedAt.getTime() + EVENT_TTL_HOURS * 60 * 60 * 1000)

  await db.territorialEvent.create({
    data: {
      type:         patternToEventType(a.pattern),
      geohash:      a.geohash6,
      confidence:   CRITICAL_CONFIDENCE,
      sourceCount:  1,
      sourceWeights: { mobility: 1.0 },
      detectedAt:   a.detectedAt,
      expiresAt,
      titleFr:      buildTitleFr(a),
      severity:     patternToSeverity(a.pattern),
    },
  })
}

export const detectAnomaliesJob = inngest.createFunction(
  {
    id:       'detect-anomalies',
    name:     'Emergent Event Detector — déclenché par consensus',
    triggers: [{ event: 'tif/anomaly.detect' }],
  },
  async ({ event, step }) => {
    const payload  = event.data as AnomalyDetectPayload
    const now      = new Date(payload.timestamp)
    const { zones } = payload

    let totalAnomalies = 0
    let criticalCount  = 0

    for (let i = 0; i < zones.length; i += BATCH) {
      const batch = zones.slice(i, i + BATCH)

      // eslint-disable-next-line no-await-in-loop
      const batchResults = (await step.run(`detect-batch-${i}`, async () => {
        const all: DetectedAnomaly[] = []
        for (const zone of batch) {
          const found = await detectZoneAnomalies(
            zone.geohash6,
            zone.congestionScore,
            zone.deviceCount,
            now,
          )
          all.push(...found)
        }
        return all
      })) as unknown as DetectedAnomaly[]

      totalAnomalies += batchResults.length

      const critical = batchResults.filter(a => a.severity === 'CRITICAL')
      if (critical.length) {
        // eslint-disable-next-line no-await-in-loop
        await step.run(`create-events-${i}`, async () => {
          await Promise.all(
            critical.map(async a => {
              const norm = { ...a, detectedAt: new Date(a.detectedAt) }
              await createTerritorialEvent(norm)
              await broadcastCritical(norm)
            }),
          )
        })
        criticalCount += critical.length
      }
    }

    return { zones: zones.length, totalAnomalies, criticalCount }
  },
)
