'use client'

import { useEffect } from 'react'
import mapboxgl     from 'mapbox-gl'

const SOURCE_ID = 'here-alerts'
const LAYER_ID  = 'here-alerts-symbols'

function injectPopupStyle() {
  if (document.getElementById('tif-here-popup-style')) return
  const s = document.createElement('style')
  s.id = 'tif-here-popup-style'
  s.textContent = `
    .tif-here-popup .mapboxgl-popup-content {
      background: rgba(15,15,20,.92);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 10px;
      padding: 10px 12px;
      backdrop-filter: blur(12px);
    }
    .tif-here-popup .mapboxgl-popup-tip { border-top-color: rgba(15,15,20,.92); }
  `
  document.head.appendChild(s)
}

export function useHereAlertsLayer(map: mapboxgl.Map | null) {
  useEffect(() => {
    if (!map) return

    injectPopupStyle()

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '280px',
      className: 'tif-here-popup',
    })

    const init = () => {
      if (map.getSource(SOURCE_ID)) return

      map.addSource(SOURCE_ID, { type: 'geojson', data: '/api/v1/layers/alerts' })

      map.addLayer({
        id:     LAYER_ID,
        type:   'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field':         ['get', 'icon'],
          'text-size':          ['interpolate', ['linear'], ['zoom'], 9, 16, 13, 24],
          'text-anchor':        'center',
          'text-allow-overlap': false,
        },
      })

      map.on('mouseenter', LAYER_ID, (e) => {
        map.getCanvas().style.cursor = 'pointer'
        const p = e.features?.[0]?.properties
        if (!p) return
        const coords = (e.features![0].geometry as unknown as { coordinates: [number, number] }).coordinates
        popup
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:-apple-system,SF Pro Text,sans-serif;font-size:13px;line-height:1.5">
              <div style="font-weight:600;margin-bottom:4px">
                ${String(p.icon ?? '⚠️')} ${String(p.type ?? 'Incident').replace(/_/g,' ')}
              </div>
              <div style="color:rgba(255,255,255,.75)">${String(p.description ?? '')}</div>
              ${p.startTime ? `
              <div style="color:rgba(255,255,255,.35);font-size:11px;margin-top:6px">
                ${new Date(String(p.startTime)).toLocaleTimeString('fr-CH',{hour:'2-digit',minute:'2-digit'})} UTC
              </div>` : ''}
            </div>
          `)
          .addTo(map)
      })

      map.on('mouseleave', LAYER_ID, () => {
        map.getCanvas().style.cursor = ''
        popup.remove()
      })
    }

    if (map.loaded()) init()
    else map.on('load', init)

    const interval = setInterval(() => {
      const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      src?.setData('/api/v1/layers/alerts')
    }, 60_000)

    return () => {
      clearInterval(interval)
      popup.remove()
      if (map.getLayer(LAYER_ID))   map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])
}
