'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { haversineMeters } from '@/lib/haversine'
import { SIGNAL_CATEGORIES } from '@/data/signalement-categories'

interface PublicSignalement {
  id:          string
  category:    string
  subcategory: string
  description: string
  lat:         number
  lng:         number
  expiresAt:   string | null
  credibility: string
}

const VOTE_KEY    = (id: string) => `tif:voted:${id}`
const DISMISS_KEY = (id: string) => `tif:vote-dismissed:${id}`
const DISMISS_TTL_MS = 10 * 60 * 1000

export default function VoteToast() {
  const [target, setTarget]     = useState<PublicSignalement | null>(null)
  const [progress, setProgress] = useState(100)
  const [voting, setVoting]     = useState(false)
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null)
  const posRef                  = useRef<{ lat: number; lng: number } | null>(null)

  const dismiss = useCallback(() => {
    if (target) {
      sessionStorage.setItem(DISMISS_KEY(target.id), String(Date.now()))
    }
    setTarget(null)
    setProgress(100)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [target])

  const startCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setProgress(100)
    const start = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.max(0, 100 - (elapsed / 15000) * 100)
      setProgress(pct)
      if (pct <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        setTarget(null)
      }
    }, 100)
  }, [])

  const vote = useCallback(async (v: 'confirm' | 'deny') => {
    if (!target || !posRef.current) return
    setVoting(true)
    try {
      await fetch('/api/v1/signalements/vote', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          id:   target.id,
          vote: v,
          lat:  posRef.current.lat,
          lng:  posRef.current.lng,
        }),
      })
      localStorage.setItem(VOTE_KEY(target.id), v)
    } catch { /* silent */ }
    setVoting(false)
    dismiss()
  }, [target, dismiss])

  useEffect(() => {
    if (!navigator.geolocation) return
    let fetchInterval: ReturnType<typeof setInterval>

    const checkProximity = (pos: GeolocationPosition) => {
      posRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
    }

    const findNearest = async () => {
      const pos = posRef.current
      if (!pos) return

      try {
        const res  = await fetch('/api/v1/signalements/public')
        const data = await res.json() as { signalements: PublicSignalement[] }
        const now  = Date.now()

        const candidates = data.signalements
          .filter(s =>
            s.lat != null && s.lng != null &&
            (!s.expiresAt || new Date(s.expiresAt).getTime() > now) &&
            !localStorage.getItem(VOTE_KEY(s.id)) &&
            (() => {
              const dismissed = sessionStorage.getItem(DISMISS_KEY(s.id))
              if (!dismissed) return true
              return now - Number(dismissed) > DISMISS_TTL_MS
            })()
          )
          .map(s => ({ ...s, dist: haversineMeters(pos.lat, pos.lng, s.lat, s.lng) }))
          .filter(s => s.dist <= 100)
          .sort((a, b) => a.dist - b.dist)

        const nearest = candidates[0] ?? null

        setTarget(prev => {
          if (nearest?.id !== prev?.id) {
            if (nearest) startCountdown()
            else if (timerRef.current) clearInterval(timerRef.current)
          }
          return nearest
        })
      } catch { /* silent */ }
    }

    const watchId = navigator.geolocation.watchPosition(checkProximity, undefined, {
      enableHighAccuracy: true, maximumAge: 5000,
    })

    fetchInterval = setInterval(findNearest, 15_000)
    findNearest()

    return () => {
      navigator.geolocation.clearWatch(watchId)
      clearInterval(fetchInterval)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startCountdown])

  if (!target) return null

  const cat = SIGNAL_CATEGORIES.find(c => c.id === target.category)

  return (
    <div style={{
      position:       'fixed',
      bottom:         'calc(env(safe-area-inset-bottom, 0px) + 72px)',
      left:           16,
      right:          16,
      zIndex:         45,
      background:     'rgba(18,18,24,0.97)',
      border:         '1px solid rgba(255,255,255,0.12)',
      borderRadius:   18,
      backdropFilter: 'blur(24px)',
      overflow:       'hidden',
      boxShadow:      '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      {/* Barre de progression */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', position: 'relative' }}>
        <div style={{
          position:   'absolute',
          left:       0,
          top:        0,
          height:     '100%',
          width:      `${progress}%`,
          background: '#0A84FF',
          transition: 'width 0.1s linear',
        }} />
      </div>

      <div style={{ padding: '12px 14px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>{cat?.icon ?? '📍'}</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: cat?.color ?? '#fff', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {cat?.label ?? target.category}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', margin: 0, lineHeight: 1.4 }}>
              {target.description.slice(0, 80)}{target.description.length > 80 ? '…' : ''}
            </p>
          </div>
          <button
            onClick={dismiss}
            style={{
              width: 26, height: 26, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)',
              fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
        </div>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 10px' }}>
          Tu es à proximité — c'est toujours vrai ?
        </p>

        {/* Boutons vote */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => vote('confirm')}
            disabled={voting}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: voting ? 'rgba(52,199,89,0.06)' : 'rgba(52,199,89,0.14)',
              color: '#30D158', fontSize: 13, fontWeight: 700,
            }}>
            ✅ Confirmer
          </button>
          <button
            onClick={() => vote('deny')}
            disabled={voting}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: voting ? 'rgba(255,59,48,0.04)' : 'rgba(255,59,48,0.10)',
              color: '#FF453A', fontSize: 13, fontWeight: 700,
            }}>
            ❌ Signaler faux
          </button>
        </div>
      </div>
    </div>
  )
}
