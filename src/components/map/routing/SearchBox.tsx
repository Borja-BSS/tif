'use client'

import { useState, useCallback, useRef } from 'react'
import type { SearchResult } from '@/lib/routing/shared/search-engine'

interface SearchBoxProps {
  placeholder: string
  onSelect:    (result: SearchResult) => void
  value?:      string
  icon?:       string
}

export function SearchBox({ placeholder, onSelect, value, icon }: SearchBoxProps) {
  const [query,   setQuery]   = useState(value ?? '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen,  setIsOpen]  = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const search = useCallback((q: string) => {
    clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); setIsOpen(false); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res  = await fetch(`/api/v1/routing/geocode?q=${encodeURIComponent(q)}`, {
          signal: AbortSignal.timeout(5000),
        })
        const data: SearchResult[] = await res.json()
        setResults(data)
        setIsOpen(data.length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
  }, [])

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

  const typeIcon = (type: SearchResult['type']) =>
    ({ address: '📍', place: '🏢', street: '🛣️', station: '🚉' }[type] ?? '📍')

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3 text-sm pointer-events-none">{icon}</span>
        )}
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={e => {
            if (results.length > 0) setIsOpen(true)
            e.currentTarget.style.borderColor = '#0A84FF'
            e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(10,132,255,0.2)'
          }}
          onBlur={e => {
            setTimeout(() => setIsOpen(false), 200)
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
            e.currentTarget.style.boxShadow   = 'none'
          }}
          placeholder={placeholder}
          className="w-full h-11 rounded-xl border px-3 text-sm outline-none transition-all"
          style={{
            paddingLeft: icon ? '36px' : '12px',
            background:  'rgba(255,255,255,0.06)',
            color:       'rgba(255,255,255,0.85)',
            borderColor: 'rgba(255,255,255,0.12)',
            fontFamily:  '-apple-system, sans-serif',
          }}
        />
        {loading && (
          <div className="absolute right-3 w-4 h-4 border-2 border-t-transparent
                          rounded-full animate-spin"
               style={{ borderColor: '#0A84FF', borderTopColor: 'transparent' }} />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-xl border
                     overflow-hidden z-50 shadow-lg"
          style={{ background: 'rgba(15,15,20,0.97)', borderColor: 'rgba(255,255,255,0.12)' }}
        >
          {results.map(result => (
            <button
              key={result.id}
              onMouseDown={() => handleSelect(result)}
              className="w-full flex items-start gap-3 px-3 py-2.5 text-left
                         transition-colors hover:bg-white/5"
            >
              <span className="text-base mt-0.5 flex-shrink-0">{typeIcon(result.type)}</span>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate text-white/85">
                  {result.title}
                </div>
                {result.subtitle && (
                  <div className="text-xs truncate mt-0.5 text-white/40">
                    {result.subtitle}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
