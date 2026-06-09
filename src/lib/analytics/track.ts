import { getConsent, getSessionId } from './consent'

export type TifEvent =
  | 'page_view' | 'map_open' | 'filter_click' | 'crossing_open'
  | 'route_search' | 'consent_given' | 'consent_refused'
  | 'geo_granted' | 'geo_denied'

export async function track(event: TifEvent, data?: Record<string, unknown>): Promise<void> {
  const consent = getConsent()
  if (!consent?.analytics) return
  const sessionId = getSessionId()
  try {
    await fetch('/api/v1/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, event, data }),
      keepalive: true,
    })
  } catch { /* silent */ }
}
