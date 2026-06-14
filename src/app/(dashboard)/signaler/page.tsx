'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { SIGNAL_CATEGORIES, PRIORITY_LEVELS } from '@/data/signalement-categories'

const LG: React.CSSProperties = {
  background:           'rgba(255,255,255,0.04)',
  backdropFilter:       'blur(48px) saturate(200%) brightness(1.05)',
  WebkitBackdropFilter: 'blur(48px) saturate(200%) brightness(1.05)',
}

type Step = 'category' | 'subcategory' | 'priority' | 'description' | 'location' | 'media' | 'confirm' | 'done'

export default function SignalerPage() {
  const router = useRouter()

  const [step,        setStep]        = useState<Step>('category')
  const [category,    setCategory]    = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [priority,    setPriority]    = useState('')
  const [description, setDescription] = useState('')
  const [address,     setAddress]     = useState('')
  const [lat,         setLat]         = useState<number | null>(null)
  const [lng,         setLng]         = useState<number | null>(null)
  const [gpsLoading,  setGpsLoading]  = useState(false)
  const [gpsError,    setGpsError]    = useState('')
  const [mediaFiles,  setMediaFiles]  = useState<File[]>([])
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cat = SIGNAL_CATEGORIES.find(c => c.id === category)

  // Géolocalisation GPS
  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) { setGpsError('Géolocalisation non disponible'); return }
    setGpsLoading(true)
    setGpsError('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setAddress('')
        setGpsLoading(false)
      },
      () => { setGpsError('Impossible de récupérer la position'); setGpsLoading(false) },
      { timeout: 10000, enableHighAccuracy: true },
    )
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setMediaFiles(prev => [...prev, ...files].slice(0, 5))
    e.target.value = ''
  }

  const removeFile = (i: number) => setMediaFiles(prev => prev.filter((_, j) => j !== i))

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const body = {
        category, subcategory, priority, description,
        address:   address.trim() || undefined,
        lat:       lat ?? undefined,
        lng:       lng ?? undefined,
        mediaUrls: mediaFiles.map(f => f.name),
      }
      const res = await fetch('/api/v1/signalements', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Erreur lors de l\'envoi')
        setSubmitting(false)
        return
      }
      setStep('done')
      setSubmitting(false)
    } catch {
      setError('Erreur réseau — réessayez')
      setSubmitting(false)
    }
  }

  const canNext = {
    category:    !!category,
    subcategory: !!subcategory,
    priority:    !!priority,
    description: description.trim().length >= 10,
    location:    !!(address.trim() || (lat != null && lng != null)),
    media:       true,
    confirm:     true,
  }

  const STEPS: Step[] = ['category','subcategory','priority','description','location','media','confirm','done']
  const stepIdx = STEPS.indexOf(step)
  const progress = ((stepIdx + 1) / STEPS.length) * 100

  const goNext = () => { const i = STEPS.indexOf(step); if (i < STEPS.length - 1) setStep(STEPS[i + 1]) }
  const goBack = () => { const i = STEPS.indexOf(step); if (i > 0) setStep(STEPS[i - 1]); else router.back() }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0a', color: 'rgba(255,255,255,0.92)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-top pt-4 pb-3 flex-shrink-0" style={LG}>
        <button onClick={goBack}
          className="w-9 h-9 flex items-center justify-center rounded-xl active:scale-95 transition-transform flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.18)' }}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round">
            <path d="M7 1L1 7l6 6"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.40)' }}>Signalement</p>
          <p className="text-[13px] font-bold truncate">
            {step === 'category'    ? 'Catégorie'
            : step === 'subcategory' ? 'Type d\'événement'
            : step === 'priority'    ? 'Niveau de priorité'
            : step === 'description' ? 'Description'
            : step === 'location'    ? 'Localisation'
            : step === 'media'       ? 'Photos / Vidéos'
            : 'Confirmer'}
          </p>
        </div>
        <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {stepIdx + 1}/{STEPS.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 w-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: cat?.color ?? '#0A84FF' }} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3"
        style={{ animation: 'fadeUp 0.18s cubic-bezier(0.23, 1, 0.32, 1)' }}
        key={step}>

        {/* ── Étape 1 : Catégorie ─────────────────────────────────────── */}
        {step === 'category' && (
          <div className="space-y-2">
            <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Sélectionnez la catégorie qui correspond le mieux à ce que vous observez.
            </p>
            {SIGNAL_CATEGORIES.map(c => (
              <button key={c.id} onClick={() => { setCategory(c.id); setSubcategory(''); goNext() }}
                className="w-full flex items-center gap-4 rounded-2xl px-4 py-3.5 text-left active:scale-[0.98] transition-transform"
                style={{
                  background: category === c.id ? `${c.color}18` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${category === c.id ? c.color + '60' : 'rgba(255,255,255,0.09)'}`,
                }}>
                <span className="text-2xl flex-shrink-0">{c.icon}</span>
                <span className="text-[14px] font-semibold flex-1">{c.label}</span>
                {category === c.id && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Étape 2 : Sous-catégorie ────────────────────────────────── */}
        {step === 'subcategory' && cat && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{cat.icon}</span>
              <p className="text-[14px] font-bold" style={{ color: cat.color }}>{cat.label}</p>
            </div>
            {cat.subs.map(sub => (
              <button key={sub} onClick={() => { setSubcategory(sub); goNext() }}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left active:scale-[0.98] transition-transform"
                style={{
                  background: subcategory === sub ? `${cat.color}18` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${subcategory === sub ? cat.color + '60' : 'rgba(255,255,255,0.09)'}`,
                }}>
                <span className="text-[14px] font-medium flex-1">{sub}</span>
                {subcategory === sub && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={cat.color} strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Étape 3 : Priorité ──────────────────────────────────────── */}
        {step === 'priority' && (
          <div className="space-y-2">
            <p className="text-[12px] mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Évaluez l&apos;urgence de la situation. En cas de doute, choisissez &laquo; Vigilance &raquo;.
            </p>
            {PRIORITY_LEVELS.map(p => (
              <button key={p.id} onClick={() => { setPriority(p.id); goNext() }}
                className="w-full flex items-center gap-4 rounded-2xl px-4 py-3.5 text-left active:scale-[0.98] transition-transform"
                style={{
                  background: priority === p.id ? `${p.color}18` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${priority === p.id ? p.color + '60' : 'rgba(255,255,255,0.09)'}`,
                }}>
                <span className="text-xl flex-shrink-0">{p.icon}</span>
                <span className="text-[14px] font-semibold flex-1" style={{ color: priority === p.id ? p.color : 'rgba(255,255,255,0.85)' }}>{p.label}</span>
                {priority === p.id && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Étape 4 : Description ───────────────────────────────────── */}
        {step === 'description' && (
          <div className="space-y-3">
            <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Décrivez ce que vous observez. Soyez précis et factuel. <span style={{ color: 'rgba(255,255,255,0.25)' }}>Min. 10 caractères.</span>
            </p>
            <textarea
              autoFocus
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Embouteillage total depuis le rond-point, aucun mouvement depuis 20 min…"
              rows={6}
              className="w-full rounded-2xl px-4 py-3 text-[14px] resize-none outline-none placeholder:opacity-30"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${description.trim().length >= 10 ? 'rgba(52,199,89,0.45)' : 'rgba(255,255,255,0.12)'}`,
                color: 'rgba(255,255,255,0.90)',
              }}
            />
            <p className="text-[11px] text-right" style={{ color: description.trim().length >= 10 ? '#30D158' : 'rgba(255,255,255,0.25)' }}>
              {description.trim().length} caractères {description.trim().length < 10 ? `(${10 - description.trim().length} de plus)` : '✓'}
            </p>
          </div>
        )}

        {/* ── Étape 5 : Localisation ──────────────────────────────────── */}
        {step === 'location' && (
          <div className="space-y-3">
            <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Indiquez l&apos;adresse <strong>ou</strong> utilisez votre position GPS.
            </p>

            {/* GPS */}
            <button onClick={handleGPS} disabled={gpsLoading}
              className="w-full flex items-center justify-center gap-3 rounded-2xl py-3.5 font-semibold text-[14px] active:scale-[0.97] transition-transform"
              style={{
                background: lat != null ? 'rgba(52,199,89,0.18)' : 'rgba(10,132,255,0.15)',
                border: `1px solid ${lat != null ? 'rgba(52,199,89,0.45)' : 'rgba(10,132,255,0.35)'}`,
                color: lat != null ? '#30D158' : '#0A84FF',
              }}>
              {gpsLoading ? (
                <><span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin inline-block"/>Localisation…</>
              ) : lat != null ? (
                <>✓ Position GPS captée · {lat.toFixed(5)}, {lng?.toFixed(5)}</>
              ) : (
                <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>Utiliser ma position GPS</>
              )}
            </button>

            {gpsError && <p className="text-[12px]" style={{ color: '#FF453A' }}>{gpsError}</p>}

            <div className="flex items-center gap-2 my-1">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }}/>
              <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.30)' }}>OU</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }}/>
            </div>

            {/* Adresse manuelle */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Adresse ou lieu
              </label>
              <input
                type="text"
                value={address}
                onChange={e => { setAddress(e.target.value); if (e.target.value) { setLat(null); setLng(null) } }}
                placeholder="Ex: Route de Ferney, Genève · Douane Bardonnex…"
                className="w-full rounded-2xl px-4 py-3 text-[14px] outline-none placeholder:opacity-30"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${address.trim() ? 'rgba(52,199,89,0.45)' : 'rgba(255,255,255,0.12)'}`,
                  color: 'rgba(255,255,255,0.90)',
                }}
              />
            </div>
          </div>
        )}

        {/* ── Étape 6 : Médias ────────────────────────────────────────── */}
        {step === 'media' && (
          <div className="space-y-3">
            <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Optionnel — ajoutez jusqu&apos;à 5 photos ou vidéos. Elles seront examinées avant publication.
            </p>
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 active:scale-[0.97] transition-transform"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.20)', color: 'rgba(255,255,255,0.60)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <span className="text-[14px] font-medium">Ajouter des médias</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileChange}/>

            {mediaFiles.length > 0 && (
              <div className="space-y-1.5">
                {mediaFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <span className="text-base flex-shrink-0">{f.type.startsWith('video') ? '🎬' : '📷'}</span>
                    <p className="flex-1 text-[12px] truncate" style={{ color: 'rgba(255,255,255,0.70)' }}>{f.name}</p>
                    <button onClick={() => removeFile(i)} className="text-[16px] leading-none active:scale-95 transition-transform"
                      style={{ color: 'rgba(255,255,255,0.35)' }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {mediaFiles.length}/5 fichier{mediaFiles.length > 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* ── Étape 7 : Confirmation ──────────────────────────────────── */}
        {step === 'confirm' && (() => {
          const catObj  = SIGNAL_CATEGORIES.find(c => c.id === category)
          const priObj  = PRIORITY_LEVELS.find(p => p.id === priority)
          return (
            <div className="space-y-3">
              <p className="text-[12px] mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Vérifiez les informations avant d&apos;envoyer. Le signalement sera examiné avant toute publication.
              </p>

              {/* Résumé */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <Row icon={catObj?.icon ?? '📍'} label="Catégorie" value={`${catObj?.label} · ${subcategory}`} />
                <Row icon={priObj?.icon ?? '⚠️'} label="Priorité" value={priObj?.label ?? priority} color={priObj?.color} />
                <Row icon="📝" label="Description" value={description} />
                <Row icon="📍" label="Localisation" value={lat != null ? `GPS ${lat.toFixed(5)}, ${lng?.toFixed(5)}` : (address || '—')} />
                {mediaFiles.length > 0 && (
                  <Row icon="📎" label="Médias" value={`${mediaFiles.length} fichier${mediaFiles.length > 1 ? 's' : ''}`} />
                )}
              </div>

              {error && (
                <p className="text-[13px] rounded-xl px-4 py-3" style={{ background: 'rgba(255,59,48,0.12)', border: '1px solid rgba(255,59,48,0.30)', color: '#FF453A' }}>
                  {error}
                </p>
              )}

              <button onClick={handleSubmit} disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 font-bold text-[15px] active:scale-[0.97] transition-transform"
                style={{ background: catObj?.color ?? '#0A84FF', color: '#fff', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? (
                  <><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin inline-block"/>Envoi en cours…</>
                ) : (
                  <>{catObj?.icon} Envoyer le signalement</>
                )}
              </button>

              <p className="text-[11px] text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Votre signalement sera modéré avant publication · Aucune donnée personnelle enregistrée
              </p>
            </div>
          )
        })()}

        {/* ── Étape done : Merci + Partager ───────────────────────────── */}
        {step === 'done' && (() => {
          const shareUrl   = 'https://tif.borja-swiss-solutions.ch'
          const shareText  = encodeURIComponent('Je viens de signaler un incident sur TIF — la carte temps réel du Grand Genève 👇')
          const shareTitle = 'TIF — Signalement Grand Genève'
          const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share
          const handleNativeShare = async () => {
            try { await navigator.share({ title: shareTitle, url: shareUrl }) } catch {}
          }
          return (
            <div className="flex flex-col items-center text-center space-y-5 py-6">
              <div className="text-6xl">✅</div>
              <div>
                <h2 className="text-[20px] font-bold text-white mb-1">Merci pour votre signalement !</h2>
                <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.50)' }}>
                  Il sera examiné avant publication sur la carte.
                </p>
              </div>

              <div className="w-full rounded-2xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                <p className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Partager l&apos;info
                </p>
                {hasNativeShare ? (
                  <button onClick={handleNativeShare}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-bold text-[14px] active:scale-[0.97] transition-transform"
                    style={{ background: 'rgba(10,132,255,0.15)', border: '1px solid rgba(10,132,255,0.35)', color: '#0A84FF' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                    </svg>
                    Partager via…
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { label: 'WhatsApp',  color: '#25D366', href: `https://wa.me/?text=${shareText}%20${encodeURIComponent(shareUrl)}` },
                      { label: 'Facebook',  color: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
                      { label: 'Instagram', color: '#E1306C', href: 'https://www.instagram.com/' },
                      { label: 'Snapchat',  color: '#FFFC00', href: `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(shareUrl)}` },
                    ] as { label: string; color: string; href: string }[]).map(s => (
                      <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center rounded-2xl py-3 font-semibold text-[13px] active:scale-[0.97] transition-transform"
                        style={{ background: `${s.color}18`, border: `1px solid ${s.color}44`, color: s.color === '#FFFC00' ? '#b8a800' : s.color }}>
                        {s.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => { window.location.href = '/map' }}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 font-bold text-[15px] active:scale-[0.97] transition-transform"
                style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.85)' }}>
                ← Retour à la carte
              </button>
            </div>
          )
        })()}
      </div>

      {/* Footer bouton Suivant (sauf confirm qui a son propre submit) */}
      {step !== 'category' && step !== 'subcategory' && step !== 'priority' && step !== 'confirm' && step !== 'done' && (
        <div className="flex-shrink-0 px-4 pb-safe-bottom pb-6 pt-3" style={{ background: 'rgba(10,10,10,0.85)', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={goNext}
            disabled={!canNext[step]}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 font-bold text-[15px] active:scale-[0.97] transition-transform"
            style={{
              background: canNext[step] ? (cat?.color ?? '#0A84FF') : 'rgba(255,255,255,0.08)',
              color: canNext[step] ? '#fff' : 'rgba(255,255,255,0.25)',
              transition: 'background 0.2s, color 0.2s',
            }}>
            Continuer
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l5 5-5 5"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

function Row({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
        <p className="text-[13px] leading-snug" style={{ color: color ?? 'rgba(255,255,255,0.80)' }}>{value}</p>
      </div>
    </div>
  )
}
