'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FeatureCollection } from 'geojson'

interface ConstructionLayerProps {
  map: mapboxgl.Map | null
}

const REFRESH_MS = 300_000  // 5 min
const SOURCE_ID  = 'tif-construction'
const LAYER_GLOW = 'tif-constr-glow'
const LAYER_DOT  = 'tif-constr-dot'
const LAYER_ICON = 'tif-constr-icon'

async function fetchConstruction(): Promise<FeatureCollection | null> {
  try {
    const res = await fetch('/api/v1/layers/construction', {
      cache: 'no-store', signal: AbortSignal.timeout(18000),
    })
    if (!res.ok) return null
    return res.json() as Promise<FeatureCollection>
  } catch { return null }
}

function addLayers(m: mapboxgl.Map) {
  if (m.getLayer(LAYER_GLOW)) return

  m.addSource(SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })

  // Halo orange pulsant
  m.addLayer({
    id: LAYER_GLOW, type: 'circle', source: SOURCE_ID,
    paint: {
      'circle-radius':  ['interpolate', ['linear'], ['zoom'], 8, 10, 13, 18, 16, 26],
      'circle-color':   '#FF9500',
      'circle-opacity': 0.18,
      'circle-blur':    0.8,
    },
  })

  // Pastille orange
  m.addLayer({
    id: LAYER_DOT, type: 'circle', source: SOURCE_ID,
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 8, 5, 13, 9, 16, 12],
      'circle-color':        '#FF9500',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FFFFFF',
      'circle-opacity':      0.9,
    },
  })

  // Icône texte 🚧 (minzoom 11)
  m.addLayer({
    id: LAYER_ICON, type: 'symbol', source: SOURCE_ID,
    minzoom: 11,
    layout: {
      'text-field':           '🚧',
      'text-size':            ['interpolate', ['linear'], ['zoom'], 11, 12, 14, 16],
      'text-anchor':          'center',
      'text-allow-overlap':   false,
    },
  })
}

export default function ConstructionLayer({ map }: ConstructionLayerProps) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!map) return

    const applyData = (data: FeatureCollection) => {
      const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      if (src) { src.setData(data); return }
      addLayers(map)
      ;(map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource)?.setData(data)
    }

    const setupPopup = () => {
      const popup = new mapboxgl.Popup({ maxWidth: '280px', closeButton: true, offset: 10 })

      map.on('click', LAYER_DOT, e => {
        if (!e.features?.length) return
        const p = e.features[0].properties as Record<string, unknown>
        popup.setLngLat(e.lngLat).setHTML(`
          <div style="font-family:-apple-system,sans-serif;padding:10px 12px;min-width:200px">
            <div style="font-size:13px;font-weight:700;color:#FF9500;margin-bottom:4px">🚧 Travaux</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.85);line-height:1.5">${String(p.description ?? p.name ?? 'Chantier en cours')}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:6px">Source : OpenStreetMap</div>
          </div>
        `).addTo(map)
      })
      map.on('touchend', LAYER_DOT, e => {
        if (!e.features?.length) return
        const p = e.features[0].properties as Record<string, unknown>
        popup.setLngLat(e.lngLat).setHTML(`
          <div style="font-family:-apple-system,sans-serif;padding:10px 12px;min-width:200px">
            <div style="font-size:13px;font-weight:700;color:#FF9500;margin-bottom:4px">🚧 Travaux</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.85);line-height:1.5">${String(p.description ?? p.name ?? 'Chantier en cours')}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:6px">Source : OpenStreetMap</div>
          </div>
        `).addTo(map)
      })
      map.on('mouseenter', LAYER_DOT, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', LAYER_DOT, () => { map.getCanvas().style.cursor = '' })
    }

    const run = async () => {
      const data = await fetchConstruction()
      if (!data) return
      if (map.isStyleLoaded()) { applyData(data); setupPopup() }
      else map.once('idle', () => { applyData(data); setupPopup() })
    }

    void run()
    timerRef.current = setInterval(() => void fetchConstruction().then(d => d && applyData(d)), REFRESH_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      try {
        for (const id of [LAYER_ICON, LAYER_DOT, LAYER_GLOW]) {
          if (map.getLayer(id)) map.removeLayer(id)
        }
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch { /* map détruite */ }
    }
  }, [map])

  return null
}
