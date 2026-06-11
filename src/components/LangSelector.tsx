'use client'

import { useState, useRef, useEffect } from 'react'
import type { Lang } from '@/i18n/home'
import { LANGUAGES } from '@/i18n/home'

export function LangSelector({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const current = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Change language"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: '980px',
          padding: '5px 9px',
          fontSize: '12px', fontWeight: 600,
          color: 'var(--ink)',
          cursor: 'pointer',
          letterSpacing: '-.01em',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: '13px', lineHeight: 1 }}>{current.flag}</span>
        <span>{current.code.toUpperCase()}</span>
        <svg
          width="8" height="5" viewBox="0 0 8 5" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          style={{
            opacity: 0.45,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s ease',
          }}
        >
          <path d="M1 1l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '5px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            zIndex: 9999,
            minWidth: '140px',
          }}
        >
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => { onChange(l.code); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '7px 10px',
                background: l.code === lang ? 'var(--off2)' : 'transparent',
                border: 'none', borderRadius: '9px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: l.code === lang ? 600 : 400,
                color: 'var(--ink)',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '15px' }}>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
