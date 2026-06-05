# TIF Redesign Elite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre complètement l'UX de tif.borja-swiss-solutions.ch — architecture 7 layers, Mon Trajet prédictif, features exclusives, infrastructure 500K concurrent.

**Architecture:** Infomaniak Jelastic (Next.js Docker auto-scale) + Cloudflare (CDN/WAF) + Ably (real-time) + Redis SWR cache + PostgreSQL avec read replica. Le dashboard est servi depuis le cache Cloudflare edge en < 5ms perçus grâce au pattern stale-while-revalidate.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind v4, Prisma 7, @upstash/redis, @upstash/ratelimit, Ably v2, Inngest v4, vitest, Zod v4, zustand v5.

---

## Fichiers créés / modifiés

### Créés
```
prisma/migrations/TIMESTAMP_add_user_journey/migration.sql
src/lib/my-journey/types.ts
src/lib/my-journey/predictor.ts
src/lib/my-journey/predictor.test.ts
src/lib/features/border-prediction.ts
src/lib/features/border-prediction.test.ts
src/lib/features/domino-detector.ts
src/lib/features/domino-detector.test.ts
src/lib/animations/springs.ts
src/lib/notifications/push.ts
src/inngest/predict-journeys.ts
src/app/api/v1/dashboard/route.ts
src/app/api/v1/my-journey/route.ts
src/app/api/v1/my-journey/status/route.ts
src/components/map/ui/SearchBar.tsx
src/components/map/ui/QuickFilters.tsx
src/components/map/ui/FloatingControls.tsx
src/components/map/ui/BottomSheet.tsx
src/components/map/ui/SmartAlert.tsx
src/components/my-journey/JourneySetup.tsx
src/components/my-journey/JourneyCard.tsx
src/components/map/widgets/BorderPredictionWidget.tsx
src/components/map/modes/G7Mode.tsx
src/components/accessibility/VoiceStatus.tsx
public/sw.js
```

### Modifiés
```
prisma/schema.prisma              ← +UserJourney +PushSubscription
src/app/globals.css               ← keyframes animations
middleware.ts                     ← HSTS + Permissions-Policy
src/app/(dashboard)/map/page.tsx  ← architecture 7 layers
src/lib/realtime.ts               ← +CHANNELS.journey
```

### Intouchables
```
src/app/api/v1/routing/*     src/app/api/v1/layers/*
src/app/api/v1/signals/*     src/lib/territory/*
src/lib/transport/*          src/lib/waze/*
src/lib/consensus/*          src/lib/scoring/*
src/inngest/compute-consensus.ts  (et tous les inngest existants)
```

---

## Phase 1 — Foundation

### Task 1: Migration Prisma — UserJourney + PushSubscription

**Files:**
- Modify: `prisma/schema.prisma`
- Run: `npx prisma migrate dev`

- [ ] **Ajouter les modèles dans `prisma/schema.prisma`** après le modèle `MobilityConsent` :

```prisma
model UserJourney {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  name      String @db.VarChar(100)
  fromLat   Float
  fromLng   Float
  fromLabel String @db.VarChar(200)
  toLat     Float
  toLng     Float
  toLabel   String @db.VarChar(200)

  dayOfWeek       Int[]
  departureHour   Int
  departureMinute Int
  flexMinutes     Int   @default(15)

  preferredMode       String @default("both")
  notifyMinutesBefore Int    @default(15)

  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  pushSubscriptions PushSubscription[]

  @@index([userId])
  @@index([active])
}

model PushSubscription {
  id       String @id @default(cuid())
  userId   String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  endpoint String @db.Text
  p256dh   String @db.Text
  auth     String @db.Text

  createdAt DateTime @default(now()) @db.Timestamptz
  lastUsed  DateTime @updatedAt @db.Timestamptz

  @@unique([userId, endpoint])
  @@index([userId])
}
```

- [ ] **Ajouter la relation inverse sur User** (chercher `mobilityConsent MobilityConsent?` et ajouter après) :

```prisma
  journeys          UserJourney[]
  pushSubscriptions PushSubscription[]
```

- [ ] **Lancer la migration**

```bash
cd "/Users/lostropicos/G7 live view/tif"
npx prisma migrate dev --name add_user_journey
```

Résultat attendu : `✓ Generated Prisma Client`

- [ ] **Vérifier la génération du client**

```bash
npx prisma generate
```

- [ ] **Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add UserJourney + PushSubscription models"
```

---

### Task 2: Types Mon Trajet

**Files:**
- Create: `src/lib/my-journey/types.ts`

- [ ] **Créer `src/lib/my-journey/types.ts`**

```typescript
export interface UserJourneyData {
  id: string
  userId: string
  name: string
  from: { lat: number; lng: number; label: string }
  to:   { lat: number; lng: number; label: string }
  schedule: {
    dayOfWeek:       number[]
    departureHour:   number
    departureMinute: number
    flexMinutes:     number
  }
  preferredMode:       'car' | 'transit' | 'both'
  notifyMinutesBefore: number
  active: boolean
}

export type JourneyStatus = 'normal' | 'delayed' | 'disrupted'

export interface JourneyStatusResult {
  journeyId:    string
  evaluatedAt:  string   // ISO string
  status:       JourneyStatus
  confidence:   number   // 0–1
  headline:     string
  detail:       string
  delayMinutes: number
  alternative?: {
    mode:        'car' | 'transit'
    description: string
    timeSaved:   number   // minutes gagnées
    departureIn: number   // minutes avant de partir
  }
  newArrivalTime?: string // ISO string
}

export interface CreateJourneyInput {
  name:               string
  fromLat:            number
  fromLng:            number
  fromLabel:          string
  toLat:              number
  toLng:              number
  toLabel:            string
  dayOfWeek:          number[]
  departureHour:      number
  departureMinute:    number
  flexMinutes?:       number
  preferredMode?:     'car' | 'transit' | 'both'
  notifyMinutesBefore?: number
}
```

- [ ] **Commit**

```bash
git add src/lib/my-journey/types.ts
git commit -m "feat(my-journey): types UserJourneyData + JourneyStatusResult"
```

---

### Task 3: Predictor — calculateImpactScore (TDD)

**Files:**
- Create: `src/lib/my-journey/predictor.ts`
- Create: `src/lib/my-journey/predictor.test.ts`

- [ ] **Écrire le test en premier** — `src/lib/my-journey/predictor.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { calculateImpactScore, minutesUntilDeparture, buildHeadline } from './predictor'
import type { UserJourneyData } from './types'

const baseJourney: UserJourneyData = {
  id: 'j1', userId: 'u1', name: 'Test',
  from: { lat: 46.2, lng: 6.1, label: 'Domicile' },
  to:   { lat: 46.3, lng: 6.2, label: 'Travail'  },
  schedule: { dayOfWeek: [1,2,3,4,5], departureHour: 7, departureMinute: 45, flexMinutes: 15 },
  preferredMode: 'both',
  notifyMinutesBefore: 15,
  active: true,
}

describe('calculateImpactScore', () => {
  it('0 incidents, 0 congestion → score < 0.3', () => {
    const score = calculateImpactScore(0, 0, 0)
    expect(score).toBeLessThan(0.3)
  })

  it('max congestion + divergence → score > 0.7', () => {
    const score = calculateImpactScore(1, 1, 5)
    expect(score).toBeGreaterThan(0.7)
  })

  it('moderate congestion → 0.3–0.6', () => {
    const score = calculateImpactScore(0.5, 0, 0)
    expect(score).toBeGreaterThanOrEqual(0.3)
    expect(score).toBeLessThan(0.6)
  })
})

describe('minutesUntilDeparture', () => {
  it('departure in 30min → returns ~30', () => {
    const j = { ...baseJourney }
    const now = new Date()
    j.schedule = {
      ...j.schedule,
      dayOfWeek: [now.getDay()],
      departureHour:   (now.getHours() + Math.floor((now.getMinutes() + 30) / 60)) % 24,
      departureMinute: (now.getMinutes() + 30) % 60,
    }
    const result = minutesUntilDeparture(j, now)
    expect(Math.abs(result - 30)).toBeLessThan(2)
  })
})

describe('buildHeadline', () => {
  it('normal → partez à heure', () => {
    const h = buildHeadline('normal', 30, 0, 7, 45)
    expect(h).toContain('7h45')
  })

  it('disrupted → mentionne perturbé', () => {
    const h = buildHeadline('disrupted', 20, 12, 7, 45)
    expect(h.toLowerCase()).toContain('perturb')
  })
})
```

- [ ] **Vérifier que le test échoue**

```bash
cd "/Users/lostropicos/G7 live view/tif"
npx vitest run src/lib/my-journey/predictor.test.ts
```

Résultat attendu : FAIL (module non trouvé)

- [ ] **Créer `src/lib/my-journey/predictor.ts`**

```typescript
import type { UserJourneyData, JourneyStatus } from './types'

// ── Calcul du score d'impact global 0.0–1.0 ──────────────────────────────────
// congestionScore : 0–1 (depuis TrafficZone.congestionScore)
// incidentCount   : nombre d'incidents actifs sur le trajet
// maxZScore       : anomalie z-score max sur le trajet (depuis EWMA)
export function calculateImpactScore(
  congestionScore: number,
  incidentCount:   number,
  maxZScore:       number,
): number {
  const congestionPart = congestionScore * 0.5
  const incidentPart   = Math.min(incidentCount / 3, 1) * 0.35
  const anomalyPart    = Math.min(maxZScore / 5, 1) * 0.15
  return Math.min(congestionPart + incidentPart + anomalyPart, 1)
}

// ── Minutes jusqu'au prochain départ habituel ─────────────────────────────────
export function minutesUntilDeparture(journey: UserJourneyData, now: Date): number {
  const dayOfWeek = now.getDay()
  if (!journey.schedule.dayOfWeek.includes(dayOfWeek)) return Infinity

  const deptMs = new Date(now).setHours(
    journey.schedule.departureHour,
    journey.schedule.departureMinute,
    0, 0,
  )
  return (deptMs - now.getTime()) / 60000
}

