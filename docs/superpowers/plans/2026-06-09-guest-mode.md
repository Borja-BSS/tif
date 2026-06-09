# Guest Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un mode invité de 60 secondes sur la page login, permettant d'accéder à la carte TIF sans compte, avec un countdown visible et une modale d'expiration incitant à créer un compte.

**Architecture:** Un cookie JWT signé `tif-guest-token` (60 s, même secret que le middleware existant) satisfait le gardien Edge. Un `GuestContext` autonome gère le countdown côté client et expose `isGuest`/`hasExpired`/`secondsLeft`. La garde client de `map/page.tsx` accepte les guests via une seule ligne supplémentaire. AuthContext n'est pas touché.

**Tech Stack:** Next.js 15 App Router · TypeScript · jose (déjà présent) · Vitest · React context

---

## Fichiers — Vue d'ensemble

| Action | Chemin |
|--------|--------|
| CRÉER | `src/app/api/auth/guest/route.ts` |
| CRÉER | `src/context/GuestContext.tsx` |
| CRÉER | `src/context/GuestContext.test.ts` |
| CRÉER | `src/components/guest/GuestBanner.tsx` |
| CRÉER | `src/components/guest/GuestExpiredModal.tsx` |
| MODIFIER | `middleware.ts` |
| MODIFIER | `src/app/Providers.tsx` |
| MODIFIER | `src/app/(auth)/login/page.tsx` |
| MODIFIER | `src/app/(dashboard)/map/page.tsx` |

---

## Task 1 : Route API `/api/auth/guest`

**Files:**
- Create: `src/app/api/auth/guest/route.ts`

- [ ] **Step 1 : Créer le fichier de route**

```typescript
// src/app/api/auth/guest/route.ts
import { NextResponse } from 'next/server'
import { SignJWT }      from 'jose'

export const dynamic = 'force-dynamic'

const GUEST_TTL = 60  // secondes

export async function POST(): Promise<NextResponse> {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)
  const now    = Date.now()
  const expSec = Math.floor(now / 1000) + GUEST_TTL

  const token = await new SignJWT({ sub: 'guest', role: 'guest' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expSec)
    .sign(secret)

  const res = NextResponse.json({ ok: true, expiresAt: now + GUEST_TTL * 1000 })

  res.cookies.set('tif-guest-token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   GUEST_TTL,
    path:     '/',
  })

  return res
}
```

- [ ] **Step 2 : Vérifier que TypeScript compile**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx tsc --noEmit 2>&1 | grep "guest" || echo "OK — aucune erreur guest"
```

Attendu : aucune ligne d'erreur mentionnant `guest`.

- [ ] **Step 3 : Smoke test manuel en dev**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npm run dev &
sleep 5 && curl -s -X POST http://localhost:3000/api/auth/guest | python3 -m json.tool
```

Attendu :
```json
{
  "ok": true,
  "expiresAt": 1749500000000
}
```
Et header `set-cookie` contenant `tif-guest-token`.

- [ ] **Step 4 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif"
git add src/app/api/auth/guest/route.ts
git commit -m "feat(guest): add POST /api/auth/guest — signs 60s JWT cookie"
```

---

## Task 2 : GuestContext + tests Vitest

**Files:**
- Create: `src/context/GuestContext.tsx`
- Create: `src/context/GuestContext.test.ts`

- [ ] **Step 1 : Écrire le test en premier (TDD)**

```typescript
// src/context/GuestContext.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { GuestProvider, useGuest } from './GuestContext'

// ── sessionStorage mock ───────────────────────────────────────────────────────
const store: Record<string, string> = {}
const sessionStorageMock = {
  getItem:    vi.fn((k: string) => store[k] ?? null),
  setItem:    vi.fn((k: string, v: string) => { store[k] = v }),
  removeItem: vi.fn((k: string) => { delete store[k] }),
}
Object.defineProperty(window, 'sessionStorage', {
  value:    sessionStorageMock,
  writable: true,
})

// ── document.cookie stub (endGuest efface le cookie) ─────────────────────────
Object.defineProperty(document, 'cookie', {
  set: vi.fn(),
  get: vi.fn(() => ''),
  configurable: true,
})

// ── helpers ───────────────────────────────────────────────────────────────────
function inFuture(ms: number) { return Date.now() + ms }
function inPast(ms: number)   { return Date.now() - ms }
const wrapper = GuestProvider

