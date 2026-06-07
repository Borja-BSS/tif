'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FeatureCollection, Feature, GeoJsonProperties } from 'geojson'

interface ConstructionLayerProps {
  map: mapboxgl.Map | null
}

const REFRESH_MS = 300_000  // 5 min

// Sources Mapbox
const SRC_LINES  = 'tif-closures-lines'
const SRC_POINTS = 'tif-construction-pts'

// Layers
const LAYER_CLOSURE_CASING = 'tif-closure-casing'
const LAYER_CLOSURE_LINE   = 'tif-closure-line'
const LAYER_CONSTR_GLOW    = 'tif-constr-glow'
const LAYER_CONSTR_DOT     = 'tif-constr-dot'
const LAYER_CONSTR_ICON    = 'tif-constr-icon'

// Overpass BBOX (south,west,north,east) — Grand Genève élargi
const BBOX = '45.85,5.70,46.60,7.10'
const OVERPASS_QUERY = `[out:json][timeout:18];(
  way["highway"="construction"](${BBOX});
  way["construction"~"."](${BBOX});
  node["highway"="construction"](${BBOX});
  way["access"="no"]["highway"~"motorway|trunk|primary|secondary"](${BBOX});
  node["barrier"="block"]["access"="no"](${BBOX});
);out center tags 150;`

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ── Fetch 1 : HERE road-closures (LineStrings) ────────────────────────────────
async function fetchHereClosures(): Promise<FeatureCollection | null> {
  try {
    const r = await fetch('/api/v1/layers/road-closures', { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    return r.json()
  } catch { return null }
}

// ── Fetch 2 : territory API — non-border features (construction, plannedEvent) ─
async function fetchTerritoryNonBorder(): Promise<Feature[]> {
  try {
    const r = await fetch('/api/v1/layers/territory', { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    if (!r.ok) return []
    const fc = await r.json() as FeatureCollection
    return fc.features.filter(f => {
      const t = (f.properties as Record<string, unknown>)?.type
      return t === 'construction' || t === 'roadClosure' || t === 'plannedEvent'
    })
  } catch { return [] }
}

// ── Fetch 3 : Overpass (static OSM construction data) ────────────────────────
async function fetchOverpass(): Promise<Feature[]> {
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    `data=${encodeURIComponent(OVERPASS_QUERY)}`,
      signal:  AbortSignal.timeout(20000),
    })
    if (!res.ok) return []
    const data = await res.json() as { elements: Array<{
      type: string; id: number
      lat?: number; lon?: number
      center?: { lat: number; lon: number }
      tags?: Record<string, string>
    }> }
    return data.elements
      .filter(el => el.lat != null || el.center != null)
      .map(el => {
        const lat  = el.lat ?? el.center!.lat
        const lng  = el.lon ?? el.center!.lon
        const tags = el.tags ?? {}
        const name = tags.name ?? tags.description ?? tags.ref ?? ''
        const isAccessNo = tags.access === 'no'
        const desc = isAccessNo
          ? `Route fermée${name ? ` · ${name}` : ''}`
          : (name ? name : `Chantier · ${tags.construction ?? tags.highway ?? 'travaux'}`)
        return {
          type: 'Feature' as const,
          properties: { id: `osm-${el.id}`, description: desc, source: 'OSM', type: isAccessNo ? 'roadClosure' : 'construction' },
          geometry: { type: 'Point' as const, coordinates: [lng, lat] },
        }
      })
  } catch { return [] }
}

// ── Merge all sources into points GeoJSON ─────────────────────────────────────
function buildPoints(territoryFeats: Feature[], overpassFeats: Feature[]): FeatureCollection {
  // Deduplicate by proximity (~50m) between sources
  const seen: [number, number][] = []
  const dedup = (feat: Feature) => {
    const coords = (feat.geometry as unknown as { coordinates: [number, number] }).coordinates
    for (const s of seen) {
      if (Math.abs(coords[0] - s[0]) < 0.0005 && Math.abs(coords[1] - s[1]) < 0.0005) return false
    }
    seen.push(coords)
    return true
  }
  const feats = [...territoryFeats, ...overpassFeats].filter(f => {
    if (f.geometry.type !== 'Point') return false
    return dedup(f)
  })
  return { type: 'FeatureCollection', features: feats }
}

// ── Add Mapbox layers ─────────────────────────────────────────────────────────
function addLayers(m: mapboxgl.Map) {
  // Line source for HERE road closures
  if (!m.getSource(SRC_LINES)) {
    m.addSource(SRC_LINES, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    m.addLayer({
      id: LAYER_CLOSURE_CASING, type: 'line', source: SRC_LINES,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color':   '#FF3B30',
        'line-width':   ['interpolate', ['linear'], ['zoom'], 8, 5, 13, 9, 16, 14],
        'line-opacity': 0.15,
        'line-blur':    3,
      },
    })
    m.addLayer({
      id: LAYER_CLOSURE_LINE, type: 'line', source: SRC_LINES,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color':     '#FF3B30',
        'line-width':     ['interpolate', ['linear'], ['zoom'], 8, 2.5, 13, 4, 16, 6],
        'line-opacity':   0.85,
        'line-dasharray': [2, 2],
      },
    })
  }

  // Point source for construction/planned events
  if (!m.getSource(SRC_POINTS)) {
    m.addSource(SRC_POINTS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    m.addLayer({
      id: LAYER_CONSTR_GLOW, type: 'circle', source: SRC_POINTS,
      paint: {
        'circle-radius':  ['interpolate', ['linear'], ['zoom'], 8, 12, 13, 20, 16, 30],
        'circle-color':   ['case', ['==', ['get', 'type'], 'roadClosure'], '#FF3B30', '#FF9500'],
        'circle-opacity': 0.15,
        'circle-blur':    0.8,
      },
    })
    m.addLayer({
      id: LAYER_CONSTR_DOT, type: 'circle', source: SRC_POINTS,
      paint: {
        'circle-radius':       ['interpolate', ['linear'], ['zoom'], 8, 5, 13, 9, 16, 12],
        'circle-color':        ['case', ['==', ['get', 'type'], 'roadClosure'], '#FF3B30', '#FF9500'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFFFFF',
        'circle-opacity':      0.9,
      },
    })
    m.addLayer({
      id: LAYER_CONSTR_ICON, type: 'symbol', source: SRC_POINTS,
      minzoom: 11,
      layout: {
        'text-field':         ['case', ['==', ['get', 'type'], 'roadClosure'], '🚫', '🚧'],
        'text-size':          ['interpolate', ['linear'], ['zoom'], 11, 12, 14, 16],
        'text-anchor':        'center',
        'text-allow-overlap': false,
      },
    })
  }
}

function updateData(m: mapboxgl.Map, lines: FeatureCollection, points: FeatureCollection) {
  const ls = m.getSource(SRC_LINES)  as mapboxgl.GeoJSONSource | undefined
  const ps = m.getSource(SRC_POINTS) as mapboxgl.GeoJSONSource | undefined
  if (ls) ls.setData(lines)
  if (ps) ps.setData(points)
}

// ── Popup ─────────────────────────────────────────────────────────────────────
function setupPopups(m: mapboxgl.Map) {
  const popup = new mapboxgl.Popup({ maxWidth: '280px', closeButton: true, offset: 10 })

  const show = (e: mapboxgl.MapLayerMouseEvent | mapboxgl.MapLayerTouchEvent) => {
    if (!e.features?.length) return
    const p = e.features[0].properties as Record<string, unknown>
    const isClosure = p.type === 'roadClosure'
    const desc = esc(String(p.description ?? 'Incident routier'))
    const src  = String(p.source ?? 'HERE / OSM')
    const timeInfo = p.startTime ? `<div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:6px">Depuis ${new Date(String(p.startTime)).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}</div>` : ''
    popup.setLngLat(e.lngLat).setHTML(`
      <div style="font-family:-apple-system,sans-serif;padding:10px 12px;min-width:200px">
        <div style="font-size:13px;font-weight:700;color:${isClosure ? '#FF3B30' : '#FF9500'};margin-bottom:4px">${isClosure ? '🚫 Route fermée' : '🚧 Travaux'}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.85);line-height:1.5">${desc}</div>
        ${timeInfo}
        <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:6px">Source : ${src}</div>
      </div>`).addTo(m)
  }

  for (const layer of [LAYER_CONSTR_DOT, LAYER_CLOSURE_LINE]) {
    m.on('click',    layer, show)
    m.on('touchend', layer, show as unknown as (e: mapboxgl.MapTouchEvent) => void)
    m.on('mouseenter', layer, () => { m.getCanvas().style.cursor = 'pointer' })
    m.on('mouseleave', layer, () => { m.getCanvas().style.cursor = '' })
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ConstructionLayer({ map }: ConstructionLayerProps) {
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const popupSetup  = useRef(false)

  useEffect(() => {
    if (!map) return

    const run = async () => {
      const [hereData, territoryFeats, overpassFeats] = await Promise.all([
        fetchHereClosures(),
        fetchTerritoryNonBorder(),
        fetchOverpass(),
      ])

      const lines: FeatureCollection = hereData ?? { type: 'FeatureCollection', features: [] }
      const points = buildPoints(territoryFeats, overpassFeats)

      const apply = () => {
        addLayers(map)
        updateData(map, lines, points)
        if (!popupSetup.current) { setupPopups(map); popupSetup.current = true }
      }

      if (map.isStyleLoaded()) apply()
      else map.once('idle', () => { if (!map.getSource(SRC_LINES)) apply() })
    }

    void run()

    timerRef.current = setInterval(async () => {
      const [hereData, territoryFeats, overpassFeats] = await Promise.all([
        fetchHereClosures(),
        fetchTerritoryNonBorder(),
        fetchOverpass(),
      ])
      if (!map.getSource(SRC_LINES)) return
      const lines  = hereData ?? { type: 'FeatureCollection', features: [] }
      const points = buildPoints(territoryFeats, overpassFeats)
      updateData(map, lines, points)
    }, REFRESH_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      try {
        for (const id of [LAYER_CONSTR_ICON, LAYER_CONSTR_DOT, LAYER_CONSTR_GLOW, LAYER_CLOSURE_LINE, LAYER_CLOSURE_CASING]) {
          if (map.getLayer(id)) map.removeLayer(id)
        }
        for (const id of [SRC_POINTS, SRC_LINES]) {
          if (map.getSource(id)) map.removeSource(id)
        }
      } catch { /* map détruite */ }
    }
  }, [map])

  return null
}
