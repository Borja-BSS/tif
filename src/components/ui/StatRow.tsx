'use client'

import { useEffect, useRef, useState } from 'react'

interface Stat {
  value: number | string
  suffix?: string
  label: string
  source?: string
}

interface StatRowProps {
  stats: Stat[]
  className?: string
}

function CountUp({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const start = performance.now()
          function tick(now: number) {
            const progress = Math.min((now - start) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.round(eased * target))
            if (progress < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, duration])

  return <span ref={ref}>{count}</span>
}

export function StatRow({ stats, className = '' }: StatRowProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 ${className}`}>
      {stats.map((stat, i) => (
        <div key={i}>
          <div className="borja-stat-number">
            {typeof stat.value === 'number' ? (
              <CountUp target={stat.value} />
            ) : (
              stat.value
            )}
            {stat.suffix && <span>{stat.suffix}</span>}
          </div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {stat.label}
          </div>
          {stat.source && (
            <div className="borja-stat-source">{stat.source}</div>
          )}
        </div>
      ))}
    </div>
  )
}
