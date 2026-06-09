'use client'

import { useGuest }  from '@/context/GuestContext'
import { useRouter } from 'next/navigation'

export function GuestExpiredModal() {
  const { hasExpired } = useGuest()
  const router         = useRouter()

  if (!hasExpired) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Accès invité expiré"
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         99999,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(28px) saturate(150%)',
      }}
    >
      <div
        style={{
          maxWidth:     '360px',
          width:        '100%',
          margin:       '0 20px',
          padding:      '32px 28px',
          borderRadius: '22px',
          background:   'rgba(28,28,30,0.94)',
          border:       '0.5px solid rgba(255,255,255,0.18)',
          boxShadow:    'inset 0 0.5px 0 rgba(255,255,255,0.28), 0 32px 96px rgba(0,0,0,0.65)',
          textAlign:    'center',
        }}
      >
        <div style={{ fontSize: '40px', marginBottom: '16px', lineHeight: 1 }}>⏱</div>

        <h2 style={{
          color:         'rgba(255,255,255,0.92)',
          fontSize:      '20px',
          fontWeight:    700,
          marginBottom:  '10px',
          letterSpacing: '-0.01em',
          fontFamily:    '-apple-system, Inter, sans-serif',
        }}>
          Accès invité expiré
        </h2>

        <p style={{
          color:        'rgba(255,255,255,0.55)',
          fontSize:     '14px',
          lineHeight:   1.55,
          marginBottom: '28px',
          padding:      '0 4px',
        }}>
          Créez un compte pour accéder en continu à l'intelligence territoriale du Grand Genève.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
            }}
          >
            Créer mon compte
          </button>

          <button
            onClick={() => router.push('/login')}
            style={{
              background:   'transparent',
              color:        'rgba(255,255,255,0.45)',
              border:       '1px solid rgba(255,255,255,0.12)',
              borderRadius: '13px',
              padding:      '13px',
              fontSize:     '14px',
              cursor:       'pointer',
            }}
          >
            Se connecter
          </button>
        </div>
      </div>
    </div>
  )
}
