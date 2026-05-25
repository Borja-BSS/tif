'use client'

import { useEffect } from 'react'
import mapboxgl     from 'mapbox-gl'

const SOURCE_ID = 'here-mobility'
const LAYER_ID  = 'here-mobility-lines'

export function useHereMobilityLayer(map: mapboxgl.Map | null) {
  useEffect(() => {
    if (!map) return

    const init = () => {
      if (map.getSource(SOURCE_ID)) return

      map.addSource(SOURCE_ID, { type: 'geojson', data: '/api/v1/layers/mobility' })

      map.addLayer({
        id:     LAYER_ID,
        type:   'line',
        source: SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint:  {
          'line-color':   ['get', 'color'],
          'line-width':   ['interpolate', ['linear'], ['zoom'], 9, 2, 12, 4, 15, 7],
          'line-opacity': 0.85,
        },
      })
    }

    if (map.loaded()) init()
    else map.on('load', init)

    const interval = setInterval(() => {
      const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      src?.setData('/api/v1/layers/mobility')
    }, 30_000)

    return () => {
      clearInterval(interval)
      if (map.getLayer(LAYER_ID))   map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])
}
