'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FeatureCollection } from 'geojson'

interface WazeLayerProps {
  map:     mapboxgl.Map | null
  visible: boolean
}

const REFRESH_MS = 90_000

// Sources
const SRC_LINES  = 'tif-waze-lines'
const SRC_POINTS = 'tif-waze-points'

// Layers — fermetures hachurées (orange/noir, distinct du rouge HERE)
const LYR_CLOSURE_GLOW  = 'tif-wz-closure-glow'
const LYR_CLOSURE_BASE  = 'tif-wz-closure-base'
const LYR_CLOSURE_HATCH = 'tif-wz-closure-hatch'

// Layers — bouchons (lignes colorées par niveau)
const LYR_JAM_BASE = 'tif-wz-jam-base'

// Layers — alertes ponctuelles
const LYR_ALERT_CIRCLE = 'tif-wz-alert-circle'
const LYR_ALERT_ICON   = 'tif-wz-alert-icon'

const ALL_LAYERS  = [LYR_CLOSURE_HATCH, LYR_CLOSURE_BASE, LYR_CLOSURE_GLOW, LYR_JAM_BASE, LYR_ALERT_ICON, LYR_ALERT_CIRCLE]
const ALL_SOURCES = [SRC_LINES, SRC_POINTS]

// ── XSS guard — données user-generated Waze ───────────────────────────────────
function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
  ))
}

// ── Popup style ───────────────────────────────────────────────────────────────
function injectPopupStyle() {
  if (document.getElementById('tif-popup-style')) return
  const s = document.createElement('style')
  s.id = 'tif-popup-style'
  s.textContent = `
    .tif-popup .mapboxgl-popup-content {
      background: rgba(12,12,18,0.96);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px; padding: 0;
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      overflow: hidden;
    }
    .tif-popup .mapboxgl-popup-tip { border-top-color: rgba(12,12,18,0.96); }
    .tif-popup .mapboxgl-popup-close-button {
      color:rgba(255,255,255,0.4);font-size:18px;padding:6px 10px;right:2px;top:2px;
    }
    .tif-popup .mapboxgl-popup-close-button:hover{color:#fff;background:none;}
  `
  document.head.appendChild(s)
}

// ── Type labels affichés ──────────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  ACCIDENT:      'Accident',
  JAM:           'Bouchon',
  ROAD_CLOSED:   'Route fermée',
  HAZARD:        'Danger',
  WEATHERHAZARD: 'Aléa météo',
  POLICE:        'Contrôle police',
  CONSTRUCTION:  'Travaux',
  MISC:          'Signalement',
  NONE:          'Bouchon',
}

function buildPopupHTML(p: Record<string, unknown>, wazetype: 'jam' | 'alert'): string {
  const type        = esc(String(p.type ?? ''))
  const desc        = esc(String(p.description ?? ''))
  const color       = esc(String(p.color ?? '#8E8E93'))
  const icon        = esc(String(p.icon ?? '⚠️'))
  const label       = esc(TYPE_LABEL[String(p.type ?? '')] ?? type)
  const reliability = Number(p.reliability ?? 0)
  const confidence  = Number(p.confidence ?? 0)
  const thumbsUp    = Number(p.thumbsUp ?? 0)
  const speedKMH    = Number(p.speedKMH ?? 0)
  const delay       = Number(p.delay ?? 0)
  const level       = Number(p.level ?? 0)
  const pubMillis   = Number(p.pubMillis ?? 0)
  const timeStr     = pubMillis
    ? esc(new Date(pubMillis).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }))
    : '—'

  const headerBg = type === 'ROAD_CLOSED' || type === 'ACCIDENT'
    ? 'rgba(255,59,48,0.1)' : 'rgba(255,255,255,0.04)'

  const jamStats = wazetype === 'jam' && speedKMH > 0 ? `
    <div style="padding:8px 14px;display:flex;gap:12px;border-bottom:1px solid rgba(255,255,255,0.07)">
      <div style="text-align:center">
        <div style="font-size:16px;font-weight:700;color:${color}">${level}<span style="font-size:10px;color:rgba(255,255,255,0.4)">/5</span></div>
        <div style="font-size:9px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:.05em">Niveau</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:16px;font-weight:700;color:#fff">${speedKMH}<span style="font-size:10px;color:rgba(255,255,255,0.4)"> km/h</span></div>
        <div style="font-size:9px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:.05em">Vitesse</div>
      </div>
      ${delay > 0 ? `
      <div style="text-align:center">
        <div style="font-size:16px;font-weight:700;color:#FF9500">${Math.round(delay / 60)}<span style="font-size:10px;color:rgba(255,255,255,0.4)"> min</span></div>
        <div style="font-size:9px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:.05em">Délai</div>
      </div>` : ''}
    </div>` : ''

  const alertStats = wazetype === 'alert' ? `
    <div style="padding:8px 14px;display:flex;gap:12px;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,0.07)">
      ${reliability > 0 ? `
      <div style="text-align:center">
        <div style="font-size:14px;font-weight:700;color:#fff">${reliability}<span style="font-size:10px;color:rgba(255,255,255,0.4)">/10</span></div>
        <div style="font-size:9px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:.05em">Fiabilité</div>
      </div>` : ''}
      ${thumbsUp > 0 ? `
      <div style="text-align:center">
        <div style="font-size:14px;font-weight:700;color:#34C759">👍 ${thumbsUp}</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:.05em">Confirmations</div>
      </div>` : ''}
    </div>` : ''

  return `
    <div style="font-family:-apple-system,SF Pro Text,sans-serif;min-width:220px">
      <div style="padding:12px 14px;background:${headerBg};border-bottom:1px solid rgba(255,255,255,0.07)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
          <span style="font-size:18px">${icon}</span>
          <span style="font-size:14px;font-weight:700;color:#fff">${label}</span>
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.6);line-height:1.4">${desc}</div>
      </div>
      ${jamStats}${alertStats}
      <div style="padding:7px 14px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:11px;color:rgba(255,255,255,0.3)">🕐 ${timeStr}</span>
        <span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:4px;
          background:rgba(52,199,89,0.12);color:#34C759">● Waze live</span>
      </div>
    </div>
  `
}

