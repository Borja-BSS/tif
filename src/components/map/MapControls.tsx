'use client'

import { useState, useRef } from 'react'
import type { FilterState } from './FilterPanel'
import { useMapT } from '@/i18n/map'

// ── Liquid Glass system token ─────────────────────────────────────────────────
export const LG_STYLE: React.CSSProperties = {
  background:           'rgba(18, 18, 22, 0.75)',
  backdropFilter:       'blur(28px) saturate(180%)',
  WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border:               '1px solid rgba(255,255,255,0.13)',
  boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.14), 0 8px 32px rgba(0,0,0,0.45)',
}

interface MapControlsProps {
  filters:      FilterState
  onChange:     (next: FilterState) => void
  routingMode?: 'car' | 'transport' | null      // kept for API compat, ignored
  onRouting?:   (mode: 'car' | 'transport' | null) => void  // kept for compat
}

export default function MapControls({ filters, onChange }: MapControlsProps) {
  const t = useMapT()
  const [tooltip,          setTooltip]          = useState<string | null>(null)
  const [territoryTooltip, setTerritoryTooltip] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [expanded, setExpanded] = useState(true)

  const LAYERS = [
    { key: 'heatmap'   as keyof FilterState, icon: '🚦', label: t.layers.traffic,  accent: '#0A84FF'  },
    { key: 'transport' as keyof FilterState, icon: '🚌', label: t.layers.tpg,      accent: '#34C759'  },
    { key: 'territory' as keyof FilterState, icon: '🗺️', label: t.layers.zones,    accent: '#FFD60A'  },
    { key: 'alerts'    as keyof FilterState, icon: '⚠️', label: t.layers.alerts,   accent: 'var(--red)'  },
  ]

  const toggle = (key: keyof FilterState) => onChange({ ...filters, [key]: !filters[key] })

  return (
    <div
      className="absolute z-20"
      style={{
        bottom: 'max(88px, calc(env(safe-area-inset-bottom, 0px) + 88px))',
        left: '16px',
      }}
    >
      {/* Collapsed state: single icon button */}
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ ...LG_STYLE, fontSize: 18 }}
          aria-label="Afficher les layers"
        >
          ⚡
        </button>
      ) : (
        /* Expanded: vertical pill with layer icons */
        <div
          className="flex flex-col items-center gap-0.5 rounded-3xl py-2 px-1.5"
          style={LG_STYLE}
        >
          {/* Collapse button at top */}
          <button
            onClick={() => setExpanded(false)}
            className="w-8 h-6 flex items-center justify-center rounded-full mb-0.5 transition-colors active:bg-white/10"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 5l4-4 4 4"/>
            </svg>
          </button>

          {/* Layer toggles */}
          {LAYERS.map(({ key, icon, label, accent }) => {
            const active = filters[key]
            const isTerritory = key === 'territory'
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                onMouseEnter={() => setTooltip(label)}
                onMouseLeave={() => { setTooltip(null); if (isTerritory) setTerritoryTooltip(false) }}
                onTouchStart={() => {
                  if (isTerritory) longPressTimer.current = setTimeout(() => setTerritoryTooltip(true), 500)
                }}
                onTouchEnd={() => {
                  if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
                }}
                className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90"
                style={{ background: active ? 'rgba(255,255,255,0.10)' : 'transparent' }}
                aria-label={label}
              >
                <span style={{ fontSize: 17, opacity: active ? 1 : 0.3 }}>{icon}</span>
                {active && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: accent }} />
                )}
              </button>
            )
          })}

          {/* Separator */}
          <div className="w-5 h-px my-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />

          {/* Live badge */}
          <div className="flex flex-col items-center gap-0.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span style={{ fontSize: 8, color: 'rgba(52,199,89,0.7)', fontWeight: 600, letterSpacing: '0.05em' }}>LIVE</span>
          </div>

          {/* Desktop hover tooltip */}
          {tooltip && (
            <div
              className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg
                         text-[11px] font-medium text-white/80 whitespace-nowrap hidden sm:block pointer-events-none"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            >
              {tooltip}
            </div>
          )}

          {/* Territory tooltip */}
          {territoryTooltip && (
            <div
              className="absolute left-full ml-2 bottom-0 w-56 p-3 rounded-2xl z-50 text-[11px] leading-relaxed"
              style={{ ...LG_STYLE, color: 'var(--text-secondary)' }}
              onClick={() => setTerritoryTooltip(false)}
            >
              <div className="font-semibold text-amber-400 mb-1">{t.layers.zonesG7Title}</div>
              {t.layers.zonesG7Desc}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
