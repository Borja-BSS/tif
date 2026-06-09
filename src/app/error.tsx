'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[TIF] Navigation error:', error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg, #000)',
        padding: '24px',
        fontFamily: '-apple-system, Inter, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '320px' }}>
        <h2
          style={{
            color:        'var(--text-primary, #fff)',
            fontSize:     '20px',
            fontWeight:   600,
            marginBottom: '12px',
          }}
        >
          Une erreur s&apos;est produite
        </h2>
        <p
          style={{
            color:        'var(--text-secondary, #999)',
            fontSize:     '14px',
            marginBottom: '24px',
            lineHeight:   1.5,
          }}
        >
          La page n&apos;a pas pu se charger correctement.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              background:   'var(--brand, #0066ff)',
              color:        '#fff',
              border:       'none',
              borderRadius: '12px',
              padding:      '12px 20px',
              fontSize:     '14px',
              fontWeight:   600,
              cursor:       'pointer',
            }}
          >
            Réessayer
          </button>
          <a
            href="/"
            style={{
              background:     'var(--bg-card, #1a1a1a)',
              color:          'var(--text-primary, #fff)',
              border:         '1px solid var(--border, #333)',
              borderRadius:   '12px',
              padding:        '12px 20px',
              fontSize:       '14px',
              fontWeight:     500,
              cursor:         'pointer',
              textDecoration: 'none',
              display:        'inline-block',
            }}
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  )
}
