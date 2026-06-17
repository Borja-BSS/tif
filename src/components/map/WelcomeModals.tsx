'use client'

import { useState, useEffect } from 'react'
import { fireConfetti } from './OnboardingTour'

const RETOUR_KEY = 'tif:retour-normale:session'

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

  useEffect(() => {
    if (sessionStorage.getItem('tif:from-signaler')) {
      sessionStorage.removeItem('tif:from-signaler')
      return
    }
    if (!sessionStorage.getItem(RETOUR_KEY)) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    sessionStorage.setItem(RETOUR_KEY, '1')
    setVisible(false)
  }

  const handleOk = () => {
    fireConfetti()
    dismiss()
  }

  const handleEvents = () => {
    fireConfetti()
    dismiss()
    onOpenEvents?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.72)' }} />
      <RetourNormaleModal onOk={handleOk} onEvents={handleEvents} onClose={dismiss} />
    </div>
  )
}

function RetourNormaleModal({
  onOk,
  onEvents,
  onClose,
}: {
  onOk:      () => void
  onEvents:  () => void
  onClose:   () => void
}) {
  const events = [
    { icon: '🎪', label: 'Caribana Festival — Niska · KeBlack', desc: 'Ce soir · Crans-près-Céligny (Vaud)' },
    { icon: '🎭', label: 'Fête de la Musique',                  desc: '19–21 juin · Parc des Bastions · Gratuit' },
    { icon: '⚽', label: 'Mondial FIFA 2026 — Nati Suisse',     desc: 'FanZone Gradi24 · tous les matchs' },
  ]

  return (
    <div className="relative z-10 w-full max-w-sm rounded-3xl p-6" style={LG_MODAL}>
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
      <div className="text-center mb-5">
        <div className="text-5xl mb-3">✅</div>
        <h2 className="text-[18px] font-bold text-white mb-1.5 leading-snug">
          Début du retour à la normale
        </h2>
        <p className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Merci d&apos;avoir utilisé TIF pendant le G7
        </p>
      </div>

      {/* Status bloc */}
      <div className="rounded-2xl p-4 mb-4 space-y-2.5"
        style={{ background: 'rgba(52,199,89,0.07)', border: '1px solid rgba(52,199,89,0.28)' }}>
        <div className="flex items-start gap-2.5">
          <span className="text-base mt-0.5">🛂</span>
          <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.88)' }}>
            Les douanes actuellement fermées sont <strong style={{ color: '#34C759' }}>réouvertes</strong> — retrouvez-les sur la carte.
          </p>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="text-base mt-0.5">🛣️</span>
          <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.88)' }}>
            L&apos;autoroute A1 entre Vernier et Bardonnex (direction France) est également <strong style={{ color: '#34C759' }}>réouverte</strong>.
          </p>
        </div>
      </div>

      {/* Events bloc */}
      <div className="mb-5">
        <p className="text-[12px] font-semibold mb-2.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Retrouvez maintenant tous les événements proches de vous
        </p>
        <div className="space-y-2">
          {events.map(e => (
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
          OK, merci
        </button>
      </div>
    </div>
  )
}
