'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { getAblyClient, CHANNELS } from '@/lib/realtime'
import { LEVEL_COLOR } from '@/lib/scoring/territory-score'
import type * as Ably from 'ably'

interface CriticalAlert {
  geohash6:   string
  lat:        number
  lng:        number
  pattern:    string
  severity:   string
  zScore:     number
  detectedAt: string | Date
}

interface AlertLayerProps {
  map:     mapboxgl.Map | null
  visible: boolean
}

const MAX_ALERTS = 30
const TTL_MS     = 2 * 60 * 60 * 1000  // 2h mirrors EVENT_TTL_HOURS

function buildPopupHtml(a: CriticalAlert): string {
  const label: Record<string, string> = {
    SPEED_DROP_COLLECTIVE: 'Ralentissement collectif',
    DENSITY_SPIKE:         'Pic de densité',
    DENSITY_VOID:          'Évitement de zone',
    MASS_ROUTE_CHANGE:     'Changement d\'itinéraire',
    CONSENSUS_DIVERGENCE:  'Divergence officiel/réalité',
  }
  return `
    <div style="font-family:monospace;font-size:11px;line-height:1.6;padding:4px 2px">
      <div style="color:#ef4444;font-weight:600;letter-spacing:.06em">${a.severity}</div>
      <div style="color:#fff;margin-top:2px">${label[a.pattern] ?? a.pattern}</div>
      <div style="color:#666;margin-top:4px">Z-score&nbsp;${a.zScore.toFixed(2)}</div>
      <div style="color:#444">${a.geohash6}</div>
    </div>
  `
}

export default function AlertLayer({ map, visible }: AlertLayerProps) {
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; timer: ReturnType<typeof setTimeout> }>>(
    new Map(),
  )

  const addAlert = (a: CriticalAlert) => {
    if (!map) return

    const key = `${a.geohash6}-${a.detectedAt}`

    // Purge si déjà > MAX_ALERTS
    if (markersRef.current.size >= MAX_ALERTS) {
      const oldest = markersRef.current.keys().next().value
      if (oldest) {
        const entry = markersRef.current.get(oldest)!
        clearTimeout(entry.timer)
        entry.marker.remove()
        markersRef.current.delete(oldest)
      }
    }

    // Élément DOM du marqueur
    const el = document.createElement('div')
    el.style.cssText = `
      width:14px; height:14px;
      border-radius:50%;
      background:${LEVEL_COLOR.CRITICAL};
      border:2px solid ${LEVEL_COLOR.RED};
      box-shadow:0 0 0 0 ${LEVEL_COLOR.RED};
      animation:alert-pulse 1.5s ease-out infinite;
      cursor:pointer;
      display:${visible ? 'block' : 'none'};
    `
    el.className = 'tif-alert-marker'

    const popup = new mapboxgl.Popup({ offset: 12, closeButton: false, maxWidth: '200px' })
      .setHTML(buildPopupHtml(a))

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([a.lng, a.lat])
      .setPopup(popup)
      .addTo(map)

    const timer = setTimeout(() => {
      marker.remove()
      markersRef.current.delete(key)
    }, TTL_MS)

    markersRef.current.set(key, { marker, timer })
  }

  // Sync visibility when prop changes
  useEffect(() => {
    markersRef.current.forEach(({ marker }) => {
      const el = marker.getElement()
      el.style.display = visible ? 'block' : 'none'
    })
  }, [visible])

  useEffect(() => {
    if (!map) return

    // Injecter l'animation CSS une seule fois
    if (!document.getElementById('tif-alert-keyframes')) {
      const style = document.createElement('style')
      style.id = 'tif-alert-keyframes'
      style.textContent = `
        @keyframes alert-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,.8); }
          70%  { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
      `
      document.head.appendChild(style)
    }

    const client  = getAblyClient()
    const channel = client.channels.get(CHANNELS.events)

    channel.subscribe('alert.critical', (msg: Ably.Message) => {
      const alerts: CriticalAlert[] = Array.isArray(msg.data) ? msg.data : [msg.data]
      alerts.forEach(addAlert)
    })

    return () => {
      channel.unsubscribe('alert.critical')
      markersRef.current.forEach(({ marker, timer }) => {
        clearTimeout(timer)
        marker.remove()
      })
      markersRef.current.clear()
    }
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
