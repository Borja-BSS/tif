'use client'

import { useState, useEffect } from 'react'
import { useMapT } from '@/i18n/map'
import { OnboardingTour, fireConfetti } from './OnboardingTour'

const CRISIS_KEY   = 'tif:alert:crisis:v1'
const UPDATE_KEY   = 'tif:update:v4'
const G7_KEY       = 'tif:g7:v2'
const FEATURES_KEY = 'tif:features:v2'

const LG_MODAL: React.CSSProperties = {
  background:           'rgba(18,18,24,0.96)',
  backdropFilter:       'blur(48px) saturate(200%) brightness(1.05)',
  WebkitBackdropFilter: 'blur(48px) saturate(200%) brightness(1.05)',
  border:               '0.5px solid rgba(255,255,255,0.18)',
  boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.22), 0 24px 80px rgba(0,0,0,0.65)',
}

type Step = 'crisis' | 'g7' | 'survey' | 'features' | 'update' | null

export function WelcomeModals() {
  const [step,       setStep]       = useState<Step>(null)
  const [tourActive, setTourActive] = useState(false)
  const t = useMapT()

  // Determine which step to show — each popup is shown only once (guarded by localStorage)
  useEffect(() => {
    // Si l'utilisateur revient depuis /signaler, skip les modals pour cette session
    if (sessionStorage.getItem('tif:from-signaler')) {
      sessionStorage.removeItem('tif:from-signaler')
      setStep(null)
      return
    }

    const crisisSeen   = localStorage.getItem(CRISIS_KEY)
    const updateSeen   = localStorage.getItem(UPDATE_KEY)
    const g7Seen       = localStorage.getItem(G7_KEY)
    const surveyDone   = localStorage.getItem('tif_survey_v1')
    const featuresSeen = localStorage.getItem(FEATURES_KEY)

    if (!crisisSeen)        setStep('crisis')
    else if (!updateSeen)   setStep('update')
    else if (!g7Seen)       setStep('g7')
    else if (!surveyDone)   setStep('survey')
    else if (!featuresSeen) setStep('features')
    else                    setStep(null)
  }, [])

  // Confetti when the Update popup appears
  useEffect(() => {
    if (step === 'update') fireConfetti()
  }, [step])

  const goAfterG7 = () => {
    localStorage.setItem(G7_KEY, '1')
    const surveyDone = localStorage.getItem('tif_survey_v1')
    setStep(surveyDone ? 'features' : 'survey')
  }

  const goAfterFeatures = () => {
    localStorage.setItem(FEATURES_KEY, '1')
    setStep(null)
  }

  const handleSkipUpdate = () => {
    localStorage.setItem(UPDATE_KEY, '1')
    fireConfetti()
    setStep('g7')
  }

  const handleDiscover = () => {
    localStorage.setItem(UPDATE_KEY, '1')
    localStorage.setItem(G7_KEY, '1')
    localStorage.setItem(FEATURES_KEY, '1')
    setStep(null)
    setTourActive(true)
  }

  if (tourActive) {
    return <OnboardingTour onDone={() => setTourActive(false)} />
  }

  if (!step) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.72)' }} />
      {step === 'crisis'
        ? <CrisisModal onDismiss={() => { localStorage.setItem(CRISIS_KEY, '1'); setStep('update') }} />
        : step === 'g7'
        ? <G7Modal       w={t.welcome} onNext={goAfterG7} />
        : step === 'survey'
        ? <SurveyModal   w={t.welcome} onNext={() => setStep('features')} />
        : step === 'features'
        ? <FeaturesModal w={t.welcome} onDismiss={goAfterFeatures} />
        : step === 'update'
        ? <UpdateModal onSkip={handleSkipUpdate} onDiscover={handleDiscover} />
        : null
      }
    </div>
  )
}

type WelcomeT = ReturnType<typeof useMapT>['welcome']

// ── Existing modals (unchanged) ───────────────────────────────────────────────

