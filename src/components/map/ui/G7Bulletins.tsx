'use client'

import { useState } from 'react'
import { G7_BULLETINS, getBulletinStatus } from '@/data/g7-bulletins'
import type { G7Bulletin, BulletinCategory } from '@/data/g7-bulletins'
import { useMapT } from '@/i18n/map'

const STATUS_CONFIG = {
  active:   { color: '#FF453A', bg: 'rgba(255,69,58,0.10)',  border: 'rgba(255,69,58,0.28)' },
  upcoming: { color: '#FF9F0A', bg: 'rgba(255,159,10,0.08)', border: 'rgba(255,159,10,0.22)' },
  past:     { color: 'var(--text-tertiary)', bg: 'var(--bg-card)', border: 'var(--border)' },
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#FF453A',
  warning:  '#FF9F0A',
  info:     '#0A84FF',
}

// Sur fond coloré (active/upcoming) : blanc pour contraste maximum
// Sur fond neutre (past) : variables CSS habituelles
function textColors(status: 'active' | 'upcoming' | 'past') {
  const colored = status !== 'past'
  return {
    primary:   colored ? 'rgba(255,255,255,0.95)' : 'var(--text-primary)',
    secondary: colored ? 'rgba(255,255,255,0.65)' : 'var(--text-secondary)',
    tertiary:  colored ? 'rgba(255,255,255,0.45)' : 'var(--text-tertiary)',
    divider:   colored ? 'rgba(255,255,255,0.12)' : 'var(--border)',
    chevron:   colored ? 'rgba(255,255,255,0.40)' : 'var(--text-tertiary)',
  }
}

function BulletinCard({ bulletin }: { bulletin: G7Bulletin }) {
  const t = useMapT()
  const [open, setOpen] = useState(false)
  const status = getBulletinStatus(bulletin)
  const sc     = STATUS_CONFIG[status]
  const tc     = textColors(status)
  const accent = SEVERITY_COLOR[bulletin.severity] ?? '#0A84FF'
  const statusLabel = status === 'active' ? t.bulletins.active
    : status === 'upcoming' ? t.bulletins.upcoming
    : t.bulletins.past

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
    >
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xl flex-shrink-0" style={{ marginTop: 1 }}>{bulletin.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 3 }}>
            <span className="text-[12px] font-bold leading-tight" style={{ color: accent }}>
              {bulletin.title}
            </span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background:    status === 'past' ? 'rgba(255,255,255,0.08)' : `${sc.color}28`,
                color:          sc.color,
                letterSpacing: '.04em',
              }}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-[11px] leading-snug" style={{ color: tc.secondary }}>
            {bulletin.summary}
          </p>
        </div>
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          stroke={tc.chevron} strokeWidth="1.5" strokeLinecap="round"
          style={{ flexShrink: 0, marginTop: 6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}
        >
          <path d="M1 1l4 4 4-4"/>
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${tc.divider}` }}>
          {bulletin.body.map((section, i) => (
            <div key={i} style={{ paddingTop: 12 }}>
              {section.heading && (
                <p
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: tc.tertiary, marginBottom: 6 }}
                >
                  {section.heading}
                </p>
              )}
              {section.lines.map((line, j) =>
                line === ''
                  ? <div key={j} style={{ height: 4 }} />
                  : <p key={j} className="text-[12px] leading-relaxed" style={{ color: tc.primary }}>{line}</p>
              )}
            </div>
          ))}
          <div style={{ paddingTop: 10, borderTop: `1px solid ${tc.divider}` }}>
            <p className="text-[10px]" style={{ color: tc.tertiary }}>
              {t.bulletins.sourcePrefix}{bulletin.source}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export function G7BulletinsPanel({ categories, title }: {
  categories?: BulletinCategory[]
  title?: string
}) {
  const t = useMapT()
  const resolvedTitle = title ?? t.bulletins.defaultTitle

  const filtered = categories
    ? G7_BULLETINS.filter(b => categories.includes(b.category))
    : G7_BULLETINS

  const ORDER: Record<string, number> = { active: 0, upcoming: 1, past: 2 }
  const sorted = [...filtered].sort((a, b) => ORDER[getBulletinStatus(a)] - ORDER[getBulletinStatus(b)])

  if (sorted.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
        {resolvedTitle}
      </p>
      {sorted.map(b => <BulletinCard key={b.id} bulletin={b} />)}
    </div>
  )
}
