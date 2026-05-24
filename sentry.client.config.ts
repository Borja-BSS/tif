import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn:         process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled:     !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate:   process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: false }),
  ],

  beforeSend(event) {
    // Ne pas envoyer les erreurs réseau locales en dev
    if (process.env.NODE_ENV !== 'production' && event.exception) return null
    return event
  },
})
