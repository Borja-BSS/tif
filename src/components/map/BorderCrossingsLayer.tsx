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
const LAYER_DOT    = 'tif-border-dot'     // cercle coloré — toujours visible, aucune image
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

async function loadMarkerImage(
  m: mapboxgl.Map, id: string,
  color: string, strokeColor: string, emoji: string,
): Promise<void> {
  if (m.hasImage(id)) return
  const canvas = drawMarkerCanvas(color, strokeColor, emoji)
  try {
    // createImageBitmap : natif, pas de base64, 3-5× plus rapide que toDataURL→Image
    const bitmap = await createImageBitmap(canvas)
    if (!m.hasImage(id)) m.addImage(id, bitmap, { pixelRatio: 2 })
  } catch {
    // Fallback : ancien chemin toDataURL pour les navigateurs qui ne supportent pas createImageBitmap
    await new Promise<void>(resolve => {
      const img = new Image()
      img.onload  = () => { if (!m.hasImage(id)) m.addImage(id, img, { pixelRatio: 2 }); resolve() }
      img.onerror = () => resolve()
      img.src = canvas.toDataURL()
    })
  }
}

// Images pré-générées au chargement de la carte (avant l'arrivée des données)
const PRELOAD_MARKERS = [
  { color: '#34C759', strokeColor: '#FFFFFF', emoji: '🛂', slug: 'ctrl' },  // CLEAR
  { color: '#636366', strokeColor: '#FF3B30', emoji: '🔒', slug: 'lock' },  // BLOCKED
  { color: '#FF9500', strokeColor: '#FFFFFF', emoji: '🛂', slug: 'ctrl' },  // MODERATE
  { color: '#FF3B30', strokeColor: '#FF3B30', emoji: '🛂', slug: 'ctrl' },  // HEAVY
  { color: '#34C759', strokeColor: '#5AC8FA', emoji: '🛂', slug: 'ctrl' },  // CLEAR macaron
]

