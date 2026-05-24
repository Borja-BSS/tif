/**
 * SLO counters stockés dans Redis.
 * Format clé : tif:metrics:{window}:{route}:{status}
 * Fenêtre : minute courante (rotation auto via TTL)
 */
import { redis } from '@/lib/redis'

type HttpStatus = '2xx' | '4xx' | '5xx'

const TTL_SECONDS = 60 * 60  // 1h de rétention par bucket

function windowKey(): string {
  // Bucket à la minute : "2026-05-24T21:14"
  return new Date().toISOString().slice(0, 16)
}

export async function incrementRequest(
  route:  string,
  status: HttpStatus,
  latencyMs: number,
): Promise<void> {
  const win = windowKey()
  const prefix = `tif:metrics:${win}:${route}`

  await Promise.all([
    redis.incr(`${prefix}:${status}`),
    redis.incr(`${prefix}:total`),
    // Somme des latences pour calculer la moyenne côté lecture
    redis.incrby(`${prefix}:latency_sum`, Math.round(latencyMs)),
    redis.expire(`${prefix}:${status}`, TTL_SECONDS),
    redis.expire(`${prefix}:total`,     TTL_SECONDS),
    redis.expire(`${prefix}:latency_sum`, TTL_SECONDS),
  ])
}

export interface RouteMetrics {
  route:      string
  window:     string
  total:      number
  errors:     number
  errorRate:  number   // 0–1
  avgLatency: number   // ms
}

export async function getMetrics(routes: string[]): Promise<RouteMetrics[]> {
  const win = windowKey()

  return Promise.all(
    routes.map(async route => {
      const prefix = `tif:metrics:${win}:${route}`

      const [total, errors5xx, errors4xx, latencySum] = await Promise.all([
        redis.get<number>(`${prefix}:total`)       ?? 0,
        redis.get<number>(`${prefix}:5xx`)         ?? 0,
        redis.get<number>(`${prefix}:4xx`)         ?? 0,
        redis.get<number>(`${prefix}:latency_sum`) ?? 0,
      ])

      const totalN     = Number(total)
      const errorsN    = Number(errors5xx) + Number(errors4xx)
      const latencyN   = Number(latencySum)

      return {
        route,
        window:     win,
        total:      totalN,
        errors:     errorsN,
        errorRate:  totalN > 0 ? errorsN / totalN : 0,
        avgLatency: totalN > 0 ? Math.round(latencyN / totalN) : 0,
      }
    }),
  )
}

/** SLO cibles pour les routes critiques */
export const SLO_TARGETS: Record<string, { errorRateMax: number; latencyP95Max: number }> = {
  '/api/v1/signals/mobility': { errorRateMax: 0.01, latencyP95Max: 500  },
  '/api/territory/zones':     { errorRateMax: 0.01, latencyP95Max: 1000 },
  '/api/health':              { errorRateMax: 0.001, latencyP95Max: 200 },
}
