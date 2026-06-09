'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FeatureCollection, Feature, MultiLineString } from 'geojson'
import type { TransitRouteProperties } from '@/lib/transit/network'
import { isPinching } from '@/lib/multiTouchGuard'
import type { TransportLayerResponse, TpgDisruption, CffDisruption } from '@/lib/transport/types'

// ── Source / layer IDs ────────────────────────────────────────────────────────
const SRC_NETWORK    = 'tif-transit-network'
const SRC_DISRUPTED  = 'tif-transit-disrupted'
const SRC_ALERTS     = 'tif-transit-alerts'

const LAYER_NETWORK_BUS      = 'tif-transit-bus'
const LAYER_NETWORK_TRAM     = 'tif-transit-tram'
const LAYER_NETWORK_RAIL     = 'tif-transit-rail'
const LAYER_NETWORK_CEVA     = 'tif-transit-ceva'
const LAYER_DISRUPTED        = 'tif-transit-disrupted-overlay'
const LAYER_ALERTS           = 'tif-transit-alert-icons'

const ALL_LAYERS = [
  LAYER_NETWORK_BUS, LAYER_NETWORK_TRAM, LAYER_NETWORK_RAIL, LAYER_NETWORK_CEVA,
  LAYER_DISRUPTED, LAYER_ALERTS,
] as const

const ALL_SOURCES = [SRC_NETWORK, SRC_DISRUPTED, SRC_ALERTS] as const

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

// ── Fetch helpers ─────────────────────────────────────────────────────────────
// Module-level promise: starts fetching immediately on first import (before user clicks Transport)
let networkPromise: Promise<FeatureCollection<MultiLineString, TransitRouteProperties> | null> | null = null

function fetchNetwork(): Promise<FeatureCollection<MultiLineString, TransitRouteProperties> | null> {
  if (!networkPromise) {
    networkPromise = fetch('/data/transit-network.json')
      .then(res => res.ok ? res.json() as Promise<FeatureCollection<MultiLineString, TransitRouteProperties>> : null)
      .catch(() => null)
  }
  return networkPromise
}

// Kick off the prefetch as soon as this module is imported
if (typeof window !== 'undefined') fetchNetwork()

async function fetchDisruptions(): Promise<TransportLayerResponse | null> {
  try {
    const res = await fetch('/api/v1/layers/transport', {
      cache:  'no-store',
      signal: AbortSignal.timeout(5000),  // 5s max — ne bloque pas la carte
    })
    if (!res.ok) return null
    return await res.json() as TransportLayerResponse
  } catch {
    return null
  }
}

// ── Build disrupted-route overlay from network features ───────────────────────
function buildDisruptedFC(
  network: FeatureCollection<MultiLineString, TransitRouteProperties>,
  disruptedRefs: Set<string>,
): FeatureCollection<MultiLineString, TransitRouteProperties> {
  return {
    type: 'FeatureCollection',
    features: network.features.filter(f => disruptedRefs.has(f.properties?.ref ?? '')),
  }
}

// ── Build alert icons from disruption stop coords ─────────────────────────────
function buildAlertFC(tpg: TpgDisruption[], cff: CffDisruption[]): FeatureCollection {
  const features: Feature[] = []

  for (const d of tpg) {
    if (!d.coordinates) continue
    features.push({
      type: 'Feature',
      properties: {
        icon: d.type === 'travaux' ? '🚧' : d.type === 'suppression' ? '🚫' : '⚠️',
        line: d.lineNumber, description: d.description,
        source: 'TPG', delayMinutes: 0,
      },
      // [lat, lng] → [lng, lat] for GeoJSON
      geometry: { type: 'Point', coordinates: [d.coordinates[1], d.coordinates[0]] },
    })
  }

  for (const d of cff) {
    features.push({
      type: 'Feature',
      properties: {
        icon: d.type === 'suppression' ? '🚫' : d.type === 'retard' ? '⏱️' : '⚠️',
        line: d.line, description: d.description,
        source: d.isCEVA ? 'Léman Express' : 'CFF',
        delayMinutes: d.delayMinutes ?? 0,
      },
      geometry: { type: 'Point', coordinates: [d.coordinates[1], d.coordinates[0]] },
    })
  }

  return { type: 'FeatureCollection', features }
}

