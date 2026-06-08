'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FeatureCollection } from 'geojson'

interface HereIncidentsLayerProps {
  map: mapboxgl.Map | null
}

const REFRESH_MS = 60_000
const SOURCE_ID  = 'tif-here-incidents'
const LYR_HALO   = 'tif-hi-halo'
const LYR_CIRCLE = 'tif-hi-circle'
const LYR_ICON   = 'tif-hi-icon'

// ── XSS guard — descriptions HERE peuvent contenir des strings arbitraires ───
function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
  ))
}

// ── Labels lisibles par type ──────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  accident:         'Accident',
  congestion:       'Congestion',
  construction:     'Travaux',
  disabledVehicle:  'Véhicule en panne',
  roadClosure:      'Route fermée',
  massTransit:      'Transport en commun',
  weatherCondition: 'Condition météo',
  plannedEvent:     'Événement planifié',
  misc:             'Incident',
  ofrou:            'Incident OFROU',
  weather:          'Alerte météo',
}

const CRIT_LABEL: Record<string, string> = {
  critical:  'Critique',
  major:     'Majeur',
  minor:     'Mineur',
  lowImpact: 'Faible impact',
}

const SOURCE_BADGE_COLOR: Record<string, string> = {
  HERE:         '#AF52DE',
  OFROU:        '#5AC8FA',
  TPG:          '#FF9500',
  MétéoSuisse:  '#34C759',
}

function injectPopupStyle() {
  if (document.getElementById('tif-popup-style')) return
  const s = document.createElement('style')
  s.id = 'tif-popup-style'
  s.textContent = `
    .tif-popup .mapboxgl-popup-content {
      background: rgba(12,12,18,0.96); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px; padding: 0; backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.6); overflow: hidden;
    }
    .tif-popup .mapboxgl-popup-tip { border-top-color: rgba(12,12,18,0.96); }
    .tif-popup .mapboxgl-popup-close-button {
      color:rgba(255,255,255,0.4); font-size:18px; padding:6px 10px; right:2px; top:2px;
    }
    .tif-popup .mapboxgl-popup-close-button:hover { color:#fff; background:none; }
  `
  document.head.appendChild(s)
}

function buildPopupHTML(p: Record<string, unknown>): string {
  const rawType    = String(p.type ?? 'misc')
  const typeLabel  = esc(TYPE_LABEL[rawType] ?? rawType)
  const icon       = esc(String(p.icon ?? '⚠️'))
  const color      = esc(String(p.color ?? '#8E8E93'))
  const desc       = esc(String(p.description ?? ''))
  const rawCrit    = String(p.criticality ?? '')
  const critLabel  = esc(CRIT_LABEL[rawCrit] ?? rawCrit)
  const src        = esc(String(p.source ?? 'HERE'))
  const srcColor   = esc(SOURCE_BADGE_COLOR[String(p.source ?? 'HERE')] ?? '#8E8E93')

  const start = p.startTime
    ? esc(new Date(String(p.startTime)).toLocaleString('fr-CH', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      }))
    : null
  const end = p.endTime
    ? esc(new Date(String(p.endTime)).toLocaleString('fr-CH', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      }))
    : null

  const timeRow = start
    ? `<div style="font-size:11px;color:rgba(255,255,255,0.35)">🕐 ${start}${end ? ` → ${end}` : ''}</div>`
    : ''

  const critRow = rawCrit
    ? `<span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;
        background:${color}22;color:${color};border:1px solid ${color}44">${critLabel}</span>`
    : ''

  return `
    <div style="font-family:-apple-system,SF Pro Text,sans-serif;min-width:220px">
      <div style="padding:12px 14px;background:${color}14;border-bottom:1px solid rgba(255,255,255,0.07)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:18px">${icon}</span>
          <span style="font-size:14px;font-weight:700;color:#fff">${typeLabel}</span>
        </div>
        ${critRow}
      </div>
      ${desc ? `
      <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.07)">
        <div style="font-size:12px;color:rgba(255,255,255,0.8);line-height:1.5">${desc}</div>
      </div>` : ''}
      <div style="padding:8px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        ${timeRow}
        <span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:4px;
          background:${srcColor}22;color:${srcColor}">● ${src}</span>
      </div>
    </div>
  `
}

