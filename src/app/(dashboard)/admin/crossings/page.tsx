'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { ALL_CROSSINGS } from '@/lib/territory/border-crossings-client'
import type { CrossingOverride } from '@/lib/territory/crossing-overrides'

type StatusKey = 'CLEAR' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'BLOCKED'

const STATUS_OPTS: { key: StatusKey; label: string; color: string }[] = [
  { key: 'CLEAR',    label: 'Libre',    color: '#34C759' },
  { key: 'LIGHT',    label: 'Fluide',   color: '#30D158' },
  { key: 'MODERATE', label: 'Ralenti',  color: '#FF9500' },
  { key: 'HEAVY',    label: 'Chargé',   color: '#FF3B30' },
  { key: 'BLOCKED',  label: 'Fermé',    color: '#636366' },
]

const STATUS_COLOR: Record<string, string> = {
  CLEAR: '#34C759', LIGHT: '#30D158', MODERATE: '#FF9500', HEAVY: '#FF3B30', BLOCKED: '#636366',
}

const ADMIN_EMAILS = ['lostropicosbox@gmail.com', 'aruncalstas@gmail.com']

export default function AdminCrossingsPage() {
  const { user, loading: authLoading } = useAuth()
  const pathname = usePathname()
  const isAdmin  = !!user && ADMIN_EMAILS.includes(user.email ?? '')

  const [overrides, setOverrides] = useState<Record<string, CrossingOverride>>({})
  const [selected,  setSelected]  = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Form state for selected crossing
  const [formStatus, setFormStatus] = useState<StatusKey | ''>('')
  const [formWait,   setFormWait]   = useState('')
  const [formLat,    setFormLat]    = useState('')
  const [formLng,    setFormLng]    = useState('')

  const mapRef    = useRef<HTMLDivElement>(null)
  const mapboxRef = useRef<unknown>(null)
  const markerRef = useRef<unknown>(null)
  const markersMapRef = useRef<Map<string, unknown>>(new Map())

  // Auth via cookie tif-firebase-token — envoyé automatiquement, pas besoin de Bearer token

  // ── Load overrides ──────────────────────────────────────────────────────────
  const loadOverrides = useCallback(async () => {
    const res  = await fetch('/api/v1/crossings/overrides', { cache: 'no-store' })
    const data = await res.json() as Record<string, CrossingOverride>
    setOverrides(data)
  }, [])

  useEffect(() => { loadOverrides() }, [loadOverrides])

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin || !mapRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any

    async function init() {
      const mapboxgl = (await import('mapbox-gl')).default
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

      map = new mapboxgl.Map({
        container:   mapRef.current!,
        style:       'mapbox://styles/mapbox/dark-v11',
        center:      [6.15, 46.22],
        zoom:        9.5,
        interactive: true,
      })
      mapboxRef.current = map

      map.on('load', () => {
        // Place one marker per crossing
        for (const c of ALL_CROSSINGS) {
          const el       = document.createElement('div')
          el.style.cssText = `
            width:14px;height:14px;border-radius:50%;
            background:#8E8E93;border:2px solid rgba(255,255,255,0.6);
            cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.5);
          `
          el.title = c.name

          const marker = new mapboxgl.Marker({ element: el, draggable: true })
            .setLngLat([c.lng, c.lat])
            .addTo(map)

          marker.on('dragend', () => {
            const { lat, lng } = marker.getLngLat()
            if (selected === c.id) {
              setFormLat(lat.toFixed(6))
              setFormLng(lng.toFixed(6))
            }
          })

          el.addEventListener('click', (e) => {
            e.stopPropagation()
            selectCrossing(c.id)
          })

          markersMapRef.current.set(c.id, marker)
        }
      })
    }

    init()
    return () => { if (map) map.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  // ── Select a crossing ───────────────────────────────────────────────────────
  const selectCrossing = useCallback((id: string) => {
    setSelected(id)
    setMsg(null)
    const c   = ALL_CROSSINGS.find(x => x.id === id)!
    const ov  = overrides[id]
    setFormStatus((ov?.status as StatusKey) ?? '')
    setFormWait(ov?.waitMinutes !== undefined ? String(ov.waitMinutes) : '')
    setFormLat(String(ov?.lat ?? c.lat))
    setFormLng(String(ov?.lng ?? c.lng))

    // Fly map to crossing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapboxRef.current as any
    if (map) map.flyTo({ center: [ov?.lng ?? c.lng, ov?.lat ?? c.lat], zoom: 13, duration: 800 })

    // Highlight marker
    markersMapRef.current.forEach((m, mid) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (m as any).getElement() as HTMLDivElement
      el.style.width  = mid === id ? '20px' : '14px'
      el.style.height = mid === id ? '20px' : '14px'
      el.style.border = mid === id ? '3px solid #fff' : '2px solid rgba(255,255,255,0.6)'
      const status = overrides[mid]?.status ?? 'CLEAR'
      el.style.background = STATUS_COLOR[status] ?? '#8E8E93'
    })
  }, [overrides])

  // ── Update marker position when lat/lng form changes ────────────────────────
  useEffect(() => {
    if (!selected) return
    const marker = markersMapRef.current.get(selected) as { setLngLat: (c: [number, number]) => void } | undefined
    if (!marker) return
    const lat = parseFloat(formLat)
    const lng = parseFloat(formLng)
    if (!isNaN(lat) && !isNaN(lng)) marker.setLngLat([lng, lat])
  }, [formLat, formLng, selected])

  // ── Sync marker colors with overrides ───────────────────────────────────────
  useEffect(() => {
    markersMapRef.current.forEach((m, mid) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (m as any).getElement() as HTMLDivElement
      const status = overrides[mid]?.status ?? 'CLEAR'
      el.style.background = overrides[mid] ? (STATUS_COLOR[status] ?? '#8E8E93') : '#8E8E93'
    })
  }, [overrides])

  // ── Save override ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setMsg(null)
    try {
      const payload: Record<string, unknown> = { id: selected }
      if (formStatus) payload.status      = formStatus
      if (formWait)   payload.waitMinutes = parseInt(formWait, 10)
      const lat = parseFloat(formLat)
      const lng = parseFloat(formLng)
      const c   = ALL_CROSSINGS.find(x => x.id === selected)!
      if (!isNaN(lat) && !isNaN(lng) && (lat !== c.lat || lng !== c.lng)) {
        payload.lat = lat
        payload.lng = lng
      }

      const res = await fetch('/api/v1/crossings/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json() as { error: string }).error)
      await loadOverrides()
      setMsg({ type: 'ok', text: 'Override sauvegardé — propagation dans ~10s' })
    } catch (e) {
      setMsg({ type: 'err', text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  // ── Reset override ──────────────────────────────────────────────────────────
  async function handleReset() {
    if (!selected || !confirm('Supprimer l\'override pour cette douane ?')) return
    setSaving(true)
    setMsg(null)
    try {
      await fetch('/api/v1/crossings/overrides', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({ id: selected }),
      })
      await loadOverrides()
      const c = ALL_CROSSINGS.find(x => x.id === selected)!
      setFormStatus('')
      setFormWait('')
      setFormLat(String(c.lat))
      setFormLng(String(c.lng))
      setMsg({ type: 'ok', text: 'Override supprimé — retour au mode automatique' })
    } catch (e) {
      setMsg({ type: 'err', text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  // ── Guards ──────────────────────────────────────────────────────────────────
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
        <p className="text-white/60 text-sm font-mono">Accès restreint</p>
      </div>
    )
  }

  const selectedCrossing = selected ? ALL_CROSSINGS.find(x => x.id === selected) : null
  const hasOverride      = selected ? !!overrides[selected] : false

  return (
    <div className="min-h-screen bg-[#0d0d10] text-white font-mono pb-20">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="px-6 pt-8 pb-4">
        <p className="text-[10px] text-white/30 uppercase tracking-[0.18em]">TIF — Admin</p>
        <p className="text-[11px] text-white/30 mt-0.5">{user.email}</p>
      </header>

      {/* ── Nav ────────────────────────────────────────────────────── */}
      <nav className="flex gap-0 px-4 border-b border-white/[0.06]">
        {[
          { label: 'Alertes',       href: '/admin/alerts'       },
          { label: 'Signalements',  href: '/admin/signalements' },
          { label: 'Sondage',  href: '/admin/survey'    },
          { label: 'Douanes',  href: '/admin/crossings' },
        ].map(tab => {
          const active = pathname === tab.href
          return (
            <Link key={tab.href} href={tab.href}
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

      <div className="px-4 pt-5 max-w-5xl mx-auto">

        {/* ── Feedback ───────────────────────────────────────────────── */}
        {msg && (
          <div
            className="rounded-xl px-4 py-3 mb-4 text-[13px]"
            style={{
              background: msg.type === 'ok' ? 'rgba(52,199,89,0.10)' : 'rgba(255,59,48,0.10)',
              border:     msg.type === 'ok' ? '0.5px solid rgba(52,199,89,0.30)' : '0.5px solid rgba(255,59,48,0.30)',
              color:      msg.type === 'ok' ? '#34C759' : '#FF3B30',
            }}
          >
            {msg.text}
          </div>
        )}

        <div className="flex gap-4 flex-col lg:flex-row">

          {/* ── Liste des douanes ─────────────────────────────────────── */}
          <div className="lg:w-72 flex-shrink-0">
            <p className="text-[10px] text-white/35 uppercase tracking-widest mb-3">
              Douanes ({ALL_CROSSINGS.length})
            </p>
            <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {ALL_CROSSINGS.map(c => {
                const ov      = overrides[c.id]
                const statusK = ov?.status ?? 'AUTO'
                const color   = ov?.status ? (STATUS_COLOR[ov.status] ?? '#636366') : 'rgba(255,255,255,0.15)'
                const isSelected = selected === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => selectCrossing(c.id)}
                    className="rounded-xl px-3 py-2.5 text-left transition-all flex items-center gap-2.5"
                    style={{
                      background: isSelected ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.03)',
                      border:     `0.5px solid ${isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    <span
                      style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: color,
                        boxShadow: ov ? `0 0 6px ${color}` : 'none',
                      }}
                    />
                    <span className="text-[12px] truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                      {c.name}
                    </span>
                    {ov && (
                      <span className="text-[10px] font-semibold" style={{ color, flexShrink: 0 }}>
                        {statusK === 'BLOCKED' ? '🔒' : statusK}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Panneau droite : carte + formulaire ──────────────────── */}
          <div className="flex-1 flex flex-col gap-4">

            {/* Carte Mapbox */}
            <div>
              <p className="text-[10px] text-white/35 uppercase tracking-widest mb-2">
                Carte — cliquer sur un marqueur ou le glisser pour repositionner
              </p>
              <div
                ref={mapRef}
                style={{
                  height: 280, borderRadius: 16,
                  border: '0.5px solid rgba(255,255,255,0.10)', overflow: 'hidden',
                }}
              />
            </div>

            {/* Formulaire d'édition */}
            {selectedCrossing ? (
              <div
                className="rounded-2xl p-4 flex flex-col gap-4"
                style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.10)' }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[14px] font-semibold text-white/90">{selectedCrossing.name}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">{selectedCrossing.id}</p>
                  </div>
                  {hasOverride && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,204,0,0.15)', color: '#FFCC00' }}
                    >
                      ● Override actif
                    </span>
                  )}
                </div>

                {/* Statut */}
                <div>
                  <p className="text-[10px] text-white/35 uppercase tracking-widest mb-2">Statut</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFormStatus('')}
                      className="rounded-xl px-3 py-1.5 text-[11px] font-medium transition-all"
                      style={{
                        background: formStatus === '' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                        border:     `0.5px solid ${formStatus === '' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.10)'}`,
                        color:      formStatus === '' ? '#fff' : 'rgba(255,255,255,0.4)',
                      }}
                    >
                      Auto
                    </button>
                    {STATUS_OPTS.map(s => (
                      <button
                        key={s.key}
                        onClick={() => setFormStatus(s.key)}
                        className="rounded-xl px-3 py-1.5 text-[11px] font-medium transition-all"
                        style={{
                          background: formStatus === s.key ? `${s.color}22` : 'rgba(255,255,255,0.04)',
                          border:     `0.5px solid ${formStatus === s.key ? s.color : 'rgba(255,255,255,0.10)'}`,
                          color:      formStatus === s.key ? s.color : 'rgba(255,255,255,0.4)',
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Temps d'attente */}
                <div>
                  <p className="text-[10px] text-white/35 uppercase tracking-widest mb-2">
                    Temps d'attente (minutes)
                  </p>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    placeholder="0"
                    value={formWait}
                    onChange={e => setFormWait(e.target.value)}
                    className="w-32 rounded-xl px-3 py-2 text-[13px] outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: '#fff' }}
                  />
                  <span className="text-[11px] text-white/30 ml-2">min</span>
                </div>

                {/* Position GPS */}
                <div>
                  <p className="text-[10px] text-white/35 uppercase tracking-widest mb-2">
                    Position GPS — glisser le marqueur ou saisir
                  </p>
                  <div className="flex gap-3">
                    <div>
                      <p className="text-[10px] text-white/30 mb-1">Latitude</p>
                      <input
                        type="number"
                        step="any"
                        value={formLat}
                        onChange={e => setFormLat(e.target.value)}
                        className="w-36 rounded-xl px-3 py-2 text-[13px] outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: '#fff' }}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 mb-1">Longitude</p>
                      <input
                        type="number"
                        step="any"
                        value={formLng}
                        onChange={e => setFormLng(e.target.value)}
                        className="w-36 rounded-xl px-3 py-2 text-[13px] outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: '#fff' }}
                      />
                    </div>
                  </div>
                  {(() => {
                    const lat = parseFloat(formLat)
                    const lng = parseFloat(formLng)
                    const c   = selectedCrossing
                    const changed = !isNaN(lat) && !isNaN(lng) && (lat !== c.lat || lng !== c.lng)
                    return changed ? (
                      <p className="text-[11px] mt-1" style={{ color: '#FFCC00' }}>
                        ⚠️ Position modifiée par rapport au code source
                      </p>
                    ) : null
                  })()}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-opacity"
                    style={{
                      background: saving ? 'rgba(255,255,255,0.06)' : '#007AFF',
                      color:      saving ? 'rgba(255,255,255,0.3)' : '#fff',
                    }}
                  >
                    {saving ? '…' : 'Sauvegarder'}
                  </button>
                  {hasOverride && (
                    <button
                      onClick={handleReset}
                      disabled={saving}
                      className="rounded-xl px-4 py-2.5 text-[13px] font-medium"
                      style={{
                        background: 'rgba(255,59,48,0.10)',
                        border:     '0.5px solid rgba(255,59,48,0.25)',
                        color:      '#FF3B30',
                      }}
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="rounded-2xl p-6 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)' }}
              >
                <p className="text-[13px] text-white/30">Sélectionner une douane dans la liste</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