describe('GuestContext — état initial', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    vi.clearAllMocks()
  })

  it('isGuest=false sans session stockée', () => {
    const { result } = renderHook(() => useGuest(), { wrapper })
    expect(result.current.isGuest).toBe(false)
    expect(result.current.hasExpired).toBe(false)
    expect(result.current.secondsLeft).toBe(0)
  })
})

describe('GuestContext — startGuest', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    vi.clearAllMocks()
  })

  it('isGuest=true et secondsLeft>0 après startGuest', () => {
    const { result } = renderHook(() => useGuest(), { wrapper })
    act(() => result.current.startGuest(inFuture(60_000)))
    expect(result.current.isGuest).toBe(true)
    expect(result.current.secondsLeft).toBeGreaterThan(0)
    expect(result.current.secondsLeft).toBeLessThanOrEqual(60)
  })

  it('stocke expiresAt dans sessionStorage', () => {
    const { result } = renderHook(() => useGuest(), { wrapper })
    const expiresAt  = inFuture(60_000)
    act(() => result.current.startGuest(expiresAt))
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith('tif-guest-expiry', String(expiresAt))
  })

  it('startGuest avec timestamp passé → isGuest=false', () => {
    const { result } = renderHook(() => useGuest(), { wrapper })
    act(() => result.current.startGuest(inPast(5_000)))
    expect(result.current.isGuest).toBe(false)
  })
})

describe('GuestContext — endGuest', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    vi.clearAllMocks()
  })

  it('remet tout à zéro', () => {
    const { result } = renderHook(() => useGuest(), { wrapper })
    act(() => result.current.startGuest(inFuture(60_000)))
    act(() => result.current.endGuest())
    expect(result.current.isGuest).toBe(false)
    expect(result.current.secondsLeft).toBe(0)
    expect(result.current.hasExpired).toBe(false)
  })

  it('retire la clé sessionStorage', () => {
    const { result } = renderHook(() => useGuest(), { wrapper })
    act(() => result.current.startGuest(inFuture(60_000)))
    act(() => result.current.endGuest())
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('tif-guest-expiry')
  })
})

describe('GuestContext — expiration via fake timers', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('hasExpired=true quand le countdown atteint 0', () => {
    const { result } = renderHook(() => useGuest(), { wrapper })
    act(() => result.current.startGuest(Date.now() + 2_000))
    act(() => vi.advanceTimersByTime(3_000))
    expect(result.current.hasExpired).toBe(true)
    expect(result.current.isGuest).toBe(false)
    expect(result.current.secondsLeft).toBe(0)
  })
})
```

- [ ] **Step 2 : Lancer le test — vérifier qu'il échoue (TDD)**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx vitest run src/context/GuestContext.test.ts 2>&1 | tail -20
```

Attendu : erreur `Cannot find module './GuestContext'`.

- [ ] **Step 3 : Implémenter GuestContext**

```typescript
// src/context/GuestContext.tsx
'use client'

import {
  createContext, useContext, useEffect, useState, useRef,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'tif-guest-expiry'

// ── Types ─────────────────────────────────────────────────────────────────────
interface GuestContextValue {
  isGuest:     boolean
  hasExpired:  boolean
  secondsLeft: number
  startGuest:  (expiresAt: number) => void
  endGuest:    () => void
}

const GuestContext = createContext<GuestContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────
export function GuestProvider({ children }: { children: ReactNode }) {
  const [isGuest,     setIsGuest]     = useState(false)
  const [hasExpired,  setHasExpired]  = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function clearTick() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  function startCountdown(expiresAt: number) {
    clearTick()
    const remaining = Math.floor((expiresAt - Date.now()) / 1000)
    if (remaining <= 0) return

    setIsGuest(true)
    setHasExpired(false)
    setSecondsLeft(remaining)

    intervalRef.current = setInterval(() => {
      const rem = Math.floor((expiresAt - Date.now()) / 1000)
      if (rem <= 0) {
        clearTick()
        setSecondsLeft(0)
        setIsGuest(false)
        setHasExpired(true)
        sessionStorage.removeItem(STORAGE_KEY)
      } else {
        setSecondsLeft(rem)
      }
    }, 1000)
  }

  // Hydrate depuis sessionStorage au montage (survit aux re-renders HMR)
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return
    const expiresAt = parseInt(stored, 10)
    if (!Number.isFinite(expiresAt)) return
    startCountdown(expiresAt)
    return clearTick
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startGuest(expiresAt: number) {
    sessionStorage.setItem(STORAGE_KEY, String(expiresAt))
    startCountdown(expiresAt)
  }

  function endGuest() {
    clearTick()
    sessionStorage.removeItem(STORAGE_KEY)
    document.cookie = 'tif-guest-token=; Max-Age=0; path=/'
    setIsGuest(false)
    setHasExpired(false)
    setSecondsLeft(0)
  }

  return (
    <GuestContext.Provider value={{ isGuest, hasExpired, secondsLeft, startGuest, endGuest }}>
      {children}
    </GuestContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useGuest(): GuestContextValue {
  const ctx = useContext(GuestContext)
  if (!ctx) throw new Error('useGuest must be used inside GuestProvider')
  return ctx
}
```

