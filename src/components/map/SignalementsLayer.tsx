'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { SIGNAL_CATEGORIES } from '@/data/signalement-categories'

interface PublicSignalement {
  id:           string
  category:     string
  subcategory:  string
  priority:     string
  description:  string
  lat:          number
  lng:          number
  address?:     string
  createdAt:    string
  expiresAt:    string | null
  confirmCount: number
  denyCount:    number
  credibility:  'neutral' | 'confirmed' | 'contested' | 'false'
}

const PRIORITY_COLOR: Record<string, string> = {
  info:         '#8E8E93',
  vigilance:    '#30D158',
  perturbation: '#FF9500',
  important:    '#FF9F0A',
  urgent:       '#FF3B30',
  critique:     '#FF2D55',
}

const CREDIBILITY_COLOR: Record<string, string> = {
  confirmed: '#30D158',
  contested: '#FF9500',
  false:     '#FF453A',
}

function markerColor(s: PublicSignalement): string {
  if (s.credibility !== 'neutral') return CREDIBILITY_COLOR[s.credibility] ?? PRIORITY_COLOR[s.priority]
  return PRIORITY_COLOR[s.priority] ?? '#8E8E93'
}

function esc(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

function buildPopupHTML(s: PublicSignalement): string {
  const cat   = SIGNAL_CATEGORIES.find(c => c.id === s.category)
  const color = markerColor(s)
  const diff  = (Date.now() - new Date(s.createdAt).getTime()) / 1000
  const ago   = diff < 60 ? `il y a ${Math.round(diff)}s`
              : diff < 3600 ? `il y a ${Math.round(diff / 60)}min`
              : diff < 86400 ? `il y a ${Math.round(diff / 3600)}h`
              : new Date(s.createdAt).toLocaleDateString('fr-CH')

  const priLabels: Record<string, string> = {
    info: 'Info', vigilance: 'Vigilance', perturbation: 'Perturbation',
    important: 'Important', urgent: 'Urgent', critique: 'Critique',
  }

  const credBadge = (() => {
    if (!s.expiresAt) return ''
    const remain = new Date(s.expiresAt).getTime() - Date.now()
    const h = Math.floor(remain / 3600000)
    const m = Math.floor((remain % 3600000) / 60000)
    const ttlStr = h > 0 ? `${h}h${m > 0 ? m + 'min' : ''}` : `${m}min`
    const cred = s.credibility
    const cLabel = cred === 'confirmed' ? `✅ Confirmé (${s.confirmCount})`
                 : cred === 'contested'  ? `⚠️ Contesté`
                 : cred === 'false'      ? `❌ Signalé faux`
                 : ''
    return `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap">
      ${cLabel ? `<span style="font-size:10px;color:${esc(color)}">${esc(cLabel)}</span>` : ''}
      <span style="font-size:10px;color:rgba(255,255,255,0.25)">⏱ ${esc(ttlStr)}</span>
    </div>`
  })()

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:12px 14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="width:28px;height:28px;border-radius:50%;background:${esc(color)}22;border:1.5px solid ${esc(color)}66;
          display:inline-flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">${esc(cat?.icon ?? '📍')}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:#fff;line-height:1.2">${esc(cat?.label ?? s.category)}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.45)">${esc(s.subcategory)}</div>
        </div>
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,0.78);margin-bottom:8px;line-height:1.45">${esc(s.description)}</div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;
          background:${esc(color)}22;color:${esc(color)};border:1px solid ${esc(color)}44;
          text-transform:uppercase;letter-spacing:0.05em">${esc(priLabels[s.priority] ?? s.priority)}</span>
        <span style="font-size:10px;color:rgba(255,255,255,0.25)">${esc(ago)}</span>
      </div>
      ${credBadge}
      <div style="font-size:10px;color:rgba(255,255,255,0.2);margin-top:8px">Signalement utilisateur · TIF</div>
    </div>
  `
}

function injectStyle() {
  if (typeof document === 'undefined') return
  if (document.getElementById('tif-popup-style')) return
  const style = document.createElement('style')
  style.id = 'tif-popup-style'
  style.textContent = `
    .tif-popup .mapboxgl-popup-content {
      background: rgba(12,12,18,0.96);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      padding: 0;
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      overflow: hidden;
    }
    .tif-popup .mapboxgl-popup-tip { border-top-color: rgba(12,12,18,0.96); }
    .tif-popup .mapboxgl-popup-close-button {
      color: rgba(255,255,255,0.4); font-size:18px;
      padding: 6px 10px; right: 2px; top: 2px;
    }
    .tif-popup .mapboxgl-popup-close-button:hover { color:#fff; background:none; }
  `
  document.head.appendChild(style)
}

export default function SignalementsLayer({ map }: { map: mapboxgl.Map | null }) {
  const markersRef = useRef<mapboxgl.Marker[]>([])

  useEffect(() => {
    if (!map) return
    injectStyle()

    let cancelled = false

    const fetchAndRender = async () => {
      try {
        const res  = await fetch('/api/v1/signalements/public')
        const data = await res.json() as { signalements: PublicSignalement[] }
        if (cancelled) return

        // Remove old markers
        markersRef.current.forEach(m => m.remove())
        markersRef.current = []

        for (const s of data.signalements) {
          const color  = markerColor(s)
          const cat    = SIGNAL_CATEGORIES.find(c => c.id === s.category)
          const el   = document.createElement('div')
          const icon = document.createElement('span')
          icon.textContent = cat?.icon ?? '📍'
          icon.style.cssText = 'font-size:20px;line-height:1;display:block'
          el.appendChild(icon)
          el.style.cssText = `
            width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;
            background:${color}22;border:2px solid ${color};cursor:pointer;
            box-shadow:0 0 0 4px ${color}18;
          `

          const popup = new mapboxgl.Popup({
            maxWidth:    '280px',
            className:   'tif-popup',
            closeButton: true,
            offset:      14,
          }).setHTML(buildPopupHTML(s))

          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([s.lng, s.lat])
            .setPopup(popup)
            .addTo(map)

          markersRef.current.push(marker)
        }
      } catch { /* silent */ }
    }

    fetchAndRender()
    const interval = setInterval(fetchAndRender, 15_000)

    // Refresh immédiat quand l'admin valide un signalement (même navigateur, autre onglet)
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tif:signalements') : null
    if (channel) channel.onmessage = () => fetchAndRender()

    return () => {
      cancelled = true
      clearInterval(interval)
      channel?.close()
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
    }
  }, [map])

  return null
}
