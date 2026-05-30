'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const baseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontFamily: '-apple-system, Inter, sans-serif',
  fontWeight: 500,
  borderRadius: '12px',
  border: '1px solid transparent',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  userSelect: 'none',
  minHeight: '44px',
}

const variantMap: Record<string, React.CSSProperties> = {
  primary:   { background: 'var(--text-primary)', color: 'var(--bg)', border: '1px solid var(--text-primary)' },
  secondary: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
  ghost:     { background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)' },
  danger:    { background: 'var(--red)', color: '#fff', border: '1px solid var(--red)' },
}

const sizeMap: Record<string, React.CSSProperties> = {
  sm: { fontSize: '13px', padding: '6px 14px', minHeight: '36px', borderRadius: '8px' },
  md: { fontSize: '15px', padding: '10px 20px', minHeight: '44px' },
  lg: { fontSize: '17px', padding: '14px 28px', minHeight: '52px', borderRadius: '14px' },
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
    </svg>
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, children, style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={{
          ...baseStyle,
          ...variantMap[variant],
          ...sizeMap[size],
          opacity: disabled || loading ? 0.6 : 1,
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          ...style,
        }}
        {...props}
      >
        {loading && <Spinner />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
