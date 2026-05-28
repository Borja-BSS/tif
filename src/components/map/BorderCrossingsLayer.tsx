'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FeatureCollection } from 'geojson'

interface BorderCrossingsLayerProps {
  map: mapboxgl.Map | null
}

const REFRESH_MS = 120_000

const STATUS_LABEL: Record<string, string> = {
  CLEAR:    'Libre',
  LIGHT:    'Fluide',
  MODERATE: 'Ralenti',
  HEAVY:    'Chargé',
  BLOCKED:  'Fermé',
}

function injectPopupStyle() {
  if (document.getElementById('tif-popup-style')) return
  const s = document.createElement('style')
  s.id = 'tif-popup-style'
  s.textContent = `
    .tif-popup .mapboxgl-popup-content {
      background: rgba(12,12,18,0.96);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      padding: 0;
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      overflow: hidden;
      min-width: 280px;
      max-width: 300px;
    }
    .tif-popup .mapboxgl-popup-tip { border-top-color: rgba(12,12,18,0.96); }
    .tif-popup .mapboxgl-popup-close-button {
      color: rgba(255,255,255,0.4);
      font-size: 18px;
      padding: 6px 10px;
      right: 2px;
      top: 2px;
    }
    .tif-popup .mapboxgl-popup-close-button:hover { color: #fff; background: none; }
    .tif-popup-section { padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.07); }
    .tif-popup-section:first-child { border-top: none; }
    .tif-popup-label { font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 6px; }
    .tif-popup-row { font-size: 12px; color: rgba(255,255,255,0.75); line-height: 1.5; margin-bottom: 2px; }
    .tif-popup-badge { display:inline-block; font-size:10px; font-weight:600; padding:2px 7px; border-radius:5px; }
  `
  document.head.appendChild(s)
}