- [ ] **Step 4 : Relancer les tests — vérifier qu'ils passent**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx vitest run src/context/GuestContext.test.ts 2>&1 | tail -20
```

Attendu :
```
✓ GuestContext — état initial (1)
✓ GuestContext — startGuest (3)
✓ GuestContext — endGuest (2)
✓ GuestContext — expiration via fake timers (1)
Test Files  1 passed (1)
```

- [ ] **Step 5 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif"
git add src/context/GuestContext.tsx src/context/GuestContext.test.ts
git commit -m "feat(guest): add GuestContext with 60s countdown, tests pass"
```

---

## Task 3 : Modifier le middleware (ajout pur)

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1 : Lire le middleware actuel et appliquer la modification**

Remplacer le bloc `if (!token)` existant (lignes 30–33) + extraire `secret` avant ce bloc :

```typescript
// middleware.ts — DIFF à appliquer
// Avant (lignes 30-40) :
//
//   if (!token) {
//     return NextResponse.redirect(new URL('/login', req.url))
//   }
//   try {
//     const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)
//     await jwtVerify(token, secret)
//     return res
//   } catch {
//     return NextResponse.redirect(new URL('/login', req.url))
//   }
//
// Après :

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)

  if (!token) {
    // Guest token check — additionnel, rien d'existant modifié
    const guestToken =
      req.cookies.get('tif-guest-token')?.value
    if (guestToken) {
      try {
        await jwtVerify(guestToken, secret)
        return res
      } catch {
        return NextResponse.redirect(new URL('/login', req.url))
      }
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    await jwtVerify(token, secret)
    return res
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }
```

