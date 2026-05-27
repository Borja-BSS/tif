'use client'

import { useEffect, useState } from 'react'
import type { TpgDisruption, CffDisruption } from '@/lib/transport/types'

interface DisruptionDetail {
  tpg:   TpgDisruption[]
  cff:   CffDisruption[]
  total: number
}

const TYPE_ICON: Record<string, string> = {
  travaux:      '🚧',
  deviation:    '🔀',
  suppression:  '🚫',
  retard:       '⏱️',
  perturbation: '⚠️',
}

export function DisruptionsPanel() {
  const [data, setData]           = useState<DisruptionDetail | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<DisruptionDetail>).detail
      setData(detail)
      // Auto-expand when new disruptions arrive
      if (detail.total > 0) setCollapsed(false)
    }
    window.addEventListener('tif:disruptions', handler)
    return () => window.removeEventListener('tif:disruptions', handler)
  }, [])

  if (!data || data.total === 0) return null

  return (
    <div
      className="absolute right-4 top-20 z-20 w-72"
      style={{ fontFamily: '-apple-system, SF Pro Text, sans-serif' }}
    >
      <div
        className="rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        style={{ background: 'rgba(10,10,15,0.88)', backdropFilter: 'blur(16px)' }}
      >
        {/* Header */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">⚠️</span>
            <span className="text-sm font-semibold text-white">
              Perturbations réseau
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(255,59,48,0.2)', color: '#FF3B30' }}
            >
              {data.total}
            </span>
          </div>
          <span className="text-white/40 text-sm">{collapsed ? '▼' : '▲'}</span>
        </button>

        {/* Body */}
        {!collapsed && (
          <div className="px-3 pb-3 flex flex-col gap-1.5 max-h-80 overflow-y-auto">
            {data.tpg.map((d, i) => (
              <div
                key={`tpg-${i}`}
                className="flex gap-2.5 rounded-xl px-3 py-2"
                style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.15)' }}
              >
                <span className="text-base flex-shrink-0">{TYPE_ICON[d.type] ?? '⚠️'}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{ background: '#FF9500', color: '#000' }}
                    >
                      {d.lineNumber}
                    </span>
                    <span className="text-xs text-white/50 capitalize">{d.type}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {d.description}
                  </p>
                </div>
              </div>
            ))}
            {data.cff.map((d, i) => (
              <div
                key={`cff-${i}`}
                className="flex gap-2.5 rounded-xl px-3 py-2"
                style={{
                  background: d.isCEVA ? 'rgba(175,82,222,0.1)' : 'rgba(0,64,255,0.1)',
                  border:     `1px solid ${d.isCEVA ? 'rgba(175,82,222,0.2)' : 'rgba(0,64,255,0.2)'}`,
                }}
              >
                <span className="text-base flex-shrink-0">{TYPE_ICON[d.type] ?? '⏱️'}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{ background: d.isCEVA ? '#AF52DE' : '#0040FF', color: '#fff' }}
                    >
                      {d.line}
                    </span>
                    {d.delayMinutes && d.delayMinutes > 0 && (
                      <span className="text-xs font-semibold" style={{ color: '#FF3B30' }}>
                        +{d.delayMinutes} min
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {d.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
