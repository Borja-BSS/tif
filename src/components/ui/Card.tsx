interface CardProps {
  variant?: 'default' | 'glass' | 'bordered' | 'featured'
  className?: string
  children: React.ReactNode
  style?: React.CSSProperties
}

const variantStyles: Record<string, React.CSSProperties> = {
  default: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-sm)',
    padding: '28px',
  },
  glass: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    padding: '28px',
  },
  bordered: {
    background: 'transparent',
    border: '2px solid var(--border)',
    borderRadius: '16px',
    padding: '28px',
    transition: 'border-color 0.2s ease',
  },
  featured: {
    background: 'var(--brand-subtle)',
    border: '1px solid var(--brand)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-md)',
    padding: '28px',
  },
}

export function Card({ variant = 'default', className = '', children, style }: CardProps) {
  return (
    <div
      className={`transition-all duration-200 ${className}`}
      style={{ ...variantStyles[variant], ...style }}
    >
      {children}
    </div>
  )
}
