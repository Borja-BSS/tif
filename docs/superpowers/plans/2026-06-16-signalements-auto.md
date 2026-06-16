# Signalements Auto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatiser la publication et le retrait des signalements utilisateurs via TTL par priorité, votes géolocalisés (100m) et badges de crédibilité en temps réel.

**Architecture:** Publication immédiate à la soumission (`status: 'approved'` + `expiresAt`). Retrait automatique filtré côté endpoint public + garbage collection Redis lazy via clés `tif:sig:ttl:{id}`. Votes communautaires sans login (rate limit IP + localStorage) déclenchés par un VoteToast de 15s lorsque l'utilisateur est à ≤ 100m.

**Tech Stack:** Next.js 15 App Router · TypeScript · Upstash Redis · Vitest · Mapbox GL JS · Firebase Auth (admin uniquement)

---

## File Map

| Action | Fichier | Rôle |
|--------|---------|------|
| Modify | `src/data/signalement-categories.ts` | Ajouter champs + helpers purs (`computeExpiresAt`, `computeCredibility`) |
| Create | `src/data/signalement-categories.test.ts` | Tests helpers purs |
| Create | `src/lib/haversine.ts` | Distance haversine en mètres |
| Create | `src/lib/haversine.test.ts` | Tests haversine |
| Modify | `src/app/api/v1/signalements/route.ts` | POST auto-approve + SETEX ; PATCH +1h |
| Modify | `src/app/api/v1/signalements/public/route.ts` | Filtre expiresAt + garbage collect |
| Create | `src/app/api/v1/signalements/vote/route.ts` | Endpoint vote confirm/deny |
| Modify | `src/components/map/SignalementsLayer.tsx` | Couleurs crédibilité + popup mis à jour |
| Create | `src/components/map/ui/VoteToast.tsx` | Toast compact 15s vote de proximité |
| Modify | `src/components/map/ui/BottomSheet.tsx` | Expiry countdown + badge crédibilité |
| Modify | `src/app/(dashboard)/admin/signalements/page.tsx` | Colonne expiresAt + bouton Prolonger +1h |

---

## Task 1 — Types + helpers purs

**Fichiers :**
- Modify: `src/data/signalement-categories.ts`
- Create: `src/data/signalement-categories.test.ts`

- [ ] **Step 1 : Écrire les tests**

Créer `src/data/signalement-categories.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { computeExpiresAt, computeCredibility, TTL_SECONDS } from './signalement-categories'

describe('TTL_SECONDS', () => {
  it('couvre toutes les priorités', () => {
    for (const p of ['info','vigilance','perturbation','important','urgent','critique']) {
      expect(TTL_SECONDS[p]).toBeGreaterThan(0)
    }
  })
  it('info > urgent > critique', () => {
    expect(TTL_SECONDS.info).toBeGreaterThan(TTL_SECONDS.urgent)
    expect(TTL_SECONDS.urgent).toBeGreaterThan(TTL_SECONDS.critique)
  })
})

describe('computeExpiresAt', () => {
  it('retourne une date future selon la priorité', () => {
    const now = Date.now()
    const exp = new Date(computeExpiresAt('urgent')).getTime()
    expect(exp).toBeGreaterThan(now)
    expect(exp).toBeLessThan(now + TTL_SECONDS.urgent * 1000 + 1000)
  })
  it('fallback sur info si priorité inconnue', () => {
    const exp = new Date(computeExpiresAt('unknown')).getTime()
    expect(exp).toBeGreaterThan(Date.now())
  })
})

describe('computeCredibility', () => {
  it('neutral si moins de 2 votes total', () => {
    expect(computeCredibility(1, 0)).toBe('neutral')
    expect(computeCredibility(0, 0)).toBe('neutral')
  })
  it('confirmed si ≥ 70% de confirms', () => {
    expect(computeCredibility(7, 3)).toBe('confirmed')
    expect(computeCredibility(10, 0)).toBe('confirmed')
  })
  it('false si ≥ 70% de deny', () => {
    expect(computeCredibility(1, 9)).toBe('false')
    expect(computeCredibility(0, 5)).toBe('false')
  })
  it('contested sinon', () => {
    expect(computeCredibility(5, 5)).toBe('contested')
    expect(computeCredibility(6, 4)).toBe('contested')
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx vitest run src/data/signalement-categories.test.ts 2>&1 | tail -20
```

Attendu : erreur d'import `computeExpiresAt` not found.

- [ ] **Step 3 : Mettre à jour `src/data/signalement-categories.ts`**

