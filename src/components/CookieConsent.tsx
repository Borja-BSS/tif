'use client'

import { useEffect, useState } from 'react'
import { getConsent, getSessionId, saveConsent, CONSENT_VERSION } from '@/lib/analytics/consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!getConsent()) setVisible(true)
  }, [])

  if (!visible) return null

  function accept() {
    saveConsent({ analytics: true, geo: true, version: CONSENT_VERSION, ts: Date.now() })
    setVisible(false)
    fetch('/api/v1/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: getSessionId(),
        event: 'consent_given',
        data: { version: CONSENT_VERSION },
      }),
      keepalive: true,
    }).catch(() => {})
  }

  function refuse() {
    saveConsent({ analytics: false, geo: false, version: CONSENT_VERSION, ts: Date.now() })
    setVisible(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        padding: '16px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          maxWidth: '680px',
          width: '100%',
          borderRadius: '20px',
          border: '0.5px solid rgba(255,255,255,0.14)',
          background: 'rgba(10,10,15,0.92)',
          backdropFilter: 'blur(48px) saturate(180%) brightness(1.04)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%) brightness(1.04)',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.4), inset 0 0.5px 0 rgba(255,255,255,0.18)',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        {/* Icône */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            background: 'rgba(232,0,14,0.15)',
            border: '0.5px solid rgba(232,0,14,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '18px',
          }}
        >
          🛡️
        </div>

        {/* Texte */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.95)',
              marginBottom: '3px',
              letterSpacing: '-0.2px',
            }}
          >
            Confidentialité &amp; Localisation
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.50)', lineHeight: 1.5 }}>
            Nous collectons des données anonymes (aucune information personnelle) pour améliorer
            la plateforme. En acceptant, vous autorisez aussi la localisation GPS pour centrer
            la carte sur votre position.
          </div>
        </div>

        {/* Boutons */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={refuse}
            style={{
              padding: '9px 16px',
              borderRadius: '100px',
              border: '0.5px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.60)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '-0.1px',
            }}
          >
            Refuser
          </button>
          <button
            onClick={accept}
            style={{
              padding: '9px 18px',
              borderRadius: '100px',
              border: 'none',
              background: '#E8000E',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '-0.1px',
              boxShadow: '0 2px 12px rgba(232,0,14,0.35)',
            }}
          >
            Tout accepter
          </button>
        </div>
      </div>
    </div>
  )
}
