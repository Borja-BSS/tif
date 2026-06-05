'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FeatureCollection } from 'geojson'
import { buildInstantGeoJSON } from '@/lib/territory/border-crossings-client'

interface BorderCrossingsLayerProps {
  map: mapboxgl.Map | null
}

const REFRESH_MS   = 120_000
const SOURCE_ID    = 'tif-border-crossings'
const LAYER_SHADOW = 'tif-border-shadow'
const LAYER_ICON   = 'tif-border-icon'

const STATUS_LABEL: Record<string, string> = {
  CLEAR:    'Libre',
  LIGHT:    'Fluide',
  MODERATE: 'Ralenti',
  HEAVY:    'Chargé',
  BLOCKED:  'Fermé',
}

// ── Canvas icon generation ────────────────────────────────────────────────────
// Retina: generate at 72×72, declare pixelRatio:2 → rendered at 36×36 CSS px.
// Chemin fiable : canvas → toDataURL → HTMLImageElement → map.addImage.
// getImageData() peut rater les emoji selon browser/GPU ; toDataURL est safe.
const IMG_SIZE = 72

function drawMarkerCanvas(color: string, strokeColor: string, emoji: string): HTMLCanvasElement {
  const c   = document.createElement('canvas')
  c.width   = IMG_SIZE
  c.height  = IMG_SIZE
  const ctx = c.getContext('2d')!
  const cx  = IMG_SIZE / 2
  const r   = cx - 4

  ctx.shadowColor   = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur    = 10
  ctx.shadowOffsetY = 2
  ctx.beginPath()
  ctx.arc(cx, cx, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.lineWidth   = 4
  ctx.strokeStyle = strokeColor
  ctx.stroke()

  // Emoji via system color font — fillStyle ne s'applique pas aux color-emoji
  ctx.font         = `${Math.round(IMG_SIZE * 0.46)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",Arial,sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, cx, cx + 1)

  return c
}

function loadMarkerImage(
  m: mapboxgl.Map, id: string,
  color: string, strokeColor: string, emoji: string,
): Promise<void> {
  return new Promise(resolve => {
    if (m.hasImage(id)) { resolve(); return }
    const canvas = drawMarkerCanvas(color, strokeColor, emoji)
    const img    = new Image()
    img.onload = () => {
      if (!m.hasImage(id)) m.addImage(id, img, { pixelRatio: 2 })
      resolve()
    }
    img.onerror = () => resolve()  // ne pas bloquer Promise.all si le canvas échoue
    img.src = canvas.toDataURL()
  })
}

// ── Popup style ───────────────────────────────────────────────────────────────
function injectPopupStyle() {
  if (document.getElementById('tif-popup-style')) return
  const s = document.createElement('style')
  s.id    = 'tif-popup-style'
  s.textContent = `
    .tif-popup .mapboxgl-popup-content {
      background: rgba(12,12,18,0.96);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 0;
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      overflow: hidden;
      min-width: 280px;
      max-width: 300px;
      font-family: -apple-system, 'SF Pro Text', sans-serif;
    }
    .tif-popup .mapboxgl-popup-tip { border-top-color: rgba(12,12,18,0.96); }
    .tif-popup .mapboxgl-popup-close-button {
      color: rgba(255,255,255,0.4); font-size: 18px;
      padding: 6px 10px; right: 2px; top: 2px;
    }
    .tif-popup .mapboxgl-popup-close-button:hover { color: #fff; background: none; }
    .tif-popup-section { padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.07); }
    .tif-popup-section:first-child { border-top: none; }
    .tif-popup-label { font-size:10px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:rgba(255,255,255,.35); margin-bottom:6px; }
    .tif-popup-row   { font-size:12px; color:rgba(255,255,255,.75); line-height:1.5; margin-bottom:2px; }
    .tif-popup-badge { display:inline-block; font-size:10px; font-weight:600; padding:2px 7px; border-radius:5px; }
  `
  document.head.appendChild(s)
}

// ── Data fetch ────────────────────────────────────────────────────────────────
async function fetchBorderData(): Promise<FeatureCollection | null> {
  try {
    const res = await fetch('/api/v1/layers/territory', { cache: 'no-store' })
    if (!res.ok) return null
    return res.json() as Promise<FeatureCollection>
  } catch { return null }
}

function parseArr(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[]
  if (typeof val === 'string') { try { return JSON.parse(val) } catch { return [] } }
  return []
}

// ── Popup HTML ────────────────────────────────────────────────────────────────
function buildPopupHTML(props: Record<string, unknown>): string {
  const name        = String(props.name ?? 'Passage frontière')
  const status      = String(props.status ?? 'CLEAR')
  const color       = String(props.color ?? '#8E8E93')
  const wait        = Number(props.waitTimeMinutes ?? 0)
  const g7Period    = Boolean(props.g7Period)
  const g7Status    = props.g7Status ? String(props.g7Status) : null
  const hours       = String(props.hours ?? '—')
  const vehicles    = parseArr(props.vehicles)
  const vignettes   = parseArr(props.vignettes)
  const g7Info      = String(props.g7Info ?? '')
  const nearest     = String(props.nearestOpen ?? '')
  const dataQuality = String(props.dataQuality ?? 'synthetic')
  const confidence  = Number(props.confidence ?? 0.3)
  const updated     = props.lastUpdated
    ? new Date(String(props.lastUpdated)).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
    : '—'

  const statusLabel = STATUS_LABEL[status] ?? status
  const isClosed    = status === 'BLOCKED'

  const headerBg = isClosed ? 'rgba(255,59,48,0.12)'
    : g7Status === 'macaron' ? 'rgba(90,200,250,0.08)'
    : 'rgba(255,255,255,0.04)'

  const waitLine = wait > 0 && !isClosed
    ? `<span style="color:rgba(255,255,255,0.4);font-size:11px">· ~${wait} min d'attente</span>`
    : ''

  let g7Section = ''
  if (g7Period && g7Info) {
    const g7Bg    = g7Status === 'closed'  ? 'rgba(255,59,48,0.12)' : 'rgba(255,149,0,0.08)'
    const g7Color = g7Status === 'closed'  ? '#FF3B30'
                  : g7Status === 'macaron' ? '#5AC8FA' : '#FF9500'
    const altRow  = nearest
      ? `<div class="tif-popup-row" style="margin-top:5px;color:rgba(255,255,255,0.5);font-size:11px">Alternative : ${nearest}</div>`
      : ''
    g7Section = `
      <div class="tif-popup-section" style="background:${g7Bg}">
        <div class="tif-popup-label" style="color:${g7Color}">G7 — 12 au 18 juin 2026</div>
        <div class="tif-popup-row"   style="color:${g7Color}">${g7Info}</div>
        ${altRow}
      </div>`
  }

  const vignetteRows = vignettes.map(v => `<div class="tif-popup-row">· ${v}</div>`).join('')
  const vehicleList  = vehicles.join(' · ')

  return `
    <div style="font-family:-apple-system,'SF Pro Text',sans-serif">
      <div class="tif-popup-section" style="background:${headerBg};padding:12px 14px">
        <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:5px">${name}</div>
        <div style="display:inline-flex;align-items:center;gap:5px;background:${color}18;border:1px solid ${color}40;border-radius:20px;padding:3px 10px;margin-top:6px">
          <span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block"></span>
          <span style="color:${color};font-size:11px;font-weight:700">${statusLabel}</span>
        </div>
        ${waitLine ? `<div style="margin-top:4px">${waitLine}</div>` : ''}
        <div style="margin-top:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-size:11px;color:rgba(255,255,255,0.3)">CH ⇄ FR · ${updated}</span>
          ${dataQuality === 'live'
            ? `<span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:4px;background:rgba(52,199,89,0.15);color:#34C759">● Live HERE · ${Math.round(confidence * 100)}%</span>`
            : dataQuality === 'g7-directive'
            ? `<span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:4px;background:rgba(90,200,250,0.15);color:#5AC8FA">● Directive G7</span>`
            : `<span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:4px;background:rgba(255,204,0,0.12);color:#FFCC00">● Estimé</span>`
          }
        </div>
      </div>
      <div class="tif-popup-section">
        <div class="tif-popup-label">Horaires & Accès</div>
        <div class="tif-popup-row">🕐 ${hours}</div>
        ${vehicleList ? `<div class="tif-popup-row">🚗 ${vehicleList}</div>` : ''}
      </div>
      ${vignetteRows ? `<div class="tif-popup-section"><div class="tif-popup-label">Documents & Vignettes requis</div>${vignetteRows}</div>` : ''}
      <div class="tif-popup-section" style="background:rgba(255,255,255,0.02)">
        <div class="tif-popup-label">Macarons obligatoires</div>
        <div class="tif-popup-row"><span class="tif-popup-badge" style="background:rgba(90,200,250,0.15);color:#5AC8FA">Macaron G7</span><span style="color:rgba(255,255,255,0.5);font-size:11px;margin-left:5px">Personnel indispensable uniquement</span></div>
        <div class="tif-popup-row" style="margin-top:4px"><span class="tif-popup-badge" style="background:rgba(52,199,89,0.15);color:#34C759">Vignette CH</span><span style="color:rgba(255,255,255,0.5);font-size:11px;margin-left:5px">CHF 40/an — autoroutes A1/A40</span></div>
        <div class="tif-popup-row" style="margin-top:4px"><span class="tif-popup-badge" style="background:rgba(255,149,0,0.15);color:#FF9500">Stick'AIR</span><span style="color:rgba(255,255,255,0.5);font-size:11px;margin-left:5px">CHF 5 · Crit'Air FR reconnu (pics pollution)</span></div>
        <div class="tif-popup-row" style="margin-top:4px"><span class="tif-popup-badge" style="background:rgba(175,82,222,0.15);color:#AF52DE">Pass G7</span><span style="color:rgba(255,255,255,0.5);font-size:11px;margin-left:5px">QR code — périmètre Évian uniquement</span></div>
      </div>
      ${g7Section}
    </div>`
}

// ── Layer management ──────────────────────────────────────────────────────────
function featureImgProps(f: { properties: unknown }) {
  const p           = f.properties as Record<string, unknown>
  const isClosed    = p.status === 'BLOCKED'
  const g7Status    = p.g7Status ? String(p.g7Status) : null
  const color       = String(p.color ?? '#8E8E93')
  const emoji       = String(p.icon ?? '🛂')
  const strokeColor = isClosed ? '#FF3B30' : g7Status === 'macaron' ? '#5AC8FA' : '#FFFFFF'
  const slug        = emoji === '🔒' ? 'lock' : 'ctrl'
  const imgId       = `tif-bc-${color.replace('#', '')}-${strokeColor.replace('#', '')}-${slug}`
  return { color, strokeColor, emoji, imgId }
}

async function applyData(m: mapboxgl.Map, geojson: FeatureCollection) {
  const borderFeatures = geojson.features.filter(
    f => (f.properties as Record<string, unknown>)?.type === 'border',
  )

  // 1. Pré-charger toutes les images manquantes via toDataURL → HTMLImageElement
  const seen   = new Set<string>()
  const loads: Promise<void>[] = []
  for (const f of borderFeatures) {
    const { color, strokeColor, emoji, imgId } = featureImgProps(f)
    if (!seen.has(imgId) && !m.hasImage(imgId)) {
      seen.add(imgId)
      loads.push(loadMarkerImage(m, imgId, color, strokeColor, emoji))
    }
  }
  await Promise.all(loads)

  // 2. Préparer les features enrichies
  const data: FeatureCollection = {
    type: 'FeatureCollection',
    features: borderFeatures.map(f => {
      const { strokeColor, imgId } = featureImgProps(f)
      return { ...f, properties: { ...(f.properties as object), strokeColor, imgId } }
    }),
  }

  // 3. Ajouter source + layers — pas d'attente idle (cause de lenteur extrême)
  // Le style est garanti chargé car on vérifie isStyleLoaded() avant d'appeler applyData
  const src = m.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
  if (src) { src.setData(data); return }

  m.addSource(SOURCE_ID, { type: 'geojson', data })

  m.addLayer({
    id: LAYER_SHADOW, type: 'circle', source: SOURCE_ID,
    paint: {
      'circle-radius': 20, 'circle-color': 'rgba(0,0,0,0.32)',
      'circle-blur': 0.55, 'circle-translate': [0, 3],
    },
  })

  m.addLayer({
    id: LAYER_ICON, type: 'symbol', source: SOURCE_ID,
    layout: {
      'icon-image': ['get', 'imgId'],
      'icon-size': 1,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  })
}

function removeLayers(m: mapboxgl.Map) {
  for (const id of [LAYER_ICON, LAYER_SHADOW]) {
    if (m.getLayer(id)) m.removeLayer(id)
  }
  if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BorderCrossingsLayer({ map }: BorderCrossingsLayerProps) {
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
      await applyData(map, data)
    }

    const setupEvents = () => {
      map.on('click', LAYER_ICON, e => {
        if (!e.features?.length) return
        const props = e.features[0].properties as Record<string, unknown>
        new mapboxgl.Popup({ maxWidth: '300px', className: 'tif-popup', closeButton: true, offset: 22 })
          .setLngLat(e.lngLat)
          .setHTML(buildPopupHTML(props))
          .addTo(map)
      })
      map.on('mouseenter', LAYER_ICON, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', LAYER_ICON, () => { map.getCanvas().style.cursor = '' })
    }

    const runWithFallback = async () => {
      // 1. Show static data INSTANTLY — zero network wait
      const instant = buildInstantGeoJSON(new Date())
      await applyData(map, instant as unknown as FeatureCollection)
      setupEvents()
      // 2. Then fetch live data from API in background
      const live = await fetchBorderData()
      if (live) await applyData(map, live)
    }

    if (map.isStyleLoaded()) { runWithFallback() }
    else map.once('style.load', () => { runWithFallback() })

    timerRef.current = setInterval(async () => {
      const data = await fetchBorderData()
      if (!data) return
      applyData(map, data)
    }, REFRESH_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      try { removeLayers(map) } catch { /* map détruite */ }
    }
  }, [map])

  return null
}
