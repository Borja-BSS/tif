import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  silent:               !process.env.CI,
  disableLogger:        true,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: !process.env.CI,
  },

  // Tunnel pour éviter les bloqueurs de pub
  tunnelRoute: '/monitoring',

  automaticVercelMonitors: true,
})
