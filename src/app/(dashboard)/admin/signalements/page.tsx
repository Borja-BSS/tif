'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { firebaseAuth } from '@/lib/firebase'
import { SIGNAL_CATEGORIES, PRIORITY_LEVELS } from '@/data/signalement-categories'
import type { Signalement } from '@/data/signalement-categories'

const ADMIN_EMAILS = ['lostropicosbox@gmail.com', 'aruncalstas@gmail.com']

const PRIORITY_COLOR: Record<string, string> = {
  info:         '#8E8E93',
  vigilance:    '#30D158',
  perturbation: '#FF9500',
  important:    '#FF9F0A',
  urgent:       '#FF3B30',
  critique:     '#FF2D55',
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)     return `il y a ${Math.round(diff)}s`
  if (diff < 3600)   return `il y a ${Math.round(diff / 60)}min`
  if (diff < 86400)  return `il y a ${Math.round(diff / 3600)}h`
  return new Date(iso).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function SignalementsAdmin() {
  const { user } = useAuth()
  const router   = useRouter()
  const [items,     setItems]     = useState<Signalement[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [acting,    setActing]    = useState<string | null>(null)

  const isAdmin = !!user && ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')

  useEffect(() => {
    if (!user) { router.replace('/login'); return }
    if (!isAdmin) { router.replace('/map'); return }
  }, [user, isAdmin, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = await firebaseAuth.currentUser?.getIdToken()
      const res   = await fetch('/api/v1/signalements', { headers: { Authorization: `Bearer ${token}` } })
      const d     = await res.json() as { signalements: Signalement[] }
      setItems(d.signalements ?? [])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  const act = async (id: string, status: 'approved' | 'rejected') => {
    setActing(id)
    const token = await firebaseAuth.currentUser?.getIdToken()
    await fetch('/api/v1/signalements', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ id, status }),
    })
    setActing(null)
    load()
  }

  const del = async (id: string) => {
    if (!confirm('Supprimer ce signalement ?')) return
    setActing(id)
    const token = await firebaseAuth.currentUser?.getIdToken()
    await fetch('/api/v1/signalements', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ id }),
    })
    setActing(null)
    load()
  }

  const shown = items.filter(s => filter === 'all' || s.status === filter)
  const pendingCount = items.filter(s => s.status === 'pending').length

  if (!isAdmin) return null

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a', color: 'rgba(255,255,255,0.92)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 border-b"
        style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.08)' }}>
        <button onClick={() => router.push('/admin')}
          className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)' }}>
          <svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round">
            <path d="M7 1L1 6.5 7 12"/>
          </svg>
        </button>
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Admin</p>
          <p className="text-[15px] font-bold">Signalements</p>
        </div>
        {pendingCount > 0 && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,59,48,0.20)', color: '#FF453A' }}>
            {pendingCount} en attente
          </span>
        )}
        <button onClick={load} className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 px-4 py-3 border-b overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {(['all','pending','approved','rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="flex-shrink-0 rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all"
            style={{
              background: filter === f ? '#0A84FF' : 'rgba(255,255,255,0.06)',
              color:      filter === f ? '#fff'    : 'rgba(255,255,255,0.50)',
              border:     `1px solid ${filter === f ? 'transparent' : 'rgba(255,255,255,0.09)'}`,
            }}>
            {f === 'all' ? 'Tous' : f === 'pending' ? 'En attente' : f === 'approved' ? 'Approuvés' : 'Rejetés'}
            {f === 'pending' && pendingCount > 0 && <span className="ml-1.5 text-[10px]">({pendingCount})</span>}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {loading && (
          <div className="flex justify-center py-12 gap-2">
            {[0,1,2].map(i => <span key={i} className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: `${i*150}ms` }}/>)}
          </div>
        )}

        {!loading && shown.length === 0 && (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-[14px] font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>Aucun signalement</p>
          </div>
        )}

        {shown.map(s => {
          const catObj = SIGNAL_CATEGORIES.find(c => c.id === s.category)
          const priObj = PRIORITY_LEVELS.find(p => p.id === s.priority)
          const priColor = PRIORITY_COLOR[s.priority] ?? '#8E8E93'
          const isActing = acting === s.id

          return (
            <div key={s.id} className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
              {/* Header card */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-xl flex-shrink-0">{catObj?.icon ?? '📍'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: catObj?.color ?? '#fff' }}>
                        {catObj?.label}
                      </span>
                      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.40)' }}>·</span>
                      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.60)' }}>{s.subcategory}</span>
                    </div>
                    <p className="text-[13px] font-semibold leading-snug" style={{ color: 'rgba(255,255,255,0.88)' }}>{s.description}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: `${priColor}18`, color: priColor, border: `1px solid ${priColor}35` }}>
                    {priObj?.icon} {priObj?.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {(s.lat != null && s.lng != null) ? (
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.40)' }}>
                      📍 GPS {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                    </span>
                  ) : s.address ? (
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.40)' }}>📍 {s.address}</span>
                  ) : null}
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.30)' }}>{timeAgo(s.createdAt)}</span>
                  {s.mediaUrls && s.mediaUrls.length > 0 && (
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.40)' }}>📎 {s.mediaUrls.length} média{s.mediaUrls.length > 1 ? 's' : ''}</span>
                  )}
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: s.status === 'pending' ? 'rgba(255,159,10,0.15)' : s.status === 'approved' ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.12)',
                      color:      s.status === 'pending' ? '#FF9F0A'               : s.status === 'approved' ? '#30D158'               : '#FF453A',
                    }}>
                    {s.status === 'pending' ? '⏳ En attente' : s.status === 'approved' ? '✓ Approuvé' : '✗ Rejeté'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              {s.status === 'pending' && (
                <div className="flex border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <button onClick={() => act(s.id, 'approved')} disabled={isActing}
                    className="flex-1 py-3 text-[13px] font-semibold transition-colors active:scale-[0.98]"
                    style={{ color: '#30D158', background: isActing ? 'rgba(52,199,89,0.05)' : 'rgba(52,199,89,0.08)' }}>
                    ✓ Approuver
                  </button>
                  <div style={{ width: 1, background: 'rgba(255,255,255,0.07)' }}/>
                  <button onClick={() => act(s.id, 'rejected')} disabled={isActing}
                    className="flex-1 py-3 text-[13px] font-semibold transition-colors active:scale-[0.98]"
                    style={{ color: '#FF453A', background: isActing ? 'rgba(255,59,48,0.05)' : 'rgba(255,59,48,0.06)' }}>
                    ✗ Rejeter
                  </button>
                  <div style={{ width: 1, background: 'rgba(255,255,255,0.07)' }}/>
                  <button onClick={() => del(s.id)} disabled={isActing}
                    className="px-4 py-3 text-[13px] active:scale-[0.98]"
                    style={{ color: 'rgba(255,255,255,0.30)' }}>
                    🗑️
                  </button>
                </div>
              )}
              {s.status !== 'pending' && (
                <div className="flex border-t justify-end" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <button onClick={() => del(s.id)} disabled={isActing}
                    className="px-4 py-2.5 text-[12px] active:scale-[0.98]"
                    style={{ color: 'rgba(255,255,255,0.30)' }}>
                    🗑️ Supprimer
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
