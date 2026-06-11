'use client'

import { useState, useEffect } from 'react'
import { useMapT } from '@/i18n/map'

const LG_MODAL: React.CSSProperties = {
  background:           'rgba(18,18,24,0.96)',
  backdropFilter:       'blur(48px) saturate(200%) brightness(1.05)',
  WebkitBackdropFilter: 'blur(48px) saturate(200%) brightness(1.05)',
  border:               '0.5px solid rgba(255,255,255,0.18)',
  boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.22), 0 24px 80px rgba(0,0,0,0.65)',
}

export function WelcomeModals() {
  const [step, setStep] = useState<'g7' | 'features' | null>(null)
  const t = useMapT()

  useEffect(() => {
    setStep('g7')
  }, [])

  if (!step) return null

  const dismiss = () => {
    setStep(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.72)' }} />
      {step === 'g7'
        ? <G7Modal      w={t.welcome} onNext={() => setStep('features')} />
        : <FeaturesModal w={t.welcome} onDismiss={dismiss} />
      }
    </div>
  )
}

type WelcomeT = ReturnType<typeof useMapT>['welcome']

function G7Modal({ w, onNext }: { w: WelcomeT; onNext: () => void }) {
  return (
    <div className="relative z-10 w-full max-w-sm rounded-3xl p-6" style={LG_MODAL}>
      <button
        onClick={onNext}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-opacity active:opacity-60"
        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}
        aria-label="Fermer"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M1 1l8 8M9 1l-8 8"/>
        </svg>
      </button>

      <div className="text-center mb-5">
        <div className="text-5xl mb-3">🏛️</div>
        <h2 className="text-[17px] font-bold text-white mb-1.5">{w.g7Title}</h2>
        <p className="text-[13px] font-semibold" style={{ color: 'rgba(255,196,0,0.9)' }}>
          {w.g7Date}
        </p>
      </div>

      <div className="rounded-2xl p-4 mb-5 space-y-3" style={{ background: 'rgba(255,196,0,0.07)', border: '1px solid rgba(255,196,0,0.22)' }}>
        <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)' }}
          dangerouslySetInnerHTML={{ __html: w.g7Body1 }} />
        <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)' }}
          dangerouslySetInnerHTML={{ __html: w.g7Body2 }} />
        <p className="text-[12px]" style={{ color: 'rgba(255,196,0,0.7)' }}>
          {w.g7Warn}
        </p>
      </div>

      <button
        onClick={onNext}
        className="w-full py-3.5 rounded-2xl text-[14px] font-bold text-white transition-opacity active:opacity-80"
        style={{ background: 'var(--brand)' }}
      >
        {w.g7Btn}
      </button>
    </div>
  )
}

function FeaturesModal({ w, onDismiss }: { w: WelcomeT; onDismiss: () => void }) {
  const features = [
    { icon: '🛂', label: w.feat1L, desc: w.feat1D },
    { icon: '🚦', label: w.feat2L, desc: w.feat2D },
    { icon: '🚌', label: w.feat3L, desc: w.feat3D },
    { icon: '⚠️', label: w.feat4L, desc: w.feat4D },
    { icon: '🅿️', label: w.feat5L, desc: w.feat5D },
    { icon: '⭐', label: w.feat6L, desc: w.feat6D },
    { icon: '🗓️', label: w.feat7L, desc: w.feat7D, isNew: true },
  ]

  return (
    <div className="relative z-10 w-full max-w-sm rounded-3xl p-6" style={LG_MODAL}>
      <div className="text-center mb-4">
        <div className="text-4xl mb-2">🎉</div>
        <h2 className="text-[17px] font-bold text-white mb-1">{w.featTitle}</h2>
        <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {w.featSub}
        </p>
      </div>

      <div className="space-y-2 mb-5">
        {features.map(f => (
          <div key={f.label}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{
              background: f.isNew ? 'rgba(175,82,222,0.08)' : 'rgba(255,255,255,0.04)',
              border:     `1px solid ${f.isNew ? 'rgba(175,82,222,0.30)' : 'rgba(255,255,255,0.08)'}`,
            }}>
            <span className="text-xl flex-shrink-0">{f.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold text-white">{f.label}</p>
                {f.isNew && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(175,82,222,0.25)', color: '#AF52DE' }}>
                    {w.newBadge}
                  </span>
                )}
              </div>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onDismiss}
        className="w-full py-3.5 rounded-2xl text-[14px] font-bold text-white transition-opacity active:opacity-80"
        style={{ background: 'var(--brand)' }}
      >
        {w.featBtn}
      </button>
    </div>
  )
}
