'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { firebaseAuth } from '@/lib/firebase'
import type { CustomAlert, CustomAlertType } from '@/data/custom-alerts'
import { TYPE_COLOR, TYPE_ICON } from '@/data/custom-alerts'

// ── Types ─────────────────────────────────────────────────────────────────────
interface AlertForm {
  type:        CustomAlertType
  title:       string
  description: string
  source:      string
  lat:         string
  lng:         string
  radius:      string
  activeFrom:  string
  activeTo:    string
  color:       string
}

const EMPTY_FORM: AlertForm = {
  type:        'barrage',
  title:       '',
  description: '',
  source:      '',
  lat:         '46.2',
  lng:         '6.15',
  radius:      '',
  activeFrom:  new Date().toISOString().slice(0, 16),
  activeTo:    '',
  color:       '',
}

const TYPE_LABELS: Record<CustomAlertType, string> = {
  barrage:     '🚧 Barrage',
  accident:    '🚨 Accident',
  restriction: '🚫 Zone de restriction',
  info:        'ℹ️ Information',
  other:       '⚠️ Autre',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function alertStatus(a: CustomAlert): 'active' | 'scheduled' | 'expired' {
  const now  = Date.now()
  const from = new Date(a.activeFrom).getTime()
  const to   = a.activeTo ? new Date(a.activeTo).getTime() : Infinity
  if (now < from) return 'scheduled'
  if (now > to)   return 'expired'
  return 'active'
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-CH', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminAlertsPage() {
  const { user, loading: authLoading } = useAuth()
  const pathname = usePathname()

  const ADMIN_EMAILS = ['lostropicosbox@gmail.com', 'aruncalstas@gmail.com']
  const isAdmin = !!user && ADMIN_EMAILS.includes(user.email ?? '')

  const [alerts,    setAlerts]    = useState<CustomAlert[]>([])
  const [fetching,  setFetching]  = useState(false)
  const [form,      setForm]      = useState<AlertForm>(EMPTY_FORM)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState<string | null>(null)

  const mapRef     = useRef<HTMLDivElement>(null)
  const mapboxRef  = useRef<unknown>(null)
  const markerRef  = useRef<unknown>(null)

  // ── Get Firebase ID token ──────────────────────────────────────────────────
  const getToken = useCallback(async (): Promise<string> => {
    const fbUser = firebaseAuth.currentUser
    if (!fbUser) throw new Error('Not authenticated')
    return fbUser.getIdToken()
  }, [])

  // ── Load alerts ────────────────────────────────────────────────────────────
  const loadAlerts = useCallback(async () => {
    if (!isAdmin) return
    setFetching(true)
    try {
      const token = await getToken()
      const res   = await fetch('/api/admin/alerts', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json() as { alerts: CustomAlert[] }
      setAlerts(json.alerts ?? [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setFetching(false)
    }
  }, [isAdmin, getToken])

  useEffect(() => { loadAlerts() }, [loadAlerts])

  // ── Init Mapbox picker ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin || !mapRef.current) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let marker: any = null

    async function initMap() {
      const mapboxgl = (await import('mapbox-gl')).default
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

      map = new mapboxgl.Map({
        container:   mapRef.current!,
        style:       'mapbox://styles/mapbox/dark-v11',
        center:      [6.15, 46.2],
        zoom:        10,
        interactive: true,
      })

      mapboxRef.current = map

      map.on('click', (e: { lngLat: { lat: number; lng: number } }) => {
        const { lat, lng } = e.lngLat
        setForm(f => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }))

        if (marker) {
          marker.setLngLat([lng, lat])
        } else {
          marker = new mapboxgl.Marker({ color: '#FF3B30' })
            .setLngLat([lng, lat])
            .addTo(map)
          markerRef.current = marker
        }
      })
    }

    initMap()
    return () => {
      if (marker) marker.remove()
      if (map) map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  // ── Update marker when lat/lng inputs change ───────────────────────────────
  useEffect(() => {
    const marker = markerRef.current as { setLngLat: (c: [number, number]) => void } | null
    if (!marker) return
    const lat = parseFloat(form.lat)
    const lng = parseFloat(form.lng)
    if (!isNaN(lat) && !isNaN(lng)) marker.setLngLat([lng, lat])
  }, [form.lat, form.lng])

  // ── Submit (create or update) ─────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const token   = await getToken()
      const payload = {
        type:        form.type,
        title:       form.title,
        description: form.description || undefined,
        source:      form.source.trim() || undefined,
        lat:         parseFloat(form.lat),
        lng:         parseFloat(form.lng),
        radius:      form.radius ? parseFloat(form.radius) : undefined,
        color:       form.color || TYPE_COLOR[form.type],
        activeFrom:  new Date(form.activeFrom).toISOString(),
        activeTo:    form.activeTo ? new Date(form.activeTo).toISOString() : undefined,
      }

      const url    = editId ? `/api/admin/alerts/${editId}` : '/api/admin/alerts'
      const method = editId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json() as { error: string }).error)

      setSuccess(editId ? 'Alerte mise à jour' : 'Alerte créée')
      setForm(EMPTY_FORM)
      setEditId(null)
      await loadAlerts()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette alerte ?')) return
    try {
      const token = await getToken()
      await fetch(`/api/admin/alerts/${id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      await loadAlerts()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  function handleEdit(a: CustomAlert) {
    setEditId(a.id)
    setForm({
      type:        a.type,
      title:       a.title,
      description: a.description ?? '',
      source:      a.source ?? '',
      lat:         String(a.lat),
      lng:         String(a.lng),
      radius:      a.radius ? String(a.radius) : '',
      activeFrom:  new Date(a.activeFrom).toISOString().slice(0, 16),
      activeTo:    a.activeTo ? new Date(a.activeTo).toISOString().slice(0, 16) : '',
      color:       a.color ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0d0d10] flex items-center justify-center">
        <p className="text-white/40 text-sm font-mono">Chargement…</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0d0d10] flex flex-col items-center justify-center gap-3">
        <p className="text-3xl">🔒</p>
        <p className="text-white/60 text-sm font-mono">Accès restreint · Connexion admin requise</p>
        <p className="text-white/25 text-[11px] font-mono">{user?.email ?? 'non connecté'}</p>
      </div>
    )
  }

  const sorted = [...alerts].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d0d10] text-white font-mono pb-20">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="px-6 pt-8 pb-4">
        <p className="text-[10px] text-white/30 uppercase tracking-[0.18em]">TIF — Admin</p>
        <p className="text-[11px] text-white/30 mt-0.5">{user.email}</p>
      </header>

      {/* ── Nav tabs ─────────────────────────────────────────────────── */}
      <nav className="flex gap-0 px-4 border-b border-white/[0.06]">
        {[
          { label: 'Alertes', href: '/admin/alerts' },
          { label: 'Sondage', href: '/admin/survey' },
        ].map(tab => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="px-5 py-2.5 text-[12px] font-mono transition-colors"
              style={{
                color:        active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
                borderBottom: active ? '1.5px solid rgba(255,255,255,0.6)' : '1.5px solid transparent',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 pt-6 max-w-3xl mx-auto space-y-8">

        {/* ── Feedback ─────────────────────────────────────────────── */}
        {error   && <div className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400 text-[13px]">{error}</div>}
        {success && <div className="rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[13px]">{success}</div>}

        {/* ── Formulaire ───────────────────────────────────────────── */}
        <section>
          <h2 className="text-[11px] text-white/35 uppercase tracking-widest mb-4">
            {editId ? '✏️ Modifier alerte' : '＋ Nouvelle alerte'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Type */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(Object.keys(TYPE_LABELS) as CustomAlertType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: t, color: '' }))}
                  className="rounded-xl px-3 py-2 text-[11px] font-medium transition-all"
                  style={{
                    background: form.type === t ? `${TYPE_COLOR[t]}25` : 'rgba(255,255,255,0.04)',
                    border:     `0.5px solid ${form.type === t ? TYPE_COLOR[t] : 'rgba(255,255,255,0.08)'}`,
                    color:      form.type === t ? TYPE_COLOR[t] : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Title */}
            <input
              required
              placeholder="Titre *"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full rounded-xl px-4 py-2.5 text-[13px] outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: '#fff' }}
            />

            {/* Description */}
            <textarea
              rows={2}
              placeholder="Description (optionnel)"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl px-4 py-2.5 text-[13px] outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: '#fff' }}
            />

            {/* Source URL */}
            <input
              type="url"
              placeholder="Source — URL (optionnel)"
              value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              className="w-full rounded-xl px-4 py-2.5 text-[13px] outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: '#fff' }}
            />

            {/* Lat / Lng / Radius */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'lat',    label: 'Latitude *',  placeholder: '46.200' },
                { key: 'lng',    label: 'Longitude *', placeholder: '6.150'  },
                { key: 'radius', label: 'Rayon (m)',   placeholder: '500'    },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <p className="text-[10px] text-white/30 mb-1">{label}</p>
                  <input
                    type="number"
                    step="any"
                    placeholder={placeholder}
                    value={form[key as keyof AlertForm]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-[13px] outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: '#fff' }}
                  />
                </div>
              ))}
            </div>

            {/* Map picker */}
            <div>
              <p className="text-[10px] text-white/30 mb-2">Cliquer sur la carte pour définir les coordonnées</p>
              <div
                ref={mapRef}
                style={{ height: 260, borderRadius: 16, border: '0.5px solid rgba(255,255,255,0.10)', overflow: 'hidden' }}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'activeFrom', label: 'Actif depuis *' },
                { key: 'activeTo',   label: 'Actif jusqu\'au (optionnel)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <p className="text-[10px] text-white/30 mb-1">{label}</p>
                  <input
                    type="datetime-local"
                    value={form[key as keyof AlertForm]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-[13px] outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: '#fff', colorScheme: 'dark' }}
                  />
                </div>
              ))}
            </div>

            {/* Custom color (override) */}
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[10px] text-white/30 mb-1">Couleur (optionnel)</p>
                <input
                  type="color"
                  value={form.color || TYPE_COLOR[form.type]}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="w-12 h-9 rounded-lg cursor-pointer"
                  style={{ background: 'none', border: '0.5px solid rgba(255,255,255,0.12)', padding: 2 }}
                />
              </div>
              <div className="flex-1" />
              {editId && (
                <button
                  type="button"
                  onClick={() => { setEditId(null); setForm(EMPTY_FORM); setError(null); setSuccess(null) }}
                  className="px-4 py-2 rounded-xl text-[12px] font-medium"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.5)' }}
                >
                  Annuler
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 rounded-xl text-[13px] font-semibold transition-opacity"
                style={{
                  background: saving ? 'rgba(255,255,255,0.06)' : TYPE_COLOR[form.type],
                  color:      saving ? 'rgba(255,255,255,0.3)' : '#fff',
                  border:     'none',
                }}
              >
                {saving ? '…' : editId ? 'Mettre à jour' : 'Créer l\'alerte'}
              </button>
            </div>

          </form>
        </section>

        {/* ── Liste des alertes ─────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] text-white/35 uppercase tracking-widest">
              Alertes ({alerts.length})
            </h2>
            <button
              onClick={loadAlerts}
              disabled={fetching}
              className="text-[11px] text-white/30 hover:text-white/60 transition-colors"
            >
              {fetching ? '…' : '↻ Rafraîchir'}
            </button>
          </div>

          {sorted.length === 0 ? (
            <p className="text-[12px] text-white/25 italic">Aucune alerte enregistrée.</p>
          ) : (
            <div className="space-y-2">
              {sorted.map(a => {
                const status = alertStatus(a)
                const statusStyle = {
                  active:    { bg: 'rgba(52,199,89,0.12)',  border: 'rgba(52,199,89,0.30)',  text: '#34C759', label: '● Actif'     },
                  scheduled: { bg: 'rgba(255,149,0,0.10)',  border: 'rgba(255,149,0,0.25)',  text: '#FF9500', label: '○ Planifié' },
                  expired:   { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.07)', text: 'rgba(255,255,255,0.25)', label: '✕ Expiré' },
                }[status]

                return (
                  <div
                    key={a.id}
                    className="rounded-2xl px-4 py-3 flex items-start gap-3"
                    style={{ background: statusStyle.bg, border: `0.5px solid ${statusStyle.border}` }}
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">{TYPE_ICON[a.type]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-semibold truncate" style={{ color: a.color ?? '#fff' }}>{a.title}</p>
                        <span className="text-[10px] font-semibold" style={{ color: statusStyle.text }}>{statusStyle.label}</span>
                      </div>
                      {a.description && (
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>{a.description}</p>
                      )}
                      {a.source && (
                        <a
                          href={a.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] mt-0.5 truncate block"
                          style={{ color: '#007AFF' }}
                        >
                          🔗 {a.source.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {fmtDate(a.activeFrom)}{a.activeTo ? ` → ${fmtDate(a.activeTo)}` : ' → ∞'}
                        </span>
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                          {a.lat.toFixed(4)}, {a.lng.toFixed(4)}{a.radius ? ` · r=${a.radius}m` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(a)}
                        className="text-[11px] px-3 py-1 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '0.5px solid rgba(255,255,255,0.10)' }}
                      >
                        Éditer
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="text-[11px] px-3 py-1 rounded-lg"
                        style={{ background: 'rgba(255,59,48,0.10)', color: '#FF3B30', border: '0.5px solid rgba(255,59,48,0.25)' }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
