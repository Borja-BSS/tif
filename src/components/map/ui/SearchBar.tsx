'use client'

import { useState, useCallback, useEffect } from 'react'
import type mapboxgl from 'mapbox-gl'
import { springs } from '@/lib/animations/springs'
import { useMapT } from '@/i18n/map'

const LG: React.CSSProperties = {
  background:           'rgba(255,255,255,0.05)',
  backdropFilter:       'blur(40px) saturate(200%) brightness(1.06)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%) brightness(1.06)',
  border:               '0.5px solid rgba(255,255,255,0.22)',
  boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.30), 0 4px 24px rgba(0,0,0,0.10)',
}

interface SearchResult {
  id: string
  title: string
  lat: number
  lng: number
  type: string
}

interface SearchBarProps {
  map: mapboxgl.Map | null
}

export function SearchBar({ map }: SearchBarProps) {
  const t = useMapT()
  const PLACEHOLDERS = [t.search.ph1, t.search.ph2, t.search.ph3, t.search.ph4]

  const [isOpen,         setIsOpen]         = useState(false)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const [query,          setQuery]          = useState('')
  const [results,        setResults]        = useState<SearchResult[]>([])
  const [loading,        setLoading]        = useState(false)
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('tif:recent-searches')
      if (raw) setRecentSearches(JSON.parse(raw).slice(0, 3))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (isOpen) return
    const id = setInterval(() => setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length), 4000)
    return () => clearInterval(id)
  }, [isOpen])

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res  = await fetch(`/api/v1/routing/geocode?q=${encodeURIComponent(query)}&bbox=5.9,46.1,6.5,46.5`)
        const data = await res.json()
        setResults((Array.isArray(data) ? data : (data.results ?? [])).slice(0, 6))
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = useCallback((result: SearchResult) => {
    const updated = [result, ...recentSearches.filter(r => r.id !== result.id)].slice(0, 3)
    setRecentSearches(updated)
    try { localStorage.setItem('tif:recent-searches', JSON.stringify(updated)) } catch { /* ignore */ }

    // Déclenche le calcul d'itinéraire depuis ma position → destination
    window.dispatchEvent(new CustomEvent('tif:route-to', { detail: result }))
    map?.flyTo({ center: [result.lng, result.lat], zoom: 14, duration: 700, essential: true })
    setIsOpen(false)
    setQuery('')
    setResults([])
  }, [map, recentSearches])

  if (!isOpen) {
    return (
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center gap-2 mx-4 mt-3">
        <button
          onClick={() => setIsOpen(true)}
          className="flex-1 flex items-center gap-3 px-4 cursor-text"
          style={{ ...LG, height: 52, borderRadius: 16, transition: springs.search }}
          aria-label="Rechercher un lieu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span className="flex-1 text-left text-sm" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: '-apple-system, sans-serif' }}>
            {PLACEHOLDERS[placeholderIdx]}
          </span>
        </button>
        <a
          href="/"
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            ...LG,
            width: 52,
            height: 52,
            borderRadius: 16,
            transition: springs.search,
          }}
          aria-label="Accueil"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </a>
      </div>
    )
  }

  // QuickFilters: top = 52+12+8 = 72px, height 40px → bottom à 112px
  // Le dropdown apparaît sous les filtres pour ne pas les couvrir
  const RESULTS_TOP = 'calc(52px + 12px + 8px + 40px + 8px)' // 120px

  return (
    <>
      <div
        className="fixed inset-0 z-29"
        style={{ background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(2px)' }}
        onClick={() => { setIsOpen(false); setQuery(''); setResults([]) }}
      />

      {/* Champ de saisie — reste en haut, au niveau de la barre */}
      <div
        className="fixed top-0 left-0 right-0 z-30 mx-4 mt-3 overflow-hidden"
        style={{ ...LG, borderRadius: 16 }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => { setIsOpen(false); setQuery(''); setResults([]) }}
            style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}
            aria-label="Fermer"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 1l8 8M9 1L1 9"/>
            </svg>
          </button>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={PLACEHOLDERS[0]}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'rgba(255,255,255,0.9)', caretColor: 'var(--brand)', fontSize: '16px' }}
          />
          {loading && (
            <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/70 animate-spin flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Résultats — positionnés SOUS les filtres */}
      {(results.length > 0 || recentSearches.length > 0) && (
        <div
          className="fixed left-0 right-0 z-30 mx-4 overflow-hidden"
          style={{ ...LG, borderRadius: 16, top: RESULTS_TOP, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
        >
          <div className="px-2 py-2">
            {results.length > 0 ? (
              results.map(r => (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors active:bg-white/5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span className="text-sm truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>{r.title}</span>
                </button>
              ))
            ) : (
              <>
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>{t.search.recent}</p>
                {recentSearches.map(r => (
                  <button
                    key={r.id}
                    onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors active:bg-white/5"
                  >
                    <span className="text-sm">🕐</span>
                    <span className="text-sm truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>{r.title}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
