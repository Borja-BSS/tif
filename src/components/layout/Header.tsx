'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const NAV_LINKS = [
  { href: '/',        label: 'Accueil' },
  { href: '/map',     label: 'Carte Live' },
  { href: '/infos',   label: 'Flash Infos' },
  { href: '/veille',  label: 'Veille G7' },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header
      className="sticky top-0 z-50 h-[60px] flex items-center px-6 md:px-8"
      style={{
        background: 'rgba(var(--bg-raw, 255,255,255), 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'color-mix(in srgb, var(--bg) 85%, transparent)',
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        className="text-[18px] font-bold tracking-tight transition-opacity duration-200 hover:opacity-70 mr-10"
        style={{ color: 'var(--text-primary)', fontFamily: '-apple-system, Inter, sans-serif' }}
      >
        Börja
      </Link>

      {/* Nav desktop */}
      <nav className="hidden md:flex items-center gap-8 flex-1">
        {NAV_LINKS.map(({ href, label }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="text-[15px] transition-colors duration-150 relative"
              style={{
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                textDecoration: 'none',
              }}
            >
              {label}
              {isActive && (
                <span
                  className="absolute -bottom-[18px] left-0 right-0 h-[2px]"
                  style={{ background: 'var(--brand)' }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        <Link
          href="/login"
          className="hidden md:inline-flex items-center text-[14px] font-medium transition-colors duration-150"
          style={{ color: 'var(--text-secondary)' }}
        >
          Se connecter
        </Link>
        <Link
          href="/register"
          className="hidden md:inline-flex items-center justify-center text-[14px] font-medium px-4 py-2 rounded-[12px] transition-all duration-200"
          style={{
            background: 'var(--text-primary)',
            color: 'var(--bg)',
            borderRadius: '12px',
          }}
        >
          Créer un compte →
        </Link>
      </div>
    </header>
  )
}
