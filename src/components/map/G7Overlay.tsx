'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'

// G7 Summit — Palais des Nations, Genève — 8–10 juin 2026
const G7_START = new Date('2026-06-08T09:00:00+02:00')

// Périmètre de sécurité G7 (polygone schématique autour du Palais des Nations)
const G7_PERIMETER: [number, number][] = [
  [6.118, 46.218],
  [6.145, 46.218],
  [6.155, 46.230],
  [6.145, 46.242],
  [6.118, 46.242],
  [6.108, 46.230],
  [6.118, 46.218],
]

const SOURCE_ID = 'tif-g7-perimeter'
const FILL_ID   = 'tif-g7-fill'
const LINE_ID   = 'tif-g7-line'

interface G7OverlayProps {
  map: mapboxgl.Map | null
}

interface Countdown {
  days:    number
  hours:   number
  minutes: number
  seconds: number
  started: boolean
}

function getCountdown(): Countdown {
  const now   = Date.now()
  const delta = G7_START.getTime() - now

  if (delta <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, started: true }
  }

  const days    = Math.floor(delta / 86_400_000)
  const hours   = Math.floor((delta % 86_400_000) / 3_600_000)
  const minutes = Math.floor((delta % 3_600_000) / 60_000)
  const seconds = Math.floor((delta % 60_000) / 1_000)
  return { days, hours, minutes, seconds, started: false }
}

export default function G7Overlay({ map }: G7OverlayProps) {
  const [cd, setCd]           = useState<Countdown>(getCountdown)
  const intervalRef           = useRef<ReturnType<typeof setInterval> | null>(null)

  // Countdown tick
  useEffect(() => {
    intervalRef.current = setInterval(() => setCd(getCountdown()), 1_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  // Couche carte périmètre G7
  useEffect(() => {
    if (!map) return

    const addLayers = () => {
      if (map.getSource(SOURCE_ID)) return

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [G7_PERIMETER],
          },
          properties: {},
        },
      })

      map.addLayer({
        id:     FILL_ID,
        type:   'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color':   '#3b82f6',
          'fill-opacity': 0.06,
        },
      })

      map.addLayer({
        id:     LINE_ID,
        type:   'line',
        source: SOURCE_ID,
        paint: {
          'line-color':   '#3b82f6',
          'line-width':   1.5,
          'line-opacity': 0.5,
          'line-dasharray': [3, 2],
        },
      })
    }

    if (map.loaded()) addLayers()
    else map.on('load', addLayers)

    return () => {
      if (map.getLayer(LINE_ID)) map.removeLayer(LINE_ID)
      if (map.getLayer(FILL_ID)) map.removeLayer(FILL_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div className="flex items-center gap-3 rounded-full bg-black/75 backdrop-blur border border-blue-500/20 px-4 py-2">
        {/* Badge G7 */}
        <span className="text-[9px] font-mono tracking-[0.22em] text-blue-400/70 uppercase">G7</span>
        <span className="w-px h-3 bg-white/10" />

        {cd.started ? (
          <span className="text-[10px] font-mono text-amber-400/90 tracking-wider">
            SOMMET EN COURS
          </span>
        ) : (
          <div className="flex items-baseline gap-1 font-mono text-white/70">
            {cd.days > 0 && (
              <>
                <span className="text-sm font-light tabular-nums text-white/90">{cd.days}</span>
                <span className="text-[9px] text-white/30 mr-1">j</span>
              </>
            )}
            <span className="text-sm font-light tabular-nums text-white/90">{pad(cd.hours)}</span>
            <span className="text-[10px] text-white/20">:</span>
            <span className="text-sm font-light tabular-nums text-white/90">{pad(cd.minutes)}</span>
            <span className="text-[10px] text-white/20">:</span>
            <span className="text-sm font-light tabular-nums text-white/50">{pad(cd.seconds)}</span>
          </div>
        )}

        <span className="w-px h-3 bg-white/10" />
        <span className="text-[9px] font-mono text-white/25 tracking-wide">8–10 juin 2026</span>
      </div>
    </div>
  )
}
