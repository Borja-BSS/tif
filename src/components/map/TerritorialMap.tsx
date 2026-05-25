'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { FeatureCollection } from 'geojson'

type LayerId = 'mobility' | 'transport' | 'alerts' | 'territory'

const LAYERS: { id: LayerId; label: string; icon: string }[] = [
  { id: 'mobility',  label: 'Mobilité',  icon: '🚗' },
  { id: 'transport', label: 'Transport',  icon: '🚌' },
  { id: 'alerts',    label: 'Alertes',    icon: '⚠️' },
  { id: 'territory', label: 'Territoire', icon: '🗺️' },
]

const REFRESH_MS: Record<LayerId, number> = {
  mobility:  30_000,
  transport: 15_000,
  alerts:    60_000,
  territory: 120_000,
}

// Mapbox layer / source IDs par couche
const LAYER_DEFS: Record<LayerId, { sources: string[]; layers: string[] }> = {
  mobility:  { sources: ['mobility'],  layers: ['mobility-lines'] },
  transport: { sources: ['transport'], layers: ['transport-circles', 'transport-labels'] },
  alerts:    { sources: ['alerts'],    layers: ['alerts-symbols'] },
  territory: { sources: ['territory'], layers: ['territory-symbols'] },
}

function injectPopupStyle() {
  if (document.getElementById('tif-popup-style')) return
  const s = document.createElement('style')
  s.id = 'tif-popup-style'
  s.textContent = `
    .tif-popup .mapboxgl-popup-content {
      background: rgba(15,15,20,.92);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 10px;
      padding: 10px 12px;
      backdrop-filter: blur(12px);
    }
    .tif-popup .mapboxgl-popup-tip { border-top-color: rgba(15,15,20,.92); }
  `
  document.head.appendChild(s)
}

