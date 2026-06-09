'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { PARKINGS_PR } from '@/lib/parking/pr-data'
import type { FeatureCollection, Point } from 'geojson'

interface ParkingLayerProps { map: mapboxgl.Map | null }

const SRC        = 'tif-parking-pr'
const LYR_SHADOW = 'tif-pr-shadow'
const LYR_DOT    = 'tif-pr-dot'
const LYR_ICON   = 'tif-pr-icon'
const IMG_ID     = 'tif-pr-marker'
const IMG_SIZE   = 72  // Retina : pixelRatio:2 → 36×36 CSS px

// ── Canvas marker ─────────────────────────────────────────────────────────────
// "P" n'est pas un emoji couleur → fillStyle '#fff' fonctionne normalement.
function drawParkingCanvas(): HTMLCanvasElement {
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
  ctx.fillStyle = '#0A84FF'
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.lineWidth   = 4
  ctx.strokeStyle = '#FFFFFF'
  ctx.stroke()

  ctx.fillStyle    = '#FFFFFF'
  ctx.font         = `bold ${Math.round(IMG_SIZE * 0.50)}px -apple-system,"Helvetica Neue",Arial,sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('P', cx, cx + 1)

  return c
}

async function loadParkingImage(m: mapboxgl.Map): Promise<void> {
  if (m.hasImage(IMG_ID)) return
  const canvas = drawParkingCanvas()
  try {
    const bitmap = await createImageBitmap(canvas)
    if (!m.hasImage(IMG_ID)) m.addImage(IMG_ID, bitmap, { pixelRatio: 2 })
  } catch {
    await new Promise<void>(resolve => {
      const img = new Image()
      img.onload  = () => { if (!m.hasImage(IMG_ID)) m.addImage(IMG_ID, img, { pixelRatio: 2 }); resolve() }
      img.onerror = () => resolve()
      img.src = canvas.toDataURL()
    })
  }
}

// ── GeoJSON ───────────────────────────────────────────────────────────────────
function buildGeojson(): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: PARKINGS_PR.map(p => ({
      type: 'Feature',
      properties: {
        id:       p.id,
        name:     p.name,
        capacity: p.capacity,
        hasRT:    p.hasRT,
        url:      p.url ?? null,
        tpg:      p.tpg ?? null,
      },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  }
}

// ── Popup ─────────────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c])
}

function buildPopup(p: Record<string, unknown>): string {
  const name  = esc(String(p.name ?? ''))
  const cap   = Number(p.capacity)
  const tpg   = p.tpg ? esc(String(p.tpg)) : null
  const url   = p.url ? String(p.url) : null
  const hasRT = Boolean(p.hasRT)

  const capLine = cap > 0
    ? `<span style="color:#30D158;font-weight:600">${cap} places</span><span style="color:rgba(255,255,255,0.4)"> · capacité totale</span>`
    : `<span style="color:rgba(255,255,255,0.4)">Capacité non disponible</span>`

  const tpgLine = tpg
    ? `<div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:4px">🚌 ${tpg}</div>`
    : ''

  const rtLine = hasRT && url
    ? `<div style="margin-top:8px"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer"
        style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;
               color:#0A84FF;text-decoration:none;padding:4px 8px;border-radius:8px;
               background:rgba(10,132,255,0.12);border:1px solid rgba(10,132,255,0.3)">
        🟢 Disponibilité sur geneve-parking.ch
      </a></div>`
    : url
      ? `<div style="margin-top:8px"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer"
          style="font-size:11px;color:rgba(255,255,255,0.4);text-decoration:underline">
          Voir sur geneve-parking.ch
        </a></div>`
      : ''

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:12px 14px">
      <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:6px">🅿️ ${name}</div>
      <div style="font-size:12px">${capLine}</div>
      ${tpgLine}
      ${rtLine}
      <div style="font-size:10px;color:rgba(255,255,255,0.25);margin-top:8px">Source : SITG · OTC Genève</div>
    </div>`
}

// ── Layers ────────────────────────────────────────────────────────────────────
// Chaque couche est ajoutée individuellement pour éviter qu'une erreur partielle
// n'empêche les couches suivantes d'être créées (pattern idempotent).
function addLayers(m: mapboxgl.Map) {
  if (!m.getLayer(LYR_SHADOW)) {
    m.addLayer({
      id: LYR_SHADOW, type: 'circle', source: SRC,
      paint: {
        'circle-radius':    18,
        'circle-color':     'rgba(0,0,0,0.35)',
        'circle-blur':       0.6,
        'circle-translate': [0, 3],
      },
    })
  }

  if (!m.getLayer(LYR_DOT)) {
    m.addLayer({
      id: LYR_DOT, type: 'circle', source: SRC,
      paint: {
        'circle-radius':       16,
        'circle-color':        '#0A84FF',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#FFFFFF',
        'circle-opacity':       0.92,
      },
    })
  }

  if (!m.getLayer(LYR_ICON)) {
    m.addLayer({
      id: LYR_ICON, type: 'symbol', source: SRC,
      layout: {
        'icon-image':            IMG_ID,
        'icon-size':             1,
        'icon-allow-overlap':    true,
        'icon-ignore-placement': true,
      },
    })
  }

  // Assure l'ordre z correct : shadow en bas, dot au milieu, icon au-dessus
  try { m.moveLayer(LYR_SHADOW) } catch { /* ignore */ }
  try { m.moveLayer(LYR_DOT) }   catch { /* ignore */ }
  try { m.moveLayer(LYR_ICON) }  catch { /* ignore */ }
}

function removeLayers(m: mapboxgl.Map) {
  for (const id of [LYR_ICON, LYR_DOT, LYR_SHADOW]) {
    if (m.getLayer(id)) m.removeLayer(id)
  }
  if (m.getSource(SRC)) m.removeSource(SRC)
}

function setupEvents(m: mapboxgl.Map) {
  m.on('click', LYR_DOT, e => {
    if (!e.features?.length) return
    const p   = e.features[0].properties as Record<string, unknown>
    const geo = e.features[0].geometry as unknown as { coordinates: [number, number] }
    new mapboxgl.Popup({ maxWidth: '280px', className: 'tif-popup', closeButton: true, offset: 14 })
      .setLngLat(geo.coordinates)
      .setHTML(buildPopup(p))
      .addTo(m)
  })
  for (const lyr of [LYR_SHADOW, LYR_DOT, LYR_ICON]) {
    m.on('mouseenter', lyr, () => { m.getCanvas().style.cursor = 'pointer' })
    m.on('mouseleave', lyr, () => { m.getCanvas().style.cursor = '' })
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ParkingLayer({ map }: ParkingLayerProps) {
  const eventsRef = useRef(false)

  useEffect(() => {
    if (!map) {
      eventsRef.current = false
      return
    }

    let mounted = true
    let rafId: ReturnType<typeof requestAnimationFrame> | null = null

    const run = async () => {
      if (!mounted) return
      try {
        if (!map.getSource(SRC)) {
          map.addSource(SRC, { type: 'geojson', data: buildGeojson() })
        }
        // addLayers est idempotente — elle vérifie chaque couche individuellement
        addLayers(map)
        if (!eventsRef.current && map.getLayer(LYR_DOT)) {
          setupEvents(map)
          eventsRef.current = true
        }
        await loadParkingImage(map)
      } catch {
        /* silent — la couche réessaie au prochain idle */
      }
    }

    const onIdle = () => { void run() }

    if (map.isStyleLoaded()) {
      // Diffère d'un frame pour laisser les autres changements de couches se stabiliser
      rafId = requestAnimationFrame(() => { void run() })
    } else {
      map.once('style.load', () => { if (mounted) void run() })
    }

    // Fallback persistant sur idle (auto-retry si la première tentative a échoué)
    map.on('idle', onIdle)

    return () => {
      mounted = false
      if (rafId !== null) cancelAnimationFrame(rafId)
      map.off('idle', onIdle)
      eventsRef.current = false
      try { removeLayers(map) } catch { /* map détruite */ }
    }
  }, [map])

  return null
}
