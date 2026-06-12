'use client'

import { useState, useEffect, useCallback } from 'react'

const STRIPE_LINK = 'https://buy.stripe.com/fZu5kCar71V38erfdR97G00'
const PAD         = 10   // px around the spotlight element
const CARD_W      = 300  // tooltip width
const CARD_H      = 185  // estimated tooltip height

interface TourStep {
  target:         string | null
  title:          string
  body:           string
  isDonation?:    boolean
  skipIfMissing?: boolean
}

const STEPS: TourStep[] = [
  {
    target: '[data-onboarding="filter-borders"]',
    title:  '🛂 Douanes en temps réel',
    body:   'Clique sur un marqueur de douane pour voir le temps d\'attente en temps réel dans les deux sens : France→Suisse et Suisse→France séparément.',
  },
  {
    target: '[data-onboarding="filter-events"]',
    title:  '🗓️ Agenda événements',
    body:   'L\'agenda culturel du Grand Genève est intégré. Filtre par jour, par lieu, et vois quels événements sont gratuits ou payants.',
  },
  {
    target: '[data-onboarding="filter-alerts"]',
    title:  '⚠️ Alertes & Incidents',
    body:   'Alertes en direct : incidents de trafic, perturbations TPG/CFF, zones G7 actives. Chaque alerte est partageable en un tap.',
  },
  {
    target:        '[data-onboarding="filter-journey"]',
    title:         '⭐ Mon Trajet',
    body:          'Enregistre ton trajet habituel pour recevoir des alertes ciblées et personnalisées sur ton chemin.',
    skipIfMissing: true,
  },
  {
    target: '[data-onboarding="gps-btn"]',
    title:  '📍 Se localiser',
    body:   'Centre la carte sur ta position pour voir les douanes et alertes proches de toi en temps réel.',
  },
  {
    target: '[data-onboarding="filter-all"]',
    title:  '🗺️ Vue complète',
    body:   'Reviens à la vue complète pour tout voir d\'un coup : trafic, douanes, alertes, événements.',
  },
  {
    target: '[data-onboarding="ai-btn"]',
    title:  '🤖 Assistant TIF',
    body:   'Pose une question en langage naturel — douanes, transports, itinéraires, événements. L\'IA répond avec les données live.',
  },
  {
    target:     null,
    title:      '🎉 Tu as tout découvert !',
    body:       'TIF est un projet indépendant et gratuit. Si tu l\'utilises régulièrement, un café symbolique aide à maintenir le service 24h/24.',
    isDonation: true,
  },
]

function fireConfetti() {
  import('canvas-confetti').then(m => {
    const fn = m.default
    fn({ particleCount: 130, spread: 80, origin: { y: 0.5 }, colors: ['#FF9F0A','#30D158','#0A84FF','#FF453A','#5E5CE6','#FF375F'] })
    setTimeout(() => {
      fn({ particleCount: 60, spread: 60, origin: { x: 0.1, y: 0.5 }, colors: ['#FF9F0A','#30D158','#0A84FF'] })
      fn({ particleCount: 60, spread: 60, origin: { x: 0.9, y: 0.5 }, colors: ['#FF453A','#5E5CE6','#FF375F'] })
    }, 220)
  })
}

export { fireConfetti }

interface Props { onDone: () => void }

