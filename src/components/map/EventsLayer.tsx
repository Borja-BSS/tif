'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { events, CATEGORY_ICONS } from '@/data/events'
import type { FeatureCollection, Point } from 'geojson'

interface EventsLayerProps { map: mapboxgl.Map | null }

const SRC        = 'tif-events'
const LYR_SHADOW = 'tif-events-shadow'
const LYR_DOT    = 'tif-events-dot'
const LYR_ICON   = 'tif-events-icon'
const IMG_PREFIX = 'tif-evt-'
const IMG_SIZE   = 72  // Retina : pixelRatio:2 → 36×36 CSS px

// ── Canvas marker par catégorie ────────────────────────────────────────────────
function drawEventCanvas(emoji: string): HTMLCanvasElement {
  const c   = document.createElement('canvas')
  c.width   = IMG_SIZE
  c.height  = IMG_SIZE
  const ctx = c.getContext('2d')!
  const cx  = IMG_SIZE / 2
  const r   = cx - 4

  // Shadow
  ctx.shadowColor   = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur    = 10
  ctx.shadowOffsetY = 2

  // Cercle violet
  ctx.beginPath()
  ctx.arc(cx, cx, r, 0, Math.PI * 2)
  ctx.fillStyle = '#AF52DE'
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.lineWidth   = 3.5
  ctx.strokeStyle = '#FFFFFF'
  ctx.stroke()

  // Emoji au centre
  ctx.font         = `${Math.round(IMG_SIZE * 0.40)}px -apple-system,"Helvetica Neue",Arial,sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, cx, cx + 1)

  return c
}

async function loadEventImage(m: mapboxgl.Map, cat: string, emoji: string): Promise<void> {
  const id = IMG_PREFIX + cat
  if (m.hasImage(id)) return
  const canvas = drawEventCanvas(emoji)
  try {
    const bitmap = await createImageBitmap(canvas)
    if (!m.hasImage(id)) m.addImage(id, bitmap, { pixelRatio: 2 })
  } catch {
    await new Promise<void>(resolve => {
      const img = new Image()
      img.onload  = () => { if (!m.hasImage(id)) m.addImage(id, img, { pixelRatio: 2 }); resolve() }
      img.onerror = () => resolve()
      img.src = canvas.toDataURL()
    })
  }
}

// ── Déduplique les lieux (un seul pin par coordonnée exacte) ──────────────────
function buildGeojson(): FeatureCollection<Point> {
  const seen = new Set<string>()
  const features: FeatureCollection<Point>['features'] = []

  for (const ev of events) {
    const { lat, lng } = ev.venue
    if (lat == null || lng == null) continue

    // Pour les lieux partagés, on garde le premier event comme représentant
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
    if (seen.has(key)) continue
    seen.add(key)

    // Slugs de tous les événements à ce lieu
    const slugsAtVenue = events
      .filter(e => e.venue.lat === lat && e.venue.lng === lng)
      .map(e => e.slug)

    features.push({
      type: 'Feature',
      properties: {
        slug:     ev.slug,
        slugs:    JSON.stringify(slugsAtVenue),
        name:     ev.venue.name,
        title:    ev.title,
        category: ev.category,
        count:    slugsAtVenue.length,
        imgId:    IMG_PREFIX + ev.category,
      },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    })
  }

  return { type: 'FeatureCollection', features }
}

// ── Popup ─────────────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
  )
}

function buildPopup(p: Record<string, unknown>): string {
  const name    = esc(String(p.name ?? ''))
  const count   = Number(p.count ?? 1)
  const countLine = count > 1
    ? `<div style="font-size:11px;color:rgba(175,82,222,0.85);font-weight:600;margin-top:4px">${count} événements à ce lieu</div>`
    : ''
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:10px 12px">
      <div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:2px">🗓️ ${name}</div>
      ${countLine}
      <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:6px">Touchez pour voir le détail</div>
    </div>`
}

// ── Layers ────────────────────────────────────────────────────────────────────
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
        'circle-color':        '#AF52DE',
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
        'icon-image':            ['get', 'imgId'],
        'icon-size':             1,
        'icon-allow-overlap':    true,
        'icon-ignore-placement': true,
      },
    })
  }
}

function removeLayers(m: mapboxgl.Map) {
  for (const id of [LYR_ICON, LYR_DOT, LYR_SHADOW]) {
    try { if (m.getLayer(id)) m.removeLayer(id) } catch {}
  }
  try { if (m.getSource(SRC)) m.removeSource(SRC) } catch {}
}

function setupEvents(m: mapboxgl.Map) {
  m.on('click', LYR_DOT, e => {
    if (!e.features?.length) return
    const p   = e.features[0].properties as Record<string, unknown>
    const geo = e.features[0].geometry as unknown as { coordinates: [number, number] }

    const slugsRaw = String(p.slugs ?? '[]')
    let slugs: string[]
    try { slugs = JSON.parse(slugsRaw) } catch { slugs = [String(p.slug ?? '')] }

    if (slugs.length === 1) {
      // Un seul event → ouvre directement la fiche dans le BottomSheet
      window.dispatchEvent(new CustomEvent('tif:event-click', { detail: { slug: slugs[0] } }))
    } else {
      // Plusieurs events au même lieu → affiche un popup récapitulatif
      // puis dispatch le premier (le popup sert juste d'indication)
      new mapboxgl.Popup({ maxWidth: '240px', className: 'tif-popup', closeButton: true, offset: 14 })
        .setLngLat(geo.coordinates)
        .setHTML(buildPopup(p))
        .addTo(m)
      window.dispatchEvent(new CustomEvent('tif:event-click', { detail: { slug: slugs[0] } }))
    }
  })

  for (const lyr of [LYR_SHADOW, LYR_DOT, LYR_ICON]) {
    m.on('mouseenter', lyr, () => { m.getCanvas().style.cursor = 'pointer' })
    m.on('mouseleave', lyr, () => { m.getCanvas().style.cursor = '' })
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function EventsLayer({ map }: EventsLayerProps) {
  const eventsRef = useRef(false)

  useEffect(() => {
    if (!map) { eventsRef.current = false; return }

    const moveToTop = () => {
      if (!map.getLayer(LYR_DOT)) return
      try { map.moveLayer(LYR_SHADOW) } catch {}
      try { map.moveLayer(LYR_DOT)   } catch {}
      try { map.moveLayer(LYR_ICON)  } catch {}
      map.triggerRepaint()
    }

    const init = () => {
      if (!map.isStyleLoaded()) return
      try {
        if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: buildGeojson() })
        addLayers(map)
        if (!eventsRef.current) { setupEvents(map); eventsRef.current = true }

        // Charge une image par catégorie présente dans les données
        const cats = [...new Set(events.filter(e => e.venue.lat != null).map(e => e.category))]
        for (const cat of cats) {
          void loadEventImage(map, cat, CATEGORY_ICONS[cat] ?? '🎟️')
        }

        setTimeout(moveToTop, 0)
      } catch {
        map.once('idle', init)
      }
    }

    if (map.isStyleLoaded()) init()
    else map.once('load', init)

    map.on('idle', moveToTop)

    return () => {
      map.off('idle', moveToTop)
      eventsRef.current = false
      try { removeLayers(map) } catch {}
    }
  }, [map])

  return null
}