Ajouter à la fin du fichier existant (après `REDIS_KEY_SIGNALEMENTS`) :

```typescript
// TTL en secondes par niveau de priorité
export const TTL_SECONDS: Record<string, number> = {
  info:         3 * 60 * 60,   // 3h
  vigilance:    2 * 60 * 60,   // 2h
  perturbation: 90 * 60,       // 1h30
  important:    60 * 60,       // 1h
  urgent:       30 * 60,       // 30min
  critique:     20 * 60,       // 20min
}

export function computeExpiresAt(priority: string): string {
  const ttl = TTL_SECONDS[priority] ?? TTL_SECONDS.info
  return new Date(Date.now() + ttl * 1000).toISOString()
}

export type Credibility = 'neutral' | 'confirmed' | 'contested' | 'false'

export function computeCredibility(confirmCount: number, denyCount: number): Credibility {
  const total = confirmCount + denyCount
  if (total < 2) return 'neutral'
  if (confirmCount / total >= 0.7) return 'confirmed'
  if (denyCount / total >= 0.7) return 'false'
  return 'contested'
}
```

Mettre à jour l'interface `Signalement` (ajouter après `disabledAt?`) :

```typescript
  expiresAt:    string
  confirmCount: number
  denyCount:    number
  credibility:  Credibility
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx vitest run src/data/signalement-categories.test.ts 2>&1 | tail -10
```

Attendu : `3 test files | 8 tests passed`.

- [ ] **Step 5 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif" && git add src/data/signalement-categories.ts src/data/signalement-categories.test.ts && git commit -m "feat: types signalement + TTL + computeCredibility helpers"
```

---

## Task 2 — Haversine utility

**Fichiers :**
- Create: `src/lib/haversine.ts`
- Create: `src/lib/haversine.test.ts`

- [ ] **Step 1 : Écrire les tests**

Créer `src/lib/haversine.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { haversineMeters } from './haversine'

