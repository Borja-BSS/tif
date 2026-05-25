/**
 * One-shot: fetch SIG Genève traffic + generate simulated transport,
 * write to DB so the map shows data immediately.
 */
import { createRequire } from 'module'
import { latLngToCell } from 'h3-js'
import { createHmac } from 'crypto'

const require = createRequire(import.meta.url)

// Load env
const { config } = await import('dotenv')
config({ path: '.env.local' })

const { PrismaClient } = await import('@prisma/client')
const { PrismaPg }     = await import('@prisma/adapter-pg')
const pg               = await import('pg')

const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

const SIG_URL = 'https://ge.ch/sitg/rest/services/SITG/MapServer/1036/query?f=json&where=1%3D1&outFields=*&resultRecordCount=200'

console.log('Fetching SIG Genève...')
let features = []
try {
  const res = await fetch(SIG_URL, { signal: AbortSignal.timeout(10000) })
  const data = await res.json()
  features = data.features ?? []
  console.log(`Got ${features.length} features from SIG`)
} catch (e) {
  console.warn('SIG API unreachable, using simulated data only:', e.message)
}

const daily = new Date().toISOString().slice(0, 10)
const salt  = process.env.NEXTAUTH_SECRET ?? 'dev-salt'

// Process SIG features
const zones = new Map()

for (const f of features) {
  const lng = f.geometry?.x
  const lat = f.geometry?.y
  if (!lat || !lng || lat < 45.8 || lat > 46.6 || lng < 5.9 || lng > 6.4) continue

  const geohash6   = latLngToCell(lat, lng, 6)
  const speed      = f.attributes.VITESSE_MESUREE ?? 50
  const freeSpeed  = f.attributes.VITESSE_LIBRE   ?? 70
  const congestion = Math.max(0, Math.min(1, 1 - speed / freeSpeed))

  if (!zones.has(geohash6) || zones.get(geohash6) < congestion) {
    zones.set(geohash6, congestion)
  }
}

// If no SIG data, generate realistic simulated zones around Geneva
if (zones.size === 0) {
  console.log('Generating simulated traffic zones...')
  const center = [[46.2044, 6.1432], [46.1975, 6.1562], [46.2150, 6.1380],
                  [46.2080, 6.1200], [46.1850, 6.1450], [46.2300, 6.1500],
                  [46.2020, 6.1700], [46.1900, 6.1300], [46.2200, 6.1600],
                  [46.2100, 6.0900], [46.1750, 6.1650], [46.2400, 6.1350]]
  for (const [lat, lng] of center) {
    for (let i = 0; i < 4; i++) {
      const jlat = lat + (Math.random() - 0.5) * 0.02
      const jlng = lng + (Math.random() - 0.5) * 0.02
      const geohash6 = latLngToCell(jlat, jlng, 6)
      zones.set(geohash6, Math.random() * 0.8)
    }
  }
  console.log(`Generated ${zones.size} simulated zones`)
}

// Upsert TrafficZone
console.log(`Upserting ${zones.size} zones...`)
let count = 0
for (const [geohash6, congestion] of zones) {
  await db.trafficZone.upsert({
    where:  { geohash6 },
    update: { congestionScore: congestion, updatedAt: new Date() },
    create: { geohash6, congestionScore: congestion },
  })
  count++
}

console.log(`✓ ${count} traffic zones written to DB`)

// Also create a few test territorial events so /alerts shows data
console.log('Creating sample territorial events...')
const eventZones = [...zones.entries()].slice(0, 3)
for (const [geohash6, cong] of eventZones) {
  if (cong < 0.4) continue
  const severity = cong > 0.7 ? 'HIGH' : 'MEDIUM'
  await db.territorialEvent.create({
    data: {
      type:         'TRAFFIC_INCIDENT',
      geohash:      geohash6,
      confidence:   0.8,
      sourceCount:  2,
      sourceWeights: { sig: 0.7, mobility: 0.3 },
      severity,
      detectedAt:   new Date(),
      expiresAt:    new Date(Date.now() + 2 * 60 * 60 * 1000),
      titleFr:      `Congestion détectée (zone ${geohash6.slice(0,6)})`,
    },
  }).catch(() => {}) // ignore duplicates
}

await db.$disconnect()
await pool.end()
console.log('✓ Done')
