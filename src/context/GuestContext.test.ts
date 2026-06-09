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
    expect(sessionStorageMock.setItem).not.toHaveBeenCalled()
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
