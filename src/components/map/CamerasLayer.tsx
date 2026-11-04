'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FeatureCollection } from 'geojson'

/**
 * Caméras de trafic du canton de Genève (Données SITG, jeu INFOMOB_CAMERA).
 * Aucune image n'est stockée ni relayée : le navigateur charge l'adresse publiée par le jeu.
 * Aucune analyse automatique. Chaque fenêtre affiche le nom, le sens, l'heure de la dernière image et la source.
 */
const SOURCE_ID = 'tif-cameras'
const LAYER_ID  = 'tif-cameras-pt'
const HALO_ID   = 'tif-cameras-halo'
const REFRESH_MS = 60_000

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
  ))
}

function popupHTML(p: Record<string, unknown>): string {
  const url = typeof p.imageUrl === 'string' && /^https:\/\/app2\.ge\.ch\/tercameras\//.test(p.imageUrl) ? p.imageUrl : ''
  const heure = p.imageAt
    ? new Date(String(p.imageAt)).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'heure inconnue'
  return `
    <div style="font-family:-apple-system,SF Pro Text,sans-serif;width:300px">
      <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.07)">
        <div style="font-size:14px;font-weight:700;color:#fff">📷 ${esc(String(p.nom ?? 'Caméra'))}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px">Sens : ${esc(String(p.sens ?? 'non indiqué'))}</div>
      </div>
      ${url ? `<img src="${esc(url)}?t=${Date.now()}" alt="Image de la caméra ${esc(String(p.nom ?? ''))}" referrerpolicy="no-referrer" width="300" style="display:block;width:300px;height:auto;background:#111">` : ''}
      <div style="padding:8px 14px;font-size:11px;color:rgba(255,255,255,0.5);line-height:1.6">
        Dernière image : ${esc(heure)}<br>
        Source : ${esc(String(p.source ?? 'Données SITG'))}
      </div>
    </div>`
}

export default function CamerasLayer({ map }: { map: mapboxgl.Map | null }) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [etat, setEtat] = useState<{ etat: string; n: number } | null>(null)

  useEffect(() => {
    if (!map) return
    let alive = true

    const load = async () => {
      try {
        const res = await fetch('/api/v1/layers/cameras', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
        if (!res.ok) { if (alive) setEtat({ etat: 'reseau', n: 0 }); return }
        const data = await res.json() as FeatureCollection & { etat?: string }
        if (!alive) return
        if (data.etat !== 'ok') { setEtat({ etat: 'source-indisponible', n: 0 }); return }
        const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
        if (src) src.setData(data)
        else {
          map.addSource(SOURCE_ID, { type: 'geojson', data })
          map.addLayer({ id: HALO_ID, type: 'circle', source: SOURCE_ID,
            paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 11, 14, 19], 'circle-color': '#0A84FF', 'circle-opacity': 0.2 } })
          map.addLayer({ id: LAYER_ID, type: 'circle', source: SOURCE_ID,
            paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 5, 14, 8], 'circle-color': '#0A84FF',
              'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 } })
          map.on('click', LAYER_ID, e => {
            if (!e.features?.length) return
            new mapboxgl.Popup({ maxWidth: '330px', className: 'tif-popup', closeButton: true, offset: 10 })
              .setLngLat(e.lngLat).setHTML(popupHTML(e.features[0].properties as Record<string, unknown>)).addTo(map)
          })
          map.on('mouseenter', LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer' })
          map.on('mouseleave', LAYER_ID, () => { map.getCanvas().style.cursor = '' })
        }
        setEtat({ etat: 'ok', n: data.features.length })
      } catch { if (alive) setEtat({ etat: 'reseau', n: 0 }) }
    }

    const start = () => { load(); timerRef.current = setInterval(load, REFRESH_MS) }
    if (map.loaded()) start(); else map.once('load', start)

    return () => {
      alive = false
      if (timerRef.current) clearInterval(timerRef.current)
      try {
        for (const id of [LAYER_ID, HALO_ID]) if (map.getLayer(id)) map.removeLayer(id)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch { /* carte détruite */ }
    }
  }, [map])

  if (!etat || etat.etat === 'ok') return null
  return (
    <div style={{ position: 'absolute', left: 12, bottom: 92, zIndex: 5, padding: '5px 10px', borderRadius: 10, pointerEvents: 'none',
      font: '600 11px -apple-system,SF Pro Text,sans-serif', color: '#FFCC00', background: 'rgba(12,12,18,0.82)', border: '1px solid rgba(255,255,255,0.12)' }}>
      Caméras : source SITG indisponible
    </div>
  )
}
