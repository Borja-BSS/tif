'use client'

import { useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FeatureCollection } from 'geojson'

interface BorderCrossingsLayerProps {
  map: mapboxgl.Map | null
}

const REFRESH_MS = 120_000

function injectPopupStyle() {
  if (document.getElementById('tif-popup-style')) return
  const s = document.createElement('style')
  s.id = 'tif-popup-style'
  s.textContent = `
    .tif-popup .mapboxgl-popup-content {
      background: rgba(15,15,20,.92);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 10px;
      padding: 10px 12px;
      backdrop-filter: blur(12px);
    }
    .tif-popup .mapboxgl-popup-tip { border-top-color: rgba(15,15,20,.92); }
  `
  document.head.appendChild(s)
}

export default function BorderCrossingsLayer({ map }: BorderCrossingsLayerProps) {
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (m: mapboxgl.Map) => {
    let geojson: FeatureCollection
    try {
      const res = await fetch('/api/v1/layers/territory')
      if (!res.ok) return
      geojson = await res.json() as FeatureCollection
    } catch {
      return
    }

    // Clear previous markers
    markersRef.current.forEach(mk => mk.remove())
    markersRef.current = []

    for (const feature of geojson.features) {
      const props = feature.properties as Record<string, unknown>
      if (props?.type !== 'border') continue

      const coords   = (feature.geometry as unknown as { coordinates: [number, number] }).coordinates
      const name     = String(props.name ?? 'Passage frontière')
      const status   = String(props.status ?? 'CLEAR')
      const color    = String(props.color ?? '#8E8E93')
      const icon     = String(props.icon ?? '🛂')
      const wait     = Number(props.waitTimeMinutes ?? 0)
      const g7Period = Boolean(props.g7Period)
      const g7Status = props.g7Status ? String(props.g7Status) : null
      const source   = String(props.source ?? '')
      const updated  = props.lastUpdated
        ? new Date(String(props.lastUpdated)).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
        : '—'

      const g7Badge = g7Period && g7Status === 'closed'
        ? `<div style="margin-top:6px;padding:4px 8px;border-radius:6px;background:rgba(255,59,48,.15);border:1px solid rgba(255,59,48,.3);font-size:11px;font-weight:600;color:#FF3B30">
             🔒 FERMÉ — Directive G7 (12–18 juin)
           </div>`
        : g7Period && g7Status === 'macaron'
        ? `<div style="margin-top:6px;padding:4px 8px;border-radius:6px;background:rgba(90,200,250,.1);border:1px solid rgba(90,200,250,.25);font-size:11px;font-weight:600;color:#5AC8FA">
             ⭐ Macarons prioritaires · Contrôles renforcés
           </div>`
        : g7Period && g7Status === 'open'
        ? `<div style="margin-top:6px;padding:4px 8px;border-radius:6px;background:rgba(255,149,0,.1);border:1px solid rgba(255,149,0,.25);font-size:11px;color:#FF9500">
             ⚠ Délais accrus — Dispositif G7
           </div>`
        : ''

      const sourceLabel = source === 'G7-directive'
        ? `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(255,59,48,.12);color:rgba(255,120,100,.8)">G7 directive</span>`
        : `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.5)">synthétique</span>`

      const el = document.createElement('div')
      const borderStyle = g7Status === 'closed'
        ? 'border:2.5px solid rgba(255,59,48,0.95)'
        : g7Status === 'macaron'
        ? 'border:2.5px solid rgba(90,200,250,0.95)'
        : 'border:2.5px solid rgba(255,255,255,0.95)'
      el.style.cssText = [
        'width:34px', 'height:34px', 'border-radius:50%',
        `background:${color}`,
        borderStyle,
        'display:flex', 'align-items:center', 'justify-content:center',
        'font-size:15px', 'cursor:pointer',
        'box-shadow:0 2px 10px rgba(0,0,0,0.5)',
        'user-select:none',
      ].join(';')
      el.textContent = icon
      el.title       = name

      const popup = new mapboxgl.Popup({
        maxWidth:    '280px',
        className:   'tif-popup',
        closeButton: false,
        offset:      20,
      }).setHTML(`
        <div style="font-family:-apple-system,SF Pro Text,sans-serif;font-size:13px;line-height:1.6">
          <div style="font-weight:600;margin-bottom:6px">${icon} ${name}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></span>
            <span style="color:${color};font-weight:500">${status}</span>
            ${wait > 0 ? `<span style="color:rgba(255,255,255,.45);font-size:11px">· ~${wait} min d'attente</span>` : ''}
          </div>
          ${g7Badge}
          <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
            <span style="color:rgba(255,255,255,.35);font-size:11px">CH ⇄ FR · Mis à jour ${updated}</span>
            ${sourceLabel}
          </div>
        </div>
      `)

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(coords)
        .setPopup(popup)
        .addTo(m)

      markersRef.current.push(marker)
    }
  }, [])

  useEffect(() => {
    if (!map) return

    injectPopupStyle()

    const run = () => load(map)

    if (map.loaded()) run()
    else map.on('load', run)

    timerRef.current = setInterval(run, REFRESH_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      markersRef.current.forEach(mk => mk.remove())
      markersRef.current = []
    }
  }, [map, load])

  return null
}
