/**
 * Load test — ingestion de signaux mobilité.
 * Simule la charge G7 : montée progressive jusqu'à 200 VUs (≈ 10k CCU estimés).
 * Usage : k6 run tests/k6/load-mobility.js -e BASE_URL=https://tif.vercel.app -e AUTH_TOKEN=xxx
 */
import http  from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate, Counter } from 'k6/metrics'

const BASE_URL  = __ENV.BASE_URL   || 'http://localhost:3000'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''

const ingestLatency  = new Trend('ingest_latency', true)
const ingestErrors   = new Rate('ingest_errors')
const signalsAccepted = new Counter('signals_accepted')

export const options = {
  stages: [
    { duration: '1m',  target: 10  },  // warm-up
    { duration: '3m',  target: 100 },  // montée en charge
    { duration: '5m',  target: 200 },  // pic G7
    { duration: '2m',  target: 200 },  // plateau
    { duration: '2m',  target: 0   },  // descente
  ],
  thresholds: {
    'ingest_latency':     ['p(95)<500', 'p(99)<1000'],
    'ingest_errors':      ['rate<0.01'],
    'http_req_failed':    ['rate<0.01'],
  },
}

// Géohashes Grand Genève — cellules H3 res6 représentatives
const GEOHASHES = [
  '8f194d6',  // Genève centre
  '8f194d4',  // Plainpalais
  '8f194f2',  // Carouge
  '8f19498',  // Lancy
  '8f1949a',  // Vernier
  '8f194b2',  // Meyrin
  '8f194b0',  // Cointrin
]

function randomGeohash() {
  return GEOHASHES[Math.floor(Math.random() * GEOHASHES.length)]
}

function randomSessionToken() {
  // 64 chars hex simulé
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

function buildBatch(size = 10) {
  return Array.from({ length: size }, () => ({
    geohash6:        randomGeohash(),
    speedBucket:     Math.floor(Math.random() * 6),
    direction:       Math.floor(Math.random() * 8),
    minuteTimestamp: Math.floor(Date.now() / 60_000) * 60_000,
    sessionToken:    randomSessionToken(),
  }))
}

export default function () {
  const payload = JSON.stringify(buildBatch(Math.floor(Math.random() * 10) + 1))

  const res = http.post(
    `${BASE_URL}/api/v1/signals/mobility`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {}),
      },
      timeout: '10s',
    },
  )

  ingestLatency.add(res.timings.duration)

  const ok = check(res, {
    'status 202':     r => r.status === 202,
    'accepted > 0':   r => {
      try { return JSON.parse(r.body).accepted >= 0 } catch { return false }
    },
  })

  ingestErrors.add(!ok)

  if (ok && res.status === 202) {
    try {
      const body = JSON.parse(res.body)
      if (body.accepted > 0) signalsAccepted.add(body.accepted)
    } catch { /* ignore */ }
  }

  // Simulation rythme réel : 1 batch toutes les 2–5 secondes par device
  sleep(2 + Math.random() * 3)
}
