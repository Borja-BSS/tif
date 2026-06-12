'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'

const ADMIN_EMAILS = ['lostropicosbox@gmail.com', 'aruncalstas@gmail.com']

interface FeedbackEntry {
  vote:    'yes' | 'no'
  text:    string
  ts?:     number
  country?: string | null
}

interface SurveyData {
  yes:      number
  no:       number
  total:    number
  feedback: FeedbackEntry[]
}

export default function AdminSurveyPage() {
  const { user, loading } = useAuth()
  const [data,    setData]    = useState<SurveyData | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)

  const isAdmin = !!user && ADMIN_EMAILS.includes(user.email ?? '')

  useEffect(() => {
    if (!isAdmin) return
    setFetching(true)
    fetch('/api/v1/admin/survey')
      .then(r => r.json())
      .then((d: SurveyData | { error: string }) => {
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

  const yesPercent = data && data.total > 0
    ? Math.round((data.yes / data.total) * 100)
    : 0
  const noPercent  = data && data.total > 0
    ? Math.round((data.no  / data.total) * 100)
    : 0

  return (
    <div className="min-h-screen bg-[#0d0d10] text-white p-6 font-mono">
      <header className="mb-8">
        <p className="text-[10px] text-white/30 uppercase tracking-[0.18em]">TIF — Admin</p>
        <h1 className="text-xl font-semibold text-white/90 mt-1">Sondage App Mobile</h1>
        <p className="text-[11px] text-white/30 mt-1">{user.email}</p>
      </header>

      {fetching && (
        <p className="text-[12px] text-white/25 mb-6">Chargement…</p>
      )}
      {error && (
        <p className="text-[12px] text-red-400 mb-6">{error}</p>
      )}

      {data && (
        <>
          {/* ── KPIs ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl bg-white/5 px-5 py-4">
              <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Total votes</p>
              <p className="text-3xl font-semibold text-white/90">{data.total}</p>
              <p className="text-[10px] text-white/25 mt-1">réponses collectées</p>
            </div>
            <div className="rounded-xl px-5 py-4" style={{ background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.18)' }}>
              <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Oui</p>
              <p className="text-3xl font-semibold" style={{ color: '#34C759' }}>{data.yes}</p>
              <p className="text-[10px] mt-1" style={{ color: 'rgba(52,199,89,0.5)' }}>{yesPercent}% des votes</p>
            </div>
            <div className="rounded-xl px-5 py-4" style={{ background: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.16)' }}>
              <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Non</p>
              <p className="text-3xl font-semibold" style={{ color: '#FF3B30' }}>{data.no}</p>
              <p className="text-[10px] mt-1" style={{ color: 'rgba(255,59,48,0.5)' }}>{noPercent}% des votes</p>
            </div>
          </div>

          {/* ── Barre de progression ─────────────────────────────────── */}
          {data.total > 0 && (
            <div className="mb-8">
              <div className="flex rounded-full overflow-hidden h-2 bg-white/[0.06]">
                <div style={{ width: `${yesPercent}%`, background: '#34C759' }} />
                <div style={{ width: `${noPercent}%`,  background: '#FF3B30' }} />
              </div>
              <div className="flex justify-between text-[10px] text-white/25 mt-1.5">
                <span>Oui {yesPercent}%</span>
                <span>Non {noPercent}%</span>
              </div>
            </div>
          )}

          {/* ── Feedbacks ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-[11px] text-white/35 uppercase tracking-widest mb-3">
              Retours & Idées ({data.feedback.filter(f => f.text).length})
            </h2>
            {data.feedback.filter(f => f.text).length === 0 ? (
              <p className="text-[12px] text-white/25 italic">Aucun retour textuel pour le moment.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.feedback
                  .filter(f => f.text)
                  .map((f, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg bg-white/[0.04] px-4 py-3">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 flex-shrink-0"
                        style={{
                          background: f.vote === 'yes' ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.12)',
                          color:      f.vote === 'yes' ? '#34C759' : '#FF3B30',
                        }}
                      >
                        {f.vote === 'yes' ? 'OUI' : 'NON'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-white/75 leading-relaxed break-words">{f.text}</p>
                        <div className="flex gap-3 mt-1">
                          {f.country && (
                            <span className="text-[10px] text-white/25">{f.country}</span>
                          )}
                          {f.ts && (
                            <span className="text-[10px] text-white/20">
                              {new Date(f.ts).toLocaleString('fr-CH', {
                                day: '2-digit', month: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