// ── GL layer setup ────────────────────────────────────────────────────────────
function initLayers(map: mapboxgl.Map) {
  for (const src of ALL_SOURCES) {
    if (!map.getSource(src)) {
      map.addSource(src, { type: 'geojson', data: EMPTY_FC, generateId: true })
    }
  }

  // Bus lines (thin green) — bevel join is GPU-cheaper than round for large datasets
  if (!map.getLayer(LAYER_NETWORK_BUS)) {
    map.addLayer({
      id: LAYER_NETWORK_BUS, type: 'line', source: SRC_NETWORK,
      filter: ['==', ['get', 'routeType'], 'bus'],
      layout: { 'line-join': 'bevel', 'line-cap': 'butt' },
      paint: {
        'line-color':   ['get', 'color'],
        'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 1, 13, 2.5],
        'line-opacity': 0.75,
      },
    })
  }

  // Tram / trolleybus lines
  if (!map.getLayer(LAYER_NETWORK_TRAM)) {
    map.addLayer({
      id: LAYER_NETWORK_TRAM, type: 'line', source: SRC_NETWORK,
      filter: ['in', ['get', 'routeType'], ['literal', ['tram', 'trolleybus', 'share_taxi']]],
      layout: { 'line-join': 'bevel', 'line-cap': 'butt' },
      paint: {
        'line-color':   ['get', 'color'],
        'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 2, 13, 4],
        'line-opacity': 0.88,
      },
    })
  }

  // CEVA / Léman Express (purple, prominent)
  if (!map.getLayer(LAYER_NETWORK_CEVA)) {
    map.addLayer({
      id: LAYER_NETWORK_CEVA, type: 'line', source: SRC_NETWORK,
      filter: ['==', ['get', 'isCEVA'], true],
      layout: { 'line-join': 'bevel', 'line-cap': 'butt' },
      paint: {
        'line-color':   '#AF52DE',
        'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 2.5, 13, 5],
        'line-opacity': 0.9,
      },
    })
  }

  // CFF/SBB rail (blue, prominent)
  if (!map.getLayer(LAYER_NETWORK_RAIL)) {
    map.addLayer({
      id: LAYER_NETWORK_RAIL, type: 'line', source: SRC_NETWORK,
      filter: ['all',
        ['in', ['get', 'routeType'], ['literal', ['train', 'rail', 'light_rail', 'subway', 'monorail']]],
        ['==', ['get', 'isCEVA'], false],
      ],
      layout: { 'line-join': 'bevel', 'line-cap': 'butt' },
      paint: {
        'line-color':   '#0040FF',
        'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 2, 13, 4.5],
        'line-opacity': 0.85,
      },
    })
  }

  // Disrupted lines overlay (red dashed)
  if (!map.getLayer(LAYER_DISRUPTED)) {
    map.addLayer({
      id: LAYER_DISRUPTED, type: 'line', source: SRC_DISRUPTED,
      layout: { 'line-join': 'bevel', 'line-cap': 'butt' },
      paint: {
        'line-color':     '#FF3B30',
        'line-width':     ['interpolate', ['linear'], ['zoom'], 9, 3, 13, 6],
        'line-opacity':   0.85,
        'line-dasharray': [2, 1.5],
      },
    })
  }

  // Disruption alert icons
  if (!map.getLayer(LAYER_ALERTS)) {
    map.addLayer({
      id: LAYER_ALERTS, type: 'symbol', source: SRC_ALERTS,
      layout: {
        'text-field':         ['get', 'icon'],
        'text-size':          ['interpolate', ['linear'], ['zoom'], 9, 14, 14, 22],
        'text-anchor':        'center',
        'text-allow-overlap': false,
      },
    })
  }

  // User location always on top of transit lines
  ;['user-location-accuracy', 'user-location-dot'].forEach(id => {
    try { if (map.getLayer(id)) map.moveLayer(id) } catch {}
  })
}

