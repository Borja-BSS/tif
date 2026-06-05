'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import { getAblyClient, CHANNELS } from '@/lib/realtime'
import type * as Ably from 'ably'

interface Signal {
  lat:    number
  lng:    number
  weight: number
  type:   string
}

interface Stats {
  traffic:   number
  transport: number
  total:     number
}

interface RealtimeLayerProps {
  map:              mapboxgl.Map | null
  visible?:         boolean
  showTransport?:   boolean
}

const SOURCE_ID = 'tif-realtime-source'
const LAYER_ID  = 'tif-realtime-heatmap'

export default function RealtimeLayer({ map, visible = true, showTransport = true }: RealtimeLayerProps) {
  const [connected, setConnected]     = useState(false)
  const [stats, setStats]             = useState<Stats>({ traffic: 0, transport: 0, total: 0 })
  const pointsRef                     = useRef<Signal[]>([])
  const channelRef                    = useRef<Ably.RealtimeChannel | null>(null)

  // Sync layer visibility
  useEffect(() => {
    if (!map || !map.loaded()) return
    if (map.getLayer(LAYER_ID)) {
      map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none')
    }
  }, [map, visible])

  // Initialise la source + layer heatmap sur la carte
  const initLayers = useCallback((m: mapboxgl.Map) => {
    if (m.getSource(SOURCE_ID)) return

    m.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    m.addLayer({
      id:     LAYER_ID,
      type:   'heatmap',
      source: SOURCE_ID,
      paint: {
        'heatmap-weight':    ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 14, 2.5],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0,    'rgba(0,0,0,0)',
          0.15, 'rgba(0,92,255,0.3)',
          0.4,  'rgba(0,122,255,0.6)',
          0.7,  'rgba(0,180,255,0.85)',
          1,    'rgba(180,240,255,1)',
        ],
        'heatmap-radius':  ['interpolate', ['linear'], ['zoom'], 8, 12, 14, 28],
        'heatmap-opacity': 0.75,
      },
    })
  }, [])

  // Pousse les points vers la source GeoJSON
  const flushToMap = useCallback((m: mapboxgl.Map) => {
    const src = m.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    src.setData({
      type: 'FeatureCollection',
      features: pointsRef.current.map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { weight: p.weight, type: p.type },
      })),
    })
  }, [])

  // Re-filter buffer existant quand showTransport change
  useEffect(() => {
    if (!map) return
    pointsRef.current = pointsRef.current.filter(p =>
      p.type !== 'transport' || showTransport,
    )
    if (map.loaded()) flushToMap(map)
  }, [map, showTransport, flushToMap])

  useEffect(() => {
    if (!map) return

    map.on('load', () => initLayers(map))
    if (map.loaded()) initLayers(map)

    const client  = getAblyClient()
    const channel = client.channels.get(CHANNELS.signals)
    channelRef.current = channel

    client.connection.on('connected',    () => setConnected(true))
    client.connection.on('disconnected', () => setConnected(false))
    client.connection.on('failed',       () => setConnected(false))

    // Reçoit soit un signal unique, soit un batch
    channel.subscribe('signal', (msg: Ably.Message) => {
      const incoming: Signal[] = Array.isArray(msg.data) ? msg.data : [msg.data]

      setStats(prev => {
        const next = { ...prev }
        incoming.forEach(s => {
          if (s.type === 'traffic')   next.traffic++
          if (s.type === 'transport') next.transport++
          next.total++
        })
        return next
      })

      // Filtre par type de signal selon les toggles
      const filtered = incoming.filter(s => {
        if (s.type === 'transport' && !showTransport) return false
        return true
      })

      // Fenêtre glissante : garde les 500 derniers points
      pointsRef.current = [...pointsRef.current, ...filtered].slice(-500)
      if (map.loaded()) flushToMap(map)
    })

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [map, initLayers, flushToMap])

  // Ne pas afficher le badge si la clé Ably n'est pas configurée
  const ablyConfigured = typeof process.env.NEXT_PUBLIC_ABLY_KEY === 'string' && process.env.NEXT_PUBLIC_ABLY_KEY.length > 0

  return (
    <div className="absolute flex flex-col gap-1.5 items-end" style={{ bottom: 'calc(56px + 54px)', right: 16 }}>
      {/* Badge connexion — visible uniquement si Ably est configuré */}
      {ablyConfigured && (
        <div className="flex items-center gap-2 rounded-lg bg-black/70 backdrop-blur px-3 py-1.5 text-[11px] font-mono">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'}`} />
          <span className="text-white/50">{connected ? 'live' : 'limité'}</span>
        </div>
      )}

      {/* Stats signaux */}
      {stats.total > 0 && (
        <div className="flex gap-2 rounded-lg bg-black/70 backdrop-blur px-3 py-1.5 text-[10px] font-mono">
          <span className="text-blue-400">{stats.traffic} trafic</span>
          <span className="text-white/20">·</span>
          <span className="text-cyan-400">{stats.transport} transport</span>
          <span className="text-white/20">·</span>
          <span className="text-white/40">{stats.total} total</span>
        </div>
      )}
    </div>
  )
}