async function preloadCommonImages(m: mapboxgl.Map) {
  await Promise.all(PRELOAD_MARKERS.map(({ color, strokeColor, emoji, slug }) => {
    const imgId = `tif-bc-${color.replace('#','')}-${strokeColor.replace('#','')}-${slug}`
    return loadMarkerImage(m, imgId, color, strokeColor, emoji)
  }))
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

// ── Data fetch — 4s timeout strict ────────────────────────────────────────────
// Si Redis ou HERE sont lents, on ne bloque PAS l'affichage statique
async function fetchBorderData(): Promise<FeatureCollection | null> {
  try {
    const res = await fetch('/api/v1/layers/territory', {
      cache:  'no-store',
      signal: AbortSignal.timeout(4000),  // 4s max — sinon on garde le statique
    })
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

  // 1. Préparer les features — pas besoin d'attendre les images pour afficher les cercles
  const data: FeatureCollection = {
    type: 'FeatureCollection',
    features: borderFeatures.map(f => {
      const { strokeColor, imgId } = featureImgProps(f)
      return { ...f, properties: { ...(f.properties as object), strokeColor, imgId } }
    }),
  }

  const src = m.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
  if (src) {
    // Mise à jour des données uniquement — les layers existent déjà
    src.setData(data)
    // Charger les nouvelles images emoji en arrière-plan (non-bloquant)
    void loadMissingImages(m, borderFeatures)
    return
  }

  // 2. Ajouter source + layers cercles IMMÉDIATEMENT (pas d'images requises)
  m.addSource(SOURCE_ID, { type: 'geojson', data })

  // Ombre portée
  m.addLayer({
    id: LAYER_SHADOW, type: 'circle', source: SOURCE_ID,
    paint: {
      'circle-radius': 18, 'circle-color': 'rgba(0,0,0,0.35)',
      'circle-blur': 0.6, 'circle-translate': [0, 3],
    },
  })

  // Cercle coloré selon le statut — TOUJOURS visible, aucune image requise
  m.addLayer({
    id: LAYER_DOT, type: 'circle', source: SOURCE_ID,
    paint: {
      'circle-radius':       16,
      'circle-color':        ['get', 'color'],
      'circle-stroke-width': 3,
      'circle-stroke-color': ['get', 'strokeColor'],
      'circle-opacity':      0.92,
    },
  })

  // Emoji par-dessus — chargé en arrière-plan, s'affiche quand prêt
  m.addLayer({
    id: LAYER_ICON, type: 'symbol', source: SOURCE_ID,
    layout: {
      'icon-image':            ['get', 'imgId'],
      'icon-size':             1,
      'icon-allow-overlap':    true,
      'icon-ignore-placement': true,
    },
  })

  // Toujours au-dessus du trafic
  m.moveLayer(LAYER_SHADOW)
  m.moveLayer(LAYER_DOT)
  m.moveLayer(LAYER_ICON)

  // Charger les images emoji en arrière-plan (non-bloquant)
  void loadMissingImages(m, borderFeatures)
}

async function loadMissingImages(m: mapboxgl.Map, features: FeatureCollection['features']) {
  const seen  = new Set<string>()
  const loads: Promise<void>[] = []
  for (const f of features) {
    const { color, strokeColor, emoji, imgId } = featureImgProps(f as { properties: unknown })
    if (!seen.has(imgId) && !m.hasImage(imgId)) {
      seen.add(imgId)
      loads.push(loadMarkerImage(m, imgId, color, strokeColor, emoji))
    }
  }
  if (loads.length) await Promise.all(loads)
}

function removeLayers(m: mapboxgl.Map) {
  for (const id of [LAYER_ICON, LAYER_DOT, LAYER_SHADOW]) {
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

    const ensureOnTop = () => {
      if (map.getLayer(LAYER_SHADOW)) map.moveLayer(LAYER_SHADOW)
      if (map.getLayer(LAYER_DOT))    map.moveLayer(LAYER_DOT)
      if (map.getLayer(LAYER_ICON))   map.moveLayer(LAYER_ICON)
    }

    // Enregistrer ensureOnTop immédiatement — avant runWithFallback
    map.on('styledata', ensureOnTop)

    const setupEvents = () => {
      const dispatchClick = (e: mapboxgl.MapLayerMouseEvent) => {
        if (!e.features?.length) return
        const props = e.features[0].properties as Record<string, unknown>
        const id = String(props.id ?? '')
        if (!id) return
        e.originalEvent.stopPropagation()
        window.dispatchEvent(new CustomEvent('tif:crossing-select', { detail: { id } }))
      }

      // click (desktop) + touchend (mobile iOS/Android)
      for (const layer of [LAYER_SHADOW, LAYER_DOT, LAYER_ICON]) {
        map.on('click',    layer, dispatchClick)
        map.on('touchend', layer, dispatchClick as unknown as (e: mapboxgl.MapTouchEvent) => void)
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
      }
    }

    const runWithFallback = async () => {
      // 1. Affichage IMMÉDIAT des cercles colorés (pas d'images requises)
      const instant = buildInstantGeoJSON(new Date())
      await applyData(map, instant as unknown as FeatureCollection)
      setupEvents()
      // 2. Pré-charger les images emoji en parallèle + données live
      const [live] = await Promise.all([
        fetchBorderData(),
        preloadCommonImages(map),
      ])
      if (live) await applyData(map, live)
    }

    if (map.isStyleLoaded()) {
      runWithFallback()
    } else {
      map.once('style.load', () => runWithFallback())
    }
    // Fallback : si style.load a déjà tiré et isStyleLoaded() est false
    map.once('idle', () => {
      if (!map.getSource(SOURCE_ID)) runWithFallback()
    })

    timerRef.current = setInterval(async () => {
      const data = await fetchBorderData()
      if (!data) return
      applyData(map, data)
    }, REFRESH_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      try {
        map.off('styledata', () => {
          if (map.getLayer(LAYER_SHADOW)) map.moveLayer(LAYER_SHADOW)
          if (map.getLayer(LAYER_ICON))   map.moveLayer(LAYER_ICON)
        })
        removeLayers(map)
      } catch { /* map détruite */ }
    }
  }, [map])

  return null
}
