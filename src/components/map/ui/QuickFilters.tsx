'use client'

import { springs } from '@/lib/animations/springs'

export type FilterId = 'all' | 'transit' | 'traffic' | 'alerts' | 'borders' | 'g7' | 'journey' | 'parking'

interface FilterDef { id: FilterId; icon: string; label: string }

const FILTERS: FilterDef[] = [
  { id: 'all',     icon: '🗺️',  label: 'Tout'      },
  { id: 'traffic', icon: '🚦',  label: 'Trafic'     },
  { id: 'alerts',  icon: '⚠️',  label: 'Alertes'    },
  { id: 'transit', icon: '🚌',  label: 'Transport'  },
  { id: 'parking', icon: '🅿️', label: 'Parking'    },
  { id: 'borders', icon: '🛂',  label: 'Frontières' },
  { id: 'g7',      icon: '🏛️', label: 'Info G7'    },
  { id: 'journey', icon: '⭐',  label: 'Mon Trajet' },
]

interface QuickFiltersProps {
  active:       FilterId
  onChange:     (id: FilterId) => void
  showJourney?: boolean
}

const PILL_BASE: React.CSSProperties = {
  backdropFilter:       'blur(32px) saturate(200%) brightness(1.05)',
  WebkitBackdropFilter: 'blur(32px) saturate(200%) brightness(1.05)',
  border:               '0.5px solid rgba(255,255,255,0.20)',
  boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.25)',
  whiteSpace:           'nowrap',
}

export function QuickFilters({ active, onChange, showJourney = false }: QuickFiltersProps) {
  const visible = FILTERS.filter(f => f.id !== 'journey' || showJourney)

  return (
    <div
      className="fixed left-0 right-0 z-20 flex gap-2 px-4 overflow-x-auto"
      style={{ top: 'calc(52px + 12px + 8px)', height: 40, scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
    >
      {visible.map(f => {
        const isActive = active === f.id
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className="flex items-center gap-1.5 px-4 flex-shrink-0 rounded-full text-[13px] font-medium"
            style={{
              ...PILL_BASE,
              height: 36,
              background: isActive ? 'var(--brand)' : 'rgba(255,255,255,0.07)',
              color:      isActive ? '#fff'          : 'rgba(255,255,255,0.65)',
              transition: springs.filter,
              transform:  isActive ? 'scale(1.04)'  : 'scale(1)',
            }}
          >
            <span>{f.icon}</span>
            <span>{f.label}</span>
          </button>
        )
      })}
    </div>
  )
}
