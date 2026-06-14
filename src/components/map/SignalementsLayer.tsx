'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { SIGNAL_CATEGORIES, PRIORITY_LEVELS } from '@/data/signalement-categories'

interface PublicSignalement {
  id:          string
  category:    string
  subcategory: string
  priority:    string
  description: string
  lat:         number
  lng:         number
  address?:    string
  createdAt:   string
}

const PRIORITY_COLOR: Record<string, string> = {
  info:         '#8E8E93',
  vigilance:    '#30D158',
  perturbation: '#FF9500',
  important:    '#FF9F0A',
  urgent:       '#FF3B30',
  critique:     '#FF2D55',
}

function esc(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

function buildPopupHTML(s: PublicSignalement): string {
  const cat      = SIGNAL_CATEGORIES.find(c => c.id === s.category)
  const pri      = PRIORITY_LEVELS?.find((p: { id: string }) => p.id === s.priority)
  const color    = PRIORITY_COLOR[s.priority] ?? '#8E8E93'
  const timeAgo  = (() => {
    const diff = (Date.now() - new Date(s.createdAt).getTime()) / 1000
    if (diff < 60)    return `il y a ${Math.round(diff)}s`
    if (diff < 3600)  return `il y a ${Math.round(diff / 60)}min`
    if (diff < 86400) return `il y a ${Math.round(diff / 3600)}h`
    return new Date(s.createdAt).toLocaleDateString('fr-CH')
  })()

  return `
    <div style="padding:2px 0">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="font-size:16px">${esc(cat?.icon ?? '📍')}</span>
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${esc(cat?.color ?? '#fff')}">${esc(cat?.label ?? s.category)}</span>
      </div>
      <p style="font-size:12px;color:rgba(255,255,255,.55);margin:0 0 6px">${esc(s.subcategory)}</p>
      <p style="font-size:13px;color:rgba(255,255,255,.88);line-height:1.45;margin:0 0 8px">${esc(s.description)}</p>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:${esc(color)}20;color:${esc(color)};border:1px solid ${esc(color)}40">
          ${pri ? esc(String((pri as { icon?: string }).icon ?? '')) + ' ' : ''}${esc(pri ? String((pri as { label?: string }).label ?? s.priority) : s.priority)}
        </span>
        <span style="font-size:10px;color:rgba(255,255,255,.35)">${esc(timeAgo)}</span>
      </div>
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
      background: rgba(18,18,24,0.97) !important;
      border: 0.5px solid rgba(255,255,255,0.14) !important;
      border-radius: 14px !important;
      padding: 12px 14px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
      backdrop-filter: blur(24px);
    }
    .tif-popup .mapboxgl-popup-tip { display:none !important; }
    .tif-popup .mapboxgl-popup-close-button {
      color: rgba(255,255,255,0.4) !important;
      font-size: 18px !important;
      top: 6px !important;
      right: 8px !important;
      background: none !important;
    }
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
          const color  = PRIORITY_COLOR[s.priority] ?? '#8E8E93'
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
    const interval = setInterval(fetchAndRender, 60_000)

    return () => {
      cancelled = true
      clearInterval(interval)
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
    }
  }, [map])

  return null
}
