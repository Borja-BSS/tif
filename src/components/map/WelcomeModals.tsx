'use client'

import { useState, useEffect } from 'react'
import { fireConfetti } from './OnboardingTour'
import { events as ALL_EVENTS, CATEGORY_ICONS } from '../../data/events'
import type { EventItem, Occurrence } from '../../data/types'

const DISMISS_KEY  = 'tif:popup:dismiss-ts'
const EIGHT_HOURS  = 8 * 60 * 60 * 1000

const LG_MODAL: React.CSSProperties = {
  background:           'rgba(18,18,24,0.96)',
  backdropFilter:       'blur(48px) saturate(200%) brightness(1.05)',
  WebkitBackdropFilter: 'blur(48px) saturate(200%) brightness(1.05)',
  border:               '0.5px solid rgba(255,255,255,0.18)',
  boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.22), 0 24px 80px rgba(0,0,0,0.65)',
}

interface WelcomeModalsProps {
  onOpenEvents?: () => void
}

export function WelcomeModals({ onOpenEvents }: WelcomeModalsProps) {
  const [visible, setVisible] = useState(false)
  const [stars,   setStars]   = useState(0)
  const [hover,   setHover]   = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('tif:from-signaler')) {
      sessionStorage.removeItem('tif:from-signaler')
      return
    }
    try {
      const ts = localStorage.getItem(DISMISS_KEY)
      if (!ts || Date.now() - Number(ts) > EIGHT_HOURS) {
        setVisible(true)
      }
    } catch {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const submitRating = async (s: number, c: string) => {
    if (s === 0 || submitted) return
    setSubmitted(true)
    try {
      await fetch('/api/v1/ratings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stars: s, comment: c.trim() || undefined }),
      })
    } catch {
      // fire-and-forget
    }
  }

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setVisible(false)
  }

  const handleOk = () => {
    fireConfetti()
    submitRating(stars, comment)
    dismiss()
  }

  const handleEvents = () => {
    fireConfetti()
    submitRating(stars, comment)
    dismiss()
    onOpenEvents?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.72)' }} />
      <RetourNormaleModal
        stars={stars} setStars={setStars}
        hover={hover} setHover={setHover}
        comment={comment} setComment={setComment}
        submitted={submitted}
        onOk={handleOk} onEvents={handleEvents} onClose={dismiss}
      />
    </div>
  )
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getUpcomingEvents(max = 3): Array<{ icon: string; label: string; desc: string }> {
  const today = todayStr()
  const todayMs = new Date(today + 'T12:00:00Z').getTime()

  type Hit = { ev: EventItem; occ: Occurrence; daysAhead: number }
  const hits: Hit[] = []
  const seen = new Set<string>()

  for (const ev of ALL_EVENTS) {
    for (const occ of ev.occurrences) {
      const daysAhead = Math.round(
        (new Date(occ.date + 'T12:00:00Z').getTime() - todayMs) / 86_400_000
      )
      if (daysAhead >= 0 && daysAhead <= 7 && !seen.has(ev.id)) {
        seen.add(ev.id)
        hits.push({ ev, occ, daysAhead })
        break
      }
    }
  }

  hits.sort((a, b) => a.daysAhead - b.daysAhead)

  return hits.slice(0, max).map(({ ev, occ, daysAhead }) => {
    const icon = CATEGORY_ICONS[ev.category] ?? '📅'
    const when = daysAhead === 0 ? "Aujourd'hui" : daysAhead === 1 ? 'Demain' : `Dans ${daysAhead}j`
    const time = occ.start ? ` · ${occ.start}` : ''
    const note = occ.note ? ` · ${occ.note}` : ''
    return {
      icon,
      label: ev.title,
      desc: `${when}${time}${note} · ${ev.venue.name}`,
    }
  })
}