async function fetchBorderData(): Promise<FeatureCollection | null> {
  try {
    const res = await fetch('/api/v1/layers/territory', { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json() as FeatureCollection
  } catch {
    return null
  }
}

function buildPopupHTML(props: Record<string, unknown>): string {
  const name      = String(props.name ?? 'Passage frontière')
  const status    = String(props.status ?? 'CLEAR')
  const color     = String(props.color ?? '#8E8E93')
  const wait      = Number(props.waitTimeMinutes ?? 0)
  const g7Period  = Boolean(props.g7Period)
  const g7Status  = props.g7Status ? String(props.g7Status) : null
  const hours     = String(props.hours ?? '—')
  const vehicles  = Array.isArray(props.vehicles) ? (props.vehicles as string[]) : []
  const vignettes = Array.isArray(props.vignettes) ? (props.vignettes as string[]) : []
  const g7Info    = String(props.g7Info ?? '')
  const nearest   = String(props.nearestOpen ?? '')
  const updated   = props.lastUpdated
    ? new Date(String(props.lastUpdated)).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
    : '—'

  const statusLabel = STATUS_LABEL[status] ?? status
  const isClosed    = status === 'BLOCKED'

  // ── Header ──────────────────────────────────────────────────────────────────
  const headerBg = isClosed
    ? 'rgba(255,59,48,0.12)'
    : g7Status === 'macaron'
    ? 'rgba(90,200,250,0.08)'
    : 'rgba(255,255,255,0.04)'

  const waitLine = wait > 0 && !isClosed
    ? `<span style="color:rgba(255,255,255,0.4);font-size:11px">· ~${wait} min d'attente</span>`
    : ''

  // ── G7 section ──────────────────────────────────────────────────────────────
  let g7Section = ''
  if (g7Period && g7Info) {
    const g7Bg    = g7Status === 'closed'  ? 'rgba(255,59,48,0.12)'   : 'rgba(255,149,0,0.08)'
    const g7Color = g7Status === 'closed'  ? '#FF3B30'
                  : g7Status === 'macaron' ? '#5AC8FA'
                  : '#FF9500'

    const alternativeRow = nearest
      ? `<div class="tif-popup-row" style="margin-top:5px;color:rgba(255,255,255,0.5);font-size:11px">Alternative : ${nearest}</div>`
      : ''

    g7Section = `
      <div class="tif-popup-section" style="background:${g7Bg}">
        <div class="tif-popup-label" style="color:${g7Color}">G7 — 12 au 18 juin 2026</div>
        <div class="tif-popup-row" style="color:${g7Color}">${g7Info}</div>
        ${alternativeRow}
      </div>`
  }

  // ── Vignettes section ───────────────────────────────────────────────────────
  const vignetteRows = vignettes.map(v =>
    `<div class="tif-popup-row">· ${v}</div>`
  ).join('')

  // ── Véhicules ───────────────────────────────────────────────────────────────
  const vehicleList = vehicles.join(' · ')

  return `
    <div style="font-family:-apple-system,SF Pro Text,sans-serif">

      <!-- Header -->
      <div class="tif-popup-section" style="background:${headerBg};padding:12px 14px">
        <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:5px">
          ${name}
        </div>
        <div style="display:flex;align-items:center;gap:7px">
          <span style="width:9px;height:9px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
          <span style="color:${color};font-weight:600;font-size:13px">${statusLabel}</span>
          ${waitLine}
        </div>
        <div style="margin-top:5px;font-size:11px;color:rgba(255,255,255,0.3)">
          CH ⇄ FR · Mis à jour ${updated}
        </div>
      </div>

      <!-- Horaires & Véhicules -->
      <div class="tif-popup-section">
        <div class="tif-popup-label">Horaires & Accès</div>
        <div class="tif-popup-row">🕐 ${hours}</div>
        ${vehicleList ? `<div class="tif-popup-row">🚗 ${vehicleList}</div>` : ''}
      </div>

      <!-- Documents requis -->
      ${vignetteRows ? `
      <div class="tif-popup-section">
        <div class="tif-popup-label">Documents & Vignettes requis</div>
        ${vignetteRows}
      </div>` : ''}

      <!-- Macarons / Vignettes G7 -->
      <div class="tif-popup-section" style="background:rgba(255,255,255,0.02)">
        <div class="tif-popup-label">Macarons obligatoires</div>
        <div class="tif-popup-row">
          <span class="tif-popup-badge" style="background:rgba(90,200,250,0.15);color:#5AC8FA">Macaron G7</span>
          <span style="color:rgba(255,255,255,0.5);font-size:11px;margin-left:5px">Personnel indispensable uniquement</span>
        </div>
        <div class="tif-popup-row" style="margin-top:4px">
          <span class="tif-popup-badge" style="background:rgba(52,199,89,0.15);color:#34C759">Vignette CH</span>
          <span style="color:rgba(255,255,255,0.5);font-size:11px;margin-left:5px">CHF 40/an — autoroutes A1/A40</span>
        </div>
        <div class="tif-popup-row" style="margin-top:4px">
          <span class="tif-popup-badge" style="background:rgba(255,149,0,0.15);color:#FF9500">Stick'AIR</span>
          <span style="color:rgba(255,255,255,0.5);font-size:11px;margin-left:5px">CHF 5 · Crit'Air FR reconnu (pics pollution)</span>
        </div>
        <div class="tif-popup-row" style="margin-top:4px">
          <span class="tif-popup-badge" style="background:rgba(175,82,222,0.15);color:#AF52DE">Pass G7</span>
          <span style="color:rgba(255,255,255,0.5);font-size:11px;margin-left:5px">QR code — périmètre Évian uniquement</span>
        </div>
      </div>

      ${g7Section}

    </div>`
}

function applyMarkers(
  m: mapboxgl.Map,
  geojson: FeatureCollection,
  markersRef: React.MutableRefObject<mapboxgl.Marker[]>,
) {
  markersRef.current.forEach(mk => mk.remove())
  markersRef.current = []

  for (const feature of geojson.features) {
    const props = feature.properties as Record<string, unknown>
    if (props?.type !== 'border') continue

    const coords   = (feature.geometry as unknown as { coordinates: [number, number] }).coordinates
    const color    = String(props.color ?? '#8E8E93')
    const icon     = String(props.icon ?? '🛂')
    const name     = String(props.name ?? '')
    const g7Status = props.g7Status ? String(props.g7Status) : null
    const isClosed = props.status === 'BLOCKED'

    // ── Marker element ─────────────────────────────────────────────────────────
    const borderColor = isClosed
      ? 'rgba(255,59,48,0.9)'
      : g7Status === 'macaron'
      ? 'rgba(90,200,250,0.9)'
      : 'rgba(255,255,255,0.85)'

    const el = document.createElement('div')
    el.style.cssText = [
      'position:relative',
      'width:36px', 'height:36px',
      'cursor:pointer', 'user-select:none',
    ].join(';')
    el.title = name

    // Main circle
    const circle = document.createElement('div')
    circle.style.cssText = [
      'width:36px', 'height:36px', 'border-radius:50%',
      `background:${color}`,
      `border:2.5px solid ${borderColor}`,
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-size:16px',
      'box-shadow:0 2px 12px rgba(0,0,0,0.55)',
    ].join(';')
    circle.textContent = icon

    // ⓘ badge
    const badge = document.createElement('div')
    badge.style.cssText = [
      'position:absolute', 'bottom:-3px', 'right:-3px',
      'width:15px', 'height:15px', 'border-radius:50%',
      'background:#fff',
      'border:1.5px solid rgba(0,0,0,0.3)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-size:9px', 'font-weight:700', 'color:#1c1c1e',
      'line-height:1', 'box-shadow:0 1px 4px rgba(0,0,0,0.4)',
    ].join(';')
    badge.textContent = 'i'

    el.appendChild(circle)
    el.appendChild(badge)

    const popup = new mapboxgl.Popup({
      maxWidth:    '300px',
      className:   'tif-popup',
      closeButton: true,
      offset:      22,
    }).setHTML(buildPopupHTML(props))

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat(coords)
      .setPopup(popup)
      .addTo(m)

    markersRef.current.push(marker)
  }
}

export default function BorderCrossingsLayer({ map }: BorderCrossingsLayerProps) {
  const markersRef   = useRef<mapboxgl.Marker[]>([])
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const prefetchRef  = useRef<FeatureCollection | null>(null)
  const prefetchDone = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetchBorderData().then(data => {
      if (cancelled || !data) return
      prefetchRef.current  = data
      prefetchDone.current = true
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!map) return
    injectPopupStyle()

    const run = async () => {
      const data = prefetchDone.current ? prefetchRef.current! : await fetchBorderData()
      if (!data) return
      prefetchRef.current  = data
      prefetchDone.current = true
      applyMarkers(map, data, markersRef)
    }

    if (map.loaded()) run()
    else map.once('load', run)

    timerRef.current = setInterval(async () => {
      const data = await fetchBorderData()
      if (!data) return
      prefetchRef.current  = data
      prefetchDone.current = true
      applyMarkers(map, data, markersRef)
    }, REFRESH_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      markersRef.current.forEach(mk => mk.remove())
      markersRef.current = []
    }
  }, [map])

  return null
}