// ── Layer management ──────────────────────────────────────────────────────────
function addLayers(m: mapboxgl.Map) {
  // Halo de glow par criticité
  m.addLayer({
    id: LYR_HALO, type: 'circle', source: SOURCE_ID,
    paint: {
      'circle-radius':   ['interpolate', ['linear'], ['zoom'], 9, 12, 13, 20],
      'circle-color':    ['get', 'color'],
      'circle-opacity':  0.12,
      'circle-blur':     0.6,
    },
  })

  // Cercle plein coloré par criticité
  m.addLayer({
    id: LYR_CIRCLE, type: 'circle', source: SOURCE_ID,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 6, 13, 10, 16, 14],
      'circle-color':  ['get', 'color'],
      'circle-opacity': 0.85,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': 'rgba(255,255,255,0.3)',
    },
  })

  // Icône emoji par-dessus
  m.addLayer({
    id: LYR_ICON, type: 'symbol', source: SOURCE_ID,
    layout: {
      'text-field':         ['get', 'icon'],
      'text-size':          ['interpolate', ['linear'], ['zoom'], 9, 11, 13, 15, 16, 18],
      'text-anchor':        'center',
      'text-allow-overlap': false,
    },
  })
}

function removeLayers(m: mapboxgl.Map) {
  for (const id of [LYR_ICON, LYR_CIRCLE, LYR_HALO]) {
    if (m.getLayer(id))  m.removeLayer(id)
  }
  if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID)
}

function setupClick(m: mapboxgl.Map) {
  for (const lyr of [LYR_CIRCLE, LYR_ICON]) {
    m.on('click', lyr, e => {
      if (!e.features?.length) return
      const p   = e.features[0].properties as Record<string, unknown>
      const geo = e.features[0].geometry as { type: string; coordinates: [number, number] }
      if (geo.type !== 'Point') return
      new mapboxgl.Popup({ maxWidth: '300px', className: 'tif-popup', closeButton: true, offset: 14 })
        .setLngLat(geo.coordinates)
        .setHTML(buildPopupHTML(p))
        .addTo(m)
    })
    m.on('mouseenter', lyr, () => { m.getCanvas().style.cursor = 'pointer' })
    m.on('mouseleave', lyr, () => { m.getCanvas().style.cursor = '' })
  }
}

async function applyData(m: mapboxgl.Map, geojson: FeatureCollection) {
  const src = m.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
  if (src) { src.setData(geojson); return }
  m.addSource(SOURCE_ID, { type: 'geojson', data: geojson })
  addLayers(m)
  setupClick(m)
}

// ── Overpass client-side (contourne le blocage IP Vercel) ────────────────────
const OVERPASS_BBOX = '46.05,5.75,46.95,7.00'
const OVERPASS_QUERY = `[out:json][timeout:10];(way["highway"="construction"](${OVERPASS_BBOX});way["construction"~"."](${OVERPASS_BBOX});node["highway"="construction"](${OVERPASS_BBOX});node["construction"~"."](${OVERPASS_BBOX}););out center tags 30;`

async function fetchOverpass(): Promise<FeatureCollection> {
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return { type: 'FeatureCollection', features: [] }
    const data = await res.json() as { elements: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> }
    const features = data.elements
      .filter(el => el.lat != null || el.center != null)
      .map(el => {
        const lat  = el.lat ?? el.center!.lat
        const lon  = el.lon ?? el.center!.lon
        const tags = el.tags ?? {}
        const name = tags['name'] ?? tags['description'] ?? ''
        return {
          type: 'Feature' as const,
          properties: {
            id: `osm-${el.id}`, type: 'construction', criticality: 'minor',
            description: name ? `🚧 Travaux — ${name}` : '🚧 Chantier en cours',
            icon: '🚧', color: '#FF9500',
            startTime: new Date().toISOString(), endTime: null, source: 'OSM',
          },
          geometry: { type: 'Point' as const, coordinates: [lon, lat] },
        }
      })
    return { type: 'FeatureCollection', features }
  } catch { return { type: 'FeatureCollection', features: [] } }
}

async function fetchAndApply(m: mapboxgl.Map) {
  try {
    // Fetch server alerts + client-side Overpass en parallèle
    const [serverRes, overpassData] = await Promise.all([
      fetch('/api/v1/layers/alerts', { cache: 'no-store', signal: AbortSignal.timeout(8000) }),
      fetchOverpass(),
    ])
    if (!serverRes.ok) {
      if (overpassData.features.length) applyData(m, overpassData)
      return
    }
    const serverData = await serverRes.json() as FeatureCollection
    const merged: FeatureCollection = {
      type: 'FeatureCollection',
      features: [...serverData.features, ...overpassData.features],
    }
    applyData(m, merged)
  } catch { /* réseau — silencieux */ }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HereIncidentsLayer({ map }: HereIncidentsLayerProps) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!map) return
    injectPopupStyle()

    const run = () => fetchAndApply(map)

    // Fix race condition: map.loaded() peut retourner false même si style prêt
    if (map.isStyleLoaded()) {
      run()
    } else {
      map.once('style.load', run)
      // Filet de sécurité si style.load a déjà tiré
      map.once('idle', () => { if (!map.getSource(SOURCE_ID)) run() })
    }

    timerRef.current = setInterval(run, REFRESH_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      try { removeLayers(map) } catch { /* map détruite */ }
    }
  }, [map])

  return null
}