Le fichier complet `middleware.ts` après modification :

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/', '/login', '/register', '/api/auth']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const requestId = crypto.randomUUID()

  // Security headers (ADR-001 edge layer)
  const res = NextResponse.next()
  res.headers.set('X-Request-Id', requestId)
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  res.headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()')
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://www.gstatic.com https://www.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://*.mapbox.com wss://*.mapbox.com https://*.ably.io wss://*.ably.io https://*.ably-realtime.com wss://*.ably-realtime.com https://accounts.google.com https://*.googleapis.com https://tif-2af68.firebaseapp.com; frame-src https://accounts.google.com https://tif-2af68.firebaseapp.com https://www.google.com; worker-src blob:;"
  )

  // Routes publiques — pas de vérification JWT
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return res

  // Extraction du token de session utilisateur
  const token = req.cookies.get('next-auth.session-token')?.value
    ?? req.cookies.get('__Secure-next-auth.session-token')?.value

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)

  if (!token) {
    // Guest token check — ajout additionnel, rien d'existant modifié
    const guestToken = req.cookies.get('tif-guest-token')?.value
    if (guestToken) {
      try {
        await jwtVerify(guestToken, secret)
        return res
      } catch {
        return NextResponse.redirect(new URL('/login', req.url))
      }
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    await jwtVerify(token, secret)
    return res
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 2 : Vérifier que TypeScript compile**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx tsc --noEmit 2>&1 | grep "middleware" || echo "OK"
```

Attendu : `OK`

- [ ] **Step 3 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif"
git add middleware.ts
git commit -m "feat(guest): middleware accepts tif-guest-token as valid pass"
```

---

## Task 4 : GuestBanner (countdown visible)

**Files:**
- Create: `src/components/guest/GuestBanner.tsx`

- [ ] **Step 1 : Créer le composant**

```typescript
// src/components/guest/GuestBanner.tsx
'use client'

import { useGuest }  from '@/context/GuestContext'
import { useRouter } from 'next/navigation'

export function GuestBanner() {
  const { isGuest, secondsLeft } = useGuest()
  const router = useRouter()

  if (!isGuest) return null

  const mins    = Math.floor(secondsLeft / 60)
  const secs    = secondsLeft % 60
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`

  const urgency     = secondsLeft <= 5 ? 'red' : secondsLeft <= 15 ? 'orange' : 'neutral'
  const bgColor     = urgency === 'red'    ? 'rgba(255,69,58,0.18)'
                    : urgency === 'orange' ? 'rgba(255,159,10,0.14)'
                    :                        'rgba(255,255,255,0.06)'
  const borderColor = urgency === 'red'    ? 'rgba(255,69,58,0.40)'
                    : urgency === 'orange' ? 'rgba(255,159,10,0.35)'
                    :                        'rgba(255,255,255,0.14)'
  const timeColor   = urgency === 'red'    ? '#FF453A'
                    : urgency === 'orange' ? '#FF9F0A'
                    :                        'rgba(255,255,255,0.55)'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position:       'fixed',
        bottom:         '20px',
        left:           '50%',
        transform:      'translateX(-50%)',
        zIndex:         9998,
        display:        'flex',
        alignItems:     'center',
        gap:            '14px',
        padding:        '10px 14px 10px 16px',
        borderRadius:   '16px',
        background:     bgColor,
        backdropFilter: 'blur(40px) saturate(200%) brightness(1.06)',
        border:         `0.5px solid ${borderColor}`,
        boxShadow:      'inset 0 0.5px 0 rgba(255,255,255,0.20), 0 4px 24px rgba(0,0,0,0.22)',
        transition:     'background 0.5s ease, border-color 0.5s ease',
        whiteSpace:     'nowrap',
      }}
    >
      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>
        Mode invité
      </span>

      <span
        style={{
          fontSize:           '14px',
          fontWeight:         700,
          color:              timeColor,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing:      '0.02em',
          transition:         'color 0.4s ease',
          minWidth:           '32px',
          textAlign:          'center',
        }}
      >
        {timeStr}
      </span>

      <button
        onClick={() => router.push('/login')}
        style={{
          fontSize:     '12px',
          fontWeight:   600,
          color:        '#fff',
          background:   '#0071E3',
          border:       'none',
          borderRadius: '10px',
          padding:      '6px 12px',
          cursor:       'pointer',
          lineHeight:   1,
          flexShrink:   0,
        }}
      >
        Créer un compte →
      </button>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx tsc --noEmit 2>&1 | grep "GuestBanner" || echo "OK"
```

Attendu : `OK`

- [ ] **Step 3 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif"
git add src/components/guest/GuestBanner.tsx
git commit -m "feat(guest): add GuestBanner countdown component"
```

---

## Task 5 : GuestExpiredModal (overlay à l'expiration)

**Files:**
- Create: `src/components/guest/GuestExpiredModal.tsx`

- [ ] **Step 1 : Créer le composant**

```typescript
// src/components/guest/GuestExpiredModal.tsx
'use client'

import { useGuest }  from '@/context/GuestContext'
import { useRouter } from 'next/navigation'

export function GuestExpiredModal() {
  const { hasExpired } = useGuest()
  const router         = useRouter()

  if (!hasExpired) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Accès invité expiré"
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         99999,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(28px) saturate(150%)',
      }}
    >
      <div
        style={{
          maxWidth:    '360px',
          width:       '100%',
          margin:      '0 20px',
          padding:     '32px 28px',
          borderRadius: '22px',
          background:  'rgba(28,28,30,0.94)',
          border:      '0.5px solid rgba(255,255,255,0.18)',
          boxShadow:   'inset 0 0.5px 0 rgba(255,255,255,0.28), 0 32px 96px rgba(0,0,0,0.65)',
          textAlign:   'center',
        }}
      >
        <div style={{ fontSize: '40px', marginBottom: '16px', lineHeight: 1 }}>⏱</div>

        <h2 style={{
          color:         'rgba(255,255,255,0.92)',
          fontSize:      '20px',
          fontWeight:    700,
          marginBottom:  '10px',
          letterSpacing: '-0.01em',
          fontFamily:    '-apple-system, Inter, sans-serif',
        }}>
          Accès invité expiré
        </h2>

        <p style={{
          color:         'rgba(255,255,255,0.55)',
          fontSize:      '14px',
          lineHeight:    1.55,
          marginBottom:  '28px',
          padding:       '0 4px',
        }}>
          Créez un compte pour accéder en continu à l'intelligence territoriale du Grand Genève.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => router.push('/login?tab=register')}
            style={{
              background:    '#0071E3',
              color:         '#fff',
              border:        'none',
              borderRadius:  '13px',
              padding:       '14px',
              fontSize:      '15px',
              fontWeight:    600,
              cursor:        'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            Créer mon compte
          </button>

          <button
            onClick={() => router.push('/login')}
            style={{
              background:   'transparent',
              color:        'rgba(255,255,255,0.45)',
              border:       '1px solid rgba(255,255,255,0.12)',
              borderRadius: '13px',
              padding:      '13px',
              fontSize:     '14px',
              cursor:       'pointer',
            }}
          >
            Se connecter
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx tsc --noEmit 2>&1 | grep "GuestExpired" || echo "OK"
```

