'use client'

import { useCallback, useState } from 'react'

interface VoiceStatusProps {
  globalStatus:     string
  alertCount:       number
  journeyHeadline?: string
}

export function VoiceStatus({ globalStatus, alertCount, journeyHeadline }: VoiceStatusProps) {
  const [speaking, setSpeaking] = useState(false)

  const speak = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    const statusText = globalStatus === 'calm'
      ? 'Situation normale sur le réseau.'
      : `${alertCount} alerte${alertCount > 1 ? 's' : ''} active${alertCount > 1 ? 's' : ''} sur le réseau.`

    const text = `Grand Genève. ${statusText}${journeyHeadline ? ` Votre trajet : ${journeyHeadline}.` : ''}`

    const utterance  = new SpeechSynthesisUtterance(text)
    utterance.lang   = 'fr-CH'
    utterance.rate   = 0.95
    utterance.pitch  = 1.0

    const voices  = window.speechSynthesis.getVoices()
    const frVoice = voices.find(v => v.lang === 'fr-CH') ?? voices.find(v => v.lang.startsWith('fr'))
    if (frVoice) utterance.voice = frVoice

    utterance.onstart = () => setSpeaking(true)
    utterance.onend   = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }, [globalStatus, alertCount, journeyHeadline])

  return (
    <button
      onClick={speak}
      aria-label="Lire le statut à voix haute"
      style={{
        width: 44, height: 44,
        borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background:           speaking ? 'rgba(10,132,255,0.2)' : 'rgba(18,18,22,0.85)',
        backdropFilter:       'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border:               `1px solid ${speaking ? 'rgba(10,132,255,0.5)' : 'rgba(255,255,255,0.12)'}`,
        boxShadow:            '0 4px 16px rgba(0,0,0,0.30)',
        cursor: 'pointer',
        color: speaking ? '#0A84FF' : 'rgba(255,255,255,0.75)',
        animation: speaking ? 'pulseStatus 1.5s ease-in-out infinite' : 'none',
      }}
    >
      🔊
    </button>
  )
}
