import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  // Serveur Node autonome : requis pour un hébergement hors Vercel
  // (Infomaniak). N'altère pas le comportement de l'app, seulement son
  // format de sortie.
  output: 'standalone',
  productionBrowserSourceMaps: false,
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