// ── Popup setup ───────────────────────────────────────────────────────────────
function setupPopups(map: mapboxgl.Map, popup: mapboxgl.Popup) {
  map.on('click', LAYER_ALERTS, (e) => {
    if (isPinching()) return
    if (!e.features?.[0]) return
    const p = e.features[0].properties ?? {}
    const delay = Number(p.delayMinutes ?? 0)
    popup.setLngLat(e.lngLat).setHTML(`
      <div style="font-family:-apple-system,sans-serif;padding:4px;max-width:240px">
        <div style="font-weight:700;font-size:13px;margin-bottom:4px">
          ${p.icon ?? ''} ${p.source ?? ''} — Ligne ${p.line ?? ''}
          ${delay > 0 ? `<span style="color:#FF3B30"> +${delay} min</span>` : ''}
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.85);line-height:1.4">${p.description ?? ''}</div>
      </div>`).addTo(map)
  })
  map.on('mouseenter', LAYER_ALERTS, () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', LAYER_ALERTS, () => { map.getCanvas().style.cursor = '' })
}

// ── Apply disruption data ─────────────────────────────────────────────────────
function applyDisruptions(
  map: mapboxgl.Map,
  network: FeatureCollection<MultiLineString, TransitRouteProperties>,
  data: TransportLayerResponse,
) {
  const { tpg, cff } = data.disruptions

  // Collect all disrupted line refs (normalize: remove spaces, uppercase)
  const disruptedRefs = new Set<string>([
    ...tpg.map(d => d.lineNumber.trim()),
    ...cff.map(d => d.line.replace(/\s+/g, '').trim()),
  ])

  const disruptedSrc = map.getSource(SRC_DISRUPTED) as mapboxgl.GeoJSONSource | undefined
  disruptedSrc?.setData(buildDisruptedFC(network, disruptedRefs))

  const alertSrc = map.getSource(SRC_ALERTS) as mapboxgl.GeoJSONSource | undefined
  alertSrc?.setData(buildAlertFC(tpg, cff))

  // Dispatch G7 warning
  if (data.g7.isActive || data.g7.isWarningPeriod) {
    window.dispatchEvent(new CustomEvent('tif:g7-warning', { detail: data.g7 }))
  }

  // Dispatch disruptions list for side panel
  window.dispatchEvent(new CustomEvent('tif:disruptions', {
    detail: { tpg, cff, total: tpg.length + cff.length },
  }))
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useTransitNetworkLayer(map: mapboxgl.Map | null) {
  const networkRef  = useRef<FeatureCollection<MultiLineString, TransitRouteProperties> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const popupRef    = useRef<mapboxgl.Popup | null>(null)

  useEffect(() => {
    if (!map) return

    const popup = new mapboxgl.Popup({
      maxWidth: '300px', closeButton: true, closeOnClick: false,
    })
    popupRef.current = popup

    const init = async () => {
      initLayers(map)
      setupPopups(map, popup)

      // Load static network (cached 24h — may be slow on first call)
      const network = await fetchNetwork()
      if (network) {
        networkRef.current = network
        ;(map.getSource(SRC_NETWORK) as mapboxgl.GeoJSONSource | undefined)
          ?.setData(network as unknown as FeatureCollection)
      }

      // Load disruptions immediately, then every 2 min
      const refreshDisruptions = async () => {
        const data = await fetchDisruptions()
        if (data && networkRef.current && map.getSource(SRC_DISRUPTED)) {
          applyDisruptions(map, networkRef.current, data)
        }
      }

      await refreshDisruptions()
      intervalRef.current = setInterval(refreshDisruptions, 120_000)
    }

    let cancelled = false

    const wrappedInit = async () => {
      if (cancelled || map.getLayer(LAYER_NETWORK_BUS)) return
      await init()
    }

    const onStyleLoad = () => void wrappedInit()
    const onIdle      = () => { if (!map.getLayer(LAYER_NETWORK_BUS)) void wrappedInit() }

    if (map.isStyleLoaded()) {
      void wrappedInit()
    } else {
      map.once('style.load', onStyleLoad)
    }
    // Fallback idle — style.load peut avoir déjà tiré si isStyleLoaded() était faux
    map.once('idle', onIdle)

    return () => {
      cancelled = true
      map.off('style.load', onStyleLoad)
      map.off('idle',       onIdle)
      if (intervalRef.current) clearInterval(intervalRef.current)
      popupRef.current?.remove()
      for (const id of ALL_LAYERS)   { try { if (map.getLayer(id))   map.removeLayer(id) } catch {} }
      for (const src of ALL_SOURCES) { try { if (map.getSource(src)) map.removeSource(src) } catch {} }
    }
  }, [map])
}
