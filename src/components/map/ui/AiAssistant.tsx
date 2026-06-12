'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

const SUGGESTIONS = [
  "Quelles douanes sont ouvertes ce week-end ?",
  "Comment aller à Évian en transport ?",
  "Y a-t-il des événements gratuits à Genève ?",
  "A1 vers Bardonnex : quelle alternative ?",
]

const LG: React.CSSProperties = {
  background:           'rgba(18,18,22,0.92)',
  backdropFilter:       'blur(48px) saturate(200%) brightness(1.05)',
  WebkitBackdropFilter: 'blur(48px) saturate(200%) brightness(1.05)',
}

export function AiAssistant() {
  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input,    setInput]    = useState('')
  const [busy,     setBusy]     = useState(false)
  const abortRef   = useRef<AbortController | null>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300)
  }, [open])

  const send = useCallback(async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setInput('')

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: q },
    ]
    setMessages([...newMessages, { role: 'assistant', content: '', streaming: true }])
    setBusy(true)

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: ctrl.signal,
      })

      if (!res.ok || !res.body) throw new Error('Erreur réseau')

      const reader = res.body.getReader()
      const dec    = new TextDecoder()
      let acc      = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = dec.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)
          if (raw === '[DONE]') break

          try {
            const obj = JSON.parse(raw) as { text?: string; error?: string }
            if (obj.text) {
              acc += obj.text
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = { role: 'assistant', content: acc, streaming: true }
                return copy
              })
            }
          } catch { /* skip malformed */ }
        }
      }

      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: acc, streaming: false }
        return copy
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = {
          role: 'assistant',
          content: "Désolé, une erreur s'est produite. Réessaie dans un moment.",
          streaming: false,
        }
        return copy
      })
    } finally {
      setBusy(false)
    }
  }, [messages, busy])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <>
      {/* Floating button */}
      <div className="fixed z-30" style={{ left: 16, bottom: 'calc(56px + 24px)' }}>
        <button
          onClick={() => setOpen(true)}
          aria-label="Assistant IA"
          style={{
            width: 44, height: 44,
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: open ? 'rgba(94,92,230,0.25)' : 'rgba(255,255,255,0.07)',
            border: open ? '0.5px solid rgba(94,92,230,0.6)' : '0.5px solid rgba(255,255,255,0.22)',
            backdropFilter:       'blur(40px) saturate(200%) brightness(1.06)',
            WebkitBackdropFilter: 'blur(40px) saturate(200%) brightness(1.06)',
            boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.28), 0 4px 20px rgba(0,0,0,0.12)',
            cursor: 'pointer',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
              fill="rgba(94,92,230,0.9)" stroke="rgba(94,92,230,0.6)" strokeWidth="0.5"/>
            <path d="M19 17L19.8 19.2L22 20L19.8 20.8L19 23L18.2 20.8L16 20L18.2 19.2L19 17Z"
              fill="rgba(94,92,230,0.7)"/>
          </svg>
        </button>
      </div>

      {/* Chat panel overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={LG}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '0.5px solid rgba(255,255,255,0.12)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(94,92,230,0.2)', border: '0.5px solid rgba(94,92,230,0.4)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
                  fill="rgba(94,92,230,0.9)"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Assistant TIF</p>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>G7 Grand Genève · Fable 5</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-xl"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--text-secondary)' }}
              aria-label="Fermer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>
                  Pose une question sur la mobilité G7
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="text-left text-[13px] rounded-2xl px-4 py-3"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '0.5px solid rgba(255,255,255,0.12)',
                        color: 'var(--text-primary)',
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                  style={m.role === 'user' ? {
                    background: 'rgba(94,92,230,0.25)',
                    border: '0.5px solid rgba(94,92,230,0.35)',
                    color: '#fff',
                    borderBottomRightRadius: 6,
                  } : {
                    background: 'rgba(255,255,255,0.07)',
                    border: '0.5px solid rgba(255,255,255,0.12)',
                    color: 'var(--text-primary)',
                    borderBottomLeftRadius: 6,
                  }}>
                  {m.content || (m.streaming && (
                    <span className="inline-flex gap-1 items-center" style={{ color: 'var(--text-tertiary)' }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'currentColor', animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'currentColor', animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'currentColor', animationDelay: '300ms' }} />
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-4 pb-safe-bottom py-3"
            style={{ borderTop: '0.5px solid rgba(255,255,255,0.10)' }}>
            <div className="flex items-center gap-2 rounded-2xl px-4 py-2"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '0.5px solid rgba(255,255,255,0.15)',
              }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Pose une question..."
                disabled={busy}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity"
                style={{
                  background: input.trim() && !busy ? 'rgba(94,92,230,0.8)' : 'rgba(255,255,255,0.08)',
                  opacity: busy ? 0.5 : 1,
                }}
                aria-label="Envoyer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
