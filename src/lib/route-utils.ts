import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { incrementRequest } from './metrics'
import { requestLogger }   from './logger'

type Handler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse | Response>

/** Wrapper qui mesure la latence, incrémente les compteurs SLO, et capture les erreurs Sentry */
export function withMetrics(route: string, handler: Handler): Handler {
  return async (req: NextRequest, ctx?: unknown): Promise<NextResponse | Response> => {
    const start     = Date.now()
    const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID()
    const log       = requestLogger(requestId, route, req.method)

    log.info({ url: req.url }, 'request')

    try {
      const res     = await handler(req, ctx)
      const status  = res.status
      const latency = Date.now() - start
      const bucket  = status >= 500 ? '5xx' : status >= 400 ? '4xx' : '2xx'

      log.info({ status, latency }, 'response')

      // Non-bloquant — pas de await
      incrementRequest(route, bucket, latency).catch(() => null)

      return res
    } catch (err) {
      const latency = Date.now() - start
      log.error({ err, latency }, 'unhandled error')
      Sentry.captureException(err)
      incrementRequest(route, '5xx', latency).catch(() => null)
      throw err
    }
  }
}
