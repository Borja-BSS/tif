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
    if (expiresAt - Date.now() <= 0) return
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