// ── Layer setup ───────────────────────────────────────────────────────────────
function addLayers(m: mapboxgl.Map) {
  // ── Fermetures (isRoadClosed = true) : hachures orange/noir ──────────────
  m.addLayer({
    id: LYR_CLOSURE_GLOW, type: 'line', source: SRC_LINES,
    filter: ['==', ['get', 'isRoadClosed'], true],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color':   '#FF6B00',
      'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 10, 13, 18],
      'line-opacity': 0.15,
      'line-blur':    4,
    },
  })
  m.addLayer({
    id: LYR_CLOSURE_BASE, type: 'line', source: SRC_LINES,
    filter: ['==', ['get', 'isRoadClosed'], true],
    layout: { 'line-join': 'round', 'line-cap': 'butt' },
    paint: {
      'line-color':   '#FF6B00',
      'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 5, 13, 9, 16, 14],
      'line-opacity': 0.92,
    },
  })
  m.addLayer({
    id: LYR_CLOSURE_HATCH, type: 'line', source: SRC_LINES,
    filter: ['==', ['get', 'isRoadClosed'], true],
    layout: { 'line-join': 'round', 'line-cap': 'butt' },
    paint: {
      'line-color':     '#1A1A1A',
      'line-width':     ['interpolate', ['linear'], ['zoom'], 9, 2, 13, 3.5, 16, 5],
      'line-opacity':   0.85,
      'line-dasharray': [2.5, 2.5],
    },
  })

  // ── Bouchons (isRoadClosed = false) : lignes colorées par niveau ─────────
  m.addLayer({
    id: LYR_JAM_BASE, type: 'line', source: SRC_LINES,
    filter: ['==', ['get', 'isRoadClosed'], false],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color':   ['get', 'color'],
      'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 2, 13, 4, 16, 6],
      'line-opacity': 0.75,
    },
  })

  // ── Alertes ponctuelles : halo + icône ────────────────────────────────────
  m.addLayer({
    id: LYR_ALERT_CIRCLE, type: 'circle', source: SRC_POINTS,
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 9, 6, 13, 10],
      'circle-color':        ['get', 'color'],
      'circle-opacity':      0.25,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-opacity': 0.8,
    },
  })
  m.addLayer({
    id: LYR_ALERT_ICON, type: 'symbol', source: SRC_POINTS,
    layout: {
      'text-field':         ['get', 'icon'],
      'text-size':          ['interpolate', ['linear'], ['zoom'], 9, 13, 13, 18],
      'text-anchor':        'center',
      'text-allow-overlap': false,
    },
  })
}

