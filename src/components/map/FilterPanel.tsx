'use client'

import MapControls from './MapControls'

interface FilterState {
  heatmap:   boolean
  alerts:    boolean
  transport: boolean
  territory: boolean
}

interface FilterPanelProps {
  filters:      FilterState
  onChange:     (next: FilterState) => void
  routingMode?: 'car' | 'transport' | null
  onRouting?:   (mode: 'car' | 'transport' | null) => void
}

export default function FilterPanel({ filters, onChange, routingMode, onRouting }: FilterPanelProps) {
  return (
    <MapControls
      filters={filters}
      onChange={onChange}
      routingMode={routingMode}
      onRouting={onRouting}
    />
  )
}

export type { FilterState }
