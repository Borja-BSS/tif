'use client'

import { useEffect } from 'react'
import mapboxgl     from 'mapbox-gl'

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#FF3B30',
  HIGH:     '#FF9500',
  MEDIUM:   '#FFCC00',
  LOW:      '#34C759',
}

/**
 * Hook Mapbox GL — layers basés sur les TerritorialEvents actifs.
 * Sources : /api/v1/territory/events (GeoJSON)
 *
 * Layer 1 : Points incidents (circle)
 * Layer 2 : Labels événements CRITICAL
 */
export function useTerritorialLayers(map: mapboxgl.Map | null) {
  useEffect(() => {
    if (!map) return

    const SOURCE_ID    = 'tif-active-events'
    const CIRCLE_ID    = 'tif-events-circles'
    const LABEL_ID     = 'tif-events-labels'

    const init = () => {
      if (map.getSource(SOURCE_ID)) return

      // Source GeoJSON chargée depuis l'API
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: '/api/v1/territory/events',
      })

      // Layer 1 — Cercles colorés par sévérité
      map.addLayer({
        id:     CIRCLE_ID,
        type:   'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 6, 14, 14],
          'circle-color': [
            'match', ['get', 'severity'],
            'CRITICAL', SEVERITY_COLOR.CRITICAL,
            'HIGH',     SEVERITY_COLOR.HIGH,
            'MEDIUM',   SEVERITY_COLOR.MEDIUM,
            'LOW',      SEVERITY_COLOR.LOW,
            '#8E8E93',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity': 0.9,
        },
      })

      // Layer 2 — Pulse sur CRITICAL (symbol ⚠)
      map.addLayer({
        id:     LABEL_ID,
        type:   'symbol',
        source: SOURCE_ID,
        filter: ['==', ['get', 'severity'], 'CRITICAL'],
        layout: {
          'text-field':  '⚠',
          'text-size':   12,
          'text-anchor': 'center',
          'text-offset': [0, -1.5],
        },
        paint: {
          'text-color': '#FF3B30',
          'text-halo-color': '#000',
          'text-halo-width': 1,
        },
      })

      // Tooltip on hover
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '220px' })

      map.on('mouseenter', CIRCLE_ID, (e) => {
        map.getCanvas().style.cursor = 'pointer'
        const p = e.features?.[0]?.properties
        if (!p) return
        const conf = Math.round((p.confidence ?? 0) * 100)
        popup
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:monospace;font-size:11px;line-height:1.7;padding:2px 0">
              <div style="color:${SEVERITY_COLOR[p.severity] ?? '#aaa'};font-weight:600">
                ${p.severity}
              </div>
              <div style="color:#fff;margin-top:2px">${p.title ?? p.type}</div>
              <div style="color:#888;margin-top:4px">
                Fiabilité sources <b style="color:#fff">${conf}%</b>
              </div>
              <div style="color:#555;font-size:10px;margin-top:2px">${p.detectedAt?.slice(11, 16) ?? ''} UTC</div>
            </div>
          `)
          .addTo(map)
      })

      map.on('mouseleave', CIRCLE_ID, () => {
        map.getCanvas().style.cursor = ''
        popup.remove()
      })
    }

    if (map.loaded()) init()
    else map.on('load', init)

    // Rafraîchit les événements actifs toutes les 60s
    const interval = setInterval(() => {
      const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      src?.setData('/api/v1/territory/events')
    }, 60_000)

    return () => {
      clearInterval(interval)
      if (map.getLayer(LABEL_ID))  map.removeLayer(LABEL_ID)
      if (map.getLayer(CIRCLE_ID)) map.removeLayer(CIRCLE_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])
}
