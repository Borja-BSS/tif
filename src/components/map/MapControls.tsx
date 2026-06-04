'use client'

import { useState } from 'react'
import type { FilterState } from './FilterPanel'

// ── Liquid Glass system token ─────────────────────────────────────────────────
export const LG_STYLE: React.CSSProperties = {
  background:             'rgba(18, 18, 22, 0.72)',
  backdropFilter:         'blur(28px) saturate(180%)',
  WebkitBackdropFilter:   'blur(28px) saturate(180%)',
  border:                 '1px solid rgba(255,255,255,0.13)',
  boxShadow:              'inset 0 0.5px 0 rgba(255,255,255,0.14), 0 16px 56px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.3)',
}

// ── Layer definitions ─────────────────────────────────────────────────────────
const LAYERS = [
  { key: 'heatmap'   as keyof FilterState, icon: '⚡', label: 'Mobilité',  accent: 'rgba(10,132,255,0.9)'  },
  { key: 'transport' as keyof FilterState, icon: '🚌', label: 'Transport', accent: 'rgba(50,215,75,0.9)'   },
  { key: 'territory' as keyof FilterState, icon: '🗺️', label: 'Territoire',accent: 'rgba(255,196,0,0.9)'   },
  { key: 'alerts'    as keyof FilterState, icon: '⚠️', label: 'Alertes',   accent: 'rgba(255,69,58,0.9)'   },
]

interface MapControlsProps {
  filters:     FilterState
  onChange:    (next: FilterState) => void
  routingMode: 'car' | 'transport' | null
  onRouting:   (mode: 'car' | 'transport' | null) => void
}

export default function MapControls({ filters, onChange, routingMode, onRouting }: MapControlsProps) {
  const [tooltip, setTooltip] = useState<string | null>(null)

  const toggle = (key: keyof FilterState) =>
    onChange({ ...filters, [key]: !filters[key] })

  const toggleRouting = (mode: 'car' | 'transport') =>
    onRouting(routingMode === mode ? null : mode)

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full px-2 py-2"
      style={LG_STYLE}
    >
      {/* ── Layer toggles ── */}
      {LAYERS.map(({ key, icon, label, accent }) => {
        const active = filters[key]
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            onMouseEnter={() => setTooltip(label)}
            onMouseLeave={() => setTooltip(null)}
            className="relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200 active:scale-90"
            style={{
              background: active ? 'rgba(255,255,255,0.10)' : 'transparent',
            }}
            aria-label={label}
          >
            <span className="text-[18px] leading-none" style={{ opacity: active ? 1 : 0.35 }}>
              {icon}
            </span>
            {/* Active indicator dot */}
            {active && (
              <span
                className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                style={{ background: accent }}
              />
            )}
          </button>
        )
      })}

      {/* ── Separator ── */}
      <div className="w-px h-6 mx-1 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />

      {/* ── Routing: Voiture ── */}
      <button
        onClick={() => toggleRouting('car')}
        onMouseEnter={() => setTooltip('Itinéraire voiture')}
        onMouseLeave={() => setTooltip(null)}
        className="flex items-center gap-1.5 h-11 rounded-full px-3 transition-all duration-200 active:scale-90"
        style={{
          background: routingMode === 'car'
            ? 'rgba(10,132,255,0.22)'
            : 'transparent',
          border: routingMode === 'car' ? '1px solid rgba(10,132,255,0.45)' : '1px solid transparent',
        }}
        aria-label="Itinéraire voiture"
      >
        <span className="text-[16px] leading-none" style={{ opacity: routingMode === 'car' ? 1 : 0.45 }}>
          🚗
        </span>
        <span
          className="text-[11px] font-medium hidden sm:inline"
          style={{ color: routingMode === 'car' ? 'rgba(10,132,255,1)' : 'rgba(255,255,255,0.45)' }}
        >
          Voiture
        </span>
      </button>

      {/* ── Routing: Transports ── */}
      <button
        onClick={() => toggleRouting('transport')}
        onMouseEnter={() => setTooltip('Itinéraire transports')}
        onMouseLeave={() => setTooltip(null)}
        className="flex items-center gap-1.5 h-11 rounded-full px-3 transition-all duration-200 active:scale-90"
        style={{
          background: routingMode === 'transport'
            ? 'rgba(50,215,75,0.18)'
            : 'transparent',
          border: routingMode === 'transport' ? '1px solid rgba(50,215,75,0.4)' : '1px solid transparent',
        }}
        aria-label="Itinéraire transports"
      >
        <span className="text-[16px] leading-none" style={{ opacity: routingMode === 'transport' ? 1 : 0.45 }}>
          🧭
        </span>
        <span
          className="text-[11px] font-medium hidden sm:inline"
          style={{ color: routingMode === 'transport' ? 'rgba(50,215,75,1)' : 'rgba(255,255,255,0.45)' }}
        >
          Transports
        </span>
      </button>

      {/* ── Tooltip (desktop hover) ── */}
      {tooltip && (
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg
                     text-[11px] font-medium text-white/80 whitespace-nowrap pointer-events-none
                     hidden sm:block"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
        >
          {tooltip}
        </div>
      )}
    </div>
  )
}
