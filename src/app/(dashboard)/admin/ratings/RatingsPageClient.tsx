'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

const ADMIN_EMAILS = ['lostropicosbox@gmail.com', 'aruncalstas@gmail.com']

interface RatingEntry {
  stars:   number
  comment: string | null
  ts:      number | null
  country: string | null
}

interface RatingsData {
  counts: number[]
  total:  number
  avg:    number
  list:   RatingEntry[]
}

const STAR_COLOR = '#FFD60A'

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= n ? STAR_COLOR : 'none'}
          stroke={i <= n ? STAR_COLOR : 'rgba(255,255,255,0.18)'} strokeWidth="1.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </span>
  )
}

export default function RatingsPageClient() {
  const { user, loading } = useAuth()
  const pathname          = usePathname()
  const [data,     setData]     = useState<RatingsData | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)

  const isAdmin = !!user && ADMIN_EMAILS.includes(user.email ?? '')

  useEffect(() => {
    if (!isAdmin) return
    setFetching(true)
    fetch('/api/v1/admin/ratings')
      .then(r => r.json())
      .then((d: RatingsData | { error: string }) => {
        if ('error' in d) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Erreur réseau'))
      .finally(() => setFetching(false))
  }, [isAdmin])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d10] flex items-center justify-center">
        <p className="text-white/30 text-[13px] font-mono">Chargement…</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0d0d10] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-[13px] text-white/30 font-mono mb-1">Accès restreint</p>
          <p className="text-[11px] text-white/20 font-mono">{user?.email ?? 'non connecté'}</p>
        </div>
      </div>
    )
  }

  const maxCount = data ? Math.max(...data.counts, 1) : 1
  const withComment = data ? data.list.filter(e => e.comment) : []

  return (
    <div className="min-h-screen bg-[#0d0d10] text-white font-mono">
      <header className="px-6 pt-8 pb-4">
        <p className="text-[10px] text-white/30 uppercase tracking-[0.18em]">TIF — Admin</p>
        <p className="text-[11px] text-white/30 mt-0.5">{user?.email ?? ''}</p>
      </header>

      <nav className="flex gap-0 px-4 border-b border-white/[0.06] mb-8">
        {[
          { label: 'Alertes',      href: '/admin/alerts'       },
          { label: 'Signalements', href: '/admin/signalements' },
          { label: 'Sondage',      href: '/admin/survey'       },
          { label: 'Douanes',      href: '/admin/crossings'    },
          { label: 'Avis ⭐',      href: '/admin/ratings'      },
        ].map(tab => {
          const active = pathname === tab.href
          return (
            <Link key={tab.href} href={tab.href}
              className="px-5 py-2.5 text-[12px] transition-colors"
              style={{
                color:        active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
                borderBottom: active ? '1.5px solid rgba(255,255,255,0.6)' : '1.5px solid transparent',
                marginBottom: -1,
              }}>
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-6">
        {fetching && <p className="text-[12px] text-white/25 mb-6">Chargement…</p>}
        {error    && <p className="text-[12px] text-red-400 mb-6">{error}</p>}

        {data && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="rounded-xl bg-white/5 px-5 py-4">
                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Total avis</p>
                <p className="text-3xl font-semibold text-white/90">{data.total}</p>
                <p className="text-[10px] text-white/25 mt-1">évaluations reçues</p>
              </div>
              <div className="rounded-xl px-5 py-4" style={{ background: 'rgba(255,214,10,0.06)', border: '1px solid rgba(255,214,10,0.18)' }}>
                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-2">Moyenne</p>
                {data.total > 0 ? (
                  <>
                    <p className="text-3xl font-semibold" style={{ color: STAR_COLOR }}>{data.avg}</p>
                    <div className="mt-1">
                      <Stars n={Math.round(data.avg)} size={12} />
                    </div>
                  </>
                ) : (
                  <p className="text-2xl font-semibold text-white/30">—</p>
                )}
              </div>
            </div>

            {/* Distribution */}
            <section className="mb-8">
              <h2 className="text-[11px] text-white/35 uppercase tracking-widest mb-4">Distribution des étoiles</h2>
              <div className="flex flex-col gap-2.5">
                {[5,4,3,2,1].map(star => {
                  const count   = data.counts[star - 1]
                  const pct     = data.total > 0 ? Math.round((count / data.total) * 100) : 0
                  const barPct  = Math.round((count / maxCount) * 100)
                  return (
                    <div key={star} className="flex items-center gap-3">
                      <Stars n={star} size={11} />
                      <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${barPct}%`, background: STAR_COLOR, opacity: 0.7 + star * 0.06 }}
                        />
                      </div>
                      <span className="text-[12px] font-semibold text-white/70 w-6 text-right">{count}</span>
                      <span className="text-[10px] text-white/25 w-8 text-right">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Commentaires */}
            <section>
              <h2 className="text-[11px] text-white/35 uppercase tracking-widest mb-3">
                Commentaires ({withComment.length})
              </h2>
              {withComment.length === 0 ? (
                <p className="text-[12px] text-white/25 italic">Aucun commentaire pour le moment.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {withComment.map((e, i) => (
                    <div key={i} className="rounded-lg bg-white/[0.04] px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <Stars n={e.stars} size={11} />
                        <div className="flex gap-3 text-[10px] text-white/25">
                          {e.country && <span>{e.country}</span>}
                          {e.ts && (
                            <span>{new Date(e.ts).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-[12px] text-white/75 leading-relaxed break-words">{e.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
