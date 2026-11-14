'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

// Statistiques TIF internes, sur nos propres serveurs (n'enregistre rien sans consentement analytique).
// PostHog retiré le 14.11.2026 : il démarrait avant le choix du bandeau cookies et envoyait les données aux États-Unis.
export function PageViewTracker({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    import('@/lib/analytics/track').then(({ track }) => track('page_view', { path: pathname }))
  }, [pathname])

  return <>{children}</>
}
