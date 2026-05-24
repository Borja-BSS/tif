/**
 * Smoke test — vérifie que les endpoints critiques répondent correctement.
 * Usage : k6 run tests/k6/smoke.js -e BASE_URL=https://tif.vercel.app
 */
import http   from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate }  from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const TOKEN    = __ENV.AUTH_TOKEN || ''

const healthLatency   = new Trend('health_latency',   true)
const zonesLatency    = new Trend('zones_latency',    true)
const metricsLatency  = new Trend('metrics_latency',  true)
const errorRate       = new Rate('errors')

export const options = {
  vus:      1,
  duration: '30s',
  thresholds: {
    'health_latency':          ['p(95)<200'],
    'zones_latency':           ['p(95)<1000'],
    'http_req_failed':         ['rate<0.01'],
    'errors':                  ['rate<0.01'],
  },
}

const headers = {
  'Content-Type': 'application/json',
  ...(TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {}),
}

export default function () {
  // Health check
  const h = http.get(`${BASE_URL}/api/health`, { headers })
  healthLatency.add(h.timings.duration)
  errorRate.add(!check(h, {
    'health: status 200': r => r.status === 200,
    'health: ok':         r => JSON.parse(r.body).status === 'ok',
  }))

  sleep(0.5)

  // Territory zones
  const z = http.get(`${BASE_URL}/api/territory/zones`, { headers })
  zonesLatency.add(z.timings.duration)
  errorRate.add(!check(z, {
    'zones: status 200': r => r.status === 200,
    'zones: array':      r => Array.isArray(JSON.parse(r.body)),
  }))

  sleep(0.5)

  // Metrics SLO
  const m = http.get(`${BASE_URL}/api/metrics`, { headers })
  metricsLatency.add(m.timings.duration)
  errorRate.add(!check(m, {
    'metrics: status 200': r => r.status === 200,
    'metrics: has routes': r => Array.isArray(JSON.parse(r.body).routes),
  }))

  sleep(1)
}
