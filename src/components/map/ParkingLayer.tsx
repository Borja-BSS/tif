'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { PARKINGS_PR } from '@/lib/parking/pr-data'
import type { FeatureCollection, Point } from 'geojson'

interface ParkingLayerProps { map: mapboxgl.Map | null }

const SRC   = 'tif-parking-pr'
const LYR_HALO   = 'tif-pr-halo'
const LYR_CIRCLE = 'tif-pr-circle'
const LYR_LABEL  = 'tif-pr-label'

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c])
}

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
        // Tier for size: 0=small, 1=medium, 2=large, 3=xlarge
        tier: p.capacity >= 700 ? 3 : p.capacity >= 300 ? 2 : p.capacity >= 100 ? 1 : 0,
      },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  }
}

function buildPopup(p: Record<string, unknown>): string {
  const name     = esc(String(p.name ?? ''))
  const cap      = Number(p.capacity)
  const tpg      = p.tpg ? esc(String(p.tpg)) : null
  const url      = p.url ? String(p.url) : null
  const hasRT    = Boolean(p.hasRT)

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

function addLayers(m: mapboxgl.Map) {
  // Halo
  m.addLayer({
    id: LYR_HALO, type: 'circle', source: SRC,
    paint: {
      'circle-radius':  ['interpolate', ['linear'], ['zoom'], 10, ['*', ['number', ['get', 'tier'], 1], 5], 15, ['*', ['number', ['get', 'tier'], 1], 12]],
      'circle-color':   '#0A84FF',
      'circle-opacity':  0.15,
      'circle-blur':     0.8,
    },
  })
  // Main circle — size by tier
  m.addLayer({
    id: LYR_CIRCLE, type: 'circle', source: SRC,
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        9,  ['case', ['>=', ['get', 'tier'], 3], 7, ['>=', ['get', 'tier'], 2], 6, ['>=', ['get', 'tier'], 1], 5, 4],
        14, ['case', ['>=', ['get', 'tier'], 3], 14, ['>=', ['get', 'tier'], 2], 11, ['>=', ['get', 'tier'], 1], 9, 7],
      ],
      'circle-color':         '#0A84FF',
      'circle-opacity':        0.9,
      'circle-stroke-width':   1.5,
      'circle-stroke-color':  '#FFFFFF',
    },
  })
  // "P" label
  m.addLayer({
    id: LYR_LABEL, type: 'symbol', source: SRC,
    layout: {
      'text-field':         'P',
      'text-font':          ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
      'text-size':          ['interpolate', ['linear'], ['zoom'], 9, 8, 14, 11],
      'text-anchor':        'center',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color':       '#FFFFFF',
      'text-halo-color':  'rgba(0,0,0,0)',
      'text-halo-width':   0,
    },
  })
}

function removeLayers(m: mapboxgl.Map) {
  for (const id of [LYR_LABEL, LYR_CIRCLE, LYR_HALO]) {
    if (m.getLayer(id)) m.removeLayer(id)
  }
  if (m.getSource(SRC)) m.removeSource(SRC)
}

function setupPopup(m: mapboxgl.Map) {
  m.on('click', LYR_CIRCLE, e => {
    if (!e.features?.length) return
    const p   = e.features[0].properties as Record<string, unknown>
    const geo = e.features[0].geometry as unknown as { coordinates: [number, number] }
    new mapboxgl.Popup({ maxWidth: '280px', className: 'tif-popup', closeButton: true, offset: 14 })
      .setLngLat(geo.coordinates)
      .setHTML(buildPopup(p))
      .addTo(m)
  })
  m.on('mouseenter', LYR_CIRCLE, () => { m.getCanvas().style.cursor = 'pointer' })
  m.on('mouseleave', LYR_CIRCLE, () => { m.getCanvas().style.cursor = '' })
}

export default function ParkingLayer({ map }: ParkingLayerProps) {
  const addedRef = useRef(false)

  useEffect(() => {
    if (!map) {
      addedRef.current = false
      return
    }

    const run = () => {
      if (addedRef.current) return
      addedRef.current = true
      map.addSource(SRC, { type: 'geojson', data: buildGeojson() })
      addLayers(map)
      setupPopup(map)
    }

    if (map.isStyleLoaded()) run()
    else {
      map.once('style.load', run)
      map.once('idle', () => { if (!addedRef.current) run() })
    }

    return () => {
      addedRef.current = false
      try { removeLayers(map) } catch { /* map détruite */ }
    }
  }, [map])

  return null
}
