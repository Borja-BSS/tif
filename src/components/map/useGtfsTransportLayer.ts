'use client'

import { useEffect } from 'react'
import mapboxgl     from 'mapbox-gl'

const SOURCE_ID  = 'gtfs-transport'
const CIRCLE_ID  = 'gtfs-transport-circles'
const LABEL_ID   = 'gtfs-transport-labels'

export function useGtfsTransportLayer(map: mapboxgl.Map | null) {
  useEffect(() => {
    if (!map) return

    const init = () => {
      if (map.getSource(SOURCE_ID)) return

      map.addSource(SOURCE_ID, { type: 'geojson', data: '/api/v1/layers/transport' })

      map.addLayer({
        id:     CIRCLE_ID,
        type:   'circle',
        source: SOURCE_ID,
        paint:  {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 9, 4, 13, 8],
          'circle-color':        ['get', 'color'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity':      0.9,
        },
      })

      map.addLayer({
        id:      LABEL_ID,
        type:    'symbol',
        source:  SOURCE_ID,
        minzoom: 13,
        layout:  {
          'text-field':  ['get', 'routeId'],
          'text-size':   10,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
        },
        paint: {
          'text-color':      '#FFFFFF',
          'text-halo-color': 'rgba(0,0,0,0.7)',
          'text-halo-width': 1,
        },
      })
    }

    if (map.loaded()) init()
    else map.on('load', init)

    const interval = setInterval(() => {
      const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      src?.setData('/api/v1/layers/transport')
    }, 15_000)

    return () => {
      clearInterval(interval)
      if (map.getLayer(LABEL_ID))   map.removeLayer(LABEL_ID)
      if (map.getLayer(CIRCLE_ID))  map.removeLayer(CIRCLE_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])
}
