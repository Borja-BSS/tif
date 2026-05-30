interface BorjaTitleProps {
  as?: 'h1' | 'h2' | 'h3'
  accent: string
  children: React.ReactNode
  className?: string
}

export function BorjaTitle({ as: Tag = 'h1', accent, children, className = '' }: BorjaTitleProps) {
  const sizes: Record<string, string> = {
    h1: 'text-[40px] md:text-[64px] leading-[1.05] tracking-[-0.02em] font-bold',
    h2: 'text-[32px] md:text-[48px] leading-[1.1] tracking-[-0.015em] font-bold',
    h3: 'text-[22px] md:text-[28px] leading-[1.2] tracking-[-0.01em] font-semibold',
  }

  return (
    <Tag
      className={`borja-title ${sizes[Tag]} ${className}`}
      style={{ color: 'var(--text-primary)', fontFamily: '-apple-system, Inter, sans-serif' }}
    >
      {children}{' '}
      <em style={{ fontStyle: 'italic', color: 'var(--italic)', fontWeight: 700 }}>
        {accent}
      </em>
    </Tag>
  )
}
