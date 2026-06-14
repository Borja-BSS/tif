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
  if (diff < 60)    return `il y a ${Math.round(diff)}s`
  if (diff < 3600)  return `il y a ${Math.round(diff / 60)}min`
  if (diff < 86400) return `il y a ${Math.round(diff / 3600)}h`
  return new Date(iso).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({
  s, onClose, onAct, onDel, acting,
}: {
  s: Signalement
  onClose: () => void
  onAct:   (id: string, status: 'approved' | 'rejected') => Promise<void>
  onDel:   (id: string) => Promise<void>
  acting:  string | null
}) {
  const catObj   = SIGNAL_CATEGORIES.find(c => c.id === s.category)
  const priObj   = PRIORITY_LEVELS.find(p => p.id === s.priority)
  const priColor = PRIORITY_COLOR[s.priority] ?? '#8E8E93'
  const isActing = acting === s.id
  const [lightbox, setLightbox] = useState<string | null>(null)

  const isVideo = (url: string) => /\.(mp4|mov|webm|ogg)(\?|$)/i.test(url)

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, backdropFilter: 'blur(4px)' }}
      />

      {/* Panel */}
      <div style={{
        position:     'fixed',
        bottom:       0,
        left:         0,
        right:        0,
        zIndex:       51,
        background:   '#0f0f14',
        borderRadius: '20px 20px 0 0',
        border:       '1px solid rgba(255,255,255,0.10)',
        maxHeight:    '90vh',
        overflowY:    'auto',
        animation:    'slideUp 0.22s cubic-bezier(0.23,1,0.32,1)',
      }}>
        <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>

        {/* Handle + close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{catObj?.icon ?? '📍'}</span>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: catObj?.color ?? '#fff', margin: 0 }}>
                {catObj?.label}
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{s.subcategory}</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)',
            fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Priority + status */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 7,
              background: `${priColor}18`, color: priColor, border: `1px solid ${priColor}35` }}>
              {priObj?.icon} {priObj?.label}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 7,
              background: s.status === 'pending' ? 'rgba(255,159,10,0.12)' : s.status === 'approved' ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.10)',
              color:      s.status === 'pending' ? '#FF9F0A' : s.status === 'approved' ? '#30D158' : '#FF453A',
              border:     `1px solid ${s.status === 'pending' ? 'rgba(255,159,10,0.25)' : s.status === 'approved' ? 'rgba(52,199,89,0.25)' : 'rgba(255,59,48,0.20)'}`,
            }}>
              {s.status === 'pending' ? '⏳ En attente' : s.status === 'approved' ? '✓ Approuvé' : '✗ Rejeté'}
            </span>
          </div>

          {/* Description */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.88)', lineHeight: 1.55, margin: 0 }}>{s.description}</p>
          </div>

          {/* Location */}
          {(s.lat != null && s.lng != null) && (
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Localisation GPS</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: '0 0 8px' }}>
                {s.lat.toFixed(6)}, {s.lng.toFixed(6)}
              </p>
              <a
                href={`https://maps.google.com/?q=${s.lat},${s.lng}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#0A84FF', textDecoration: 'none', fontWeight: 600 }}>
                Ouvrir dans Maps →
              </a>
            </div>
          )}
          {!s.lat && s.address && (
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Adresse</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>📍 {s.address}</p>
            </div>
          )}

          {/* Dates */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Signalé</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{fmt(s.createdAt)}</span>
            </div>
            {s.approvedAt && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'rgba(52,199,89,0.6)' }}>Approuvé</span>
                <span style={{ fontSize: 12, color: 'rgba(52,199,89,0.8)' }}>{fmt(s.approvedAt)}</span>
              </div>
            )}
            {s.rejectedAt && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,59,48,0.6)' }}>Rejeté</span>
                <span style={{ fontSize: 12, color: 'rgba(255,59,48,0.8)' }}>{fmt(s.rejectedAt)}</span>
              </div>
            )}
          </div>

          {/* Media */}
          {s.mediaUrls && s.mediaUrls.length > 0 && (
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Pièces jointes ({s.mediaUrls.length})
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {s.mediaUrls.map((url, i) => (
                  <button key={i} onClick={() => setLightbox(url)} style={{
                    padding: 0, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
                    overflow: 'hidden', cursor: 'pointer', background: 'rgba(255,255,255,0.05)',
                    aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isVideo(url) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 28 }}>▶️</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Vidéo</span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={`média ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            {s.status === 'pending' && (
              <>
                <button onClick={async () => { await onAct(s.id, 'approved'); onClose() }}
                  disabled={isActing}
                  style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
                    background: isActing ? 'rgba(52,199,89,0.08)' : 'rgba(52,199,89,0.15)',
                    color: '#30D158', fontSize: 14, fontWeight: 700 }}>
                  ✓ Approuver
                </button>
                <button onClick={async () => { await onAct(s.id, 'rejected'); onClose() }}
                  disabled={isActing}
                  style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
                    background: isActing ? 'rgba(255,59,48,0.06)' : 'rgba(255,59,48,0.12)',
                    color: '#FF453A', fontSize: 14, fontWeight: 700 }}>
                  ✗ Rejeter
                </button>
              </>
            )}
            <button onClick={async () => { await onDel(s.id); onClose() }}
              disabled={isActing}
              style={{ padding: '13px 16px', borderRadius: 14, border: 'none', cursor: 'pointer',
                background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
              🗑️
            </button>
          </div>

        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          {isVideo(lightbox) ? (
            <video src={lightbox} controls autoPlay style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 12 }} onClick={e => e.stopPropagation()} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightbox} alt="media" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 12, objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
          )}
          <button onClick={() => setLightbox(null)} style={{
            position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%',
            border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff',
            fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SignalementsAdmin() {
  const { user } = useAuth()
  const router   = useRouter()
  const [items,    setItems]    = useState<Signalement[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [acting,   setActing]   = useState<string | null>(null)
  const [selected, setSelected] = useState<Signalement | null>(null)

  const isAdmin = !!user && ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')

  useEffect(() => {
    if (!user)    { router.replace('/login'); return }
    if (!isAdmin) { router.replace('/map');   return }
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
    // Notifie SignalementsLayer dans les autres onglets pour refresh immédiat
    if (status === 'approved') {
      try { new BroadcastChannel('tif:signalements').postMessage({ approved: id }) } catch {}
    }
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

  const shown        = items.filter(s => filter === 'all' || s.status === filter)
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
          const catObj   = SIGNAL_CATEGORIES.find(c => c.id === s.category)
          const priObj   = PRIORITY_LEVELS.find(p => p.id === s.priority)
          const priColor = PRIORITY_COLOR[s.priority] ?? '#8E8E93'

          return (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className="w-full text-left rounded-2xl overflow-hidden active:scale-[0.98] transition-transform"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
            >
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
                    <p className="text-[13px] font-semibold leading-snug line-clamp-2" style={{ color: 'rgba(255,255,255,0.88)' }}>{s.description}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: `${priColor}18`, color: priColor, border: `1px solid ${priColor}35` }}>
                    {priObj?.icon} {priObj?.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {(s.lat != null && s.lng != null) ? (
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.40)' }}>
                      📍 {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                    </span>
                  ) : s.address ? (
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.40)' }}>📍 {s.address}</span>
                  ) : null}
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.30)' }}>{timeAgo(s.createdAt)}</span>
                  {s.mediaUrls && s.mediaUrls.length > 0 && (
                    <span className="text-[11px] font-semibold" style={{ color: '#0A84FF' }}>
                      📎 {s.mediaUrls.length} média{s.mediaUrls.length > 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto"
                    style={{
                      background: s.status === 'pending' ? 'rgba(255,159,10,0.15)' : s.status === 'approved' ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.12)',
                      color:      s.status === 'pending' ? '#FF9F0A'               : s.status === 'approved' ? '#30D158'               : '#FF453A',
                    }}>
                    {s.status === 'pending' ? '⏳' : s.status === 'approved' ? '✓' : '✗'}
                    {' '}{s.status === 'pending' ? 'En attente' : s.status === 'approved' ? 'Approuvé' : 'Rejeté'}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          s={selected}
          onClose={() => setSelected(null)}
          onAct={act}
          onDel={del}
          acting={acting}
        />
      )}
    </div>
  )
}
