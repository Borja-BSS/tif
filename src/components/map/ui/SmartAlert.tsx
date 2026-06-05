'use client'

import { useState, useEffect, useCallback } from 'react'
import type { InboundMessage } from 'ably'
import { getAblyClient, CHANNELS } from '@/lib/realtime'
import { springs } from '@/lib/animations/springs'

type Severity = 'info' | 'warning' | 'critical'

interface SmartAlertItem {
  id:       string
  severity: Severity
  icon:     string
  headline: string
  action?:  { label: string; href: string }
}

const SEVERITY_STYLE: Record<Severity, React.CSSProperties> = {
  info:     { background: 'rgba(10,132,255,0.12)',  borderColor: 'rgba(10,132,255,0.35)' },
  warning:  { background: 'rgba(255,159,10,0.12)', borderColor: 'rgba(255,159,10,0.35)' },
  critical: { background: 'rgba(255,69,58,0.15)',   borderColor: 'rgba(255,69,58,0.45)' },
}

export function SmartAlertManager() {
  const [alerts, setAlerts] = useState<SmartAlertItem[]>([])

  const pushAlert = useCallback((alert: SmartAlertItem) => {
    setAlerts(prev => {
      if (prev.find(a => a.id === alert.id)) return prev
      return [...prev.slice(-1), alert]
    })
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== alert.id))
    }, 8000)
  }, [])

  const dismiss = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  useEffect(() => {
    let client: ReturnType<typeof getAblyClient> | null = null
    try {
      client = getAblyClient()
      const alertChannel  = client.channels.get('alerts:critical')
      const eventsChannel = client.channels.get(CHANNELS.events)

      alertChannel.subscribe('alert', (msg: InboundMessage) => {
        if (msg.data) pushAlert(msg.data as SmartAlertItem)
      })

      eventsChannel.subscribe('critical', (msg: InboundMessage) => {
        if (msg.data) {
          const d = msg.data as { id: string; titleFr: string }
          pushAlert({ id: d.id, severity: 'critical', icon: '🚨', headline: d.titleFr })
        }
      })

      return () => {
        alertChannel.unsubscribe()
        eventsChannel.unsubscribe()
      }
    } catch {
      return undefined
    }
  }, [pushAlert])

  if (alerts.length === 0) return null

  return (
    <div className="fixed left-4 right-4 z-25 flex flex-col gap-2" style={{ top: 'calc(52px + 12px + 40px + 8px)', zIndex: 25 }}>
      {alerts.map(alert => (
        <div
          key={alert.id}
          className="flex items-center gap-3 rounded-2xl px-4 border"
          style={{
            ...SEVERITY_STYLE[alert.severity],
            height: 52,
            animation: `slideDown ${springs.alertIn} forwards`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <span className="text-[18px] flex-shrink-0">{alert.icon}</span>
          <span className="flex-1 text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {alert.headline}
          </span>
          {alert.action && (
            <a
              href={/^https?:\/\//i.test(alert.action.href) || alert.action.href.startsWith('/') ? alert.action.href : '#'}
              className="text-[12px] font-bold flex-shrink-0"
              style={{ color: 'var(--brand)' }}
              rel="noopener noreferrer"
            >
              {alert.action.label}
            </a>
          )}
          <button onClick={() => dismiss(alert.id)} className="flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 1l8 8M9 1L1 9"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