export function OnboardingTour({ onDone }: Props) {
  const [idx,  setIdx]  = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const upd = () => setDims({ w: window.innerWidth, h: window.innerHeight })
    upd()
    window.addEventListener('resize', upd)
    return () => window.removeEventListener('resize', upd)
  }, [])

  useEffect(() => {
    const step = STEPS[idx]
    if (!step.target) { setRect(null); return }

    let tries = 0
    const measure = () => {
      const el = document.querySelector<HTMLElement>(step.target!)
      if (el) { setRect(el.getBoundingClientRect()); return true }
      return false
    }

    if (!measure()) {
      const id = setInterval(() => { if (measure() || ++tries > 15) clearInterval(id) }, 80)
      return () => clearInterval(id)
    }
  }, [idx])

  useEffect(() => {
    const step = STEPS[idx]
    if (!step.target) return
    const remeasure = () => {
      const el = document.querySelector<HTMLElement>(step.target!)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', remeasure)
    window.addEventListener('scroll', remeasure, { passive: true })
    return () => {
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('scroll', remeasure)
    }
  }, [idx])

  const next = useCallback(() => {
    let n = idx + 1
    while (n < STEPS.length) {
      const s = STEPS[n]
      if (s.skipIfMissing && s.target && !document.querySelector(s.target)) { n++; continue }
      break
    }
    if (n >= STEPS.length) { fireConfetti(); onDone() }
    else setIdx(n)
  }, [idx, onDone])

  const skip = useCallback(() => { fireConfetti(); onDone() }, [onDone])

  const step = STEPS[idx]
  const pct  = Math.round(((idx + 1) / STEPS.length) * 100)

  // Tooltip position relative to spotlight rect
  let cardStyle: React.CSSProperties
  if (rect && dims.w > 0) {
    const spaceBelow = dims.h - rect.bottom
    const spaceAbove = rect.top
    const cx = Math.max(16, Math.min(rect.left + rect.width / 2 - CARD_W / 2, dims.w - CARD_W - 16))
    if (spaceBelow >= CARD_H + 24 || spaceBelow >= spaceAbove) {
      cardStyle = { top: rect.bottom + PAD + 12, left: cx }
    } else {
      cardStyle = { top: Math.max(8, rect.top - PAD - CARD_H - 16), left: cx }
    }
  } else {
    cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
  }

  const CARD_STYLE: React.CSSProperties = {
    position:             'absolute',
    width:                CARD_W,
    ...cardStyle,
    zIndex:               2,
    background:           'rgba(18,18,26,0.98)',
    backdropFilter:       'blur(48px) saturate(180%)',
    WebkitBackdropFilter: 'blur(48px) saturate(180%)',
    border:               '0.5px solid rgba(255,255,255,0.18)',
    borderRadius:         20,
    boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.16), 0 24px 80px rgba(0,0,0,0.70)',
    padding:              '16px 18px',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1002 }}>

      {/* Dark overlay with spotlight hole */}
      {dims.w > 0 && (
        <svg width={dims.w} height={dims.h} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <mask id="ob-spot">
              <rect x={0} y={0} width={dims.w} height={dims.h} fill="white"/>
              {rect && (
                <rect
                  x={rect.x - PAD} y={rect.y - PAD}
                  width={rect.width + PAD * 2} height={rect.height + PAD * 2}
                  rx={16} fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x={0} y={0} width={dims.w} height={dims.h}
            fill="rgba(0,0,0,0.82)"
            mask="url(#ob-spot)"
            onClick={skip}
            style={{ cursor: 'default' }}
          />
        </svg>
      )}

      {/* Highlight ring around element */}
      {rect && (
        <div style={{
          position:      'absolute',
          left:          rect.x - PAD,
          top:           rect.y - PAD,
          width:         rect.width  + PAD * 2,
          height:        rect.height + PAD * 2,
          borderRadius:  16,
          border:        '2px solid rgba(255,255,255,0.55)',
          boxShadow:     '0 0 0 4px rgba(255,255,255,0.07)',
          pointerEvents: 'none',
          zIndex:        1,
          transition:    'all 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}/>
      )}

      {/* Tooltip card */}
      <div style={CARD_STYLE}>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#0A84FF,#5E5CE6)', borderRadius: 3, transition: 'width 0.35s ease' }}/>
        </div>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginBottom: 6, fontWeight: 500 }}>
          Étape {idx + 1} / {STEPS.length}
        </p>

        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8, lineHeight: 1.3 }}>
          {step.title}
        </p>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 1.55, marginBottom: 16 }}>
          {step.body}
        </p>

        {step.isDonation ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={STRIPE_LINK}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setTimeout(skip, 500)}
              style={{
                flex: 1, display: 'block', textAlign: 'center',
                padding: '10px 0', borderRadius: 12,
                background: 'rgba(255,159,10,0.14)',
                border: '1px solid rgba(255,159,10,0.38)',
                color: '#FF9F0A', fontSize: 13, fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              ☕ Soutenir
            </a>
            <button
              onClick={skip}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.42)', fontSize: 13,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Non merci
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={next}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12,
                background: '#0A84FF', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
              }}
            >
              Suivant →
            </button>
            <button
              onClick={skip}
              style={{
                padding: '10px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.36)', fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Passer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
