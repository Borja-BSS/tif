export const CONSENT_VERSION = '1'
const CONSENT_KEY = 'tif-consent-v1'
const SESSION_KEY = 'tif-sid'

export interface TifConsent {
  analytics: boolean
  geo: boolean
  version: string
  ts: number
}

export function getConsent(): TifConsent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    return raw ? (JSON.parse(raw) as TifConsent) : null
  } catch { return null }
}

export function saveConsent(c: TifConsent): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CONSENT_KEY, JSON.stringify(c))
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}
