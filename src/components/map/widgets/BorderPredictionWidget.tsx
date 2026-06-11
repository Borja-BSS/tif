'use client'

import { useQuery } from '@tanstack/react-query'
import { computeBorderPrediction } from '@/lib/features/border-prediction'
import type { BorderPrediction } from '@/lib/features/border-prediction'
import { useMapT } from '@/i18n/map'

const CROSSINGS = [
  { id: 'bardonnex', name: 'Bardonnex' },
  { id: 'thonex',    name: 'Thônex'   },
  { id: 'perly',     name: 'Perly'    },
  { id: 'meyrin',    name: 'Meyrin'   },
]

function Sparkline({ points }: { points: number[] }) {
  const max = 30
  const w = 80, h = 24
  const pts = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w
    const y = h - (Math.min(v, max) / max) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline points={pts} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BorderCard({ data }: { data: BorderPrediction }) {
  const trendIcon  = data.trend === 'improving' ? '↘' : data.trend === 'worsening' ? '↗' : '→'
  const trendColor = data.trend === 'improving' ? '#30D158' : data.trend === 'worsening' ? '#FF453A' : '#FF9F0A'
  return (
    <div className="rounded-2xl p-3 mb-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>🛂 {data.name}</span>
        <span className="text-[13px] font-bold" style={{ color: trendColor }}>{data.currentWait} min {trendIcon}</span>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] flex-1 pr-2" style={{ color: 'var(--text-secondary)' }}>{data.recommendation}</p>
        <Sparkline points={data.sparkline} />
      </div>
    </div>
  )
}

export function BorderPredictionWidget() {
  const t = useMapT()
  const { data: predictions } = useQuery<BorderPrediction[]>({
    queryKey: ['border-predictions'],
    queryFn: async () => {
      try {
        const res  = await fetch('/api/v1/layers/territory')
        const json = await res.json()
        return CROSSINGS.map(c => computeBorderPrediction({
          crossingId:    c.id,
          name:          c.name,
          currentWait:   (json?.[c.id]?.waitMinutes as number | undefined) ?? 0,
          congestionNow: (json?.[c.id]?.congestionScore as number | undefined) ?? 0,
          peakPattern:   1.0,
        }))
      } catch {
        return CROSSINGS.map(c => computeBorderPrediction({
          crossingId: c.id, name: c.name, currentWait: 0, congestionNow: 0, peakPattern: 1,
        }))
      }
    },
    refetchInterval: 60000,
    staleTime:       60000,
  })

  if (!predictions) return null

  return (
    <div className="px-4 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
        {t.borderWidget.title}
      </p>
      {predictions.map(p => <BorderCard key={p.crossingId} data={p} />)}
    </div>
  )
}
