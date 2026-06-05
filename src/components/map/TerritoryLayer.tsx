'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { cellToBoundary } from 'h3-js'
import { getAblyClient } from '@/lib/realtime'
import { LEVEL_COLOR, LEVEL_OPACITY } from '@/lib/scoring/territory-score'
import type * as Ably from 'ably'
import type { TerritoryLevel } from '@/lib/scoring/territory-score'

interface ZoneEntry {
  geohash6:  string
  score:     number
  level:     TerritoryLevel
  congestion: number
  divergence: boolean
  computedAt: string
}

interface TerritoryLayerProps {
  map:     mapboxgl.Map | null
  visible: boolean
}

const SOURCE_ID = 'tif-territory-zones'
const FILL_ID   = 'tif-territory-fill'
const LINE_ID   = 'tif-territory-line'

function zonesToGeoJSON(zones: Map<string, ZoneEntry>): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []

  for (const zone of zones.values()) {
    if (zone.level === 'GREEN') continue  // pas de rendu pour zones normales

    try {
      const boundary  = cellToBoundary(zone.geohash6)
      // h3 returns [lat, lng], mapbox needs [lng, lat]
      const coords    = boundary.map(([lat, lng]) => [lng, lat] as [number, number])
      coords.push(coords[0])  // close ring

      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: {
          geohash6:  zone.geohash6,
          score:     zone.score,
          level:     zone.level,
          color:     LEVEL_COLOR[zone.level],
          opacity:   LEVEL_OPACITY[zone.level],
          divergence: zone.divergence,
        },
      })
    } catch {
      // geohash invalide — ignoré
    }
  }

  return { type: 'FeatureCollection', features }
}

export default function TerritoryLayer({ map, visible }: TerritoryLayerProps) {
  const zonesRef = useRef<Map<string, ZoneEntry>>(new Map())

  const flush = (m: mapboxgl.Map) => {
    const src = m.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(zonesToGeoJSON(zonesRef.current))
  }

  const setLayerVisibility = (m: mapboxgl.Map, show: boolean) => {
    const v = show ? 'visible' : 'none'
    if (m.getLayer(FILL_ID)) m.setLayoutProperty(FILL_ID, 'visibility', v)
    if (m.getLayer(LINE_ID)) m.setLayoutProperty(LINE_ID, 'visibility', v)
  }

  useEffect(() => {
    if (!map || !map.loaded()) return
    setLayerVisibility(map, visible)
  }, [map, visible])

  // Chargement de l'état initial depuis l'API au montage
  useEffect(() => {
    fetch('/api/territory/zones', { signal: AbortSignal.timeout(5000) })
      .then(r => r.ok ? r.json() : [])
      .then((zones: ZoneEntry[]) => {
        zones.forEach(z => zonesRef.current.set(z.geohash6, z))
        // Si la source existe déjà (fetch plus lent que l'init Mapbox), on flush
        if (map?.loaded() && map.getSource(SOURCE_ID)) flush(map)
      })
      .catch(() => null)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map) return

    const initLayers = () => {
      if (map.getSource(SOURCE_ID)) return

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: zonesToGeoJSON(zonesRef.current),  // données déjà chargées si fetch rapide
      })

      // Fill coloré par propriété `color`
      map.addLayer({
        id:     FILL_ID,
        type:   'fill',
        source: SOURCE_ID,
        layout: { visibility: visible ? 'visible' : 'none' },
        paint: {
          'fill-color':   ['get', 'color'],
          'fill-opacity': ['get', 'opacity'],
        },
      })

      // Contour fin pour délimiter les cellules
      map.addLayer({
        id:     LINE_ID,
        type:   'line',
        source: SOURCE_ID,
        layout: { visibility: visible ? 'visible' : 'none' },
        paint: {
          'line-color':   ['get', 'color'],
          'line-width':   0.8,
          'line-opacity': 0.4,
        },
      })

      // Tooltip on hover
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })

      map.on('mouseenter', FILL_ID, (e) => {
        map.getCanvas().style.cursor = 'crosshair'
        const props = e.features?.[0]?.properties
        if (!props) return
        popup
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:monospace;font-size:11px;line-height:1.7;padding:2px 0">
              <div style="color:${props.color};font-weight:600">${props.level}</div>
              <div style="color:#aaa">Score&nbsp;<b style="color:#fff">${props.score}</b>/100</div>
              ${props.divergence ? '<div style="color:#f97316;font-size:10px">⚠ divergence</div>' : ''}
              <div style="color:#555;font-size:10px">${props.geohash6}</div>
            </div>
          `)
          .addTo(map)
      })

      map.on('mouseleave', FILL_ID, () => {
        map.getCanvas().style.cursor = ''
        popup.remove()
      })
    }

    if (map.loaded()) initLayers()
    else map.on('load', initLayers)

    // Ably subscription pour mises à jour temps réel
    const client  = getAblyClient()
    const channel = client.channels.get('tif:territory:snapshot')

    channel.subscribe('zones.updated', (msg: Ably.Message) => {
      const zones: ZoneEntry[] = msg.data
      zones.forEach(z => zonesRef.current.set(z.geohash6, z))
      if (map.loaded()) flush(map)
    })

    return () => {
      channel.unsubscribe('zones.updated')
      if (map.getLayer(LINE_ID)) map.removeLayer(LINE_ID)
      if (map.getLayer(FILL_ID)) map.removeLayer(FILL_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
