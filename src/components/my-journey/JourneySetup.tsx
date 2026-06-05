'use client'

import { useState } from 'react'
import { springs } from '@/lib/animations/springs'
import type { CreateJourneyInput } from '@/lib/my-journey/types'

const DAYS = [
  { label: 'L', value: 1 }, { label: 'M', value: 2 }, { label: 'M', value: 3 },
  { label: 'J', value: 4 }, { label: 'V', value: 5 }, { label: 'S', value: 6 },
  { label: 'D', value: 0 },
]

type Step = 1 | 2 | 3 | 4 | 5

interface SearchResult { id: string; title: string; lat: number; lng: number; type: string }

interface JourneySetupProps {
  onComplete: () => void
  onClose:    () => void
}

export function JourneySetup({ onComplete, onClose }: JourneySetupProps) {
  const [step,    setStep]    = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const [from,    setFrom]    = useState<SearchResult | null>(null)
  const [to,      setTo]      = useState<SearchResult | null>(null)
  const [days,    setDays]    = useState<number[]>([1,2,3,4,5])
  const [hour,    setHour]    = useState(7)
  const [minute,  setMinute]  = useState(45)
  const [mode,    setMode]    = useState<'car' | 'transit' | 'both'>('both')
  const [notify,  setNotify]  = useState(15)

  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchFor, setSearchFor] = useState<'from' | 'to'>('from')

  const searchAddress = async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res  = await fetch(`/api/v1/routing/geocode?q=${encodeURIComponent(q)}&bbox=5.9,46.1,6.5,46.5`)
      const data = await res.json()
      setResults((data.results ?? []).slice(0, 5))
    } catch { setResults([]) }
    finally { setSearching(false) }
  }

  const selectResult = (r: SearchResult) => {
    if (searchFor === 'from') { setFrom(r); setStep(2) }
    else { setTo(r); setStep(3) }
    setQuery('')
    setResults([])
  }

  const useGPS = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      const r: SearchResult = {
        id: 'gps', title: 'Ma position',
        lat: pos.coords.latitude, lng: pos.coords.longitude, type: 'address',
      }
      setFrom(r)
      setStep(2)
    })
  }

  const toggleDay = (d: number) =>
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const submit = async () => {
    if (!from || !to) return
    setLoading(true)
    setError(null)
    try {
      const body: CreateJourneyInput = {
        name:                `${from.title.split(',')[0]} → ${to.title.split(',')[0]}`,
        fromLat: from.lat, fromLng: from.lng, fromLabel: from.title,
        toLat: to.lat,     toLng: to.lng,     toLabel: to.title,
        dayOfWeek: days, departureHour: hour, departureMinute: minute,
        preferredMode: mode, notifyMinutesBefore: notify,
      }
      const res = await fetch('/api/v1/my-journey', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde')
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally { setLoading(false) }
  }

  const SearchStep = ({ which }: { which: 'from' | 'to' }) => (
    <div style={{ animation: `scaleIn ${springs.search} forwards` }}>
      <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
        {which === 'from' ? 'Où commencez-vous ?' : 'Où allez-vous ?'}
      </h2>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        {which === 'from' ? 'Votre adresse de départ habituelle' : 'Votre destination habituelle'}
      </p>
      <div className="relative mb-2">
        <input
          autoFocus
          value={query}
          onChange={e => { setQuery(e.target.value); searchAddress(e.target.value) }}
          placeholder={which === 'from' ? 'Domicile ou adresse de départ…' : 'Bureau, école, destination…'}
          className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        {searching && <div className="absolute right-3 top-3 w-4 h-4 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />}
      </div>
      {which === 'from' && (
        <button onClick={useGPS} className="w-full text-sm py-2.5 rounded-2xl mb-3 font-medium"
          style={{ background: 'rgba(10,132,255,0.1)', color: 'var(--brand)', border: '1px solid rgba(10,132,255,0.2)' }}>
          📍 Utiliser ma position actuelle
        </button>
      )}
      {results.map(r => (
        <button key={r.id} onClick={() => selectResult(r)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left mb-1"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>📍</span>
          <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{r.title}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full rounded-t-3xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg)', animation: `slideUp ${springs.sheet} forwards`, maxHeight: '90vh' }}>

        {/* Header + progress */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
              Étape {step} / 5
            </p>
            <div className="flex gap-1">
              {([1,2,3,4,5] as Step[]).map(s => (
                <div key={s} className="h-1 flex-1 rounded-full"
                  style={{ background: s <= step ? 'var(--brand)' : 'var(--border)', transition: springs.filter }} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="ml-4" style={{ color: 'var(--text-tertiary)' }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {step === 1 && <SearchStep which="from" />}
          {step === 2 && <SearchStep which="to" />}

          {step === 3 && (
            <div style={{ animation: `scaleIn ${springs.search} forwards` }}>
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Quand partez-vous ?</h2>
              <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>Jours et heure de départ habituels</p>
              <div className="flex gap-1.5 mb-5">
                {DAYS.map(d => (
                  <button key={d.value} onClick={() => toggleDay(d.value)}
                    className="flex-1 h-10 rounded-xl text-sm font-bold"
                    style={{
                      background: days.includes(d.value) ? 'var(--brand)' : 'var(--bg-card)',
                      color:      days.includes(d.value) ? '#fff'         : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}>
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mb-5">
                <select value={hour} onChange={e => setHour(+e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i.toString().padStart(2,'0')}h</option>
                  ))}
                </select>
                <select value={minute} onChange={e => setMinute(+e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => (
                    <option key={m} value={m}>{m.toString().padStart(2,'0')} min</option>
                  ))}
                </select>
              </div>
              <button onClick={() => setStep(4)} disabled={days.length === 0}
                className="w-full py-3.5 rounded-xl text-sm font-bold"
                style={{ background: 'var(--brand)', color: '#fff', opacity: days.length === 0 ? 0.5 : 1 }}>
                Continuer →
              </button>
            </div>
          )}

          {step === 4 && (
            <div style={{ animation: `scaleIn ${springs.search} forwards` }}>
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Comment voyagez-vous ?</h2>
              <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>Mode de transport préféré</p>
              {([
                { value: 'car'     as const, icon: '🚗', label: 'Voiture'    },
                { value: 'transit' as const, icon: '🚌', label: 'Transport'  },
                { value: 'both'    as const, icon: '🔄', label: 'Les deux'   },
              ]).map(m => (
                <button key={m.value} onClick={() => { setMode(m.value); setStep(5) }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl mb-3 text-left"
                  style={{
                    background: mode === m.value ? 'var(--brand-subtle)' : 'var(--bg-card)',
                    border: `1px solid ${mode === m.value ? 'var(--brand)' : 'var(--border)'}`,
                  }}>
                  <span className="text-2xl">{m.icon}</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.label}</span>
                </button>
              ))}
            </div>
          )}

          {step === 5 && (
            <div style={{ animation: `scaleIn ${springs.search} forwards` }}>
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Alertez-moi avant mon départ</h2>
              <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>Si votre trajet est perturbé, TIF vous alerte à l'avance</p>
              <div className="flex gap-2 mb-6">
                {[5, 10, 15, 20, 30].map(n => (
                  <button key={n} onClick={() => setNotify(n)}
                    className="flex-1 h-10 rounded-xl text-sm font-bold"
                    style={{
                      background: notify === n ? 'var(--brand)' : 'var(--bg-card)',
                      color:      notify === n ? '#fff'         : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}>
                    {n} min
                  </button>
                ))}
              </div>
              {error && <p className="text-sm mb-4" style={{ color: 'var(--red)' }}>{error}</p>}
              <button onClick={submit} disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-bold"
                style={{ background: 'var(--brand)', color: '#fff', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Enregistrement...' : '✓ Configurer mon trajet'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
