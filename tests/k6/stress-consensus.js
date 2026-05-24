/**
 * Stress test — résistance au pic G7 sur les endpoints carte.
 * Simule N analystes qui rechargent la carte simultanément + monitoring.
 * Usage : k6 run tests/k6/stress-consensus.js -e BASE_URL=https://tif.vercel.app
 */
import http  from 'k6/http'
import { check, group, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

const BASE_URL   = __ENV.BASE_URL   || 'http://localhost:3000'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''

const zonesLatency   = new Trend('zones_latency',   true)
const healthLatency  = new Trend('health_latency',  true)
const metricsLatency = new Trend('metrics_latency', true)
const errorRate      = new Rate('errors')

export const options = {
  scenarios: {
    // Analystes qui rechargent la carte
    analysts: {
      executor:   'ramping-vus',
      stages: [
        { duration: '30s', target: 20  },
        { duration: '2m',  target: 50  },
        { duration: '3m',  target: 100 },
        { duration: '1m',  target: 0   },
      ],
      exec: 'analystLoad',
    },
    // Monitoring SLO continu
    monitoring: {
      executor: 'constant-vus',
      vus:      2,
      duration: '6m30s',
      exec:     'monitoringLoad',
    },
  },
  thresholds: {
    'zones_latency':          ['p(95)<1000', 'p(99)<2000'],
    'health_latency':         ['p(95)<200'],
    'http_req_failed':        ['rate<0.02'],
    'errors':                 ['rate<0.02'],
  },
}

const headers = {
  'Content-Type': 'application/json',
  ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {}),
}

export function analystLoad() {
  group('map load', () => {
    const z = http.get(`${BASE_URL}/api/territory/zones`, { headers })
    zonesLatency.add(z.timings.duration)
    errorRate.add(!check(z, {
      'zones 200': r => r.status === 200,
    }))
  })

  sleep(5 + Math.random() * 10)
}

export function monitoringLoad() {
  group('health', () => {
    const h = http.get(`${BASE_URL}/api/health`, { headers })
    healthLatency.add(h.timings.duration)
    errorRate.add(!check(h, { 'health 200': r => r.status === 200 }))
  })

  sleep(1)

  group('metrics', () => {
    const m = http.get(`${BASE_URL}/api/metrics`, { headers })
    metricsLatency.add(m.timings.duration)
    errorRate.add(!check(m, { 'metrics 200': r => r.status === 200 }))
  })

  sleep(14)  // monitoring toutes les 15s
}
