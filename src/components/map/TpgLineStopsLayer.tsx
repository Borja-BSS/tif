'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { TPG_LINES } from '@/lib/transport/tpg-line-stops'

interface Props { map: mapboxgl.Map | null }

export interface StopSelectDetail {
  name:  string
  coord: [number, number]
  line:  string
}

const PIN_SIZE = 10

function makeMarkerEl(stopName: string, lineColor: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = `
    width:${PIN_SIZE + 4}px;height:${PIN_SIZE + 4}px;
    border-radius:50%;
    background:${lineColor};
    border:2px solid rgba(255,255,255,0.9);
    box-shadow:0 1px 6px rgba(0,0,0,0.5);
    cursor:pointer;
    transition:transform 0.15s;
  `
  el.title = stopName
  el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.5)' })
  el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })
  return el
}

export default function TpgLineStopsLayer({ map }: Props) {
  const markersRef  = useRef<mapboxgl.Marker[]>([])
  const activeColor = useRef('#30D158')

  useEffect(() => {
    const clearMarkers = () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
    }

    const handleLineSelect = (e: Event) => {
      clearMarkers()
      const { line, color } = (e as CustomEvent<{ line: string | null; color?: string }>).detail
      if (!line || !map) return

      const cfg = TPG_LINES[line]
      if (!cfg) return

      activeColor.current = color ?? '#30D158'

      cfg.stops.forEach(stop => {
        const el = makeMarkerEl(stop.name, activeColor.current)

        el.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent<StopSelectDetail>('tif:stop-select', {
            detail: { name: stop.name, coord: stop.coord, line },
          }))
        })

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(stop.coord)
          .addTo(map)

        markersRef.current.push(marker)
      })
    }

    window.addEventListener('tif:line-select', handleLineSelect)
    window.addEventListener('tif:line-clear', clearMarkers)

    return () => {
      window.removeEventListener('tif:line-select', handleLineSelect)
      window.removeEventListener('tif:line-clear', clearMarkers)
      clearMarkers()
    }
  }, [map])

  return null
}
