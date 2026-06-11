'use client'

import { useEffect, useState } from 'react'
import type { G7Impact } from '@/lib/transport/types'
import { useMapT } from '@/i18n/map'

export function G7Banner() {
  const t = useMapT()
  const [g7, setG7]           = useState<G7Impact | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      setG7((e as CustomEvent<G7Impact>).detail)
    }
    window.addEventListener('tif:g7-warning', handler)
    return () => window.removeEventListener('tif:g7-warning', handler)
  }, [])

  if (!g7 || dismissed) return null

  return (
    <div
      className="absolute top-16 left-1/2 -translate-x-1/2 z-20 max-w-sm w-full px-4"
      style={{ fontFamily: '-apple-system, SF Pro Text, sans-serif' }}
    >
      <div
        className="rounded-2xl border border-orange-500/30 px-4 py-3 shadow-xl"
        style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">🏛️</span>
              <span className="font-semibold text-white text-sm">
                {g7.isActive ? t.banner.activeTitle : t.banner.upcomingTitle}
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {g7.isActive ? t.banner.activeBody : t.banner.upcomingBody}
              {g7.suspendedLines.length > 0 &&
                ` ${g7.suspendedLines.length > 1 ? t.banner.lineSuppPrefixP : t.banner.lineSuppPrefixS} ${g7.suspendedLines.join(', ')} ${g7.suspendedLines.length > 1 ? t.banner.lineSuppSuffixP : t.banner.lineSuppSuffixS}`}
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {t.banner.infoPrefix}<span style={{ color: 'rgba(255,255,255,0.65)' }}>{g7.hotline}</span>
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-xl leading-none flex-shrink-0 mt-0.5 transition-opacity hover:opacity-70"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