// ── Message headline utilisateur ──────────────────────────────────────────────
export function buildHeadline(
  status:  JourneyStatus,
  deptIn:  number,
  delay:   number,
  hour:    number,
  minute:  number,
): string {
  const t = `${hour}h${minute.toString().padStart(2, '0')}`
  if (status === 'normal')    return `Trajet normal · Partez à ${t}`
  if (status === 'delayed')   return `Léger retard · +${delay} min estimées`
  return `Trajet perturbé · Partez dans ${Math.max(0, deptIn - 5)} min`
}

// ── Status depuis impact score ────────────────────────────────────────────────
export function scoreToStatus(score: number): JourneyStatus {
  if (score >= 0.6) return 'disrupted'
  if (score >= 0.3) return 'delayed'
  return 'normal'
}
```

- [ ] **Vérifier que le test passe**

```bash
npx vitest run src/lib/my-journey/predictor.test.ts
```

Résultat attendu : ✓ 7 tests passed

- [ ] **Commit**

```bash
git add src/lib/my-journey/
git commit -m "feat(my-journey): predictor — calculateImpactScore, minutesUntilDeparture, buildHeadline"
```

---

### Task 4: Inngest — predict-journeys cron

**Files:**
- Create: `src/inngest/predict-journeys.ts`

- [ ] **Créer `src/inngest/predict-journeys.ts`** (suivre le même pattern que `compute-consensus.ts`)

```typescript
import { inngest }   from '@/lib/inngest'
import { db }        from '@/lib/db'
import { redis }     from '@/lib/redis'
import Ably          from 'ably'
import {
  calculateImpactScore,
  minutesUntilDeparture,
  buildHeadline,
  scoreToStatus,
} from '@/lib/my-journey/predictor'
import type { UserJourneyData, JourneyStatusResult } from '@/lib/my-journey/types'

let _ably: Ably.Rest | null = null
function getAbly(): Ably.Rest {
  if (!_ably) _ably = new Ably.Rest({ key: process.env.ABLY_API_KEY! })
  return _ably
}

export const predictJourneysJob = inngest.createFunction(
  {
    id:       'predict-journeys',
    name:     'Mon Trajet — prédiction toutes les 5 min',
    triggers: [{ cron: '*/5 * * * *' }],
  },
  async ({ step }) => {
    const now = new Date()

    // 1. Charger les trajets actifs
    const journeys = await step.run('fetch-active-journeys', async () => {
      return db.userJourney.findMany({
        where: { active: true },
        include: { user: { select: { id: true } } },
      })
    })

    // 2. Filtrer ceux dans la fenêtre ±60min
    const toEvaluate = journeys.filter(j => {
      const jd: UserJourneyData = {
        id: j.id, userId: j.userId, name: j.name,
        from: { lat: j.fromLat, lng: j.fromLng, label: j.fromLabel },
        to:   { lat: j.toLat,   lng: j.toLng,   label: j.toLabel   },
        schedule: {
          dayOfWeek: j.dayOfWeek, departureHour: j.departureHour,
          departureMinute: j.departureMinute, flexMinutes: j.flexMinutes,
        },
        preferredMode: j.preferredMode as 'car' | 'transit' | 'both',
        notifyMinutesBefore: j.notifyMinutesBefore,
        active: j.active,
      }
      const deptIn = minutesUntilDeparture(jd, now)
      return deptIn > -10 && deptIn <= 60
    })

    // 3. Évaluer chaque trajet
    for (const journey of toEvaluate) {
      await step.run(`evaluate-${journey.id}`, async () => {
        // Récupérer le score de congestion depuis TrafficZone
        // (zones proches du trajet — approximation: zone de départ)
        const geohash6 = await getApproxGeohash(journey.fromLat, journey.fromLng)
        const zone = await db.trafficZone.findUnique({ where: { geohash6 } })

        const congestion = zone?.congestionScore ?? 0
        const incidents  = await db.territorialEvent.count({
          where: { resolvedAt: null, expiresAt: { gt: now }, confidence: { gt: 0.5 } },
        })

        const impactScore  = calculateImpactScore(congestion, incidents, 0)
        const status       = scoreToStatus(impactScore)
        const delayMinutes = Math.round(impactScore * 25)
        const deptIn       = minutesUntilDeparture({
          ...journey,
          from: { lat: journey.fromLat, lng: journey.fromLng, label: journey.fromLabel },
          to:   { lat: journey.toLat,   lng: journey.toLng,   label: journey.toLabel   },
          schedule: {
            dayOfWeek: journey.dayOfWeek, departureHour: journey.departureHour,
            departureMinute: journey.departureMinute, flexMinutes: journey.flexMinutes,
          },
          preferredMode: journey.preferredMode as 'car' | 'transit' | 'both',
          notifyMinutesBefore: journey.notifyMinutesBefore,
        } as UserJourneyData, now)

        const result: JourneyStatusResult = {
          journeyId:    journey.id,
          evaluatedAt:  now.toISOString(),
          status,
          confidence:   0.75,
          headline:     buildHeadline(status, deptIn, delayMinutes, journey.departureHour, journey.departureMinute),
          detail:       incidents > 0 ? `${incidents} incident(s) actif(s) sur le trajet` : '',
          delayMinutes,
          newArrivalTime: delayMinutes > 0
            ? new Date(Date.now() + delayMinutes * 60000).toISOString()
            : undefined,
        }

        // Cache Redis 5min
        const prevRaw = await redis.get(`tif:journey:${journey.userId}:status`)
        await redis.set(`tif:journey:${journey.userId}:status`, JSON.stringify(result), { ex: 300 })

        // Broadcast Ably si statut changé
        const prev = prevRaw
          ? (typeof prevRaw === 'string' ? JSON.parse(prevRaw) : prevRaw) as JourneyStatusResult
          : null
        if (!prev || prev.status !== status) {
          try {
            await getAbly().channels.get(`tif:journey:${journey.userId}`).publish('status', result)
          } catch { /* circuit breaker: continuer si Ably indisponible */ }
        }
      })
    }

    return { evaluated: toEvaluate.length, total: journeys.length }
  },
)

async function getApproxGeohash(lat: number, lng: number): Promise<string> {
  const { encode } = await import('ngeohash')
  return encode(lat, lng, 6)
}
```

- [ ] **Enregistrer la fonction dans `src/app/api/inngest/route.ts`** — vérifier que le fichier importe et exporte le nouveau job :

```bash
cat "/Users/lostropicos/G7 live view/tif/src/app/api/inngest/route.ts"
```

Ajouter `predictJourneysJob` dans la liste des fonctions si elle n'y est pas déjà.

- [ ] **TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Résultat attendu : 0 erreur (ou corriger les erreurs avant de continuer).

- [ ] **Commit**

```bash
git add src/inngest/predict-journeys.ts src/app/api/inngest/route.ts
git commit -m "feat(inngest): predict-journeys cron — évalue trajets actifs toutes les 5min"
```

---

### Task 5: API Dashboard — endpoint central

**Files:**
- Create: `src/app/api/v1/dashboard/route.ts`

- [ ] **Créer `src/app/api/v1/dashboard/route.ts`**

```typescript
import { getServerSession }  from 'next-auth'
import { db }                from '@/lib/db'
import { redis }             from '@/lib/redis'
import { Ratelimit }         from '@upstash/ratelimit'
import { NextRequest }       from 'next/server'
import type { JourneyStatusResult } from '@/lib/my-journey/types'

const rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1m') })

function eventTypeToIcon(type: string): string {
  const map: Record<string, string> = {
    TRAFFIC_INCIDENT: '🚦', ROAD_CLOSURE: '🚫', BORDER_CONGESTION: '🛂',
    PUBLIC_TRANSPORT_DISRUPTION: '🚌', DEMONSTRATION: '📢', CONSTRUCTION: '🚧',
    EMERGENCY: '🚨', PLANNED_EVENT: '🏛️', WEATHER_IMPACT: '⛈️',
  }
  return map[type] ?? '⚠️'
}

function timeAgo(date: Date): string {
  const m = Math.floor((Date.now() - date.getTime()) / 60000)
  if (m < 1)  return "À l'instant"
  if (m < 60) return `Il y a ${m} min`
  return `Il y a ${Math.floor(m / 60)}h`
}

export async function GET(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await rl.limit(ip)
  if (!success) return Response.json({ error: 'Too many requests' }, { status: 429 })

  // Cache Redis 30s (partagé tous utilisateurs non-connectés)
  const cacheKey = 'tif:dashboard:global'
  const session  = await getServerSession()

  // Journey status — spécifique à l'utilisateur si connecté
  let myJourney: JourneyStatusResult | undefined
  if (session?.user) {
    const raw = await redis.get(`tif:journey:${(session.user as { id?: string }).id}:status`)
    if (raw) myJourney = (typeof raw === 'string' ? JSON.parse(raw) : raw) as JourneyStatusResult
  }

  // Données globales depuis cache ou DB
  const cached = await redis.get(cacheKey)
  let globalData: Record<string, unknown>

  if (cached) {
    globalData = (typeof cached === 'string' ? JSON.parse(cached) : cached) as Record<string, unknown>
  } else {
    const now = new Date()
    const alerts = await db.territorialEvent.findMany({
      where: { resolvedAt: null, expiresAt: { gt: now } },
      orderBy: { detectedAt: 'desc' },
      take: 10,
      select: { id: true, titleFr: true, severity: true, detectedAt: true, type: true },
    })

    const [tpgStatus, cffStatus, cevaStatus, activeZonesRaw] = await Promise.all([
      redis.get('tif:network:tpg:status'),
      redis.get('tif:network:cff:status'),
      redis.get('tif:network:ceva:status'),
      redis.get('tif:active-zones-count'),
    ])

    globalData = {
      alerts: alerts.map(a => ({
        id: a.id, icon: eventTypeToIcon(a.type), title: a.titleFr,
        severity: a.severity, timeAgo: timeAgo(a.detectedAt),
      })),
      network: {
        tpg:  (tpgStatus  as string) ?? 'normal',
        cff:  (cffStatus  as string) ?? 'normal',
        ceva: (cevaStatus as string) ?? 'normal',
      },
      globalStatus: alerts.length === 0 ? 'calm'
        : alerts.some(a => a.severity === 'CRITICAL') ? 'critical'
        : 'active',
      activeZones:  parseInt((activeZonesRaw as string) ?? '4'),
      lastUpdated:  now.toISOString(),
    }

    await redis.set(cacheKey, JSON.stringify(globalData), { ex: 30 })
  }

  const response = Response.json({ ...globalData, myJourney })

  // Cloudflare edge cache + SWR
  response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=30')
  return response
}
```

- [ ] **Tester manuellement** (app en dev)

```bash
npx next dev --port 3001 &
curl http://localhost:3001/api/v1/dashboard | jq .
```

Résultat attendu : JSON avec `alerts`, `network`, `globalStatus`, `activeZones`.

- [ ] **Stopper le serveur dev** : `kill %1`

- [ ] **Commit**

```bash
git add src/app/api/v1/dashboard/
git commit -m "feat(api): /v1/dashboard — endpoint central SWR, cache Redis 30s"
```

---

### Task 6: API Mon Trajet — CRUD + Status

**Files:**
- Create: `src/app/api/v1/my-journey/route.ts`
- Create: `src/app/api/v1/my-journey/status/route.ts`

- [ ] **Créer `src/app/api/v1/my-journey/route.ts`**

```typescript
import { getServerSession } from 'next-auth'
import { NextRequest }      from 'next/server'
import { db }               from '@/lib/db'
import { redis }            from '@/lib/redis'
import { Ratelimit }        from '@upstash/ratelimit'
import { z }                from 'zod'

const rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1m') })

const CreateSchema = z.object({
  name:               z.string().min(1).max(100),
  fromLat:            z.number(),
  fromLng:            z.number(),
  fromLabel:          z.string().max(200),
  toLat:              z.number(),
  toLng:              z.number(),
  toLabel:            z.string().max(200),
  dayOfWeek:          z.array(z.number().int().min(0).max(6)).min(1),
  departureHour:      z.number().int().min(0).max(23),
  departureMinute:    z.number().int().min(0).max(59),
  flexMinutes:        z.number().int().min(0).max(60).optional().default(15),
  preferredMode:      z.enum(['car', 'transit', 'both']).optional().default('both'),
  notifyMinutesBefore: z.number().int().min(5).max(60).optional().default(15),
})

async function requireUser(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user) return null
  return (session.user as { id?: string }).id ?? null
}

export async function GET(req: NextRequest) {
  const userId = await requireUser(req)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const journeys = await db.userJourney.findMany({
    where: { userId, active: true },
    orderBy: { createdAt: 'desc' },
  })

  return Response.json({ journeys })
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await rl.limit(ip)
  if (!success) return Response.json({ error: 'Too many requests' }, { status: 429 })

  const userId = await requireUser(req)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data

  // Désactiver les anciens trajets (1 trajet actif max par user)
  await db.userJourney.updateMany({ where: { userId, active: true }, data: { active: false } })

  const journey = await db.userJourney.create({
    data: { userId, ...d },
  })

  return Response.json({ journey }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUser(req)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await db.userJourney.updateMany({ where: { userId, active: true }, data: { active: false } })
  await redis.del(`tif:journey:${userId}:status`)

  return Response.json({ ok: true })
}
```

- [ ] **Créer `src/app/api/v1/my-journey/status/route.ts`**

```typescript
import { getServerSession } from 'next-auth'
import { NextRequest }      from 'next/server'
import { redis }            from '@/lib/redis'
import type { JourneyStatusResult } from '@/lib/my-journey/types'

export async function GET(_req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as { id?: string }).id
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await redis.get(`tif:journey:${userId}:status`)
  if (!raw) return Response.json({ status: null })

  const result = (typeof raw === 'string' ? JSON.parse(raw) : raw) as JourneyStatusResult
  return Response.json(result, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
```

- [ ] **TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Commit**

```bash
git add src/app/api/v1/my-journey/
git commit -m "feat(api): /v1/my-journey CRUD + /status — trajet prédictif utilisateur"
```

---

## Phase 2 — UI Components

### Task 7: Animations + Keyframes CSS

**Files:**
- Create: `src/lib/animations/springs.ts`
- Modify: `src/app/globals.css`

- [ ] **Créer `src/lib/animations/springs.ts`**

```typescript
export const springs = {
  sheet:    'cubic-bezier(0.23, 1, 0.32, 1) 350ms',
  filter:   'cubic-bezier(0.23, 1, 0.32, 1) 200ms',
  alertIn:  'cubic-bezier(0.23, 1, 0.32, 1) 280ms',
  alertOut: 'cubic-bezier(0.4, 0, 1, 1) 200ms',
  search:   'cubic-bezier(0.16, 1, 0.3, 1) 300ms',
  card:     'cubic-bezier(0.23, 1, 0.32, 1) 150ms',
} as const

export type SpringKey = keyof typeof springs
```

- [ ] **Ajouter les keyframes dans `src/app/globals.css`** — ajouter avant la dernière accolade ou après le bloc `.tif-scroll` existant :

```css
/* ─── TIF ELITE — Keyframes ─────────────────────────────── */
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-12px) }
  to   { opacity: 1; transform: translateY(0) }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px) }
  to   { opacity: 1; transform: translateY(0) }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95) }
  to   { opacity: 1; transform: scale(1) }
}
@keyframes pulseStatus {
  0%, 100% { opacity: 1 }
  50%       { opacity: 0.5 }
}
@keyframes shimmer {
  from { background-position: -200% 0 }
  to   { background-position:  200% 0 }
}
```

- [ ] **Commit**

```bash
git add src/lib/animations/springs.ts src/app/globals.css
git commit -m "feat(ui): springs constants + CSS keyframes"
```

---

### Task 8: SearchBar

**Files:**
- Create: `src/components/map/ui/SearchBar.tsx`

- [ ] **Créer `src/components/map/ui/SearchBar.tsx`**

```tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type mapboxgl from 'mapbox-gl'
import { SearchBox } from '@/components/map/routing/SearchBox'
import type { SearchResult } from '@/lib/routing/shared/search-engine'
import { springs } from '@/lib/animations/springs'

const LG: React.CSSProperties = {
  background:           'rgba(18,18,22,0.88)',
  backdropFilter:       'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  border:               '1px solid rgba(255,255,255,0.13)',
  boxShadow:            '0 2px 12px rgba(0,0,0,0.20)',
}

const PLACEHOLDERS = [
  'Où allez-vous ?',
  'Bardonnex, Cornavin, Rive...',
  'Un arrêt, une adresse, un lieu',
  'Rechercher dans le Grand Genève',
]

interface SearchBarProps {
  map: mapboxgl.Map | null
}