function G7Modal({ w, onNext }: { w: WelcomeT; onNext: () => void }) {
  return (
    <div className="relative z-10 w-full max-w-sm rounded-3xl p-6" style={LG_MODAL}>
      <button
        onClick={onNext}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-opacity active:opacity-60"
        style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-tertiary)' }}
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
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}
          dangerouslySetInnerHTML={{ __html: w.g7Body1 }} />
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}
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

function SurveyModal({ w, onNext }: { w: WelcomeT; onNext: () => void }) {
  const [vote, setVote]         = useState<'yes' | 'no' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [sending, setSending]   = useState(false)

  const handleSubmit = async () => {
    if (!vote) return
    setSending(true)
    try {
      await fetch('/api/v1/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote, feedback: feedback.trim() }),
      })
    } catch {}
    localStorage.setItem('tif_survey_v1', '1')
    onNext()
  }

  return (
    <div className="relative z-10 w-full max-w-sm rounded-3xl p-6" style={LG_MODAL}>
      <div className="text-center mb-5">
        <div className="text-5xl mb-3">📱</div>
        <h2 className="text-[16px] font-bold text-white mb-2 leading-snug">{w.surveyTitle}</h2>
        <p className="text-[12px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
          {w.surveySub}
        </p>
      </div>

      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setVote('yes')}
          className="flex-1 py-3 rounded-2xl text-[13px] font-bold transition-all active:scale-95"
          style={{
            background: vote === 'yes' ? 'rgba(52,199,89,0.16)' : 'rgba(255,255,255,0.05)',
            border: `1.5px solid ${vote === 'yes' ? 'rgba(52,199,89,0.65)' : 'rgba(255,255,255,0.10)'}`,
            color: vote === 'yes' ? '#34C759' : 'rgba(255,255,255,0.65)',
          }}
        >
          {w.surveyYes}
        </button>
        <button
          onClick={() => setVote('no')}
          className="flex-1 py-3 rounded-2xl text-[13px] font-bold transition-all active:scale-95"
          style={{
            background: vote === 'no' ? 'rgba(255,59,48,0.13)' : 'rgba(255,255,255,0.05)',
            border: `1.5px solid ${vote === 'no' ? 'rgba(255,59,48,0.55)' : 'rgba(255,255,255,0.10)'}`,
            color: vote === 'no' ? '#FF3B30' : 'rgba(255,255,255,0.65)',
          }}
        >
          {w.surveyNo}
        </button>
      </div>

      <textarea
        value={feedback}
        onChange={e => setFeedback(e.target.value.slice(0, 500))}
        placeholder={w.surveyFeedbackPh}
        rows={3}
        className="w-full rounded-2xl px-3.5 py-3 text-[13px] resize-none outline-none mb-4"
        style={{
          background:  'rgba(255,255,255,0.05)',
          border:      '1px solid rgba(255,255,255,0.10)',
          color: 'var(--text-primary)',
          caretColor:  'white',
        }}
      />

      <button
        onClick={handleSubmit}
        disabled={!vote || sending}
        className="w-full py-3.5 rounded-2xl text-[14px] font-bold text-white transition-opacity active:opacity-80"
        style={{
          background: vote ? 'var(--brand)' : 'rgba(255,255,255,0.07)',
          opacity:    (!vote || sending) ? 0.55 : 1,
          cursor:     vote && !sending ? 'pointer' : 'not-allowed',
        }}
      >
        {sending ? '…' : w.surveyBtn}
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
        <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
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
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{f.desc}</p>
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

// ── CRISIS — Alerte zone critique G7 (one-time, key: tif:alert:crisis:v1) ─────

