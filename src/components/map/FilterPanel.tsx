'use client'

interface FilterState {
  heatmap:   boolean
  alerts:    boolean
  transport: boolean
  territory: boolean
  waze:      boolean
}

interface FilterPanelProps {
  filters:   FilterState
  onChange:  (next: FilterState) => void
}

const ITEMS: { key: keyof FilterState; label: string; color: string }[] = [
  { key: 'heatmap',   label: 'Mobilité',   color: 'text-blue-400'   },
  { key: 'transport', label: 'Transport',  color: 'text-cyan-400'   },
  { key: 'territory', label: 'Territoire', color: 'text-amber-400'  },
  { key: 'alerts',    label: 'Alertes',    color: 'text-red-400'    },
  { key: 'waze',      label: 'Waze',       color: 'text-green-400'  },
]

export default function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const toggle = (key: keyof FilterState) =>
    onChange({ ...filters, [key]: !filters[key] })

  return (
    <div className="absolute bottom-10 left-4 z-10 flex flex-col gap-1.5">
      {ITEMS.map(({ key, label, color }) => {
        const active = filters[key]
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={[
              'flex items-center gap-2.5 rounded-lg px-3 py-1.5',
              'text-[11px] font-mono tracking-wide select-none',
              'transition-all duration-150',
              active
                ? 'bg-black/80 backdrop-blur border border-white/10 text-white/80'
                : 'bg-black/40 backdrop-blur border border-white/[0.04] text-white/25',
            ].join(' ')}
          >
            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${active ? color.replace('text-', 'bg-') : 'bg-white/10'}`} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

export type { FilterState }
