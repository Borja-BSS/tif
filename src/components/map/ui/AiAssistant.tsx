'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

function formatMsg(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // **bold** → bold
    .replace(/\*(.*?)\*/g,    '$1')   // *italic* → italic
    .replace(/^- /gm,         '• ')   // - item → • item
}

const SUGGESTIONS = [
  "Quelle douane est la moins encombrée en ce moment ?",
  "Genève Triathlon ce week-end : quelles routes sont fermées ?",
  "Où voir un match de la Coupe du monde à Genève ?",
  "Quels événements à Genève ce week-end ?",
]

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
          data-onboarding="ai-btn"
          className="w-11 h-11 rounded-xl flex items-center justify-center
            bg-white/80 dark:bg-white/10
            border border-black/10 dark:border-white/20
            shadow-md"
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
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
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#0d0d11]">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b border-black/10 dark:border-white/10">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(94,92,230,0.15)', border: '1px solid rgba(94,92,230,0.3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
                  fill="rgba(94,92,230,0.9)"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Assistant TIF</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[11px] text-gray-500 dark:text-white/50">Données live · Mobilité Grand Genève</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-xl
                bg-black/5 dark:bg-white/10
                text-gray-600 dark:text-white/70"
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
                <p className="text-sm text-center py-4 text-gray-500 dark:text-white/50">
                  Pose une question sur la mobilité du Grand Genève
                </p>
                <p className="text-[11px] text-center text-gray-400 dark:text-white/30 -mt-2 mb-1">
                  Douanes, transports, itinéraires, événements — périmètre Grand Genève uniquement
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="text-left text-[13px] rounded-2xl px-4 py-3
                        bg-gray-100 dark:bg-white/8
                        border border-black/8 dark:border-white/10
                        text-gray-800 dark:text-white
                        active:opacity-70">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'text-white rounded-br-md'
                      : 'text-gray-800 dark:text-white rounded-bl-md bg-gray-100 dark:bg-white/10 border border-black/8 dark:border-white/10'
                  }`}
                  style={m.role === 'user' ? {
                    background: 'rgba(94,92,230,0.85)',
                  } : {
                    whiteSpace: 'pre-wrap',
                  }}>
                  {m.role === 'assistant'
                    ? (formatMsg(m.content) || (m.streaming && (
                        <span className="inline-flex gap-1 items-center text-gray-400 dark:text-white/40">
                          <span className="w-1.5 h-1.5 rounded-full animate-bounce bg-current" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full animate-bounce bg-current" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full animate-bounce bg-current" style={{ animationDelay: '300ms' }} />
                        </span>
                      )))
                    : m.content
                  }
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-black/10 dark:border-white/10"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center gap-2 rounded-2xl px-4 py-2
              bg-gray-100 dark:bg-white/8
              border border-black/10 dark:border-white/15">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Pose une question..."
                disabled={busy}
                className="flex-1 bg-transparent text-sm outline-none
                  text-gray-900 dark:text-white
                  placeholder:text-gray-400 dark:placeholder:text-white/35"
              />
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-40"
                style={{
                  background: input.trim() && !busy ? 'rgba(94,92,230,0.9)' : 'rgba(128,128,128,0.2)',
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
