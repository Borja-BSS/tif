'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FeatureCollection } from 'geojson'
import type { TransportLayerResponse, TpgDisruption, CffDisruption } from '@/lib/transport/types'
import { isPinching } from '@/lib/multiTouchGuard'

// Source IDs
const SRC_TPG    = 'tif-tpg-vehicles'
const SRC_CFF    = 'tif-cff-vehicles'
const SRC_TALERT = 'tif-tpg-alerts'
const SRC_CALERT = 'tif-cff-alerts'

const ALL_LAYERS = [
  'tif-tpg-circles', 'tif-tpg-labels',
  'tif-cff-circles', 'tif-cff-labels',
  'tif-tpg-alert-icons', 'tif-cff-alert-icons',
] as const

const ALL_SOURCES = [SRC_TPG, SRC_CFF, SRC_TALERT, SRC_CALERT] as const

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

async function fetchTransport(): Promise<TransportLayerResponse | null> {
  try {
    const res = await fetch('/api/v1/layers/transport', { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json() as TransportLayerResponse
  } catch {
    return null
  }
}

function buildTpgAlertFC(disruptions: TpgDisruption[]): FeatureCollection {
  const features = disruptions
    .filter((d): d is TpgDisruption & { coordinates: [number, number] } => !!d.coordinates)
    .map(d => ({
      type: 'Feature' as const,
      properties: {
        icon:        d.type === 'travaux' ? '🚧' : d.type === 'suppression' ? '🚫' : '⚠️',
        line:        d.lineNumber,
        description: d.description,
        source:      'TPG',
        delayMinutes: 0,
        isCEVA:      false,
      },
      // types.ts: coordinates is [lat, lng] — GeoJSON needs [lng, lat]
      geometry: { type: 'Point' as const, coordinates: [d.coordinates[1], d.coordinates[0]] },
    }))
  return { type: 'FeatureCollection', features }
}

function buildCffAlertFC(disruptions: CffDisruption[]): FeatureCollection {
  const features = disruptions.map(d => ({
    type: 'Feature' as const,
    properties: {
      icon:         d.type === 'suppression' ? '🚫' : d.type === 'retard' ? '⏱️' : '⚠️',
      line:         d.line,
      description:  d.description,
      source:       d.isCEVA ? 'Léman Express' : 'CFF',
      delayMinutes: d.delayMinutes ?? 0,
      isCEVA:       d.isCEVA,
    },
    // types.ts: coordinates is [lat, lng] — GeoJSON needs [lng, lat]
    geometry: { type: 'Point' as const, coordinates: [d.coordinates[1], d.coordinates[0]] },
  }))
  return { type: 'FeatureCollection', features }
}

function initLayers(map: mapboxgl.Map) {
  for (const src of ALL_SOURCES) {
    if (!map.getSource(src)) {
      map.addSource(src, { type: 'geojson', data: EMPTY_FC })
    }
  }

  if (!map.getLayer('tif-tpg-circles')) {
    map.addLayer({
      id:     'tif-tpg-circles',
      type:   'circle',
      source: SRC_TPG,
      paint: {
        'circle-radius':       ['interpolate', ['linear'], ['zoom'], 9, 5, 14, 10],
        'circle-color':        ['match', ['get', 'vehicleType'], 'tram', '#FF9500', 'bus', '#34C759', '#8E8E93'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#FFFFFF',
        'circle-opacity':      ['case', ['<', ['get', 'speed'], 2], 0.5, 0.9],
      },
    })

    map.addLayer({
      id:      'tif-tpg-labels',
      type:    'symbol',
      source:  SRC_TPG,
      minzoom: 12,
      layout: {
        'text-field':  ['get', 'routeId'],
        'text-size':   9,
        'text-offset': [0, -1.2],
        'text-anchor': 'bottom',
      },
      paint: {
        'text-color':      '#FFFFFF',
        'text-halo-color': 'rgba(0,0,0,0.7)',
        'text-halo-width': 1.5,
      },
    })
  }

  if (!map.getLayer('tif-cff-circles')) {
    map.addLayer({
      id:     'tif-cff-circles',
      type:   'circle',
      source: SRC_CFF,
      paint: {
        'circle-radius':       ['interpolate', ['linear'], ['zoom'], 9, 7, 14, 14],
        'circle-color':        ['match', ['get', 'vehicleType'], 'ceva', '#AF52DE', 'train', '#0040FF', '#0040FF'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFFFFF',
        'circle-opacity':      0.95,
      },
    })

    map.addLayer({
      id:      'tif-cff-labels',
      type:    'symbol',
      source:  SRC_CFF,
      minzoom: 10,
      layout: {
        'text-field':  ['get', 'routeId'],
        'text-size':   10,
        'text-offset': [0, -1.2],
        'text-anchor': 'bottom',
      },
      paint: {
        'text-color':      '#FFFFFF',
        'text-halo-color': 'rgba(0,0,0,0.8)',
        'text-halo-width': 2,
      },
    })
  }

  if (!map.getLayer('tif-tpg-alert-icons')) {
    map.addLayer({
      id:     'tif-tpg-alert-icons',
      type:   'symbol',
      source: SRC_TALERT,
      layout: {
        'text-field':         ['get', 'icon'],
        'text-size':          ['interpolate', ['linear'], ['zoom'], 9, 14, 14, 22],
        'text-anchor':        'center',
        'text-allow-overlap': false,
      },
    })
  }

  if (!map.getLayer('tif-cff-alert-icons')) {
    map.addLayer({
      id:     'tif-cff-alert-icons',
      type:   'symbol',
      source: SRC_CALERT,
      layout: {
        'text-field':  ['get', 'icon'],
        'text-size':   ['interpolate', ['linear'], ['zoom'], 9, 16, 14, 24],
        'text-anchor': 'center',
      },
    })
  }
}

function setupPopups(map: mapboxgl.Map, popup: mapboxgl.Popup) {
  const circleLayers = ['tif-tpg-circles', 'tif-cff-circles'] as const
  const alertLayers  = ['tif-tpg-alert-icons', 'tif-cff-alert-icons'] as const

  for (const layerId of circleLayers) {
    map.on('click', layerId, (e) => {
      if (isPinching()) return
      if (!e.features?.[0]) return
      const p = e.features[0].properties ?? {}
      const vehicleType = String(p.vehicleType ?? '')
      const icon = vehicleType === 'ceva' ? '🚆' : vehicleType === 'tram' ? '🚋' : vehicleType === 'train' ? '🚄' : '🚌'
      const speed = Number(p.speed ?? 0)
      popup.setLngLat(e.lngLat).setHTML(`
        <div style="font-family:-apple-system,sans-serif;padding:4px;min-width:140px">
          <div style="font-weight:700;font-size:15px;margin-bottom:2px">${icon} Ligne ${p.routeId ?? '—'}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.7)">
            ${speed > 0 ? `${Math.round(speed)} km/h` : ''}
            ${speed < 2 ? '· À l\'arrêt' : ''}
          </div>
        </div>`).addTo(map)
    })
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
  }

  for (const layerId of alertLayers) {
    map.on('click', layerId, (e) => {
      if (isPinching()) return
      if (!e.features?.[0]) return
      const p = e.features[0].properties ?? {}
      const delay = Number(p.delayMinutes ?? 0)
      popup.setLngLat(e.lngLat).setHTML(`
        <div style="font-family:-apple-system,sans-serif;padding:4px;max-width:250px">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px">
            ${p.icon ?? ''} ${p.source ?? ''} — Ligne ${p.line ?? ''}
            ${delay > 0 ? `<span style="color:#FF3B30"> +${delay} min</span>` : ''}
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,0.85);line-height:1.4">${p.description ?? ''}</div>
        </div>`).addTo(map)
    })
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
  }
}

function applyData(map: mapboxgl.Map, data: TransportLayerResponse) {
  const tpgSrc  = map.getSource(SRC_TPG)    as mapboxgl.GeoJSONSource | undefined
  const cffSrc  = map.getSource(SRC_CFF)    as mapboxgl.GeoJSONSource | undefined
  const tAlertSrc = map.getSource(SRC_TALERT) as mapboxgl.GeoJSONSource | undefined
  const cAlertSrc = map.getSource(SRC_CALERT) as mapboxgl.GeoJSONSource | undefined

  tpgSrc?.setData((data.vehicles.tpg ?? EMPTY_FC) as FeatureCollection)
  cffSrc?.setData((data.vehicles.cff ?? EMPTY_FC) as FeatureCollection)
  tAlertSrc?.setData(buildTpgAlertFC(data.disruptions.tpg))
  cAlertSrc?.setData(buildCffAlertFC(data.disruptions.cff))

  if (data.g7.isActive || data.g7.isWarningPeriod) {
    window.dispatchEvent(new CustomEvent('tif:g7-warning', { detail: data.g7 }))
  }
}

export function useGtfsTransportLayer(map: mapboxgl.Map | null) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const popupRef    = useRef<mapboxgl.Popup | null>(null)

  useEffect(() => {
    if (!map) return

    const popup = new mapboxgl.Popup({
      maxWidth:    '300px',
      closeButton: true,
      closeOnClick: false,
    })
    popupRef.current = popup

    const init = async () => {
      initLayers(map)
      setupPopups(map, popup)

      const data = await fetchTransport()
      if (data) applyData(map, data)

      intervalRef.current = setInterval(async () => {
        const fresh = await fetchTransport()
        if (fresh && map.getSource(SRC_TPG)) applyData(map, fresh)
      }, 15_000)
    }

    if (map.loaded()) {
      void init()
    } else {
      map.once('load', () => void init())
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      popupRef.current?.remove()

      for (const id of ALL_LAYERS) {
        if (map.getLayer(id)) map.removeLayer(id)
      }
      for (const src of ALL_SOURCES) {
        if (map.getSource(src)) map.removeSource(src)
      }
    }
  }, [map])
}
