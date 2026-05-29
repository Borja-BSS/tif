'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FeatureCollection } from 'geojson'

interface RoadClosuresLayerProps {
  map: mapboxgl.Map | null
}

const REFRESH_MS = 60_000

const SOURCE_ID    = 'tif-road-closures'
const LAYER_GLOW   = 'tif-rc-glow'
const LAYER_BASE   = 'tif-rc-base'
const LAYER_HATCH  = 'tif-rc-hatch'
const LAYER_CASING = 'tif-rc-casing'

// ── Popup style (réutilise le style global .tif-popup si déjà injecté) ────────
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
    }
    .tif-popup .mapboxgl-popup-tip { border-top-color: rgba(12,12,18,0.96); }
    .tif-popup .mapboxgl-popup-close-button {
      color: rgba(255,255,255,0.4); font-size:18px;
      padding: 6px 10px; right: 2px; top: 2px;
    }
    .tif-popup .mapboxgl-popup-close-button:hover { color:#fff; background:none; }
  `
  document.head.appendChild(s)
}

const KNOWN_CRITICALITIES = new Set(['critical', 'major', 'minor', 'lowImpact'])

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
  ))
}

function buildPopupHTML(props: Record<string, unknown>): string {
  const desc = esc(String(props.description ?? 'Route fermée'))
  const raw  = String(props.criticality ?? 'major')
  const crit = KNOWN_CRITICALITIES.has(raw) ? raw : 'major'

  const start = esc(props.startTime
    ? new Date(String(props.startTime)).toLocaleString('fr-CH', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '—')
  const end = props.endTime
    ? esc(new Date(String(props.endTime)).toLocaleString('fr-CH', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      }))
    : null

  const critLabel: Record<string, string> = {
    critical: 'Critique', major: 'Majeur', minor: 'Mineur', lowImpact: 'Faible impact',
  }
  const critColor: Record<string, string> = {
    critical: '#FF3B30', major: '#FF3B30', minor: '#FF9500', lowImpact: '#FFCC00',
  }
  const color = critColor[crit]
  const label = critLabel[crit]

  return `
    <div style="font-family:-apple-system,SF Pro Text,sans-serif;min-width:240px">
      <div style="padding:12px 14px;background:rgba(255,59,48,0.1);border-bottom:1px solid rgba(255,255,255,0.07)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:16px">🚫</span>
          <span style="font-size:14px;font-weight:700;color:#fff">Route fermée</span>
        </div>
        <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;
          background:${color}22;color:${color};border:1px solid ${color}44">${label}</span>
      </div>
      <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.07)">
        <div style="font-size:12px;color:rgba(255,255,255,0.8);line-height:1.5">${desc}</div>
      </div>
      <div style="padding:8px 14px;display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:11px;color:rgba(255,255,255,0.35)">
          🕐 ${start}${end ? ` → ${end}` : ''}
        </div>
        <span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:4px;
          background:rgba(175,82,222,0.15);color:#AF52DE">● Live HERE</span>
      </div>
    </div>
  `
}

// ── Layer management ──────────────────────────────────────────────────────────

function addLayers(m: mapboxgl.Map) {
  // 1. Halo de glow sous la ligne
  m.addLayer({
    id: LAYER_GLOW, type: 'line', source: SOURCE_ID,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color':   '#FF3B30',
      'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 10, 13, 18, 16, 26],
      'line-opacity': 0.18,
      'line-blur':    4,
    },
  })

  // 2. Ligne de fond rouge pleine
  m.addLayer({
    id: LAYER_BASE, type: 'line', source: SOURCE_ID,
    layout: { 'line-join': 'round', 'line-cap': 'butt' },
    paint: {
      'line-color':   '#FF3B30',
      'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 5, 13, 9, 16, 14],
      'line-opacity': 0.92,
    },
  })

  // 3. Hachures blanches par-dessus — effect "ruban de chantier"
  m.addLayer({
    id: LAYER_HATCH, type: 'line', source: SOURCE_ID,
    layout: { 'line-join': 'round', 'line-cap': 'butt' },
    paint: {
      'line-color':      '#FFFFFF',
      'line-width':      ['interpolate', ['linear'], ['zoom'], 9, 2, 13, 3.5, 16, 5],
      'line-opacity':    0.9,
      'line-dasharray':  [2.5, 2.5],
    },
  })

  // 4. Bordure sombre fine pour le détourage
  m.addLayer({
    id: LAYER_CASING, type: 'line', source: SOURCE_ID,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color':   'rgba(0,0,0,0.5)',
      'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 7, 13, 12, 16, 18],
      'line-opacity': 0.4,
      'line-gap-width': ['interpolate', ['linear'], ['zoom'], 9, 5, 13, 9, 16, 14],
    },
  }, LAYER_GLOW)
}

function removeLayers(m: mapboxgl.Map) {
  for (const id of [LAYER_HATCH, LAYER_BASE, LAYER_CASING, LAYER_GLOW]) {
    if (m.getLayer(id)) m.removeLayer(id)
  }
  if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID)
}

async function applyData(m: mapboxgl.Map, geojson: FeatureCollection) {
  const src = m.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
  if (src) { src.setData(geojson); return }

  m.addSource(SOURCE_ID, { type: 'geojson', data: geojson, tolerance: 0.5 })
  addLayers(m)
}

async function fetchAndApply(m: mapboxgl.Map) {
  try {
    const res = await fetch('/api/v1/layers/road-closures', { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json() as FeatureCollection
    applyData(m, data)
  } catch { /* réseau indisponible — on ne crash pas */ }
}

function setupClick(m: mapboxgl.Map) {
  m.on('click', LAYER_BASE, e => {
    if (!e.features?.length) return
    const props = e.features[0].properties as Record<string, unknown>
    new mapboxgl.Popup({ maxWidth: '300px', className: 'tif-popup', closeButton: true, offset: 10 })
      .setLngLat(e.lngLat)
      .setHTML(buildPopupHTML(props))
      .addTo(m)
  })
  m.on('mouseenter', LAYER_BASE, () => { m.getCanvas().style.cursor = 'pointer' })
  m.on('mouseleave', LAYER_BASE, () => { m.getCanvas().style.cursor = '' })
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RoadClosuresLayer({ map }: RoadClosuresLayerProps) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!map) return
    injectPopupStyle()

    const run = () => fetchAndApply(map)

    if (map.loaded()) { run(); setupClick(map) }
    else map.once('load', () => { run(); setupClick(map) })

    timerRef.current = setInterval(run, REFRESH_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      try { removeLayers(map) } catch { /* map détruite */ }
    }
  }, [map])

  return null
}
