'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FeatureCollection } from 'geojson'

interface BorderCrossingsLayerProps {
  map: mapboxgl.Map | null
}

const REFRESH_MS    = 120_000
const SOURCE_ID     = 'tif-border-crossings'
const LAYER_SHADOW  = 'tif-border-shadow'
const LAYER_CIRCLE  = 'tif-border-circle'
const LAYER_ICON    = 'tif-border-icon'

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

function parseArr(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[]
  if (typeof val === 'string') { try { return JSON.parse(val) } catch { return [] } }
  return []
}

function buildPopupHTML(props: Record<string, unknown>): string {
  const name      = String(props.name ?? 'Passage frontière')
  const status    = String(props.status ?? 'CLEAR')
  const color     = String(props.color ?? '#8E8E93')
  const wait      = Number(props.waitTimeMinutes ?? 0)
  const g7Period  = Boolean(props.g7Period)
  const g7Status  = props.g7Status ? String(props.g7Status) : null
  const hours     = String(props.hours ?? '—')
  const vehicles  = parseArr(props.vehicles)
  const vignettes = parseArr(props.vignettes)
  const g7Info    = String(props.g7Info ?? '')
  const nearest   = String(props.nearestOpen ?? '')
  const updated   = props.lastUpdated
    ? new Date(String(props.lastUpdated)).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
    : '—'

  const statusLabel = STATUS_LABEL[status] ?? status
  const isClosed    = status === 'BLOCKED'

  const headerBg = isClosed
    ? 'rgba(255,59,48,0.12)'
    : g7Status === 'macaron'
    ? 'rgba(90,200,250,0.08)'
    : 'rgba(255,255,255,0.04)'

  const waitLine = wait > 0 && !isClosed
    ? `<span style="color:rgba(255,255,255,0.4);font-size:11px">· ~${wait} min d'attente</span>`
    : ''

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

  const vignetteRows = vignettes.map(v => `<div class="tif-popup-row">· ${v}</div>`).join('')
  const vehicleList  = vehicles.join(' · ')

  return `
    <div style="font-family:-apple-system,SF Pro Text,sans-serif">
      <div class="tif-popup-section" style="background:${headerBg};padding:12px 14px">
        <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:5px">${name}</div>
        <div style="display:flex;align-items:center;gap:7px">
          <span style="width:9px;height:9px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
          <span style="color:${color};font-weight:600;font-size:13px">${statusLabel}</span>
          ${waitLine}
        </div>
        <div style="margin-top:5px;font-size:11px;color:rgba(255,255,255,0.3)">
          CH ⇄ FR · Mis à jour ${updated}
        </div>
      </div>
      <div class="tif-popup-section">
        <div class="tif-popup-label">Horaires & Accès</div>
        <div class="tif-popup-row">🕐 ${hours}</div>
        ${vehicleList ? `<div class="tif-popup-row">🚗 ${vehicleList}</div>` : ''}
      </div>
      ${vignetteRows ? `
      <div class="tif-popup-section">
        <div class="tif-popup-label">Documents & Vignettes requis</div>
        ${vignetteRows}
      </div>` : ''}
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

// Filtre les features border et ajoute borderColor pour les expressions de layer
function prepareBorderData(geojson: FeatureCollection): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: geojson.features
      .filter(f => (f.properties as Record<string, unknown>)?.type === 'border')
      .map(f => {
        const p        = f.properties as Record<string, unknown>
        const isClosed = p.status === 'BLOCKED'
        const g7Status = p.g7Status ? String(p.g7Status) : null
        const strokeColor = isClosed ? '#FF3B30' : g7Status === 'macaron' ? '#5AC8FA' : '#FFFFFF'
        return { ...f, properties: { ...p, strokeColor } }
      }),
  }
}

function addLayersToMap(m: mapboxgl.Map) {
  m.addLayer({
    id: LAYER_SHADOW,
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-radius': 20,
      'circle-color': 'rgba(0,0,0,0.35)',
      'circle-blur': 0.6,
      'circle-translate': [0, 2],
    },
  })

  m.addLayer({
    id: LAYER_CIRCLE,
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-radius': 18,
      'circle-color': ['get', 'color'],
      'circle-stroke-width': 2,
      'circle-stroke-color': ['get', 'strokeColor'],
    },
  })

  m.addLayer({
    id: LAYER_ICON,
    type: 'symbol',
    source: SOURCE_ID,
    layout: {
      'text-field': ['get', 'icon'],
      'text-size': 16,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
    },
    paint: {
      'text-translate': [0, 0],
    },
  })
}

function applyData(m: mapboxgl.Map, geojson: FeatureCollection) {
  const data = prepareBorderData(geojson)
  const src  = m.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
  if (src) {
    src.setData(data)
  } else {
    m.addSource(SOURCE_ID, { type: 'geojson', data })
    addLayersToMap(m)
  }
}

function removeLayers(m: mapboxgl.Map) {
  for (const id of [LAYER_ICON, LAYER_CIRCLE, LAYER_SHADOW]) {
    if (m.getLayer(id)) m.removeLayer(id)
  }
  if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID)
}

export default function BorderCrossingsLayer({ map }: BorderCrossingsLayerProps) {
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const prefetchRef  = useRef<FeatureCollection | null>(null)
  const prefetchDone = useRef(false)

  // Prefetch immediately so first render is instant
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
      applyData(map, data)
    }

    const setupEvents = () => {
      map.on('click', LAYER_CIRCLE, e => {
        if (!e.features?.length) return
        const props = e.features[0].properties as Record<string, unknown>
        new mapboxgl.Popup({ maxWidth: '300px', className: 'tif-popup', closeButton: true, offset: 22 })
          .setLngLat(e.lngLat)
          .setHTML(buildPopupHTML(props))
          .addTo(map)
      })
      map.on('mouseenter', LAYER_CIRCLE, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', LAYER_CIRCLE, () => { map.getCanvas().style.cursor = '' })
    }

    if (map.loaded()) {
      run()
      setupEvents()
    } else {
      map.once('load', () => { run(); setupEvents() })
    }

    timerRef.current = setInterval(async () => {
      const data = await fetchBorderData()
      if (!data) return
      applyData(map, data)
    }, REFRESH_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      try { removeLayers(map) } catch { /* map peut être détruite */ }
    }
  }, [map])

  return null
}
