'use client'

import { useState, useRef } from 'react'
import type { FilterState } from './FilterPanel'

// ── Liquid Glass system token ─────────────────────────────────────────────────
export const LG_STYLE: React.CSSProperties = {
  background:             'rgba(18, 18, 22, 0.72)',
  backdropFilter:         'blur(28px) saturate(180%)',
  WebkitBackdropFilter:   'blur(28px) saturate(180%)',
  border:                 '1px solid rgba(255,255,255,0.13)',
  boxShadow:              'inset 0 0.5px 0 rgba(255,255,255,0.14), 0 16px 56px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.3)',
}

const TERRITORY_TOOLTIP = 'La rubrique Territoire regroupe les zones de restriction, périmètres de sécurité et conditions d\'accès liées au G7.'

// ── Layer definitions ─────────────────────────────────────────────────────────
const LAYERS = [
  { key: 'heatmap'   as keyof FilterState, icon: '🚦', label: 'Trafic',  accent: 'rgba(10,132,255,0.9)'  },
  { key: 'transport' as keyof FilterState, icon: '🚌', label: 'TPG',     accent: 'rgba(50,215,75,0.9)'   },
  { key: 'territory' as keyof FilterState, icon: '🗺️', label: 'Zones',   accent: 'rgba(255,196,0,0.9)'   },
  { key: 'alerts'    as keyof FilterState, icon: '⚠️', label: 'Alertes', accent: 'rgba(255,69,58,0.9)'   },
]

interface MapControlsProps {
  filters:     FilterState
  onChange:    (next: FilterState) => void
  routingMode: 'car' | 'transport' | null
  onRouting:   (mode: 'car' | 'transport' | null) => void
}

export default function MapControls({ filters, onChange, routingMode, onRouting }: MapControlsProps) {
  const [tooltip,           setTooltip]           = useState<string | null>(null)
  const [territoryTooltip,  setTerritoryTooltip]  = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggle = (key: keyof FilterState) =>
    onChange({ ...filters, [key]: !filters[key] })

  const toggleRouting = (mode: 'car' | 'transport') =>
    onRouting(routingMode === mode ? null : mode)

  // Long-press for territory tooltip on mobile
  const handleTerritoryPressStart = () => {
    longPressTimer.current = setTimeout(() => setTerritoryTooltip(true), 500)
  }
  const handleTerritoryPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }
  const dismissTerritoryTooltip = () => setTerritoryTooltip(false)

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full px-2 py-2"
      style={LG_STYLE}
    >
      {/* ── Layer toggles ── */}
      {LAYERS.map(({ key, icon, label, accent }) => {
        const active = filters[key]
        const isTerritory = key === 'territory'

        return (
          <button
            key={key}
            onClick={() => {
              toggle(key)
              if (isTerritory) setTerritoryTooltip(false)
            }}
            onMouseEnter={() => {
              setTooltip(isTerritory ? null : label)
              if (isTerritory) setTerritoryTooltip(true)
            }}
            onMouseLeave={() => {
              setTooltip(null)
              if (isTerritory) setTerritoryTooltip(false)
            }}
            onTouchStart={isTerritory ? handleTerritoryPressStart : undefined}
            onTouchEnd={isTerritory ? handleTerritoryPressEnd : undefined}
            onTouchCancel={isTerritory ? handleTerritoryPressEnd : undefined}
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

      {/* ── Separator ── */}
      <div className="w-px h-6 mx-1 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />

      {/* ── Live badge ── */}
      <div className="flex items-center gap-1 px-2">
        <span
          className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0"
          style={{ width: 6, height: 6 }}
        />
        <span
          className="font-medium"
          style={{ fontSize: 9, color: 'rgba(52,199,89,0.85)', lineHeight: 1 }}
        >
          Live
        </span>
      </div>

      {/* ── Tooltip: generic (desktop hover) ── */}
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

      {/* ── Tooltip: territoire (hover desktop + long-press mobile) ── */}
      {territoryTooltip && (
        <div
          onClick={dismissTerritoryTooltip}
          className="absolute -top-16 left-1/2 -translate-x-1/2 px-3 py-2 rounded-xl
                     text-[11px] font-medium text-white/80 pointer-events-auto
                     max-w-[260px] text-center"
          style={{
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)',
            lineHeight: 1.4,
            whiteSpace: 'normal',
          }}
        >
          {TERRITORY_TOOLTIP}
        </div>
      )}
    </div>
  )
}