describe('haversineMeters', () => {
  it('retourne 0 pour deux points identiques', () => {
    expect(haversineMeters(46.2044, 6.1432, 46.2044, 6.1432)).toBe(0)
  })
  it('retourne ~111km pour 1° de latitude', () => {
    const d = haversineMeters(46.0, 6.0, 47.0, 6.0)
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })
  it('retourne < 100m pour deux points très proches', () => {
    // ~55m
    expect(haversineMeters(46.2044, 6.1432, 46.2049, 6.1432)).toBeLessThan(100)
  })
  it('retourne > 100m pour points éloignés', () => {
    // ~560m
    expect(haversineMeters(46.2044, 6.1432, 46.2094, 6.1432)).toBeGreaterThan(100)
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx vitest run src/lib/haversine.test.ts 2>&1 | tail -10
```

- [ ] **Step 3 : Créer `src/lib/haversine.ts`**

```typescript
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx vitest run src/lib/haversine.test.ts 2>&1 | tail -10
```

Attendu : `4 tests passed`.

- [ ] **Step 5 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif" && git add src/lib/haversine.ts src/lib/haversine.test.ts && git commit -m "feat: haversine distance utility"
```

---

## Task 3 — POST auto-approve + SETEX Redis

**Fichier :**
- Modify: `src/app/api/v1/signalements/route.ts`

- [ ] **Step 1 : Mettre à jour la fonction POST**

Remplacer l'import actuel de `signalement-categories` :

```typescript
import { REDIS_KEY_SIGNALEMENTS, TTL_SECONDS, computeExpiresAt, computeCredibility } from '@/data/signalement-categories'
import type { Signalement } from '@/data/signalement-categories'
```

Remplacer la construction de `item` dans POST (remplacer tout le bloc `const item: Signalement = {` jusqu'à `}`) :

```typescript
  const ttlSec = TTL_SECONDS[body.priority] ?? TTL_SECONDS.info
  const item: Signalement = {
    id:           randomUUID(),
    category:     body.category,
    subcategory:  body.subcategory,
    priority:     body.priority,
    description:  body.description.trim(),
    address:      body.address?.trim() || undefined,
    lat:          body.lat != null ? Number(body.lat) : undefined,
    lng:          body.lng != null ? Number(body.lng) : undefined,
    mediaUrls:    Array.isArray(body.mediaUrls) ? body.mediaUrls : undefined,
    createdAt:    new Date().toISOString(),
    status:       'approved',
    approvedAt:   new Date().toISOString(),
    expiresAt:    computeExpiresAt(body.priority),
    confirmCount: 0,
    denyCount:    0,
    credibility:  'neutral',
  }
```

Après `await save(all)` et avant `sendSignalementNotification`, ajouter :

```typescript
  // Clé Redis individuelle avec TTL natif pour garbage collection
  await redis.set(`tif:sig:ttl:${item.id}`, '1', { ex: ttlSec })
```

- [ ] **Step 2 : Mettre à jour le cas PATCH pour prolonger**

Dans la fonction PATCH, après la ligne `const { id, status, lat, lng } = body`, remplacer par :

```typescript
  const { id, status, lat, lng, extendHours } = body as {
    id: string
    status?: 'approved' | 'rejected' | 'disabled'
    lat?: number
    lng?: number
    extendHours?: number
  }
```

Après le bloc `all[idx] = { ...all[idx], ... }`, avant `await save(all)`, ajouter :

```typescript
  if (extendHours) {
    const current = all[idx].expiresAt ? new Date(all[idx].expiresAt).getTime() : Date.now()
    const newExpiry = new Date(current + extendHours * 3600 * 1000).toISOString()
    all[idx] = { ...all[idx], expiresAt: newExpiry }
    const remainSec = Math.max(0, Math.floor((new Date(newExpiry).getTime() - Date.now()) / 1000))
    if (remainSec > 0) await redis.expire(`tif:sig:ttl:${id}`, remainSec)
  }
```

- [ ] **Step 3 : Vérifier la compilation TypeScript**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx tsc --noEmit 2>&1 | grep "signalements/route" | head -10
```

Attendu : aucune erreur sur ce fichier.

- [ ] **Step 4 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif" && git add src/app/api/v1/signalements/route.ts && git commit -m "feat: signalements auto-approve + expiresAt SETEX + prolonger PATCH"
```

---

## Task 4 — GET /public filtre + garbage collect

**Fichier :**
- Modify: `src/app/api/v1/signalements/public/route.ts`

- [ ] **Step 1 : Réécrire le handler GET**

Remplacer tout le contenu du fichier :

```typescript
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { REDIS_KEY_SIGNALEMENTS } from '@/data/signalement-categories'
import type { Signalement } from '@/data/signalement-categories'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const stored = await redis.get<Signalement[]>(REDIS_KEY_SIGNALEMENTS)
    const all    = Array.isArray(stored) ? stored : []
    const now    = Date.now()

    // Garbage collect : retirer les entrées dont la clé TTL Redis a expiré
    const expiredIds = new Set<string>()
    await Promise.all(
      all
        .filter(s => s.status === 'approved' && s.expiresAt && new Date(s.expiresAt).getTime() <= now)
        .map(async s => {
          const exists = await redis.exists(`tif:sig:ttl:${s.id}`)
          if (!exists) expiredIds.add(s.id)
        })
    )

    if (expiredIds.size > 0) {
      const cleaned = all.map(s =>
        expiredIds.has(s.id) ? { ...s, status: 'disabled' as const, disabledAt: new Date().toISOString() } : s
      )
      await redis.set(REDIS_KEY_SIGNALEMENTS, cleaned)
    }

    const approved = all.filter(s =>
      s.status === 'approved' &&
      s.lat != null &&
      s.lng != null &&
      (!s.expiresAt || new Date(s.expiresAt).getTime() > now)
    )

    const public_ = approved.map(({ id, category, subcategory, priority, description, lat, lng, address, createdAt, expiresAt, confirmCount, denyCount, credibility }) => ({
      id, category, subcategory, priority, description, lat, lng, address, createdAt,
      expiresAt:    expiresAt    ?? null,
      confirmCount: confirmCount ?? 0,
      denyCount:    denyCount    ?? 0,
      credibility:  credibility  ?? 'neutral',
    }))

    return NextResponse.json({ signalements: public_ }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ signalements: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx tsc --noEmit 2>&1 | grep "signalements/public" | head -10
```

Attendu : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif" && git add src/app/api/v1/signalements/public/route.ts && git commit -m "feat: signalements/public filtre expiresAt + garbage collect Redis"
```

---

## Task 5 — Endpoint vote

**Fichier :**
- Create: `src/app/api/v1/signalements/vote/route.ts`

- [ ] **Step 1 : Créer le fichier**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { redis, ratelimit } from '@/lib/redis'
import { REDIS_KEY_SIGNALEMENTS, computeCredibility, TTL_SECONDS } from '@/data/signalement-categories'
import type { Signalement } from '@/data/signalement-categories'
import { haversineMeters } from '@/lib/haversine'

export const dynamic = 'force-dynamic'

const MAX_DENY_FOR_AUTO_DISABLE = 3
const DENY_PENALTY_MS = 10 * 60 * 1000 // -10min par vote deny

async function load(): Promise<Signalement[]> {
  try {
    const stored = await redis.get<Signalement[]>(REDIS_KEY_SIGNALEMENTS)
    return Array.isArray(stored) ? stored : []
  } catch { return [] }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anon'
  const body = await req.json() as { id?: string; vote?: string; lat?: number; lng?: number }
  const { id, vote, lat, lng } = body

  if (!id || !vote || lat == null || lng == null) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }
  if (vote !== 'confirm' && vote !== 'deny') {
    return NextResponse.json({ error: 'vote doit être confirm ou deny' }, { status: 400 })
  }

  // Rate limit par IP + signalement (1 vote/IP/signalement/heure)
  const rl = await ratelimit.limit(`vote:${ip}:${id}`)
  if (!rl.success) {
    return NextResponse.json({ error: 'Vous avez déjà voté pour ce signalement' }, { status: 429 })
  }

  const all = await load()
  const idx = all.findIndex(s => s.id === id)
  if (idx === -1) return NextResponse.json({ error: 'Signalement introuvable' }, { status: 404 })

  const s = all[idx]
  if (s.status !== 'approved') return NextResponse.json({ error: 'Signalement non actif' }, { status: 400 })
  if (!s.expiresAt || new Date(s.expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Signalement expiré' }, { status: 400 })
  }
  if (s.lat == null || s.lng == null) {
    return NextResponse.json({ error: 'Signalement sans coordonnées GPS' }, { status: 400 })
  }

  // Vérification distance ≤ 100m côté serveur
  const dist = haversineMeters(lat, lng, s.lat, s.lng)
  if (dist > 100) {
    return NextResponse.json({ error: `Trop loin du signalement (${Math.round(dist)}m)` }, { status: 403 })
  }

  const confirmCount = (s.confirmCount ?? 0) + (vote === 'confirm' ? 1 : 0)
  const denyCount    = (s.denyCount    ?? 0) + (vote === 'deny'    ? 1 : 0)
  const credibility  = computeCredibility(confirmCount, denyCount)

  let expiresAt = s.expiresAt
  if (vote === 'deny') {
    if (denyCount >= MAX_DENY_FOR_AUTO_DISABLE) {
      // Retrait immédiat
      expiresAt = new Date().toISOString()
    } else {
      // -10min
      const current = new Date(s.expiresAt).getTime()
      expiresAt = new Date(Math.max(Date.now(), current - DENY_PENALTY_MS)).toISOString()
    }
    // Mettre à jour le TTL Redis natif
    const remainSec = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
    if (remainSec > 0) {
      await redis.expire(`tif:sig:ttl:${id}`, remainSec)
    } else {
      await redis.del(`tif:sig:ttl:${id}`)
    }
  }

  all[idx] = { ...s, confirmCount, denyCount, credibility, expiresAt }
  await redis.set(REDIS_KEY_SIGNALEMENTS, all)

  return NextResponse.json({ confirmCount, denyCount, credibility, expiresAt })
}
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx tsc --noEmit 2>&1 | grep "signalements/vote" | head -10
```

Attendu : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif" && git add src/app/api/v1/signalements/vote/route.ts && git commit -m "feat: POST /api/v1/signalements/vote (haversine 100m, rate limit, auto-disable)"
```

---

## Task 6 — SignalementsLayer : couleurs crédibilité

**Fichier :**
- Modify: `src/components/map/SignalementsLayer.tsx`

- [ ] **Step 1 : Mettre à jour l'interface `PublicSignalement`**

Remplacer l'interface existante :

```typescript
interface PublicSignalement {
  id:           string
  category:     string
  subcategory:  string
  priority:     string
  description:  string
  lat:          number
  lng:          number
  address?:     string
  createdAt:    string
  expiresAt:    string | null
  confirmCount: number
  denyCount:    number
  credibility:  'neutral' | 'confirmed' | 'contested' | 'false'
}
```

- [ ] **Step 2 : Ajouter la palette crédibilité + helper couleur marker**

Après `PRIORITY_COLOR`, ajouter :

```typescript
const CREDIBILITY_COLOR: Record<string, string> = {
  confirmed: '#30D158',
  contested: '#FF9500',
  false:     '#FF453A',
}

function markerColor(s: PublicSignalement): string {
  if (s.credibility !== 'neutral') return CREDIBILITY_COLOR[s.credibility] ?? PRIORITY_COLOR[s.priority]
  return PRIORITY_COLOR[s.priority] ?? '#8E8E93'
}
```

- [ ] **Step 3 : Mettre à jour `buildPopupHTML` pour afficher la crédibilité et le TTL**

Remplacer la fonction `buildPopupHTML` entière :

```typescript
function buildPopupHTML(s: PublicSignalement): string {
  const cat   = SIGNAL_CATEGORIES.find(c => c.id === s.category)
  const color = markerColor(s)
  const diff  = (Date.now() - new Date(s.createdAt).getTime()) / 1000
  const ago   = diff < 60 ? `il y a ${Math.round(diff)}s`
              : diff < 3600 ? `il y a ${Math.round(diff / 60)}min`
              : diff < 86400 ? `il y a ${Math.round(diff / 3600)}h`
              : new Date(s.createdAt).toLocaleDateString('fr-CH')

  const priLabels: Record<string, string> = {
    info: 'Info', vigilance: 'Vigilance', perturbation: 'Perturbation',
    important: 'Important', urgent: 'Urgent', critique: 'Critique',
  }

  const credBadge = (() => {
    if (!s.expiresAt) return ''
    const remain = new Date(s.expiresAt).getTime() - Date.now()
    const h = Math.floor(remain / 3600000)
    const m = Math.floor((remain % 3600000) / 60000)
    const ttlStr = h > 0 ? `${h}h${m > 0 ? m + 'min' : ''}` : `${m}min`
    const cred = s.credibility
    const cLabel = cred === 'confirmed' ? `✅ Confirmé (${s.confirmCount})`
                 : cred === 'contested'  ? `⚠️ Contesté`
                 : cred === 'false'      ? `❌ Signalé faux`
                 : ''
    return `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap">
      ${cLabel ? `<span style="font-size:10px;color:${esc(color)}">${esc(cLabel)}</span>` : ''}
      <span style="font-size:10px;color:rgba(255,255,255,0.25)">⏱ ${esc(ttlStr)}</span>
    </div>`
  })()

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:12px 14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="width:28px;height:28px;border-radius:50%;background:${esc(color)}22;border:1.5px solid ${esc(color)}66;
          display:inline-flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">${esc(cat?.icon ?? '📍')}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:#fff;line-height:1.2">${esc(cat?.label ?? s.category)}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.45)">${esc(s.subcategory)}</div>
        </div>
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,0.78);margin-bottom:8px;line-height:1.45">${esc(s.description)}</div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;
          background:${esc(color)}22;color:${esc(color)};border:1px solid ${esc(color)}44;
          text-transform:uppercase;letter-spacing:0.05em">${esc(priLabels[s.priority] ?? s.priority)}</span>
        <span style="font-size:10px;color:rgba(255,255,255,0.25)">${esc(ago)}</span>
      </div>
      ${credBadge}
      <div style="font-size:10px;color:rgba(255,255,255,0.2);margin-top:8px">Signalement utilisateur · TIF</div>
    </div>
  `
}
```

- [ ] **Step 4 : Mettre à jour la couleur du marker dans `fetchAndRender`**

Dans la boucle `for (const s of data.signalements)`, remplacer :

```typescript
const color  = PRIORITY_COLOR[s.priority] ?? '#8E8E93'
```

par :

```typescript
const color  = markerColor(s)
```

- [ ] **Step 5 : Vérifier la compilation**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx tsc --noEmit 2>&1 | grep "SignalementsLayer" | head -10
```

- [ ] **Step 6 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif" && git add src/components/map/SignalementsLayer.tsx && git commit -m "feat: SignalementsLayer couleurs crédibilité + popup TTL"
```

---

## Task 7 — VoteToast composant

**Fichier :**
- Create: `src/components/map/ui/VoteToast.tsx`

- [ ] **Step 1 : Créer le composant**

```typescript
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { haversineMeters } from '@/lib/haversine'
import { SIGNAL_CATEGORIES } from '@/data/signalement-categories'

interface PublicSignalement {
  id:          string
  category:    string
  subcategory: string
  description: string
  lat:         number
  lng:         number
  expiresAt:   string | null
  credibility: string
}

const VOTE_KEY   = (id: string) => `tif:voted:${id}`
const DISMISS_KEY = (id: string) => `tif:vote-dismissed:${id}`
const DISMISS_TTL_MS = 10 * 60 * 1000 // 10min

export default function VoteToast() {
  const [target, setTarget]     = useState<PublicSignalement | null>(null)
  const [progress, setProgress] = useState(100)
  const [voting, setVoting]     = useState(false)
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null)
  const posRef                  = useRef<{ lat: number; lng: number } | null>(null)

  const dismiss = useCallback(() => {
    if (target) {
      sessionStorage.setItem(DISMISS_KEY(target.id), String(Date.now()))
    }
    setTarget(null)
    setProgress(100)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [target])

  const startCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setProgress(100)
    const start = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.max(0, 100 - (elapsed / 15000) * 100)
      setProgress(pct)
      if (pct <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        setTarget(null)
      }
    }, 100)
  }, [])

  const vote = useCallback(async (v: 'confirm' | 'deny') => {
    if (!target || !posRef.current) return
    setVoting(true)
    try {
      await fetch('/api/v1/signalements/vote', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          id:   target.id,
          vote: v,
          lat:  posRef.current.lat,
          lng:  posRef.current.lng,
        }),
      })
      localStorage.setItem(VOTE_KEY(target.id), v)
    } catch { /* silent */ }
    setVoting(false)
    dismiss()
  }, [target, dismiss])

  useEffect(() => {
    if (!navigator.geolocation) return
    let fetchInterval: ReturnType<typeof setInterval>

    const checkProximity = (pos: GeolocationPosition) => {
      posRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
    }

    const findNearest = async () => {
      const pos = posRef.current
      if (!pos) return

      try {
        const res  = await fetch('/api/v1/signalements/public')
        const data = await res.json() as { signalements: PublicSignalement[] }
        const now  = Date.now()

        const candidates = data.signalements
          .filter(s =>
            s.lat != null && s.lng != null &&
            (!s.expiresAt || new Date(s.expiresAt).getTime() > now) &&
            !localStorage.getItem(VOTE_KEY(s.id)) &&
            (() => {
              const dismissed = sessionStorage.getItem(DISMISS_KEY(s.id))
              if (!dismissed) return true
              return now - Number(dismissed) > DISMISS_TTL_MS
            })()
          )
          .map(s => ({ ...s, dist: haversineMeters(pos.lat, pos.lng, s.lat, s.lng) }))
          .filter(s => s.dist <= 100)
          .sort((a, b) => a.dist - b.dist)

        const nearest = candidates[0] ?? null

        setTarget(prev => {
          if (nearest?.id !== prev?.id) {
            if (nearest) startCountdown()
            else if (timerRef.current) clearInterval(timerRef.current)
          }
          return nearest
        })
      } catch { /* silent */ }
    }

    const watchId = navigator.geolocation.watchPosition(checkProximity, undefined, {
      enableHighAccuracy: true, maximumAge: 5000,
    })

    fetchInterval = setInterval(findNearest, 15_000)
    findNearest()

    return () => {
      navigator.geolocation.clearWatch(watchId)
      clearInterval(fetchInterval)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startCountdown])

  if (!target) return null

  const cat = SIGNAL_CATEGORIES.find(c => c.id === target.category)

  return (
    <div style={{
      position:     'fixed',
      bottom:       'calc(env(safe-area-inset-bottom, 0px) + 72px)',
      left:         16,
      right:        16,
      zIndex:       45,
      background:   'rgba(18,18,24,0.97)',
      border:       '1px solid rgba(255,255,255,0.12)',
      borderRadius: 18,
      backdropFilter: 'blur(24px)',
      overflow:     'hidden',
      boxShadow:    '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      {/* Barre de progression */}
      <div style={{
        height:     3,
        background: 'rgba(255,255,255,0.08)',
        position:   'relative',
      }}>
        <div style={{
          position:   'absolute',
          left:       0,
          top:        0,
          height:     '100%',
          width:      `${progress}%`,
          background: '#0A84FF',
          transition: 'width 0.1s linear',
        }} />
      </div>

      <div style={{ padding: '12px 14px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>{cat?.icon ?? '📍'}</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: cat?.color ?? '#fff', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {cat?.label ?? target.category}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', margin: 0, lineHeight: 1.4 }}>
              {target.description.slice(0, 80)}{target.description.length > 80 ? '…' : ''}
            </p>
          </div>
          <button
            onClick={dismiss}
            style={{
              width: 26, height: 26, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)',
              fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
        </div>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 10px' }}>
          Tu es à proximité — c'est toujours vrai ?
        </p>

        {/* Boutons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => vote('confirm')}
            disabled={voting}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: voting ? 'rgba(52,199,89,0.06)' : 'rgba(52,199,89,0.14)',
              color: '#30D158', fontSize: 13, fontWeight: 700,
            }}>
            ✅ Confirmer
          </button>
          <button
            onClick={() => vote('deny')}
            disabled={voting}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: voting ? 'rgba(255,59,48,0.04)' : 'rgba(255,59,48,0.10)',
              color: '#FF453A', fontSize: 13, fontWeight: 700,
            }}>
            ❌ Signaler faux
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Monter le composant dans `MapView.tsx`**

Dans `src/components/map/MapView.tsx`, importer et ajouter `<VoteToast />` après `<SignalementsLayer>` :

```typescript
import VoteToast from '@/components/map/ui/VoteToast'
// ...
// Dans le JSX, après <SignalementsLayer map={map} /> :
<VoteToast />
```

- [ ] **Step 3 : Vérifier la compilation**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx tsc --noEmit 2>&1 | grep -E "VoteToast|MapView" | head -10
```

- [ ] **Step 4 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif" && git add src/components/map/ui/VoteToast.tsx src/components/map/MapView.tsx && git commit -m "feat: VoteToast géolocalisé 15s auto-dismiss + vote confirm/deny"
```

---

## Task 8 — BottomSheet : expiry + badge crédibilité

**Fichier :**
- Modify: `src/components/map/ui/BottomSheet.tsx`

> La BottomSheet est un fichier volumineux. Ces changements s'appliquent uniquement à la vue détail d'un signalement (section `SignalementDetail` ou équivalent).

- [ ] **Step 1 : Ajouter le helper `timeRemaining`**

Chercher dans `BottomSheet.tsx` la fonction `timeAgo` ou tout helper de formatage de date. Juste après, ajouter :

```typescript
function timeRemaining(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expiré'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 0) return `${h}h${m > 0 ? ' ' + m + 'min' : ''}`
  return `${m}min`
}
```

- [ ] **Step 2 : Dans la vue détail signalement, ajouter le bloc expiry + crédibilité**

Chercher le rendu de la date `createdAt` dans la fiche signalement. Juste après le bloc dates, ajouter :

```typescript
{/* Expiry + crédibilité */}
{s.expiresAt && (
  <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        ⏱ Expire dans
      </span>
      <span style={{ fontSize: 12, color: new Date(s.expiresAt).getTime() - Date.now() < 600000 ? '#FF9500' : 'rgba(255,255,255,0.65)' }}>
        {timeRemaining(s.expiresAt)}
      </span>
    </div>
    {(() => {
      const cred = s.credibility ?? 'neutral'
      const credMap = {
        confirmed: { label: `✅ Confirmé par ${s.confirmCount} utilisateur${s.confirmCount > 1 ? 's' : ''}`, color: '#30D158' },
        contested:  { label: `⚠️ Contesté (${s.confirmCount} confirm, ${s.denyCount} faux)`, color: '#FF9500' },
        false:      { label: `❌ Signalé faux par la communauté`, color: '#FF453A' },
        neutral:    null,
      }
      const meta = credMap[cred as keyof typeof credMap]
      if (!meta) return null
      return (
        <span style={{ fontSize: 12, color: meta.color, fontWeight: 600 }}>{meta.label}</span>
      )
    })()}
  </div>
)}
```

- [ ] **Step 3 : Vérifier la compilation**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx tsc --noEmit 2>&1 | grep "BottomSheet" | head -10
```

- [ ] **Step 4 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif" && git add src/components/map/ui/BottomSheet.tsx && git commit -m "feat: BottomSheet signalement expiry countdown + badge crédibilité"
```

---

## Task 9 — Admin : colonne expiresAt + bouton Prolonger +1h

**Fichier :**
- Modify: `src/app/(dashboard)/admin/signalements/page.tsx`

- [ ] **Step 1 : Ajouter `timeRemaining` dans la page admin**

Ajouter après la fonction `fmt` existante :

```typescript
function timeRemaining(iso: string | undefined): string {
  if (!iso) return '—'
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expiré'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}
```

- [ ] **Step 2 : Ajouter la fonction `extend` dans `SignalementsAdmin`**

Dans le composant `SignalementsAdmin`, après la fonction `del`, ajouter :

```typescript
  const extend = async (id: string) => {
    const token = await firebaseAuth.currentUser?.getIdToken()
    await fetch('/api/v1/signalements', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ id, extendHours: 1 }),
    })
    load()
  }
```

- [ ] **Step 3 : Dans `DetailPanel`, ajouter l'affichage expiry + bouton Prolonger**

Passer `onExtend` comme prop de `DetailPanel` :

```typescript
function DetailPanel({
  s, onClose, onAct, onDel, onExtend, acting,
}: {
  s: Signalement
  onClose: () => void
  onAct:     (id: string, status: 'approved' | 'rejected' | 'disabled') => Promise<void>
  onDel:     (id: string) => Promise<void>
  onExtend:  (id: string) => Promise<void>
  acting:    string | null
})
```

Dans le bloc dates du `DetailPanel`, ajouter après `{s.approvedAt && ...}` :

```typescript
{s.expiresAt && (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: 11, color: new Date(s.expiresAt).getTime() - Date.now() < 600000 ? '#FF9500' : 'rgba(255,255,255,0.35)' }}>
      ⏱ Expire dans
    </span>
    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{timeRemaining(s.expiresAt)}</span>
  </div>
)}
```

Dans le bloc Actions, avant le bouton "Supprimer", ajouter :

```typescript
{s.status === 'approved' && s.expiresAt && (
  <button onClick={async () => { await onExtend(s.id) }}
    disabled={acting === s.id}
    style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
      background: 'rgba(10,132,255,0.10)', color: '#0A84FF', fontSize: 14, fontWeight: 600 }}>
    ⏱ Prolonger +1h
  </button>
)}
```

- [ ] **Step 4 : Passer `onExtend={extend}` là où `DetailPanel` est utilisé**

Trouver l'appel `<DetailPanel ... />` et ajouter `onExtend={extend}`.

- [ ] **Step 5 : Afficher `expiresAt` dans la card liste**

Dans la card de liste (`shown.map(s => ...)`), trouver la div avec `timeAgo(s.createdAt)` et ajouter à côté :

```typescript
{s.expiresAt && (
  <span className="text-[10px]" style={{ color: new Date(s.expiresAt).getTime() - Date.now() < 600000 ? '#FF9500' : 'rgba(255,255,255,0.25)' }}>
    ⏱ {timeRemaining(s.expiresAt)}
  </span>
)}
```

- [ ] **Step 6 : Vérifier la compilation**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx tsc --noEmit 2>&1 | grep "admin/signalements" | head -10
```

