'use client'

import { useGuest }  from '@/context/GuestContext'
import { useRouter } from 'next/navigation'

export function GuestBanner() {
  const { isGuest, secondsLeft } = useGuest()
  const router = useRouter()

  if (!isGuest) return null

  const mins    = Math.floor(secondsLeft / 60)
  const secs    = secondsLeft % 60
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`

  const urgency     = secondsLeft <= 30 ? 'red' : secondsLeft <= 120 ? 'orange' : 'neutral'
  const bgColor     = urgency === 'red'    ? 'rgba(255,69,58,0.18)'
                    : urgency === 'orange' ? 'rgba(255,159,10,0.14)'
                    :                        'rgba(255,255,255,0.06)'
  const borderColor = urgency === 'red'    ? 'rgba(255,69,58,0.40)'
                    : urgency === 'orange' ? 'rgba(255,159,10,0.35)'
                    :                        'rgba(255,255,255,0.14)'
  const timeColor   = urgency === 'red'    ? '#FF453A'
                    : urgency === 'orange' ? '#FF9F0A'
                    :                        'rgba(255,255,255,0.55)'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position:       'fixed',
        bottom:         '20px',
        left:           '50%',
        transform:      'translateX(-50%)',
        zIndex:         9998,
        display:        'flex',
        alignItems:     'center',
        gap:            '14px',
        padding:        '10px 14px 10px 16px',
        borderRadius:   '16px',
        background:     bgColor,
        backdropFilter: 'blur(40px) saturate(200%) brightness(1.06)',
        border:         `0.5px solid ${borderColor}`,
        boxShadow:      'inset 0 0.5px 0 rgba(255,255,255,0.20), 0 4px 24px rgba(0,0,0,0.22)',
        transition:     'background 0.5s ease, border-color 0.5s ease',
        whiteSpace:     'nowrap',
      }}
    >
      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>
        Mode invité
      </span>

      <span
        style={{
          fontSize:           '14px',
          fontWeight:         700,
          color:              timeColor,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing:      '0.02em',
          transition:         'color 0.4s ease',
          minWidth:           '32px',
          textAlign:          'center',
        }}
      >
        {timeStr}
      </span>

      <button
        onClick={() => router.push('/login')}
        style={{
          fontSize:     '12px',
          fontWeight:   600,
          color:        '#fff',
          background:   '#0071E3',
          border:       'none',
          borderRadius: '10px',
          padding:      '6px 12px',
          cursor:       'pointer',
          lineHeight:   1,
          flexShrink:   0,
        }}
      >
        Créer un compte →
      </button>
    </div>
  )
}
