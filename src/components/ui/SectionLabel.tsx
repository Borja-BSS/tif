interface SectionLabelProps {
  number?: string
  children: React.ReactNode
  className?: string
}

export function SectionLabel({ number, children, className = '' }: SectionLabelProps) {
  return (
    <div
      className={`borja-label flex items-center gap-2 mb-6 ${className}`}
      style={{ color: 'var(--text-tertiary)' }}
    >
      {number && <span>{number}</span>}
      <span>{children}</span>
    </div>
  )
}
