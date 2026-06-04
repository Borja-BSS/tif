'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { SearchResult } from '@/lib/routing/shared/search-engine'

interface SearchBoxProps {
  placeholder:   string
  onSelect:      (result: SearchResult) => void
  value?:        string
  icon?:         string
  // Shown as first suggestion when field is empty and focused
  gpsHint?:      boolean
  onGPSSelect?:  () => void
  loading?:      boolean   // external loading state (e.g. GPS acquisition)
}

// Type-specific styling for search results
const TYPE_CONFIG: Record<SearchResult['type'], { icon: string; color: string }> = {
  address: { icon: '📍', color: 'rgba(255,255,255,0.35)' },
  place:   { icon: '🏢', color: 'rgba(255,255,255,0.35)' },
  street:  { icon: '🛣️', color: 'rgba(255,255,255,0.35)' },
  station: { icon: '🚉', color: 'rgba(50,215,75,0.9)' },   // green for transit stops
}

// Liquid Glass dropdown style
const LG_DROPDOWN: React.CSSProperties = {
  background:           'rgba(18,18,22,0.96)',
  backdropFilter:       'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  border:               '1px solid rgba(255,255,255,0.13)',
  boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.1), 0 12px 40px rgba(0,0,0,0.6)',
}

export function SearchBox({
  placeholder, onSelect, value, icon, gpsHint, onGPSSelect, loading,
}: SearchBoxProps) {
  const [query,    setQuery]    = useState(value ?? '')
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [isOpen,   setIsOpen]   = useState(false)
  const [fetching, setFetching] = useState(false)
  const [focused,  setFocused]  = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const abortRef    = useRef<AbortController | null>(null)

  // Sync with external value changes (GPS set origin, etc.)
  useEffect(() => {
    setQuery(value ?? '')
  }, [value])

  const search = useCallback((q: string) => {
    clearTimeout(debounceRef.current)
    abortRef.current?.abort()

    if (q.length < 2) {
      setResults([])
      setIsOpen(focused && gpsHint ? true : false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      abortRef.current = new AbortController()
      setFetching(true)
      try {
        const res = await fetch(`/api/v1/routing/geocode?q=${encodeURIComponent(q)}`, {
          signal: abortRef.current.signal,
        })
        const data: SearchResult[] = await res.json()
        setResults(data)
        setIsOpen(true)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setResults([])
      } finally {
        setFetching(false)
      }
    }, 180)  // 180ms debounce — fast enough for live feel
  }, [focused, gpsHint])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    search(e.target.value)
  }

  const handleSelect = (result: SearchResult) => {
    setQuery(result.title)
    setResults([])
    setIsOpen(false)
    onSelect(result)
  }

  const handleFocus = () => {
    setFocused(true)
    // Show GPS hint or cached results on re-focus
    if (results.length > 0 || (gpsHint && !query)) setIsOpen(true)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false)
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'
    e.currentTarget.style.boxShadow   = 'none'
    setTimeout(() => setIsOpen(false), 200)
  }

  const isLoading = fetching || loading
  const showDropdown = isOpen && (results.length > 0 || (gpsHint && focused && !query))

  return (
    <div className="relative w-full">
      {/* Input */}
      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3 text-sm pointer-events-none select-none" aria-hidden>
            {icon}
          </span>
        )}

        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={e => {
            handleFocus()
            e.currentTarget.style.borderColor = '#0A84FF'
            e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(10,132,255,0.18)'
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full h-11 rounded-xl border px-3 text-sm outline-none transition-all"
          style={{
            paddingLeft:  icon ? '36px' : '12px',
            paddingRight: isLoading ? '40px' : '12px',
            background:   'rgba(255,255,255,0.06)',
            color:        query ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
            borderColor:  'rgba(255,255,255,0.10)',
            fontFamily:   '-apple-system, SF Pro Text, sans-serif',
            fontSize:     '14px',
            caretColor:   '#0A84FF',
          }}
        />

        {/* Loading / fetching indicator */}
        {isLoading && (
          <span className="absolute right-3 flex items-center justify-center w-5 h-5">
            <span
              className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin block"
              style={{ borderColor: '#0A84FF', borderTopColor: 'transparent' }}
            />
          </span>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 rounded-2xl overflow-hidden z-[60]"
          style={LG_DROPDOWN}
        >
          {/* GPS hint — shown when empty + focused + gpsHint enabled */}
          {gpsHint && !query && (
            <button
              onMouseDown={e => { e.preventDefault(); onGPSSelect?.() }}
              onTouchStart={e => { e.preventDefault(); onGPSSelect?.() }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left
                         transition-colors active:bg-white/8"
              style={{ borderBottom: results.length > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}
            >
              <span
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(10,132,255,0.15)', border: '1px solid rgba(10,132,255,0.3)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="3"/>
                  <line x1="12" y1="2"  x2="12" y2="6"/>
                  <line x1="12" y1="18" x2="12" y2="22"/>
                  <line x1="2"  y1="12" x2="6"  y2="12"/>
                  <line x1="18" y1="12" x2="22" y2="12"/>
                </svg>
              </span>
              <div>
                <div className="text-sm font-semibold" style={{ color: '#0A84FF' }}>
                  Ma position
                </div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Utiliser la localisation GPS
                </div>
              </div>
            </button>
          )}

          {/* Search results */}
          {results.map((result, i) => {
            const cfg = TYPE_CONFIG[result.type] ?? TYPE_CONFIG.address
            return (
              <button
                key={result.id}
                onMouseDown={e => { e.preventDefault(); handleSelect(result) }}
                onTouchStart={e => { e.preventDefault(); handleSelect(result) }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left
                           transition-colors active:bg-white/[0.06]"
                style={{
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                {/* Type icon with color for stations */}
                <span
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                  style={{
                    background: result.type === 'station'
                      ? 'rgba(50,215,75,0.12)'
                      : 'rgba(255,255,255,0.06)',
                  }}
                >
                  {cfg.icon}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                    {highlightMatch(result.title, query)}
                  </div>
                  {result.subtitle && (
                    <div className="text-xs truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {result.subtitle}
                    </div>
                  )}
                </div>

                {/* Station badge */}
                {result.type === 'station' && (
                  <span
                    className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                    style={{ background: 'rgba(50,215,75,0.15)', color: 'rgba(50,215,75,0.9)' }}
                  >
                    Arrêt
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Bold the matching part of the title — returns React nodes, no HTML injection
function highlightMatch(title: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return title
  const idx = title.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return title
  return (
    <>
      {title.slice(0, idx)}
      <strong style={{ color: 'rgba(255,255,255,1)', fontWeight: 600 }}>
        {title.slice(idx, idx + query.length)}
      </strong>
      {title.slice(idx + query.length)}
    </>
  )
}
