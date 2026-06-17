'use client'

import { springs } from '@/lib/animations/springs'
import { useMapT } from '@/i18n/map'

export type FilterId = 'all' | 'transit' | 'traffic' | 'alerts' | 'borders' | 'g7' | 'journey' | 'parking' | 'events'

interface FilterDef { id: FilterId; icon: string; label: string }

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
  const t = useMapT()

  const FILTERS: FilterDef[] = [
    { id: 'all',     icon: '🗺️',  label: t.filters.all     },
    { id: 'events',  icon: '🗓️', label: t.eventsSection.filterLabel },
    { id: 'traffic', icon: '🚦',  label: t.filters.traffic  },
    { id: 'alerts',  icon: '⚠️',  label: t.filters.alerts   },
    { id: 'transit', icon: '🚌',  label: t.filters.transit  },
    { id: 'parking', icon: '🅿️', label: t.filters.parking  },
    { id: 'borders', icon: '🛂',  label: t.filters.borders  },
    { id: 'g7',      icon: '🏛️', label: t.filters.g7       },
    { id: 'journey', icon: '⭐',  label: t.filters.journey  },
  ]

  const visible = FILTERS.filter(f => f.id !== 'journey' || showJourney)

  return (
    <div
      className="fixed left-0 right-0 z-40 flex gap-2 px-4 overflow-x-auto"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 52px + 12px + 8px)', height: 40, scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
    >
      {visible.map(f => {
        const isActive = active === f.id
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            data-onboarding={`filter-${f.id}`}
            className="flex items-center gap-1.5 px-4 flex-shrink-0 rounded-full text-[13px] font-medium"
            style={{
              ...PILL_BASE,
              height: 36,
              background: isActive ? 'var(--brand)' : 'rgba(255,255,255,0.07)',
              color:      isActive ? '#fff'          : 'var(--text-secondary)',
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
