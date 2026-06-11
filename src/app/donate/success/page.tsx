'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function SuccessInner() {
  const params = useSearchParams()
  const amount = params.get('amount')

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-sm text-center"
        style={{
          padding:      '40px 32px',
          borderRadius: '24px',
          background:   'var(--bg-card)',
          border:       '1px solid var(--border)',
          boxShadow:    'var(--shadow-lg)',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '20px', lineHeight: 1 }}>💚</div>

        <h1
          style={{
            fontSize:      '22px',
            fontWeight:    700,
            letterSpacing: '-0.02em',
            color:         'var(--text-primary)',
            marginBottom:  '10px',
            fontFamily:    '-apple-system, Inter, sans-serif',
          }}
        >
          Merci pour votre soutien !
        </h1>

        {amount && (
          <p style={{ fontSize: '15px', color: 'var(--green)', fontWeight: 600, marginBottom: '8px' }}>
            CHF {amount} reçus
          </p>
        )}

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '28px' }}>
          Votre contribution finance directement l'infrastructure TIF et la résilience de l'information pour tous les habitants du Grand Genève.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Link
            href="/map"
            style={{
              display:       'block',
              background:    'var(--green)',
              color:         '#fff',
              borderRadius:  '13px',
              padding:       '14px',
              fontSize:      '15px',
              fontWeight:    600,
              textDecoration:'none',
              letterSpacing: '-0.01em',
            }}
          >
            Ouvrir la carte live
          </Link>
          <Link
            href="/"
            style={{
              display:       'block',
              color:         'var(--text-tertiary)',
              fontSize:      '13px',
              textDecoration:'none',
              padding:       '8px',
            }}
          >
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function DonateSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessInner />
    </Suspense>
  )
}
