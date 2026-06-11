'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

if (typeof window !== 'undefined' && !posthog.__loaded) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host:          '/ingest',
    ui_host:           'https://us.posthog.com',
    person_profiles:   'identified_only',
    capture_pageview:  false,
    capture_pageleave: true,
    session_recording: {
      maskAllInputs:      true,
      maskTextSelector:   '[data-ph-mask]',
    },
    autocapture: {
      dom_event_allowlist: ['click', 'change', 'submit'],
      element_allowlist:   ['button', 'a', 'input', 'select', 'textarea', 'form'],
    },
  })
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    posthog.capture('$pageview')
  }, [pathname])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