Attendu : `OK`

- [ ] **Step 3 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif"
git add src/components/guest/GuestExpiredModal.tsx
git commit -m "feat(guest): add GuestExpiredModal overlay"
```

---

## Task 6 : Providers + Login page

**Files:**
- Modify: `src/app/Providers.tsx`
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1 : Ajouter GuestProvider dans Providers.tsx**

```typescript
// src/app/Providers.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider }                      from '@/context/AuthContext'
import { GuestProvider }                     from '@/context/GuestContext'
import { useState }                          from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <AuthProvider>
      <GuestProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </GuestProvider>
    </AuthProvider>
  )
}
```

- [ ] **Step 2 : Modifier la page login**

Le fichier complet `src/app/(auth)/login/page.tsx` avec :
1. Import `useGuest` + `useSearchParams`
2. Lecture du query param `?tab=register` pour pré-sélectionner le tab
3. `handleGuest()` : POST + startGuest + router.push
4. Bouton "Mode invité" avec séparateur visuel
5. Disclaimer mis à jour

```typescript
// src/app/(auth)/login/page.tsx
'use client'

import { useState, useEffect }   from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link                       from 'next/link'
import { useAuth }                from '@/context/AuthContext'
import { useGuest }               from '@/context/GuestContext'

export default function LoginPage() {
  const {
    signInGoogle, signInEmail, registerEmail,
    user, loading, error, clearError,
  } = useAuth()
  const { startGuest } = useGuest()
  const router         = useRouter()
  const searchParams   = useSearchParams()

  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'google'

  const [tab,             setTab]             = useState<'google' | 'email' | 'register'>(initialTab as 'google' | 'email' | 'register')
  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy,            setBusy]            = useState(false)
  const [localError,      setLocalError]      = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user) router.replace('/map')
  }, [user, loading, router])

  function resetForm() {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setLocalError(null)
    clearError()
  }

  async function handleGoogle() {
    setLocalError(null)
    clearError()
    setBusy(true)
    await signInGoogle()
    setBusy(false)
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setLocalError(null)
    clearError()
    setBusy(true)
    await signInEmail(email, password)
    setBusy(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLocalError(null)
    clearError()
    if (password !== confirmPassword) {
      setLocalError('Les mots de passe ne correspondent pas')
      return
    }
    if (password.length < 6) {
      setLocalError('Le mot de passe doit faire au moins 6 caractères')
      return
    }
    setBusy(true)
    await registerEmail(email, password)
    setBusy(false)
  }

  async function handleGuest() {
    setLocalError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/auth/guest', { method: 'POST' })
      if (!res.ok) throw new Error('Erreur serveur')
      const { expiresAt } = await res.json() as { expiresAt: number }
      startGuest(expiresAt)
      router.push('/map')
    } catch {
      setLocalError("Impossible d'accéder en mode invité")
      setBusy(false)
    }
  }

  const displayError = localError || error

  const inputStyle = {
    background:   'var(--bg-card)',
    color:        'var(--text-primary)',
    border:       '1px solid var(--border)',
    borderRadius: '12px',
    padding:      '14px 16px',
    fontSize:     '15px',
    outline:      'none',
  }

  const btnPrimary = (isBusy: boolean) => ({
    background:   'var(--brand)',
    color:        '#fff',
    border:       'none',
    borderRadius: '12px',
    padding:      '14px 20px',
    fontSize:     '15px',
    fontWeight:   600,
    cursor:       isBusy ? 'not-allowed' : 'pointer',
    opacity:      isBusy ? 0.7 : 1,
  })

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="text-[22px] font-bold tracking-tight"
            style={{ color: 'var(--text-primary)', fontFamily: '-apple-system, Inter, sans-serif' }}
          >
            Börja
          </Link>
          <div className="w-8 h-px mx-auto my-4" style={{ background: 'var(--border)' }} />
          <h1 className="text-[28px] font-bold tracking-[-0.015em]" style={{ color: 'var(--text-primary)' }}>
            Accès Grand{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--italic)', fontWeight: 700 }}>Genève.</em>
          </h1>
          <p className="text-[14px] mt-2" style={{ color: 'var(--text-secondary)' }}>
            Plateforme d'intelligence territoriale
          </p>
        </div>

        {/* Tabs */}
        <div
          className="flex rounded-xl p-1 mb-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {(['google', 'email', 'register'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); resetForm() }}
              className="flex-1 py-2 text-[13px] font-medium rounded-lg transition-all"
              style={{
                background: tab === t ? 'var(--bg)' : 'transparent',
                color:      tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow:  tab === t ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {t === 'google' ? 'Google' : t === 'email' ? 'Connexion' : 'Créer'}
            </button>
          ))}
        </div>

        {/* Google */}
        {tab === 'google' && (
          <button
            onClick={handleGoogle}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 transition-all duration-200"
            style={{
              background:   '#FFFFFF',
              color:        '#1F2937',
              border:       '1px solid var(--border)',
              borderRadius: '12px',
              padding:      '14px 20px',
              fontSize:     '15px',
              fontWeight:   500,
              cursor:       busy ? 'not-allowed' : 'pointer',
              opacity:      busy ? 0.7 : 1,
              boxShadow:    'var(--shadow-sm)',
            }}
          >
            <GoogleIcon />
            {busy ? 'Connexion…' : 'Continuer avec Google'}
          </button>
        )}

        {/* Email — connexion */}
        {tab === 'email' && (
          <form onSubmit={handleEmail} className="flex flex-col gap-3">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            <button type="submit" disabled={busy} style={btnPrimary(busy)}>
              {busy ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        )}

        {/* Créer un compte */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="Confirmer le mot de passe" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={inputStyle} />
            <button type="submit" disabled={busy} style={btnPrimary(busy)}>
              {busy ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>
        )}

        {/* Erreur */}
        {displayError && (
          <p className="text-center text-[12px] mt-3" style={{ color: '#FF453A' }}>
            {displayError}
          </p>
        )}

        {/* Séparateur mode invité */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>ou</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        {/* Bouton mode invité */}
        <button
          onClick={handleGuest}
          disabled={busy}
          className="w-full transition-all duration-200"
          style={{
            background:   'transparent',
            color:        'var(--text-secondary)',
            border:       '1px solid var(--border)',
            borderRadius: '12px',
            padding:      '13px 20px',
            fontSize:     '14px',
            fontWeight:   500,
            cursor:       busy ? 'not-allowed' : 'pointer',
            opacity:      busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Chargement…' : '👁 Explorer en mode invité · 1 min'}
        </button>

        {/* Disclaimer */}
        <p className="text-center text-[12px] mt-6" style={{ color: 'var(--text-tertiary)' }}>
          Accès invité limité à 60 secondes · Données Grand Genève
        </p>

        {/* Back */}
        <div className="text-center mt-8">
          <Link href="/" className="text-[13px] transition-colors duration-150" style={{ color: 'var(--text-tertiary)' }}>
            ← Retour à l'accueil
          </Link>
        </div>

      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  )
}
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx tsc --noEmit 2>&1 | grep -E "login|Providers" || echo "OK"
```

Attendu : `OK`

- [ ] **Step 4 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif"
git add src/app/Providers.tsx src/app/(auth)/login/page.tsx
git commit -m "feat(guest): add guest button on login page, wire GuestProvider"
```

---

## Task 7 : Intégrer guest dans map/page.tsx

**Files:**
- Modify: `src/app/(dashboard)/map/page.tsx`

- [ ] **Step 1 : Appliquer les 3 modifications minimales**

Ajouter en haut du fichier (après les imports existants) :
```typescript
import { useGuest }           from '@/context/GuestContext'
import { GuestBanner }        from '@/components/guest/GuestBanner'
import { GuestExpiredModal }  from '@/components/guest/GuestExpiredModal'
```

Dans le corps du composant `MapPage`, après `const router = useRouter()` :
```typescript
const { isGuest } = useGuest()
```

Modifier la ligne de guard (actuellement ligne 42) :
```typescript
// Avant :
if (sessionResult.status !== 'loading' && !session) router.replace('/login')
// Après :
if (sessionResult.status !== 'loading' && !session && !isGuest) router.replace('/login')
```

Dans le JSX, avant la fermeture du `</div>` principal (après `<TpgLineStopsLayer />`) :
```tsx
      {/* Guest mode — bannière countdown + modale d'expiration */}
      <GuestBanner />
      <GuestExpiredModal />
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx tsc --noEmit 2>&1 | grep "map" || echo "OK"
```

Attendu : `OK`

- [ ] **Step 3 : Lancer toute la suite de tests**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npx vitest run 2>&1 | tail -15
```

Attendu : tous les tests passent, `GuestContext` inclus.

- [ ] **Step 4 : Commit**

```bash
cd "/Users/lostropicos/G7 live view/tif"
git add src/app/(dashboard)/map/page.tsx
git commit -m "feat(guest): wire guest guard + Banner + Modal into map page"
```

---

## Task 8 : Vérification end-to-end + commit final

- [ ] **Step 1 : Lancer le serveur dev**

```bash
cd "/Users/lostropicos/G7 live view/tif" && npm run dev
```

- [ ] **Step 2 : Scénario 1 — flux invité complet**

1. Ouvrir `http://localhost:3000/login`
2. Vérifier que le bouton "Explorer en mode invité · 1 min" est visible sous le séparateur "ou"
3. Cliquer sur le bouton
4. Vérifier la redirection vers `/map` (carte chargée)
5. Vérifier la `GuestBanner` en bas avec countdown `0:60` → `0:59`…
6. Attendre l'expiration (ou raccourcir `GUEST_TTL` à 5 en local pour tester rapidement)
7. Vérifier que la `GuestExpiredModal` apparaît à t=0
8. Cliquer "Créer mon compte" → vérifier redirect vers `/login?tab=register` avec tab "Créer" actif

- [ ] **Step 3 : Scénario 2 — flux normal non affecté**

1. Aller sur `/login`
2. Se connecter avec Google (ou email/password existant)
3. Vérifier que la carte charge normalement
4. Vérifier que `GuestBanner` et `GuestExpiredModal` sont absents (isGuest=false)

- [ ] **Step 4 : Scénario 3 — cookie expiré intercepté par middleware**

1. Obtenir un cookie guest valide (scénario 1)
2. Attendre expiration
3. Rafraîchir la page (hard reload)
4. Vérifier redirect vers `/login` (middleware refuse le cookie expiré)

- [ ] **Step 5 : Tag de version et commit de vérification**

```bash
cd "/Users/lostropicos/G7 live view/tif"
git log --oneline -8
```

Tous les commits de la feature doivent apparaître proprement.

- [ ] **Step 6 : Sauvegarder la mémoire projet**

Mettre à jour `/Users/lostropicos/.claude/projects/-Users-lostropicos/memory/project_tif_g7.md` pour noter que le mode invité (60s JWT guest) est implémenté et mergé.

---

## Self-review

**Spec coverage :**
- ✅ Route POST `/api/auth/guest` — Task 1
- ✅ GuestContext isolé (sans toucher AuthContext) — Task 2
- ✅ Middleware additionnel (rien retiré) — Task 3
- ✅ GuestBanner countdown progressif — Task 4
- ✅ GuestExpiredModal overlay — Task 5
- ✅ GuestProvider dans Providers (pas dans AuthContext) — Task 6
- ✅ Login page : bouton + séparateur + query param tab=register — Task 6
- ✅ Map page : guard + renders + 3 imports — Task 7
- ✅ AuthContext non modifié — vérifié dans chaque task TypeScript check
- ✅ Prisma non modifié — aucune migration, stateless JWT

**Cohérence des types :**
- `startGuest(expiresAt: number)` — défini Task 2, appelé Task 6 ✅
- `useGuest()` retourne `{ isGuest, hasExpired, secondsLeft, startGuest, endGuest }` — utilisé dans Task 4, 5, 6, 7 ✅
- `GuestProvider` exporté depuis Task 2, importé dans Task 6 ✅
- `GuestBanner` / `GuestExpiredModal` exportés Tasks 4-5, importés Task 7 ✅

**Placeholders :** aucun TBD, TODO, ou "implement later". ✅