function RetourNormaleModal({
  stars, setStars, hover, setHover,
  comment, setComment, submitted,
  onOk, onEvents, onClose,
}: {
  stars:      number
  setStars:   (n: number) => void
  hover:      number
  setHover:   (n: number) => void
  comment:    string
  setComment: (s: string) => void
  submitted:  boolean
  onOk:       () => void
  onEvents:   () => void
  onClose:    () => void
}) {
  const upcomingEvents = getUpcomingEvents(3)

  const active = hover || stars

  return (
    <div className="relative z-10 w-full max-w-sm rounded-3xl p-6 overflow-y-auto max-h-[92dvh]" style={LG_MODAL}>
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-opacity active:opacity-60"
        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}
        aria-label="Fermer"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M1 1l8 8M9 1l-8 8"/>
        </svg>
      </button>

      {/* Header */}
      <div className="text-center mb-4">
        <div className="text-5xl mb-3">✅</div>
        <h2 className="text-[18px] font-bold text-white mb-1.5 leading-snug">
          Bienvenue sur TIF — Été 2026
        </h2>
        <p className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Mobilité · Sorties · FIFA World Cup jusqu&apos;au 19 juillet
        </p>
      </div>

      {/* ── Zone étoiles ───────────────────────────────────────────────── */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,214,10,0.06)', border: '1px solid rgba(255,214,10,0.18)' }}>
        <p className="text-[12px] font-semibold text-center mb-3" style={{ color: 'rgba(255,255,255,0.70)' }}>
          {submitted ? '✅ Avis envoyé — merci !' : 'Comment évaluez-vous TIF ?'}
        </p>

        {/* 5 étoiles */}
        <div className="flex justify-center gap-2 mb-1"
          onMouseLeave={() => setHover(0)}>
          {[1,2,3,4,5].map(i => (
            <button
              key={i}
              onClick={() => !submitted && setStars(i)}
              onMouseEnter={() => !submitted && setHover(i)}
              aria-label={`${i} étoile${i > 1 ? 's' : ''}`}
              className="transition-transform active:scale-90"
              style={{ transform: active >= i ? 'scale(1.12)' : 'scale(1)' }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24"
                fill={active >= i ? '#FFD60A' : 'none'}
                stroke={active >= i ? '#FFD60A' : 'rgba(255,255,255,0.22)'}
                strokeWidth="1.5"
                style={{ transition: 'fill 0.12s, stroke 0.12s' }}
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
          ))}
        </div>

        {stars > 0 && (
          <p className="text-[11px] text-center mt-0.5" style={{ color: 'rgba(255,214,10,0.65)' }}>
            {stars === 1 ? 'Peut mieux faire…' : stars === 2 ? 'Pas terrible…' : stars === 3 ? 'Bien !' : stars === 4 ? 'Très bien !' : 'Excellent ! 🎉'}
          </p>
        )}

        {/* Commentaire — apparaît si étoile sélectionnée */}
        {stars > 0 && !submitted && (
          <div className="mt-3 space-y-2.5">
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Un commentaire ? (facultatif)"
              rows={2}
              maxLength={300}
              className="w-full rounded-xl px-3 py-2 text-[12px] resize-none outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border:     '1px solid rgba(255,255,255,0.12)',
                color:      'rgba(255,255,255,0.80)',
              }}
            />
            {/* Soutenir TIF */}
            <a
              href="https://buy.stripe.com/fZu5kCar71V38erfdR97G00"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 active:opacity-70 transition-opacity"
              style={{ background: 'rgba(255,55,95,0.08)', border: '1px solid rgba(255,55,95,0.22)' }}
            >
              <span className="text-lg">❤️</span>
              <div>
                <p className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>Soutenir TIF</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.40)' }}>Faire un don pour continuer l&apos;aventure</p>
              </div>
            </a>
          </div>
        )}
      </div>

      {/* Events bloc */}
      <div className="mb-4">
        <p className="text-[12px] font-semibold mb-2.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {upcomingEvents.length > 0
            ? 'À venir dans le Grand Genève'
            : 'Retrouvez tous les événements sur la carte'}
        </p>
        <div className="space-y-2">
          {upcomingEvents.map(e => (
            <div
              key={e.label}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{
                background: 'rgba(175,82,222,0.07)',
                border:     '1px solid rgba(175,82,222,0.22)',
              }}
            >
              <span className="text-xl flex-shrink-0">{e.icon}</span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white truncate">{e.label}</p>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{e.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* App tease */}
      <div className="rounded-2xl px-3.5 py-3 mb-4 flex items-center gap-3"
        style={{ background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.25)' }}>
        <span className="text-xl flex-shrink-0">📱</span>
        <p className="text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.80)' }}>
          <strong style={{ color: '#0A84FF' }}>TIF arrive sur l&apos;App Store</strong> — l&apos;application mobile sort la semaine prochaine.
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onEvents}
          className="flex-1 py-3.5 rounded-2xl text-[14px] font-bold text-white transition-opacity active:opacity-80"
          style={{ background: 'var(--brand)' }}
        >
          Voir les événements
        </button>
        <button
          onClick={onOk}
          className="py-3.5 px-5 rounded-2xl text-[14px] font-semibold transition-opacity active:opacity-70"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border:     '0.5px solid rgba(255,255,255,0.14)',
            color:      'rgba(255,255,255,0.65)',
          }}
        >
          Continuer
        </button>
      </div>
    </div>
  )
}
