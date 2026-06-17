'use client'

import { useGuest }  from '@/context/GuestContext'
import { useRouter } from 'next/navigation'

const LOCKED_FEATURES = [
  { icon: '🗺️', label: 'Mon trajet personnalisé', desc: 'Sauvegarde et alertes sur votre trajet quotidien' },
  { icon: '📧', label: 'Alertes email avant le départ', desc: 'Notification si votre trajet est perturbé' },
  { icon: '🔔', label: 'Veille G7 en continu', desc: 'Accès illimité sans minuterie' },
]

export function GuestWelcomeModal() {
  const { showWelcome, dismissWelcome } = useGuest()
  const router = useRouter()

  if (!showWelcome) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenue en mode invité"
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         99998,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(24px) saturate(140%)',
      }}
    >
      <div
        style={{
          maxWidth:     '380px',
          width:        '100%',
          margin:       '0 20px',
          padding:      '32px 28px 28px',
          borderRadius: '24px',
          background:   'rgba(28,28,30,0.96)',
          border:       '0.5px solid rgba(255,255,255,0.16)',
          boxShadow:    'inset 0 0.5px 0 rgba(255,255,255,0.25), 0 32px 96px rgba(0,0,0,0.70)',
        }}
      >
        <div style={{ fontSize: '38px', marginBottom: '14px', lineHeight: 1, textAlign: 'center' }}>👋</div>

        <h2 style={{
          color: 'var(--text-primary)',
          fontSize:      '19px',
          fontWeight:    700,
          marginBottom:  '8px',
          letterSpacing: '-0.02em',
          textAlign:     'center',
          fontFamily:    '-apple-system, Inter, sans-serif',
        }}>
          Bienvenue en mode invité
        </h2>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize:     '13px',
          lineHeight:   1.55,
          marginBottom: '22px',
          textAlign:    'center',
        }}>
          Vous avez <strong style={{ color: 'var(--text-primary)' }}>10 minutes</strong> pour explorer la carte live. Créez un compte pour accéder à toutes les fonctionnalités.
        </p>

        <div style={{ marginBottom: '22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {LOCKED_FEATURES.map(f => (
            <div key={f.label} style={{
              display:      'flex',
              alignItems:   'flex-start',
              gap:          '12px',
              padding:      '12px 14px',
              borderRadius: '14px',
              background:   'rgba(255,255,255,0.05)',
              border:       '0.5px solid rgba(255,255,255,0.09)',
            }}>
              <span style={{ fontSize: '18px', lineHeight: 1, marginTop: '1px', flexShrink: 0 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{f.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{f.desc}</div>
              </div>
              <span style={{
                marginLeft:   'auto',
                fontSize:     '11px',
                fontWeight:   600,
                color:        'rgba(255,159,10,0.85)',
                background:   'rgba(255,159,10,0.12)',
                border:       '0.5px solid rgba(255,159,10,0.25)',
                borderRadius: '6px',
                padding:      '2px 7px',
                flexShrink:   0,
                alignSelf:    'center',
              }}>
                Compte requis
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          <button
            onClick={() => router.push('/login?tab=register')}
            style={{
              background:    '#0071E3',
              color:         '#fff',
              border:        'none',
              borderRadius:  '13px',
              padding:       '14px',
              fontSize:      '15px',
              fontWeight:    600,
              cursor:        'pointer',
              letterSpacing: '-0.01em',
              width:         '100%',
            }}
          >
            Créer mon compte — c'est gratuit
          </button>

          <button
            onClick={dismissWelcome}
            style={{
              background:   'transparent',
              color: 'var(--text-tertiary)',
              border:       '1px solid rgba(255,255,255,0.10)',
              borderRadius: '13px',
              padding:      '13px',
              fontSize:     '14px',
              cursor:       'pointer',
              width:        '100%',
            }}
          >
            Explorer la carte (10 min)
          </button>
        </div>
      </div>
    </div>
  )
}