- [ ] **Step 7 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif" && git add "src/app/(dashboard)/admin/signalements/page.tsx" && git commit -m "feat: admin signalements expiresAt + bouton Prolonger +1h"
```

---

## Task 10 — Build final + vérification

- [ ] **Step 1 : Lancer tous les tests unitaires**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx vitest run src/data/signalement-categories.test.ts src/lib/haversine.test.ts 2>&1 | tail -15
```

Attendu : `2 test files | 12 tests passed`.

- [ ] **Step 2 : Build de production**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx next build 2>&1 | tail -20
```

Attendu : `✓ Compiled successfully`.

- [ ] **Step 3 : Vérifier les nouvelles routes dans le build output**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx next build 2>&1 | grep "signalements"
```

Attendu : routes `/api/v1/signalements`, `/api/v1/signalements/vote`, `/api/v1/signalements/public` présentes.

- [ ] **Step 4 : Push et déploiement Vercel**

```bash
cd "/Users/lostropicos/G7 live view/tif" && git push origin main
```

Vérifier le déploiement sur le dashboard Vercel ou avec `vercel ls`.

- [ ] **Step 5 : Test e2e manuel**

1. Ouvrir `https://tif.borja-swiss-solutions.ch/signaler`
2. Soumettre un signalement avec priorité `urgent`
3. Vérifier qu'il apparaît immédiatement sur `/map` (pas de validation admin)
4. Vérifier que la clé `tif:sig:ttl:{id}` existe dans Upstash avec TTL 1800s
5. Se placer à <100m du signalement (ou simuler avec DevTools overriding geolocation)
6. Vérifier que le VoteToast apparaît après max 15s
7. Voter "Confirmer" → vérifier `localStorage: tif:voted:{id}`
8. Vérifier dans `/admin/signalements` que le champ expiresAt est affiché et le bouton Prolonger visible

---

## Résumé des commits attendus

```
feat: types signalement + TTL + computeCredibility helpers
feat: haversine distance utility
feat: signalements auto-approve + expiresAt SETEX + prolonger PATCH
feat: signalements/public filtre expiresAt + garbage collect Redis
feat: POST /api/v1/signalements/vote (haversine 100m, rate limit, auto-disable)
feat: SignalementsLayer couleurs crédibilité + popup TTL
feat: VoteToast géolocalisé 15s auto-dismiss + vote confirm/deny
feat: BottomSheet signalement expiry countdown + badge crédibilité
feat: admin signalements expiresAt + bouton Prolonger +1h
```