export function SearchBar({ map }: SearchBarProps) {
  const [isOpen,        setIsOpen]        = useState(false)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([])

  // Rotate placeholder every 4s
  useEffect(() => {
    if (isOpen) return
    const id = setInterval(() => setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length), 4000)
    return () => clearInterval(id)
  }, [isOpen])

  // Load recent from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('tif:recent-searches')
      if (raw) setRecentSearches(JSON.parse(raw).slice(0, 3))
    } catch { /* ignore */ }
  }, [])

  const handleSelect = useCallback((result: SearchResult) => {
    // Save to recent
    const updated = [result, ...recentSearches.filter(r => r.id !== result.id)].slice(0, 3)
    setRecentSearches(updated)
    try { localStorage.setItem('tif:recent-searches', JSON.stringify(updated)) } catch { /* ignore */ }

    // Move map + pin
    map?.flyTo({ center: [result.lng, result.lat], zoom: 15, duration: 700, essential: true })
    window.dispatchEvent(new CustomEvent('tif:search-pin', {
      detail: { lat: result.lat, lng: result.lng, title: result.title },
    }))
    setIsOpen(false)
  }, [map, recentSearches])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-0 left-0 right-0 z-30 flex items-center gap-3 mx-4 mt-3 px-4 cursor-text"
        style={{ ...LG, height: 52, borderRadius: 16, transition: springs.search }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <span className="flex-1 text-left text-sm" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: '-apple-system, sans-serif' }}>
          {PLACEHOLDERS[placeholderIdx]}
        </span>
      </button>
    )
  }

  return (
    <>
      {/* Overlay sombre sur la carte */}
      <div
        className="fixed inset-0 z-29"
        style={{ background: 'rgba(0,0,0,0.30)' }}
        onClick={() => setIsOpen(false)}
      />

      {/* Barre de recherche ouverte */}
      <div
        className="fixed top-0 left-0 right-0 z-30 mx-4 mt-3 flex flex-col overflow-hidden"
        style={{ ...LG, borderRadius: 16, animation: `scaleIn ${springs.search} forwards` }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => setIsOpen(false)} style={{ color: 'rgba(255,255,255,0.5)' }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 1l8 8M9 1L1 9"/>
            </svg>
          </button>
          <div className="flex-1">
            <SearchBox
              placeholder={PLACEHOLDERS[0]}
              icon="🔍"
              value={undefined}
              loading={false}
              onSelect={handleSelect}
            />
          </div>
        </div>

        {recentSearches.length > 0 && (
          <div className="px-4 pb-3 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Récents
            </p>
            {recentSearches.map(r => (
              <button
                key={r.id}
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors active:bg-white/5"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              >
                <span className="text-sm">🕐</span>
                <span className="text-sm truncate">{r.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep SearchBar
```

Résultat attendu : 0 ligne d'erreur sur SearchBar.

- [ ] **Commit**

```bash
git add src/components/map/ui/SearchBar.tsx
git commit -m "feat(ui): SearchBar — barre de recherche sticky avec historique et animation"
```

---

### Task 9: QuickFilters

**Files:**
- Create: `src/components/map/ui/QuickFilters.tsx`

- [ ] **Créer `src/components/map/ui/QuickFilters.tsx`**

```tsx
'use client'

import { springs } from '@/lib/animations/springs'

export type FilterId = 'all' | 'transit' | 'traffic' | 'alerts' | 'borders' | 'g7' | 'journey'

interface FilterDef {
  id:    FilterId
  icon:  string
  label: string
}

const FILTERS: FilterDef[] = [
  { id: 'all',     icon: '🗺️',  label: 'Tout'       },
  { id: 'transit', icon: '🚌',  label: 'Transport'   },
  { id: 'traffic', icon: '🚦',  label: 'Trafic'      },
  { id: 'alerts',  icon: '⚠️',  label: 'Alertes'     },
  { id: 'borders', icon: '🛂',  label: 'Frontières'  },
  { id: 'g7',      icon: '🏛️', label: 'G7'          },
  { id: 'journey', icon: '⭐',  label: 'Mon Trajet'  },
]

interface QuickFiltersProps {
  active:       FilterId
  onChange:     (id: FilterId) => void
  showJourney?: boolean
}

const PILL_BASE: React.CSSProperties = {
  backdropFilter:       'blur(12px) saturate(160%)',
  WebkitBackdropFilter: 'blur(12px) saturate(160%)',
  border:               '1px solid rgba(255,255,255,0.10)',
  whiteSpace:           'nowrap',
}

export function QuickFilters({ active, onChange, showJourney = false }: QuickFiltersProps) {
  const visible = FILTERS.filter(f => f.id !== 'journey' || showJourney)

  return (
    <div
      className="fixed left-0 right-0 z-20 flex gap-2 px-4 overflow-x-auto"
      style={{
        top: 'calc(52px + 12px + 8px)',  // SearchBar height + margin + gap
        height: 40,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {visible.map(f => {
        const isActive = active === f.id
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className="flex items-center gap-1.5 px-4 flex-shrink-0 rounded-full text-[13px] font-medium"
            style={{
              ...PILL_BASE,
              height: 36,
              background: isActive ? 'var(--brand)' : 'rgba(28,28,30,0.88)',
              color:      isActive ? '#fff'          : 'rgba(255,255,255,0.65)',
              transition: springs.filter,
              transform:  isActive ? 'scale(1.04)'  : 'scale(1)',
            }}
          >
            <span>{f.icon}</span>
            <span>{f.label}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep QuickFilters
```

- [ ] **Commit**

```bash
git add src/components/map/ui/QuickFilters.tsx
git commit -m "feat(ui): QuickFilters — filtres horizontaux scrollables style App Store"
```

---

### Task 10: FloatingControls

**Files:**
- Create: `src/components/map/ui/FloatingControls.tsx`

- [ ] **Créer `src/components/map/ui/FloatingControls.tsx`**

```tsx
'use client'

import { useState, useCallback } from 'react'
import type mapboxgl from 'mapbox-gl'

const BTN: React.CSSProperties = {
  width: 44, height: 44,
  borderRadius: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background:           'rgba(18,18,22,0.85)',
  backdropFilter:       'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  border:               '1px solid rgba(255,255,255,0.12)',
  boxShadow:            '0 4px 16px rgba(0,0,0,0.30)',
  cursor: 'pointer',
  transition: 'transform 150ms ease, opacity 150ms ease',
  color: 'rgba(255,255,255,0.75)',
}

interface FloatingControlsProps {
  map: mapboxgl.Map | null
}

export function FloatingControls({ map }: FloatingControlsProps) {
  const [gpsActive, setGpsActive] = useState(false)

  const handleGPS = useCallback(() => {
    if (!navigator.geolocation || !map) return
    setGpsActive(true)
    navigator.geolocation.getCurrentPosition(pos => {
      map.flyTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: 15, duration: 800, essential: true,
      })
      window.dispatchEvent(new CustomEvent('tif:update-user-location', {
        detail: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy },
      }))
      setTimeout(() => setGpsActive(false), 3000)
    }, () => setGpsActive(false))
  }, [map])

  const zoomIn  = () => map?.zoomIn({ duration: 250 })
  const zoomOut = () => map?.zoomOut({ duration: 250 })

  return (
    <div
      className="fixed z-20 flex flex-col gap-2.5"
      style={{ right: 16, bottom: 'calc(56px + 80px)' }}
    >
      {/* GPS */}
      <button
        onClick={handleGPS}
        style={{ ...BTN, color: gpsActive ? '#0A84FF' : 'rgba(255,255,255,0.75)' }}
        aria-label="Recentrer sur ma position"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3"/>
          <line x1="12" y1="2"  x2="12" y2="6"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2"  y1="12" x2="6"  y2="12"/>
          <line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
      </button>

      {/* Zoom in */}
      <button onClick={zoomIn} style={BTN} aria-label="Zoom avant">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* Zoom out */}
      <button onClick={zoomOut} style={BTN} aria-label="Zoom arrière">
        <svg width="16" height="2" viewBox="0 0 24 2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="5" y1="1" x2="19" y2="1"/>
        </svg>
      </button>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/map/ui/FloatingControls.tsx
git commit -m "feat(ui): FloatingControls — GPS, zoom in/out"
```

---

### Task 11: BottomSheet (pièce maîtresse)

**Files:**
- Create: `src/components/map/ui/BottomSheet.tsx`

- [ ] **Créer `src/components/map/ui/BottomSheet.tsx`**

```tsx
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { springs } from '@/lib/animations/springs'
import type { Session } from 'next-auth'
import type { FilterId } from './QuickFilters'
import type { JourneyStatusResult } from '@/lib/my-journey/types'

type SnapSize = 'compact' | 'mid' | 'full'

const SNAP_HEIGHT: Record<SnapSize, string> = {
  compact: '56px',
  mid:     '45vh',
  full:    '92vh',
}

const LG: React.CSSProperties = {
  background:           'color-mix(in srgb, var(--bg) 95%, transparent)',
  backdropFilter:       'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  borderTop:            '1px solid var(--border)',
  borderRadius:         '20px 20px 0 0',
}

interface DashboardData {
  myJourney?: JourneyStatusResult
  alerts:      { id: string; icon: string; title: string; severity: string; timeAgo: string }[]
  network:     { tpg: string; cff: string; ceva: string }
  globalStatus: string
  activeZones:  number
}

interface BottomSheetProps {
  session:      Session | null
  activeFilter: FilterId
}

function NetworkBadge({ name, status }: { name: string; status: string }) {
  const color = status === 'normal' ? '#30D158' : status === 'delayed' ? '#FF9F0A' : '#FF453A'
  return (
    <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: `${color}18`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
      {name}
    </span>
  )
}

function JourneyCompactHeadline({ status, headline }: { status: string; headline: string }) {
  const color = status === 'normal' ? '#30D158' : status === 'delayed' ? '#FF9F0A' : '#FF453A'
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold truncate" style={{ color }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      {headline}
    </span>
  )
}

export function BottomSheet({ session, activeFilter }: BottomSheetProps) {
  const [snap,        setSnap]        = useState<SnapSize>('compact')
  const touchStartY   = useRef(0)
  const touchStartSnap = useRef<SnapSize>('compact')
  const touchVelocity  = useRef(0)
  const lastTouchY     = useRef(0)
  const lastTouchTime  = useRef(0)

  const { data } = useQuery<DashboardData>({
    queryKey: ['dashboard', activeFilter],
    queryFn:  () => fetch('/api/v1/dashboard').then(r => r.json()),
    refetchInterval: 30000,
    staleTime: 30000,
  })

  const snapOrder: SnapSize[] = ['compact', 'mid', 'full']

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current    = e.touches[0].clientY
    touchStartSnap.current = snap
    lastTouchY.current     = e.touches[0].clientY
    lastTouchTime.current  = Date.now()
    touchVelocity.current  = 0
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const now   = Date.now()
    const dy    = lastTouchY.current - e.touches[0].clientY
    const dt    = now - lastTouchTime.current
    touchVelocity.current = dt > 0 ? dy / dt : 0
    lastTouchY.current    = e.touches[0].clientY
    lastTouchTime.current = now
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const delta    = touchStartY.current - e.changedTouches[0].clientY
    const velocity = touchVelocity.current

    // Fast swipe → sauter directement en haut ou en bas
    if (velocity > 1.5) { setSnap('full');    return }
    if (velocity < -1.5) { setSnap('compact'); return }

    const idx = snapOrder.indexOf(touchStartSnap.current)
    if (delta > 60 && idx < 2) setSnap(snapOrder[idx + 1])
    else if (delta < -60 && idx > 0) setSnap(snapOrder[idx - 1])
  }

  const compactContent = () => {
    if (data?.myJourney) {
      return <JourneyCompactHeadline status={data.myJourney.status} headline={data.myJourney.headline} />
    }
    const count = data?.alerts.length ?? 0
    const color = count === 0 ? 'var(--text-secondary)' : '#FF9F0A'
    return (
      <span className="text-sm font-medium" style={{ color }}>
        {count === 0 ? `Grand Genève · Situation normale` : `Grand Genève · ${count} alerte${count > 1 ? 's' : ''} ⚠️`}
      </span>
    )
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 flex flex-col overflow-hidden"
      style={{ ...LG, height: SNAP_HEIGHT[snap], transition: `height ${springs.sheet}` }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Drag handle */}
      <button
        className="flex justify-center pt-2.5 pb-1 flex-shrink-0"
        onClick={() => setSnap(s => s === 'compact' ? 'mid' : 'compact')}
        aria-label="Ouvrir/fermer le panneau"
      >
        <div className="w-9 h-1 rounded-full" style={{ background: 'var(--border)' }} />
      </button>

      {/* Compact content — toujours visible */}
      <div className="flex items-center justify-between px-4 py-1 flex-shrink-0">
        {compactContent()}
        {(data?.alerts.length ?? 0) > 0 && snap === 'compact' && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,159,10,0.15)', color: '#FF9F0A' }}>
            {data!.alerts.length}
          </span>
        )}
      </div>

      {/* Mid content */}
      {snap !== 'compact' && (
        <div className="flex-1 overflow-y-auto px-4 pb-safe tif-scroll">
          {/* Réseau transport */}
          {data?.network && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <NetworkBadge name="TPG"  status={data.network.tpg} />
              <NetworkBadge name="CFF"  status={data.network.cff} />
              <NetworkBadge name="CEVA" status={data.network.ceva} />
            </div>
          )}

          {/* Alertes */}
          {(data?.alerts ?? []).length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                Alertes actives
              </p>
              {(data?.alerts ?? []).slice(0, snap === 'full' ? 20 : 5).map(a => (
                <div key={a.id} className="flex items-start gap-3 rounded-2xl p-3"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <span className="text-base flex-shrink-0">{a.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{a.timeAgo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="h-[env(safe-area-inset-bottom,0px)] flex-shrink-0" />
    </div>
  )
}
```

- [ ] **TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep BottomSheet
```

- [ ] **Commit**

```bash
git add src/components/map/ui/BottomSheet.tsx
git commit -m "feat(ui): BottomSheet — 3 snaps, drag natif pointer events, SWR data"
```

---

### Task 12: SmartAlert

**Files:**
- Create: `src/components/map/ui/SmartAlert.tsx`

- [ ] **Créer `src/components/map/ui/SmartAlert.tsx`**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAblyClient, CHANNELS } from '@/lib/realtime'
import { springs } from '@/lib/animations/springs'
import type { Session } from 'next-auth'
import type mapboxgl from 'mapbox-gl'

type Severity = 'info' | 'warning' | 'critical'

interface SmartAlertItem {
  id:       string
  severity: Severity
  icon:     string
  headline: string
  action?:  { label: string; href: string }
}

const SEVERITY_STYLE: Record<Severity, React.CSSProperties> = {
  info:     { background: 'rgba(10,132,255,0.12)',  borderColor: 'rgba(10,132,255,0.35)' },
  warning:  { background: 'rgba(255,159,10,0.12)', borderColor: 'rgba(255,159,10,0.35)' },
  critical: { background: 'rgba(255,69,58,0.15)',   borderColor: 'rgba(255,69,58,0.45)',
              animation: 'pulseStatus 2.5s ease-in-out infinite' },
}

interface SmartAlertManagerProps {
  map:     mapboxgl.Map | null
  session: Session | null
}

export function SmartAlertManager({ map: _map, session: _session }: SmartAlertManagerProps) {
  const [alerts, setAlerts] = useState<SmartAlertItem[]>([])

  const pushAlert = useCallback((alert: SmartAlertItem) => {
    setAlerts(prev => {
      if (prev.find(a => a.id === alert.id)) return prev
      return [...prev.slice(-1), alert]  // max 2
    })
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== alert.id))
    }, 8000)
  }, [])

  const dismiss = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  // Subscribe Ably channel "alerts:critical"
  useEffect(() => {
    const client  = getAblyClient()
    const channel = client.channels.get('alerts:critical')

    channel.subscribe('alert', (msg: { data: SmartAlertItem }) => {
      pushAlert(msg.data)
    })

    // Subscribe aux updates Ably events territoriaux
    const eventsChannel = client.channels.get(CHANNELS.events)
    eventsChannel.subscribe('critical', (msg: { data: { id: string; titleFr: string; type: string } }) => {
      pushAlert({
        id:       msg.data.id,
        severity: 'critical',
        icon:     '🚨',
        headline: msg.data.titleFr,
      })
    })

    return () => {
      channel.unsubscribe()
      eventsChannel.unsubscribe()
    }
  }, [pushAlert])

  if (alerts.length === 0) return null

  return (
    <div
      className="fixed left-4 right-4 z-25 flex flex-col gap-2"
      style={{ top: 'calc(52px + 12px + 40px + 8px)' }}  // sous QuickFilters
    >
      {alerts.map(alert => (
        <div
          key={alert.id}
          className="flex items-center gap-3 rounded-2xl px-4 border"
          style={{
            ...SEVERITY_STYLE[alert.severity],
            height: 52,
            animation: `slideDown ${springs.alertIn} forwards`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <span className="text-[18px] flex-shrink-0">{alert.icon}</span>
          <span className="flex-1 text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {alert.headline}
          </span>
          {alert.action && (
            <a href={alert.action.href}
              className="text-[12px] font-bold flex-shrink-0"
              style={{ color: 'var(--brand)' }}>
              {alert.action.label}
            </a>
          )}
          <button onClick={() => dismiss(alert.id)} className="flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 1l8 8M9 1L1 9"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/map/ui/SmartAlert.tsx
git commit -m "feat(ui): SmartAlertManager — alertes contextuelles Ably, auto-dismiss 8s"
```

---

## Phase 3 — Mon Trajet UI

### Task 13: JourneyCard

**Files:**
- Create: `src/components/my-journey/JourneyCard.tsx`

- [ ] **Créer le dossier et `src/components/my-journey/JourneyCard.tsx`**

```bash
mkdir -p "/Users/lostropicos/G7 live view/tif/src/components/my-journey"
```

```tsx
'use client'

import { springs } from '@/lib/animations/springs'
import type { JourneyStatusResult } from '@/lib/my-journey/types'

interface JourneyCardProps {
  data:    JourneyStatusResult
  onPress?: () => void
}

const STATUS_COLOR = {
  normal:    '#30D158',
  delayed:   '#FF9F0A',
  disrupted: '#FF453A',
} as const

const STATUS_LABEL = {
  normal:    '🟢',
  delayed:   '🟡',
  disrupted: '🔴',
} as const

export function JourneyCard({ data, onPress }: JourneyCardProps) {
  const color = STATUS_COLOR[data.status]

  return (
    <button
      onClick={onPress}
      className="w-full flex overflow-hidden rounded-2xl text-left"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${data.status === 'disrupted' ? color + '50' : 'var(--border)'}`,
        transition: springs.card,
      }}
    >
      {/* Barre latérale colorée */}
      <div className="w-1 flex-shrink-0" style={{ background: color }} />

      {/* Contenu */}
      <div className="flex-1 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">{STATUS_LABEL[data.status]}</span>
          {data.status === 'disrupted' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${color}20`, color }}>
              PERTURBÉ
            </span>
          )}
        </div>

        <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
          {data.headline}
        </p>

        {data.detail && (
          <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            {data.detail}
          </p>
        )}

        {data.alternative && (
          <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.20)' }}>
            <p className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--brand)' }}>
              ✨ Alternative recommandée
            </p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {data.alternative.description}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {data.alternative.timeSaved > 0 && `${data.alternative.timeSaved} min plus rapide · `}
              Partez dans {data.alternative.departureIn} min
            </p>
          </div>
        )}
      </div>
    </button>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/my-journey/JourneyCard.tsx
git commit -m "feat(my-journey): JourneyCard — 3 états visuels (normal/delayed/disrupted)"
```

---

### Task 14: JourneySetup (flow 5 étapes)

**Files:**
- Create: `src/components/my-journey/JourneySetup.tsx`

- [ ] **Créer `src/components/my-journey/JourneySetup.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { SearchBox } from '@/components/map/routing/SearchBox'
import type { SearchResult } from '@/lib/routing/shared/search-engine'
import type { CreateJourneyInput } from '@/lib/my-journey/types'
import { springs } from '@/lib/animations/springs'

const DAYS = [
  { label: 'L', value: 1 }, { label: 'M', value: 2 }, { label: 'M', value: 3 },
  { label: 'J', value: 4 }, { label: 'V', value: 5 }, { label: 'S', value: 6 },
  { label: 'D', value: 0 },
]

type Step = 1 | 2 | 3 | 4 | 5

interface JourneySetupProps {
  onComplete: () => void
  onClose:    () => void
}

export function JourneySetup({ onComplete, onClose }: JourneySetupProps) {
  const [step,    setStep]    = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const [from,    setFrom]    = useState<SearchResult | null>(null)
  const [to,      setTo]      = useState<SearchResult | null>(null)
  const [days,    setDays]    = useState<number[]>([1,2,3,4,5])
  const [hour,    setHour]    = useState(7)
  const [minute,  setMinute]  = useState(45)
  const [flex,    setFlex]    = useState(15)
  const [mode,    setMode]    = useState<'car' | 'transit' | 'both'>('both')
  const [notify,  setNotify]  = useState(15)

  const toggleDay = (d: number) =>
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const submit = async () => {
    if (!from || !to) return
    setLoading(true)
    setError(null)
    try {
      const body: CreateJourneyInput = {
        name: `${from.title.split(',')[0]} → ${to.title.split(',')[0]}`,
        fromLat: from.lat, fromLng: from.lng, fromLabel: from.title,
        toLat: to.lat, toLng: to.lng, toLabel: to.title,
        dayOfWeek: days, departureHour: hour, departureMinute: minute,
        flexMinutes: flex, preferredMode: mode, notifyMinutesBefore: notify,
      }
      const res = await fetch('/api/v1/my-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde')
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full rounded-t-3xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg)',
          animation: `slideUp ${springs.sheet} forwards`,
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              Étape {step} / 5
            </p>
            <div className="flex gap-1 mt-1">
              {([1,2,3,4,5] as Step[]).map(s => (
                <div key={s} className="h-1 flex-1 rounded-full" style={{
                  background: s <= step ? 'var(--brand)' : 'var(--border)',
                  transition: springs.filter,
                }} />
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)' }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* Étape 1 */}
          {step === 1 && (
            <div style={{ animation: `scaleIn ${springs.search} forwards` }}>
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                Où commencez-vous ?
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Votre adresse de départ habituelle
              </p>
              <SearchBox
                placeholder="Domicile ou adresse de départ"
                icon="🔵" value={from?.title} gpsHint
                loading={false}
                onGPSSelect={() => {
                  navigator.geolocation?.getCurrentPosition(pos => {
                    setFrom({ id: 'gps', title: 'Ma position', lat: pos.coords.latitude, lng: pos.coords.longitude, type: 'address' })
                    setStep(2)
                  })
                }}
                onSelect={r => { setFrom(r); setStep(2) }}
              />
            </div>
          )}

          {/* Étape 2 */}
          {step === 2 && (
            <div style={{ animation: `scaleIn ${springs.search} forwards` }}>
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                Où allez-vous ?
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Votre destination habituelle
              </p>
              <SearchBox
                placeholder="Bureau, école, destination..."
                icon="🔴" value={to?.title}
                loading={false}
                onSelect={r => { setTo(r); setStep(3) }}
              />
            </div>
          )}

          {/* Étape 3 */}
          {step === 3 && (
            <div style={{ animation: `scaleIn ${springs.search} forwards` }}>
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                Quand partez-vous ?
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Jours et heure de départ habituels
              </p>
              <div className="flex gap-2 mb-6">
                {DAYS.map(d => (
                  <button
                    key={d.value}
                    onClick={() => toggleDay(d.value)}
                    className="flex-1 h-10 rounded-xl text-sm font-bold transition-all"
                    style={{
                      background: days.includes(d.value) ? 'var(--brand)' : 'var(--bg-card)',
                      color:      days.includes(d.value) ? '#fff'         : 'var(--text-secondary)',
                      border:     '1px solid var(--border)',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                Heure de départ
              </label>
              <div className="flex gap-3 mb-4">
                <select
                  value={hour}
                  onChange={e => setHour(+e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl text-sm"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i.toString().padStart(2,'0')}h</option>
                  ))}
                </select>
                <select
                  value={minute}
                  onChange={e => setMinute(+e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl text-sm"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => (
                    <option key={m} value={m}>{m.toString().padStart(2,'0')} min</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setStep(4)}
                disabled={days.length === 0}
                className="w-full py-3.5 rounded-xl text-sm font-bold"
                style={{ background: 'var(--brand)', color: '#fff', opacity: days.length === 0 ? 0.5 : 1 }}
              >
                Continuer →
              </button>
            </div>
          )}

          {/* Étape 4 */}
          {step === 4 && (
            <div style={{ animation: `scaleIn ${springs.search} forwards` }}>
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                Comment voyagez-vous ?
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Mode de transport préféré
              </p>
              {([
                { value: 'car',     icon: '🚗', label: 'Voiture'      },
                { value: 'transit', icon: '🚌', label: 'Transport'    },
                { value: 'both',    icon: '🔄', label: 'Les deux'     },
              ] as const).map(m => (
                <button
                  key={m.value}
                  onClick={() => { setMode(m.value); setStep(5) }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl mb-3 text-left"
                  style={{
                    background: mode === m.value ? 'var(--brand-subtle)' : 'var(--bg-card)',
                    border: `1px solid ${mode === m.value ? 'var(--brand)' : 'var(--border)'}`,
                  }}
                >
                  <span className="text-2xl">{m.icon}</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Étape 5 */}
          {step === 5 && (
            <div style={{ animation: `scaleIn ${springs.search} forwards` }}>
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                Alertez-moi avant mon départ
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Si votre trajet est perturbé, TIF vous alerte à l'avance
              </p>
              <div className="flex gap-2 mb-6">
                {[5, 10, 15, 20, 30].map(n => (
                  <button
                    key={n}
                    onClick={() => setNotify(n)}
                    className="flex-1 h-10 rounded-xl text-sm font-bold"
                    style={{
                      background: notify === n ? 'var(--brand)' : 'var(--bg-card)',
                      color:      notify === n ? '#fff'         : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {n} min
                  </button>
                ))}
              </div>
              {error && (
                <p className="text-sm mb-4" style={{ color: 'var(--red)' }}>{error}</p>
              )}
              <button
                onClick={submit}
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-bold"
                style={{ background: 'var(--brand)', color: '#fff', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Enregistrement...' : 'Configurer mon trajet ✓'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/my-journey/
git commit -m "feat(my-journey): JourneySetup 5 étapes + JourneyCard 3 états"
```

---

## Phase 4 — Features Exclusives

### Task 15: Border Prediction (TDD)

**Files:**
- Create: `src/lib/features/border-prediction.ts`
- Create: `src/lib/features/border-prediction.test.ts`

- [ ] **Écrire le test en premier** — `src/lib/features/border-prediction.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { buildSparkline, getTrend, buildRecommendation } from './border-prediction'

describe('buildSparkline', () => {
  it('retourne 12 points pour 60 minutes', () => {
    const points = buildSparkline(10, 0.3)
    expect(points).toHaveLength(12)
  })

  it('trending up — dernier point > premier', () => {
    const points = buildSparkline(5, 0.5)
    expect(points[11]).toBeGreaterThan(points[0])
  })

  it('trending down — dernier point < premier', () => {
    const points = buildSparkline(20, -0.4)
    expect(points[11]).toBeLessThan(points[0])
  })

  it('valeurs entre 0 et 60', () => {
    const points = buildSparkline(10, 0.2)
    points.forEach(p => {
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(60)
    })
  })
})

describe('getTrend', () => {
  it('improving quand score négatif', () => expect(getTrend(-0.3)).toBe('improving'))
  it('worsening quand score positif', () => expect(getTrend(0.3)).toBe('worsening'))
  it('stable quand score proche de 0', () => expect(getTrend(0.05)).toBe('stable'))
})

describe('buildRecommendation', () => {
  it('improving → libre dans X min', () => {
    const r = buildRecommendation('improving', 15)
    expect(r.toLowerCase()).toContain('libre')
  })
  it('worsening → partez maintenant', () => {
    const r = buildRecommendation('worsening', 5)
    expect(r.toLowerCase()).toContain('partez')
  })
})
```

- [ ] **Vérifier que le test échoue**

```bash
npx vitest run src/lib/features/border-prediction.test.ts
```

- [ ] **Créer `src/lib/features/border-prediction.ts`**

```typescript
export type BorderTrend = 'improving' | 'stable' | 'worsening'

export interface BorderPrediction {
  crossingId:   string
  name:         string
  currentWait:  number
  predictions:  { in15min: number; in30min: number; in45min: number }
  trend:        BorderTrend
  recommendation: string
  sparkline:    number[]   // 12 points = 60 minutes
  confidence:   number
}

// Génère la courbe sparkline 60min (12 points, 1 par 5min)
// slope : taux de changement par step (négatif = améliore, positif = empire)
export function buildSparkline(current: number, slope: number): number[] {
  return Array.from({ length: 12 }, (_, i) => {
    const val = current + slope * i * 2  // ×2 pour amplifier visuellement
    return Math.min(60, Math.max(0, val))
  })
}

export function getTrend(slope: number): BorderTrend {
  if (slope < -0.1) return 'improving'
  if (slope > 0.1)  return 'worsening'
  return 'stable'
}

export function buildRecommendation(trend: BorderTrend, currentWait: number): string {
  if (trend === 'improving') {
    const freeIn = Math.round(currentWait * 0.6)
    return freeIn < 5
      ? 'Passage fluide maintenant'
      : `Sera libre dans ~${freeIn} min`
  }
  if (trend === 'worsening') {
    return currentWait < 8
      ? 'Partez maintenant — pire dans 20 min'
      : `${currentWait} min d'attente · Tendance à la hausse`
  }
  return `${currentWait} min · Situation stable`
}

// Calcule la prédiction depuis les données consensus et pattern temporel
export function computeBorderPrediction(params: {
  crossingId:    string
  name:          string
  currentWait:   number
  congestionNow: number    // 0–1
  peakPattern:   number    // multiplicateur heure de pointe 0.5–2.0
}): BorderPrediction {
  const { crossingId, name, currentWait, congestionNow, peakPattern } = params

  // Pente estimée basée sur la congestion actuelle et le pattern
  const slope = (peakPattern - 1) * 0.8 * congestionNow

  const sparkline = buildSparkline(currentWait, slope)
  const trend     = getTrend(slope)

  return {
    crossingId,
    name,
    currentWait,
    predictions: {
      in15min: Math.max(0, Math.round(sparkline[2])),
      in30min: Math.max(0, Math.round(sparkline[5])),
      in45min: Math.max(0, Math.round(sparkline[8])),
    },
    trend,
    recommendation: buildRecommendation(trend, currentWait),
    sparkline,
    confidence: 0.72,
  }
}
```

- [ ] **Vérifier que le test passe**

```bash
npx vitest run src/lib/features/border-prediction.test.ts
```

Résultat attendu : ✓ 8 tests passed

- [ ] **Commit**

```bash
git add src/lib/features/border-prediction.ts src/lib/features/border-prediction.test.ts
git commit -m "feat(features): border-prediction — sparkline 60min, trend, recommendation"
```

---

### Task 16: BorderPredictionWidget

**Files:**
- Create: `src/components/map/widgets/BorderPredictionWidget.tsx`

- [ ] **Créer le dossier et le composant**

```bash
mkdir -p "/Users/lostropicos/G7 live view/tif/src/components/map/widgets"
```

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { computeBorderPrediction } from '@/lib/features/border-prediction'
import type { BorderPrediction } from '@/lib/features/border-prediction'

const CROSSINGS = [
  { id: 'bardonnex', name: 'Bardonnex' },
  { id: 'thonex',    name: 'Thônex'   },
  { id: 'perly',     name: 'Perly'    },
  { id: 'meyrin',    name: 'Meyrin'   },
]

function Sparkline({ points }: { points: number[] }) {
  const max = 30  // max affiché = 30 min
  const w = 80, h = 24
  const pts = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w
    const y = h - (Math.min(v, max) / max) * h
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline points={pts} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BorderCard({ data }: { data: BorderPrediction }) {
  const trendIcon = data.trend === 'improving' ? '↘' : data.trend === 'worsening' ? '↗' : '→'
  const trendColor = data.trend === 'improving' ? '#30D158' : data.trend === 'worsening' ? '#FF453A' : '#FF9F0A'

  return (
    <div className="rounded-2xl p-3 mb-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          🛂 {data.name}
        </span>
        <span className="text-[13px] font-bold" style={{ color: trendColor }}>
          {data.currentWait} min {trendIcon}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] flex-1" style={{ color: 'var(--text-secondary)' }}>
          {data.recommendation}
        </p>
        <Sparkline points={data.sparkline} />
      </div>
    </div>
  )
}

export function BorderPredictionWidget() {
  const { data: predictions } = useQuery<BorderPrediction[]>({
    queryKey: ['border-predictions'],
    queryFn: async () => {
      // Données depuis le layer API existant
      const res = await fetch('/api/v1/layers/territory')
      const json = await res.json()
      // Mapper les données de passage frontière
      return CROSSINGS.map(c => computeBorderPrediction({
        crossingId:    c.id,
        name:          c.name,
        currentWait:   json?.[c.id]?.waitMinutes ?? 0,
        congestionNow: json?.[c.id]?.congestionScore ?? 0,
        peakPattern:   1.0,
      }))
    },
    refetchInterval: 60000,
    staleTime: 60000,
  })

  if (!predictions) return null

  return (
    <div className="px-4 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
        Passages frontière
      </p>
      {predictions.map(p => <BorderCard key={p.crossingId} data={p} />)}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/map/widgets/
git commit -m "feat(widgets): BorderPredictionWidget — sparkline SVG 60min par passage frontière"
```

---

### Task 17: Domino Detector (TDD)

**Files:**
- Create: `src/lib/features/domino-detector.ts`
- Create: `src/lib/features/domino-detector.test.ts`

- [ ] **Écrire le test** — `src/lib/features/domino-detector.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { predictDominoEffect } from './domino-detector'

describe('predictDominoEffect', () => {
  it('zone à 80% capacité + incident → alerte domino', () => {
    const result = predictDominoEffect({
      incidentGeohash: 'u0k2j5',
      neighborGeohashes: ['u0k2j6', 'u0k2j7'],
      neighborCapacities: { 'u0k2j6': 0.8, 'u0k2j7': 0.3 },
      divertedFlowRatio: 0.4,
    })
    expect(result).not.toBeNull()
    expect(result!.targetGeohash).toBe('u0k2j6')
    expect(result!.estimatedMinutes).toBeGreaterThan(0)
  })

  it('zones sous-chargées → pas d'alerte', () => {
    const result = predictDominoEffect({
      incidentGeohash: 'u0k2j5',
      neighborGeohashes: ['u0k2j6'],
      neighborCapacities: { 'u0k2j6': 0.2 },
      divertedFlowRatio: 0.3,
    })
    expect(result).toBeNull()
  })
})
```

- [ ] **Vérifier que le test échoue**

```bash
npx vitest run src/lib/features/domino-detector.test.ts
```

- [ ] **Créer `src/lib/features/domino-detector.ts`**

```typescript
export interface DominoAlert {
  incidentGeohash: string
  targetGeohash:   string
  estimatedMinutes: number  // dans combien de minutes la saturation arrive
  confidence:       number
  message:          string
}

interface DominoInput {
  incidentGeohash:    string
  neighborGeohashes:  string[]
  neighborCapacities: Record<string, number>  // 0–1 (capacité actuelle)
  divertedFlowRatio:  number                  // 0–1 (fraction du trafic reporté)
}

// Seuil à partir duquel on génère une alerte
const SATURATION_THRESHOLD = 0.72

export function predictDominoEffect(input: DominoInput): DominoAlert | null {
  const { incidentGeohash, neighborGeohashes, neighborCapacities, divertedFlowRatio } = input

  // Trouver la zone voisine avec la plus haute capacité actuelle
  const target = neighborGeohashes
    .map(g => ({ geohash: g, capacity: neighborCapacities[g] ?? 0 }))
    .filter(z => z.capacity + divertedFlowRatio > SATURATION_THRESHOLD)
    .sort((a, b) => b.capacity - a.capacity)[0]

  if (!target) return null

  // Estimation du temps avant saturation
  const slack = SATURATION_THRESHOLD - target.capacity
  const estimatedMinutes = Math.max(5, Math.round((slack / divertedFlowRatio) * 15))

  return {
    incidentGeohash,
    targetGeohash: target.geohash,
    estimatedMinutes,
    confidence: 0.65,
    message: `⚡ Effet cascade prédit · Saturation dans ~${estimatedMinutes} min`,
  }
}
```

- [ ] **Vérifier que le test passe**

```bash
npx vitest run src/lib/features/domino-detector.test.ts
```

Résultat attendu : ✓ 2 tests passed

- [ ] **Commit**

```bash
git add src/lib/features/domino-detector.ts src/lib/features/domino-detector.test.ts
git commit -m "feat(features): domino-detector — prédiction effets cascade"
```

---

### Task 18: G7Mode

**Files:**
- Create: `src/components/map/modes/G7Mode.tsx`

- [ ] **Créer le dossier et le composant**

```bash
mkdir -p "/Users/lostropicos/G7 live view/tif/src/components/map/modes"
```

```tsx
'use client'

import { useEffect, useState } from 'react'
import type mapboxgl from 'mapbox-gl'

// G7 actif du 8 au 17 juin 2026
const G7_START = new Date('2026-06-08T00:00:00')
const G7_END   = new Date('2026-06-17T23:59:59')

export function useG7Active(): boolean {
  const now = new Date()
  return now >= G7_START && now <= G7_END
}

interface G7ModeProps {
  map: mapboxgl.Map | null
}

export function G7Mode({ map }: G7ModeProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!map) return

    // Ajouter les zones G7 depuis l'API existante
    const addLayers = async () => {
      try {
        const res  = await fetch('/api/v1/territory/events')
        const data = await res.json()
        if (!data.zones?.length) return

        if (!map.getSource('g7-zones')) {
          map.addSource('g7-zones', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: data.zones.map((z: { geohash6: string; lat: number; lng: number }) => ({
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [z.lng, z.lat],
                },
                properties: { geohash6: z.geohash6 },
              })),
            },
          })
        }

        if (!map.getLayer('g7-zones-fill')) {
          map.addLayer({
            id:     'g7-zones-fill',
            type:   'circle',
            source: 'g7-zones',
            paint: {
              'circle-radius':       800,
              'circle-color':        '#FF453A',
              'circle-opacity':      0.08,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#FF453A',
              'circle-stroke-opacity': 0.3,
              'circle-radius-transition': { duration: 500 },
            },
          })
        }
      } catch { /* ignore */ }
    }

    if (map.loaded()) addLayers()
    else map.on('load', addLayers)

    return () => {
      if (map.getLayer('g7-zones-fill')) map.removeLayer('g7-zones-fill')
      if (map.getSource('g7-zones'))     map.removeSource('g7-zones')
    }
  }, [map])

  if (dismissed) return null

  return (
    <div
      className="fixed top-[108px] left-4 right-4 z-24 flex items-center gap-3 px-4 rounded-2xl border"
      style={{
        height: 48,
        background: 'rgba(255,69,58,0.12)',
        borderColor: 'rgba(255,69,58,0.35)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <span className="text-base flex-shrink-0">🏛️</span>
      <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        G7 actif · Restrictions en vigueur jusqu'au 17 juin
      </span>
      <button onClick={() => setDismissed(true)} style={{ color: 'var(--text-tertiary)' }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1 1l8 8M9 1L1 9"/>
        </svg>
      </button>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/map/modes/
git commit -m "feat(g7): G7Mode — overlay zones sécurisées + banner auto 8-17 juin 2026"
```

---

### Task 19: VoiceStatus

**Files:**
- Create: `src/components/accessibility/VoiceStatus.tsx`

- [ ] **Créer le dossier et le composant**

```bash
mkdir -p "/Users/lostropicos/G7 live view/tif/src/components/accessibility"
```

```tsx
'use client'

import { useCallback, useState } from 'react'

interface VoiceStatusProps {
  globalStatus: string
  alertCount:   number
  journeyHeadline?: string
}

export function VoiceStatus({ globalStatus, alertCount, journeyHeadline }: VoiceStatusProps) {
  const [speaking, setSpeaking] = useState(false)

  const speak = useCallback(() => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    const statusText = globalStatus === 'calm'
      ? 'Situation normale sur le réseau.'
      : `${alertCount} alerte${alertCount > 1 ? 's' : ''} active${alertCount > 1 ? 's' : ''} sur le réseau.`

    const journeyText = journeyHeadline
      ? `Votre trajet : ${journeyHeadline}.`
      : ''

    const text = `Grand Genève. ${statusText} ${journeyText}`

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang  = 'fr-CH'
    utterance.rate  = 0.95
    utterance.pitch = 1.0

    // Fallback vers fr-FR si fr-CH non disponible
    const voices = window.speechSynthesis.getVoices()
    const frVoice = voices.find(v => v.lang === 'fr-CH') ?? voices.find(v => v.lang.startsWith('fr'))
    if (frVoice) utterance.voice = frVoice

    utterance.onstart = () => setSpeaking(true)
    utterance.onend   = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }, [globalStatus, alertCount, journeyHeadline])

  if (!('speechSynthesis' in (typeof window !== 'undefined' ? window : {}))) return null

  return (
    <button
      onClick={speak}
      style={{
        width: 44, height: 44,
        borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background:           speaking ? 'rgba(10,132,255,0.2)' : 'rgba(18,18,22,0.85)',
        backdropFilter:       'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border:               `1px solid ${speaking ? 'rgba(10,132,255,0.5)' : 'rgba(255,255,255,0.12)'}`,
        boxShadow:            '0 4px 16px rgba(0,0,0,0.30)',
        cursor: 'pointer',
        color: speaking ? '#0A84FF' : 'rgba(255,255,255,0.75)',
        animation: speaking ? 'pulseStatus 1.5s ease-in-out infinite' : 'none',
      }}
      aria-label="Lire le statut à voix haute"
    >
      🔊
    </button>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/accessibility/
git commit -m "feat(a11y): VoiceStatus — lecture vocale Web Speech API fr-CH, 0 dépendance"
```

---

## Phase 5 — Intégration & Sécurité

### Task 20: Middleware — HSTS + Permissions-Policy

**Files:**
- Modify: `middleware.ts`

- [ ] **Ajouter les headers manquants dans `middleware.ts`** — après la ligne `res.headers.set('Referrer-Policy', ...)` :

```typescript
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  res.headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()')
```

- [ ] **Vérifier que le middleware compile**

```bash
npx tsc --noEmit 2>&1 | grep middleware
```

- [ ] **Commit**

```bash
git add middleware.ts
git commit -m "fix(security): add HSTS + Permissions-Policy headers"
```

---

### Task 21: Restructure src/app/(dashboard)/map/page.tsx

**Files:**
- Modify: `src/app/(dashboard)/map/page.tsx`

- [ ] **Lire le fichier actuel pour connaître son contenu exact**

```bash
cat "/Users/lostropicos/G7 live view/tif/src/app/(dashboard)/map/page.tsx"
```

- [ ] **Remplacer le contenu de `src/app/(dashboard)/map/page.tsx`** par l'architecture 7 layers :

```tsx
'use client'

import { useState }           from 'react'
import { useSession }         from 'next-auth/react'
import dynamic                from 'next/dynamic'
import { SearchBar }          from '@/components/map/ui/SearchBar'
import { QuickFilters }       from '@/components/map/ui/QuickFilters'
import { FloatingControls }   from '@/components/map/ui/FloatingControls'
import { BottomSheet }        from '@/components/map/ui/BottomSheet'
import { SmartAlertManager }  from '@/components/map/ui/SmartAlert'
import { G7Mode, useG7Active } from '@/components/map/modes/G7Mode'
import type { FilterId }      from '@/components/map/ui/QuickFilters'
import type mapboxgl          from 'mapbox-gl'

// La carte et ses layers restent en dynamic import (pas de SSR)
const MapView = dynamic(() => import('@/components/map/MapView'), { ssr: false })

export default function MapPage() {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')
  const [mapRef,       setMapRef]       = useState<mapboxgl.Map | null>(null)
  const { data: session }               = useSession()
  const isG7Active                      = useG7Active()

  // Convertir FilterId → FilterState pour MapView existant
  const filterState = {
    heatmap:   activeFilter === 'all' || activeFilter === 'traffic',
    alerts:    activeFilter === 'all' || activeFilter === 'alerts',
    transport: activeFilter === 'transit',
    territory: activeFilter === 'all' || activeFilter === 'borders' || activeFilter === 'g7',
  }

  return (
    <div className="h-screen w-full overflow-hidden relative" style={{ background: '#000' }}>

      {/* Layer 1 : Carte Mapbox — plein écran */}
      <MapView
        style="mapbox://styles/mapbox/dark-v11"
        initialViewState={{ longitude: 6.1432, latitude: 46.2044, zoom: 11 }}
        filters={filterState}
        onMapReady={setMapRef}
      />

      {/* Layer 2 : Search Bar — sticky top */}
      <SearchBar map={mapRef} />

      {/* Layer 3 : Quick Filters — horizontal scrollable */}
      <QuickFilters
        active={activeFilter}
        onChange={setActiveFilter}
        showJourney={!!session}
      />

      {/* Layer 4 : Smart Alerts — contextuelles auto-dismiss */}
      <SmartAlertManager map={mapRef} session={session} />

      {/* Layer 5 : Floating Controls — droite */}
      <FloatingControls map={mapRef} />

      {/* Layer 6 : G7 Mode — overlay zones sécurisées si actif */}
      {isG7Active && <G7Mode map={mapRef} />}

      {/* Layer 7 : Bottom Sheet — toujours visible */}
      <BottomSheet session={session} activeFilter={activeFilter} />

    </div>
  )
}
```

- [ ] **TypeScript check complet**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Corriger chaque erreur avant de continuer. Les erreurs les plus probables :
- Props manquantes sur MapView → vérifier l'interface `MapGLProps` dans `MapGL.tsx` et adapter
- Import `useSession` → s'assurer que `next-auth/react` est importé correctement

- [ ] **Commit**

```bash
git add src/app/(dashboard)/map/page.tsx
git commit -m "feat(map): architecture 7 layers — SearchBar, QuickFilters, SmartAlert, BottomSheet, G7Mode"
```

---

### Task 22: Service Worker + Push Notifications

**Files:**
- Create: `public/sw.js`
- Create: `src/lib/notifications/push.ts`

- [ ] **Créer `public/sw.js`**

```javascript
// Service Worker TIF — Web Push
const CACHE_NAME = 'tif-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body:    data.body,
    icon:    '/icons/tif-192.png',
    badge:   '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    data:    data.data ?? {},
    actions: data.action ? [{ action: 'open', title: data.action }] : [],
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/map'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const existing = clients.find(c => c.url.includes('/map'))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
```

- [ ] **Créer le dossier et `src/lib/notifications/push.ts`**

```bash
mkdir -p "/Users/lostropicos/G7 live view/tif/src/lib/notifications"
```

```typescript
// Enregistrement Service Worker côté client
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

// Demander la permission push (appelé UNE seule fois, depuis JourneySetup étape 5)
export async function requestPushPermission(): Promise<PushSubscription | null> {
  if (!('Notification' in window) || !('PushManager' in window)) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
    ),
  })

  // Envoyer la souscription au serveur
  await fetch('/api/v1/my-journey/push-subscription', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(sub.toJSON()),
  })

  return sub
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad     = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64     = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(b64)
  const output  = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i)
  return output
}
```

- [ ] **Commit**

```bash
git add public/sw.js src/lib/notifications/
git commit -m "feat(push): service worker Web Push + lib registration + permission flow"
```

---

## Phase 6 — Validation Finale

### Task 23: TypeScript strict + Build

- [ ] **TypeScript check complet — 0 erreur attendue**

```bash
cd "/Users/lostropicos/G7 live view/tif"
npx tsc --noEmit 2>&1
```

Si erreurs → les corriger avant de continuer. Types non résolus courants à checker :
- `MapView` props (onMapReady / onMapLoad)
- `SearchBox` props (gpsHint optionnel ?)
- Session user type (cast explicite si nécessaire)

- [ ] **Run tous les tests unitaires**

```bash
npx vitest run
```

Résultat attendu :
- `predictor.test.ts` ✓
- `border-prediction.test.ts` ✓
- `domino-detector.test.ts` ✓
- Tests existants ✓ (territory-score, anonymize)

- [ ] **Build Next.js**

```bash
npx next build 2>&1 | tail -20
```

Résultat attendu : `✓ Build successful`

- [ ] **Commit final**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: TIF redesign elite — architecture 7 layers + Mon Trajet prédictif

- SearchBar sticky avec historique localStorage + placeholder animé
- QuickFilters horizontaux (trafic/transport/alertes/frontières/G7/Mon Trajet)
- BottomSheet 3 snaps drag natif (compact 56px / mid 45vh / full 92vh)
- SmartAlertManager Ably temps réel, auto-dismiss 8s
- FloatingControls GPS + zoom
- JourneySetup 5 étapes (< 90s) + JourneyCard 3 états visuels
- BorderPredictionWidget sparkline SVG 60min
- DominoDetector prédiction effets cascade
- G7Mode overlay zones sécurisées auto 8-17 juin 2026
- VoiceStatus Web Speech API fr-CH, 0 dépendance
- Dashboard API SWR cache Redis 30s + Cloudflare edge cache
- Security: HSTS + Permissions-Policy + rate limiting tous endpoints
- Service Worker Web Push

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Test manuel dans le navigateur**

```bash
npx next dev --port 3001
```

Checklist manuelle :
- [ ] `/map` charge sans erreur console
- [ ] SearchBar : tap → overlay carte, résultats apparaissent
- [ ] QuickFilters : sélection change les layers carte
- [ ] BottomSheet : drag up/down change les snaps correctement
- [ ] BottomSheet compact : affiche statut global (x alertes ou "normal")
- [ ] FloatingControls : GPS recentre la carte
- [ ] `npx next build` → succès après test dev

---

## Notes d'implémentation importantes

### MapView — adaptation des props

La page actuelle passe `filters` comme `FilterState`. La nouvelle page calcule `filterState` depuis `activeFilter`. Vérifier que `MapView` accepte bien une prop `filters` ET `onMapReady`. Si `MapView` utilise `onMapLoad` au lieu de `onMapReady`, adapter en conséquence.

### SearchBox — import path

`SearchBox` est importé depuis `@/components/map/routing/SearchBox`. Si le chemin est différent, ajuster tous les imports.

### VAPID Keys pour Web Push

Pour activer les notifications push, générer les clés VAPID :
```bash
npx web-push generate-vapid-keys
```
Ajouter dans `.env.local` :
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:contact@borja-swiss-solutions.ch
```

### VoiceStatus — intégration dans la page carte

`VoiceStatus` nécessite `globalStatus`, `alertCount` et `journeyHeadline` du dashboard. Dans Task 21 (`map/page.tsx`), ajouter un `useQuery` pour ces données et passer les props à `VoiceStatus` à l'intérieur de `FloatingControls` ou juste à côté :

```tsx
// Dans map/page.tsx, après le useSession() :
const { data: dashboard } = useQuery({
  queryKey: ['dashboard'],
  queryFn: () => fetch('/api/v1/dashboard').then(r => r.json()),
  refetchInterval: 30000,
  staleTime: 30000,
})

// Puis dans le JSX, à côté de FloatingControls :
<FloatingControls map={mapRef} />
<div className="fixed z-20" style={{ right: 16, bottom: 'calc(56px + 80px + 54px + 10px)' }}>
  <VoiceStatus
    globalStatus={dashboard?.globalStatus ?? 'calm'}
    alertCount={dashboard?.alerts?.length ?? 0}
    journeyHeadline={dashboard?.myJourney?.headline}
  />
</div>
```

### Ably channel journey

Le predictor Inngest publie sur `tif:journey:${userId}` (channel privé par user). Ce n'est pas dans `CHANNELS` de `realtime.ts` car c'est un channel dynamique côté serveur (Ably.Rest). Côté client, si tu veux subscribe aux updates journey en temps réel, ajouter dans `realtime.ts` :

```typescript
export const journeyChannel = (userId: string) => `tif:journey:${userId}`
```

Et l'appeler depuis `BottomSheet` si `session?.user?.id` est disponible.

### Infrastructure Infomaniak

Les tâches d'infrastructure (Cloudflare DNS, Jelastic Docker config, Read Replica PostgreSQL) sont des tâches DevOps hors-code — à réaliser sur les dashboards Infomaniak/Cloudflare séparément de l'implémentation.
