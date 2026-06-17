'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
  id:        string
  title:     string
  subtitle?: string
  lat:       number
  lng:       number
  type:      string
}

interface MapboxFeature {
  id:          string
  text:        string
  place_name:  string
  place_type:  string[]
  center:      [number, number]
  properties?: { category?: string }
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const PROXIMITY    = '6.1432,46.2044'
const BBOX         = '5.80,46.00,6.65,46.55'
const TYPES        = 'place,locality,neighborhood,address,poi,district'

function toSearchResult(f: MapboxFeature): SearchResult {
  const [lng, lat] = f.center
  const commaIdx   = f.place_name.indexOf(',')
  const subtitle   = commaIdx !== -1 ? f.place_name.slice(commaIdx + 2) : undefined
  return {
    id:       f.id,
    title:    f.text,
    subtitle: subtitle !== f.text ? subtitle : undefined,
    lat, lng,
    type:     f.place_type[0] ?? 'address',
  }
}

async function geocodeDirect(query: string, signal: AbortSignal): Promise<SearchResult[]> {
  if (!MAPBOX_TOKEN || query.trim().length < 2) return []
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json` +
    `?access_token=${MAPBOX_TOKEN}` +
    `&proximity=${PROXIMITY}` +
    `&bbox=${BBOX}` +
    `&language=fr` +
    `&limit=6` +
    `&types=${TYPES}`
  const res = await fetch(url, { signal, cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json() as { features?: MapboxFeature[] }
  return (data.features ?? []).map(toSearchResult)
}

function highlightMatch(title: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return title
  const idx = title.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return title
  return (
    <>
      {title.slice(0, idx)}
      <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
        {title.slice(idx, idx + query.length)}
      </strong>
      {title.slice(idx + query.length)}
    </>
  )
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
  const abortRef = useRef<AbortController | null>(null)

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
    // Cancel any previous in-flight request
    abortRef.current?.abort()

    if (!query || query.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    abortRef.current  = controller

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await geocodeDirect(query, controller.signal)
        setResults(res)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setResults([])
      } finally {
        setLoading(false)
      }
    }, 150)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const handleSelect = useCallback((result: SearchResult) => {
    const updated = [result, ...recentSearches.filter(r => r.id !== result.id)].slice(0, 3)
    setRecentSearches(updated)
    try { localStorage.setItem('tif:recent-searches', JSON.stringify(updated)) } catch { /* ignore */ }

    window.dispatchEvent(new CustomEvent('tif:route-to', { detail: result }))
    map?.flyTo({ center: [result.lng, result.lat], zoom: 14, duration: 700, essential: true })
    setIsOpen(false)
    setQuery('')
    setResults([])
  }, [map, recentSearches])

  if (!isOpen) {
    return (
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center gap-2 mx-4"
        style={{ marginTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}>
        <button
          onClick={() => setIsOpen(true)}
          className="flex-1 flex items-center gap-3 px-4 cursor-text"
          style={{ ...LG, height: 52, borderRadius: 16, transition: springs.search }}
          aria-label="Rechercher un lieu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span className="flex-1 text-left text-sm" style={{ color: 'var(--text-tertiary)', fontFamily: '-apple-system, sans-serif' }}>
            {PLACEHOLDERS[placeholderIdx]}
          </span>
        </button>
        <a
          href="/"
          className="flex-shrink-0 flex items-center justify-center"
          style={{ ...LG, width: 52, height: 52, borderRadius: 16, transition: springs.search }}
          aria-label="Accueil"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </a>
      </div>
    )
  }

  const RESULTS_TOP = 'calc(env(safe-area-inset-top, 0px) + 52px + 12px + 8px + 40px + 8px)'

  return (
    <>
      <div
        className="fixed inset-0 z-29"
        style={{ background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(2px)' }}
        onClick={() => { setIsOpen(false); setQuery(''); setResults([]) }}
      />

      {/* Champ de saisie */}
      <div
        className="fixed top-0 left-0 right-0 z-30 mx-4 overflow-hidden"
        style={{ ...LG, borderRadius: 16, marginTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => { setIsOpen(false); setQuery(''); setResults([]) }}
            style={{ color: 'var(--text-secondary)', flexShrink: 0 }}
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
            style={{ color: 'var(--text-primary)', caretColor: 'var(--brand)', fontSize: '16px' }}
          />
          {loading && (
            <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/70 animate-spin flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Résultats */}
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
                    <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {highlightMatch(r.title, query)}
                    </div>
                    {r.subtitle && (
                      <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {r.subtitle}
                      </div>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <>
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t.search.recent}</p>
                {recentSearches.map(r => (
                  <button
                    key={r.id}
                    onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors active:bg-white/5"
                  >
                    <span className="text-sm flex-shrink-0">🕐</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{r.title}</div>
                      {r.subtitle && (
                        <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{r.subtitle}</div>
                      )}
                    </div>
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