function removeLayers(m: mapboxgl.Map) {
  for (const id of ALL_LAYERS)  { if (m.getLayer(id))  m.removeLayer(id)  }
  for (const id of ALL_SOURCES) { if (m.getSource(id)) m.removeSource(id) }
}

function setupInteractions(m: mapboxgl.Map) {
  // Click sur lignes
  for (const lyr of [LYR_CLOSURE_BASE, LYR_JAM_BASE]) {
    m.on('click', lyr, e => {
      if (!e.features?.length) return
      const p = e.features[0].properties as Record<string, unknown>
      new mapboxgl.Popup({ maxWidth: '280px', className: 'tif-popup', closeButton: true, offset: 10 })
        .setLngLat(e.lngLat)
        .setHTML(buildPopupHTML(p, 'jam'))
        .addTo(m)
    })
    m.on('mouseenter', lyr, () => { m.getCanvas().style.cursor = 'pointer' })
    m.on('mouseleave', lyr, () => { m.getCanvas().style.cursor = '' })
  }

  // Click sur alertes
  for (const lyr of [LYR_ALERT_ICON, LYR_ALERT_CIRCLE]) {
    m.on('click', lyr, e => {
      if (!e.features?.length) return
      const p = e.features[0].properties as Record<string, unknown>
      const geo = e.features[0].geometry as { type: string; coordinates: [number, number] }
      if (geo.type !== 'Point') return
      new mapboxgl.Popup({ maxWidth: '280px', className: 'tif-popup', closeButton: true, offset: 12 })
        .setLngLat(geo.coordinates)
        .setHTML(buildPopupHTML(p, 'alert'))
        .addTo(m)
    })
    m.on('mouseenter', lyr, () => { m.getCanvas().style.cursor = 'pointer' })
    m.on('mouseleave', lyr, () => { m.getCanvas().style.cursor = '' })
  }
}

// ── Data fetch + apply ────────────────────────────────────────────────────────
async function applyData(m: mapboxgl.Map, geojson: FeatureCollection) {
  // Sépare les LineStrings et les Points en deux sources distinctes
  const lines:  typeof geojson = { type: 'FeatureCollection', features: geojson.features.filter(f => f.geometry.type === 'LineString') }
  const points: typeof geojson = { type: 'FeatureCollection', features: geojson.features.filter(f => f.geometry.type === 'Point') }

  const srcLines  = m.getSource(SRC_LINES)  as mapboxgl.GeoJSONSource | undefined
  const srcPoints = m.getSource(SRC_POINTS) as mapboxgl.GeoJSONSource | undefined

  if (srcLines && srcPoints) {
    srcLines.setData(lines)
    srcPoints.setData(points)
    return
  }

  m.addSource(SRC_LINES,  { type: 'geojson', data: lines,  tolerance: 0.5 })
  m.addSource(SRC_POINTS, { type: 'geojson', data: points })
  addLayers(m)
  setupInteractions(m)
}

async function fetchAndApply(m: mapboxgl.Map) {
  try {
    const res = await fetch('/api/v1/layers/waze', { cache: 'no-store' })
    if (!res.ok) {
      console.warn('[Waze] API route returned', res.status)
      return
    }
    const data = await res.json() as FeatureCollection
    const lines  = data.features.filter(f => f.geometry.type === 'LineString').length
    const points = data.features.filter(f => f.geometry.type === 'Point').length
    console.info(`[Waze] ${lines} lignes (bouchons/fermetures) + ${points} alertes`)
    applyData(m, data)
  } catch (err) {
    console.warn('[Waze] fetch failed (endpoint non officiel):', err)
  }
}

// ── Sync visibility ───────────────────────────────────────────────────────────
function syncVisibility(m: mapboxgl.Map, visible: boolean) {
  const v = visible ? 'visible' : 'none'
  for (const id of ALL_LAYERS) {
    if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', v)
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function WazeLayer({ map, visible }: WazeLayerProps) {
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  useEffect(() => {
    if (!map) return
    injectPopupStyle()

    const run = () => fetchAndApply(map)

    if (map.loaded()) run()
    else map.once('load', run)

    timerRef.current = setInterval(run, REFRESH_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      try { removeLayers(map) } catch { /* map détruite */ }
    }
  }, [map])

  useEffect(() => {
    if (!map) return
    if (map.loaded()) syncVisibility(map, visible)
    else map.once('load', () => syncVisibility(map, visible))
  }, [map, visible])

  return null
}
