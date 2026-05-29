import { logger } from '@/lib/logger'
import type { WazeResponse } from './types'

// ⚠️  ENDPOINT NON OFFICIEL — dev uniquement
// Pas de support Waze/Google, peut être coupé sans préavis.
// En production : remplacer par le Waze CCP (partenariat public requis).
const WAZE_BASE = 'https://www.waze.com/live-map/api/georss'

const BBOX = {
  top:    46.45,
  bottom: 46.05,
  left:   5.85,
  right:  6.60,
} as const

const TIMEOUT = 10_000

export async function fetchWazeData(): Promise<WazeResponse> {
  const url = new URL(WAZE_BASE)
  url.searchParams.set('top',    String(BBOX.top))
  url.searchParams.set('bottom', String(BBOX.bottom))
  url.searchParams.set('left',   String(BBOX.left))
  url.searchParams.set('right',  String(BBOX.right))
  url.searchParams.set('env',    'row')
  url.searchParams.set('types',  'jams,alerts')

  const res = await fetch(url.toString(), {
    signal:  AbortSignal.timeout(TIMEOUT),
    headers: {
      // UA réaliste pour éviter le filtrage — endpoint public non authentifié
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':     'application/json, text/plain, */*',
      'Referer':    'https://www.waze.com/live-map',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    logger.warn({ status: res.status, url: url.toString() }, 'waze:unofficial:http-error')
    throw new Error(`Waze ${res.status}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json') && !contentType.includes('text/plain')) {
    const preview = (await res.text()).slice(0, 200)
    logger.warn({ contentType, preview }, 'waze:unofficial:unexpected-content-type')
    throw new Error(`Waze returned non-JSON: ${contentType}`)
  }

  const data = await res.json() as WazeResponse
  logger.info(
    { jams: data.jams?.length ?? 0, alerts: data.alerts?.length ?? 0 },
    'waze:unofficial:fetched',
  )
  return data
}
