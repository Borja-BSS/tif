'use client'

import { springs } from '@/lib/animations/springs'
import type { JourneyStatusResult } from '@/lib/my-journey/types'

interface JourneyCardProps {
  data:     JourneyStatusResult
  onPress?: () => void
}

const STATUS_COLOR = {
  normal:    '#30D158',
  delayed:   '#FF9F0A',
  disrupted: '#FF453A',
} as const

const STATUS_ICON = { normal: '🟢', delayed: '🟡', disrupted: '🔴' } as const

export function JourneyCard({ data, onPress }: JourneyCardProps) {
  const color = STATUS_COLOR[data.status]

  return (
    <button
      onClick={onPress}
      className="w-full flex overflow-hidden rounded-2xl text-left"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${data.status === 'disrupted' ? color + '50' : 'var(--border)'}`,
        transition: springs.card,
      }}
    >
      {/* Color bar */}
      <div className="w-1 flex-shrink-0" style={{ background: color }} />

      {/* Content */}
      <div className="flex-1 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">{STATUS_ICON[data.status]}</span>
          {data.status === 'disrupted' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${color}20`, color }}>
              PERTURBÉ
            </span>
          )}
        </div>
        <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
          {data.headline}
        </p>
        {data.detail && (
          <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            {data.detail}
          </p>
        )}
        {data.alternative && (
          <div className="mt-3 p-3 rounded-xl"
            style={{ background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.20)' }}>
            <p className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--brand)' }}>
              ✨ Alternative recommandée
            </p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {data.alternative.description}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {data.alternative.timeSaved > 0 && `${data.alternative.timeSaved} min plus rapide · `}
              Partez dans {data.alternative.departureIn} min
            </p>
          </div>
        )}
      </div>
    </button>
  )
}
