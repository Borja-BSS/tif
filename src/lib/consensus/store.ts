import Ably from 'ably'
import { redis } from '@/lib/redis'
import { db }    from '@/lib/db'
import type { ZoneConsensus } from './types'
import type { TerritoryScore } from '@/lib/scoring/territory-score'

const KEY = (g: string) => `tif:consensus:${g}`

let _rest: Ably.Rest | null = null
function getAblyRest(): Ably.Rest {
  if (!_rest) _rest = new Ably.Rest({ key: process.env.ABLY_API_KEY! })
  return _rest
}

export async function getConsensus(geohash6: string): Promise<ZoneConsensus | null> {
  const cached = await redis.get(KEY(geohash6))
  if (!cached) return null
  return (typeof cached === 'string' ? JSON.parse(cached) : cached) as ZoneConsensus
}

export async function saveConsensus(
  consensus:     ZoneConsensus,
  prev:          ZoneConsensus | null,
  territoryScore?: TerritoryScore,
): Promise<{ broadcast: boolean }> {
  // Redis hot cache (TTL = consensus.ttl + 10s de marge)
  await redis.set(KEY(consensus.geohash6), JSON.stringify(consensus), {
    ex: consensus.ttl + 10,
  })

  // Snapshot Postgres pour historique 7 jours
  const datePartition = consensus.computedAt.toISOString().slice(0, 10)
  await db.zoneConsensusSnapshot.create({
    data: {
      geohash6:      consensus.geohash6,
      consensus:     consensus as object,
      computedAt:    consensus.computedAt,
      datePartition,
    },
  })

  // Broadcast Ably uniquement si consensus a changé (delta check)
  const changed = !prev
    || prev.realityStatus  !== consensus.realityStatus
    || prev.officialStatus !== consensus.officialStatus
    || prev.divergence     !== consensus.divergence

  if (changed) {
    try {
      const payload = territoryScore
        ? { ...consensus, territoryScore }
        : consensus
      await getAblyRest()
        .channels.get(`territory:${consensus.geohash6}`)
        .publish('consensus.updated', payload)
    } catch {
      // Broadcast non-bloquant — échec ignoré (pas de retry ici)
    }
  }

  return { broadcast: changed }
}

/** Broadcast batch pour les zones divergentes — priorité haute */
export async function broadcastDivergentBatch(zones: ZoneConsensus[]): Promise<void> {
  const rest = getAblyRest()
  await Promise.all(
    zones.map(z =>
      rest.channels.get(`territory:${z.geohash6}`).publish('consensus.updated', z).catch(() => null),
    ),
  )
}

export interface ZoneTerritorySnapshot {
  geohash6:  string
  score:     number
  level:     TerritoryScore['level']
  congestion: number
  divergence: boolean
  computedAt: string
}

/** Broadcast snapshot de toutes les zones actives vers le canal de carte */
export async function broadcastTerritorySnapshot(zones: ZoneTerritorySnapshot[]): Promise<void> {
  if (!zones.length) return
  try {
    await getAblyRest()
      .channels.get('tif:territory:snapshot')
      .publish('zones.updated', zones)
  } catch {
    // non-bloquant
  }
}