export function TerritorialMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const loadedRef    = useRef(false)
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  const [activeLayer, setActiveLayer] = useState<LayerId>('mobility')
  const [isReady, setIsReady]         = useState(false)

  // ── Init Mapbox ───────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    const map = new mapboxgl.Map({
      container:  containerRef.current,
      style:      'mapbox://styles/mapbox/dark-v11',
      center:     [6.1432, 46.2044],
      zoom:       11,
      minZoom:    9,
      maxZoom:    17,
      projection: 'globe',
      antialias:  true,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-right')

    map.on('load', () => {
      map.setFog({ color: '#0d0d10', 'space-color': '#000005', 'star-intensity': 0.3 })
      loadedRef.current = true
      setIsReady(true)
    })

    mapRef.current = map
    injectPopupStyle()

    return () => {
      map.remove()
      mapRef.current  = null
      loadedRef.current = false
    }
  }, [])

  // ── Cleanup d'une couche ───────────────────────────────────────
  const clearLayer = useCallback((id: LayerId) => {
    const m = mapRef.current
    if (!m) return
    const { layers, sources } = LAYER_DEFS[id]
    layers.forEach(l  => { if (m.getLayer(l))   m.removeLayer(l)   })
    sources.forEach(s => { if (m.getSource(s))  m.removeSource(s)  })
  }, [])

  // ── Chargement + rendu d'une couche ───────────────────────────
  const loadLayer = useCallback(async (id: LayerId) => {
    const m = mapRef.current
    if (!m || !loadedRef.current) return

    // Vider les layers existants de cette couche
    clearLayer(id)

    let geojson: FeatureCollection
    try {
      const res = await fetch(`/api/v1/layers/${id}`)
      if (!res.ok) throw new Error(`${res.status}`)
      geojson = await res.json() as FeatureCollection
    } catch (err) {
      console.error(`[TIF] layer ${id} fetch error:`, err)
      return
    }

    // Vérifier que la carte est toujours là après l'await
    if (!mapRef.current || !loadedRef.current) return

    m.addSource(id, { type: 'geojson', data: geojson })

    if (id === 'mobility') {
      m.addLayer({
        id:     'mobility-lines',
        type:   'line',
        source: 'mobility',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint:  {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2, 12, 4, 15, 7],
          'line-opacity': 0.85,
        },
      })
    }

    if (id === 'transport') {
      m.addLayer({
        id:     'transport-circles',
        type:   'circle',
        source: 'transport',
        paint:  {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 9, 4, 13, 8],
          'circle-color':        ['get', 'color'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity':      0.9,
        },
      })
      m.addLayer({
        id:       'transport-labels',
        type:     'symbol',
        source:   'transport',
        minzoom:  13,
        layout:   {
          'text-field':  ['get', 'routeId'],
          'text-size':   10,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
        },
        paint: {
          'text-color':       '#FFFFFF',
          'text-halo-color':  'rgba(0,0,0,0.7)',
          'text-halo-width':  1,
        },
      })
    }

    if (id === 'alerts' || id === 'territory') {
      const layerId = `${id}-symbols`
      m.addLayer({
        id:     layerId,
        type:   'symbol',
        source: id,
        layout: {
          'text-field':          ['get', 'icon'],
          'text-size':           ['interpolate', ['linear'], ['zoom'], 9, 16, 13, 24],
          'text-anchor':         'center',
          'text-allow-overlap':  false,
        },
      })

      // Popup au clic
      m.on('click', layerId, (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        if (!e.features?.length) return
        const props = e.features[0].properties ?? {}
        const geo   = e.features[0].geometry as { type: string; coordinates: [number, number] }
        if (geo.type !== 'Point') return

        new mapboxgl.Popup({ maxWidth: '280px', className: 'tif-popup', closeButton: false })
          .setLngLat(geo.coordinates)
          .setHTML(`
            <div style="font-family:-apple-system,SF Pro Text,sans-serif;font-size:13px;line-height:1.5">
              <div style="font-weight:600;margin-bottom:4px">
                ${props.icon ?? '⚠️'} ${String(props.type ?? 'Incident').replace(/_/g,' ')}
              </div>
              <div style="color:rgba(255,255,255,.75)">
                ${String(props.description ?? '')}
              </div>
              ${props.startTime ? `
              <div style="color:rgba(255,255,255,.35);font-size:11px;margin-top:6px">
                ${new Date(String(props.startTime)).toLocaleTimeString('fr-CH',{hour:'2-digit',minute:'2-digit'})} UTC
                ${props.endTime ? '→ ' + new Date(String(props.endTime)).toLocaleTimeString('fr-CH',{hour:'2-digit',minute:'2-digit'}) : ''}
              </div>` : ''}
            </div>
          `)
          .addTo(m)
      })

      m.on('mouseenter', layerId, () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', layerId, () => { m.getCanvas().style.cursor = '' })
    }
  }, [clearLayer])

  // ── Auto-refresh quand activeLayer change ─────────────────────
  useEffect(() => {
    if (!isReady) return

    loadLayer(activeLayer)

    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      loadLayer(activeLayer)
    }, REFRESH_MS[activeLayer])

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [activeLayer, isReady, loadLayer])

  // ── Toggle handler ────────────────────────────────────────────
  const toggle = (id: LayerId) => {
    if (id === activeLayer) return  // bouton actif = ne rien faire
    clearLayer(activeLayer)
    setActiveLayer(id)
  }

  return (
    <div className="relative w-full h-full bg-black">
      {/* Carte Mapbox */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Spinner avant load */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d10] z-10">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Layer toggles — style Apple Maps */}
      <div className="absolute bottom-8 left-4 flex flex-col gap-2 z-10">
        {LAYERS.map(layer => {
          const active = activeLayer === layer.id
          return (
            <button
              key={layer.id}
              onClick={() => toggle(layer.id)}
              className={[
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium',
                'backdrop-blur-xl border transition-all duration-200 min-w-[118px]',
                active
                  ? 'bg-white/20 border-white/40 text-white shadow-lg scale-105'
                  : 'bg-black/50 border-white/10 text-white/55 hover:bg-black/65 hover:text-white/80',
              ].join(' ')}
            >
              <span>{layer.icon}</span>
              <span className="flex-1">{layer.label}</span>
              {active && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          )
        })}
      </div>

      {/* Badge Live */}
      <div className="absolute top-4 left-4 z-10">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-mono text-white/50 tracking-wide">Live</span>
        </div>
      </div>
    </div>
  )
}
