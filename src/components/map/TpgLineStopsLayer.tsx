'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { GeoJSONSource, MapLayerMouseEvent, MapLayerTouchEvent } from 'mapbox-gl'
import { TPG_LINES } from '@/lib/transport/tpg-line-stops'
import { isPinching } from '@/lib/multiTouchGuard'

interface Props { map: mapboxgl.Map | null }

export interface StopSelectDetail {
  name:  string
  coord: [number, number]
  line:  string
}

const SRC      = 'tif-tpg-stops'
const LYR_GLOW = 'tif-tpg-glow'
const LYR_DOT  = 'tif-tpg-dot'

type StopFeature = {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { name: string; line: string; color: string }
}
type StopFC = { type: 'FeatureCollection'; features: StopFeature[] }
const EMPTY: StopFC = { type: 'FeatureCollection', features: [] }

export default function TpgLineStopsLayer({ map }: Props) {
  const initDone = useRef(false)

  useEffect(() => {
    if (!map) return

    const init = () => {
      if (initDone.current || map.getSource(SRC)) { initDone.current = true; return }
      initDone.current = true

      map.addSource(SRC, { type: 'geojson', data: EMPTY })

      // Glow halo — rendered in WebGL, no DOM flicker on zoom
      map.addLayer({
        id: LYR_GLOW, type: 'circle', source: SRC,
        paint: {
          'circle-radius':  16,
          'circle-color':   ['get', 'color'],
          'circle-opacity': 0.18,
          'circle-blur':    0.6,
        },
      })
      // Solid dot
      map.addLayer({
        id: LYR_DOT, type: 'circle', source: SRC,
        paint: {
          'circle-radius':       6,
          'circle-color':        ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity':      0.92,
        },
      })

      // User location always above TPG stops
      ;['user-location-accuracy', 'user-location-dot'].forEach(id => {
        try { if (map.getLayer(id)) map.moveLayer(id) } catch {}
      })

      const dispatch = (e: MapLayerMouseEvent | MapLayerTouchEvent) => {
        if (isPinching()) return
        if (!e.features?.length) return
        const p = e.features[0].properties as { name: string; line: string }
        window.dispatchEvent(new CustomEvent<StopSelectDetail>('tif:stop-select', {
          detail: { name: p.name, coord: [e.lngLat.lng, e.lngLat.lat], line: p.line },
        }))
      }
      map.on('click',    LYR_DOT, dispatch)
      map.on('touchend', LYR_DOT, dispatch as unknown as (e: mapboxgl.MapTouchEvent) => void)
      map.on('mouseenter', LYR_DOT, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', LYR_DOT, () => { map.getCanvas().style.cursor = '' })
    }

    const setData = (fc: StopFC) => {
      const src = map.getSource(SRC) as GeoJSONSource | undefined
      if (src) src.setData(fc)
    }

    if (map.isStyleLoaded()) init()
    else map.once('idle', init)

    const handleSelect = (e: Event) => {
      const { line, color } = (e as CustomEvent<{ line: string | null; color?: string }>).detail
      if (!line) { setData(EMPTY); return }
      const cfg = TPG_LINES[line]
      if (!cfg) { setData(EMPTY); return }
      const c = color ?? '#30D158'
      setData({
        type: 'FeatureCollection',
        features: cfg.stops.map(s => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: s.coord },
          properties: { name: s.name, line, color: c },
        })),
      })
    }

    const clearData = () => setData(EMPTY)

    window.addEventListener('tif:line-select', handleSelect)
    window.addEventListener('tif:line-clear',  clearData)

    return () => {
      window.removeEventListener('tif:line-select', handleSelect)
      window.removeEventListener('tif:line-clear',  clearData)
      try {
        if (map.getLayer(LYR_DOT))  map.removeLayer(LYR_DOT)
        if (map.getLayer(LYR_GLOW)) map.removeLayer(LYR_GLOW)
        if (map.getSource(SRC))     map.removeSource(SRC)
      } catch { /* map destroyed */ }
      initDone.current = false
    }
  }, [map])

  return null
}
