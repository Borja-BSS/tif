'use client'

import { useEffect, useState, useCallback } from 'react'

interface ConsentState {
  location:       boolean
  mobility:       boolean
  devicePresence: boolean
}

const LABELS: Record<keyof ConsentState, { title: string; desc: string }> = {
  location:       { title: 'Position approximative', desc: 'Zone de ~800 m (geohash6) — jamais la position exacte' },
  mobility:       { title: 'Vitesse de déplacement', desc: 'Catégorie de vitesse seulement (arrêt / lent / rapide…)' },
  devicePresence: { title: 'Présence anonyme',        desc: 'Être comptabilisé dans la densité de zone, sans identifiant' },
}

export default function ConsentToggles() {
  const [consent, setConsent] = useState<ConsentState>({
    location: false, mobility: false, devicePresence: false,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/v1/consent')
      .then(r => r.json())
      .then((data: ConsentState) => setConsent(data))
      .catch(() => {})
  }, [])

  const toggle = useCallback(async (key: keyof ConsentState) => {
    const next = { ...consent, [key]: !consent[key] }
    setConsent(next)
    setSaving(true)
    try {
      await fetch('/api/v1/consent', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(next),
      })
    } catch {
      // Revert optimistic update
      setConsent(consent)
    } finally {
      setSaving(false)
    }
  }, [consent])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-white/40 uppercase tracking-widest font-mono mb-1">
        Participation anonyme
      </p>

      {(Object.keys(LABELS) as (keyof ConsentState)[]).map(key => (
        <button
          key={key}
          onClick={() => toggle(key)}
          disabled={saving}
          className="flex items-start gap-3 rounded-xl bg-white/5 hover:bg-white/8 px-4 py-3 text-left transition-colors"
        >
          {/* Toggle pill */}
          <span
            className={[
              'mt-0.5 flex-shrink-0 w-8 h-4 rounded-full transition-colors',
              consent[key] ? 'bg-blue-500' : 'bg-white/20',
            ].join(' ')}
          >
            <span
              className={[
                'block w-3 h-3 rounded-full bg-white shadow transition-transform mt-0.5',
                consent[key] ? 'translate-x-4.5' : 'translate-x-0.5',
              ].join(' ')}
            />
          </span>

          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-white/85">
              {LABELS[key].title}
            </span>
            <span className="text-[11px] text-white/40 font-mono leading-relaxed">
              {LABELS[key].desc}
            </span>
          </span>
        </button>
      ))}

      <p className="text-[10px] text-white/25 font-mono leading-relaxed px-1">
        Chaque paramètre est indépendant. Révocation immédiate. Aucune donnée
        identifiante ne transite — ADR-002 RGPD.
      </p>
    </div>
  )
}