function CrisisModal({ onDismiss }: { onDismiss: () => void }) {
  const handleSignal = () => {
    localStorage.setItem(CRISIS_KEY, '1')
    sessionStorage.setItem('tif:from-signaler', '1')
    window.location.href = '/signaler'
  }

  const handleShare = async () => {
    const url  = 'https://tif.borja-swiss-solutions.ch/map'
    const text = '⚠️ Zone critique à Genève — Suis la situation en direct sur TIF :'
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'TIF — Alerte Genève', text, url }) } catch {}
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank')
    }
  }

  return (
    <div className="relative z-10 w-full max-w-sm rounded-3xl p-6" style={LG_MODAL}>
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-opacity active:opacity-60"
        style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-tertiary)' }}
        aria-label="Fermer"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M1 1l8 8M9 1l-8 8"/>
        </svg>
      </button>

      <div className="text-center mb-5">
        <div className="text-5xl mb-3">⚠️</div>
        <h2 className="text-[18px] font-bold text-white mb-2 leading-snug">
          Zone critique en ce moment
        </h2>
        <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Manifestation NO-G7 · TPG fortement perturbé · Contrôles frontière renforcés
        </p>
      </div>

      <div className="rounded-2xl p-4 mb-5 space-y-2.5"
        style={{ background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.28)' }}>
        <p className="text-[13px] font-semibold text-white">
          📡 Partagez vos infos en direct
        </p>
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Vous êtes sur le terrain ? Signalez un incident, un embouteillage ou une fermeture de route. Votre signal aide tous les utilisateurs TIF en temps réel.
        </p>
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Partagez aussi l&apos;application avec vos proches pour qu&apos;ils puissent suivre la situation et se déplacer en sécurité.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSignal}
          className="flex-1 py-3.5 rounded-2xl text-[14px] font-bold text-white transition-opacity active:opacity-80"
          style={{ background: '#FF453A' }}
        >
          📍 Signaler
        </button>
        <button
          onClick={handleShare}
          className="flex-1 py-3.5 rounded-2xl text-[14px] font-bold text-white transition-opacity active:opacity-80"
          style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)' }}
        >
          🔗 Partager
        </button>
      </div>
    </div>
  )
}

// ── NEW — Mise à jour popup (one-time, key: tif:update:v2) ────────────────────

const NEW_FEATURES = [
  { icon: '🛂', label: 'Temps d\'attente directionnels', desc: 'FR→CH et CH→FR affichés séparément sur chaque douane', isNew: true },
  { icon: '🗓️', label: 'Agenda événements', desc: 'Filtres par jour, lieu et prix (gratuit / payant)', isNew: true },
  { icon: '⚠️', label: 'Alertes partageables', desc: 'Incidents en direct, partageables en un tap', isNew: true },
  { icon: '⭐', label: 'Mon Trajet', desc: 'Alertes personnalisées sur ton chemin habituel', isNew: true },
  { icon: '🚦', label: 'Trafic HERE amélioré', desc: 'Embouteillages : rouge toujours visible par-dessus le vert', isNew: true },
  { icon: '🤖', label: 'Assistant IA optimisé', desc: 'Réponses plus rapides, données live intégrées', isNew: true },
]

function UpdateModal({ onSkip, onDiscover }: { onSkip: () => void; onDiscover: () => void }) {
  return (
    <div className="relative z-10 w-full max-w-sm rounded-3xl p-6 max-h-[90vh] overflow-y-auto" style={LG_MODAL}>

      <div className="text-center mb-4">
        <div className="text-4xl mb-2">✨</div>
        <h2 className="text-[17px] font-bold text-white mb-1">Nouvelle mise à jour</h2>
        <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
          Voici ce qui a été ajouté depuis ta dernière visite
        </p>
      </div>

      <div className="space-y-2 mb-5">
        {NEW_FEATURES.map(f => (
          <div
            key={f.label}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{
              background: 'rgba(10,132,255,0.07)',
              border:     '1px solid rgba(10,132,255,0.22)',
            }}
          >
            <span className="text-xl flex-shrink-0">{f.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold text-white">{f.label}</p>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(10,132,255,0.25)', color: '#0A84FF' }}
                >
                  NOUVEAU
                </span>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex gap-3">
        <button
          onClick={onDiscover}
          className="flex-1 py-3.5 rounded-2xl text-[14px] font-bold text-white transition-opacity active:opacity-80"
          style={{ background: 'var(--brand)' }}
        >
          Découvrir 🚀
        </button>
        <button
          onClick={onSkip}
          className="py-3.5 px-5 rounded-2xl text-[14px] font-semibold transition-opacity active:opacity-70"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border:     '0.5px solid rgba(255,255,255,0.14)',
            color: 'var(--text-secondary)',
          }}
        >
          Passer
        </button>
      </div>
    </div>
  )
}
