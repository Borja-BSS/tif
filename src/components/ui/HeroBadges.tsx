interface HeroBadgesProps {
  items: string[]
  className?: string
}

export function HeroBadges({ items, className = '' }: HeroBadgesProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-1 text-sm ${className}`}
      style={{ color: 'var(--text-tertiary)' }}
    >
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="opacity-40">·</span>}
          {item}
        </span>
      ))}
    </div>
  )
}
