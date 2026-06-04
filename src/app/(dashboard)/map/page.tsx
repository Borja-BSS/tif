import type { Metadata } from 'next'
import Link from 'next/link'
import MapView from '@/components/map/MapView'

export const metadata: Metadata = { title: 'Carte Live' }

export default function MapPage() {
  return (
    <div className="flex flex-col h-[100dvh] bg-[#0d0d10]">
      {/*
        Header — compact sur mobile (2 éléments max),
        navigation complète sur desktop
      */}
      <header
        className="flex items-center justify-between shrink-0
                   px-4 py-2 sm:px-5 sm:py-3
                   border-b border-white/[0.05]"
        style={{
          background:           'rgba(10,10,13,0.80)',
          backdropFilter:       'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        }}
      >
        {/* Logo + titre */}
        <div className="flex items-center gap-2.5">
          <span className="text-[9px] font-mono tracking-[0.2em] text-white/25 uppercase">TIF</span>
          <span className="w-px h-3 bg-white/[0.08]" />
          {/* Full title on desktop, abbreviated on mobile */}
          <span className="text-[11px] sm:text-sm font-medium text-white/70">
            <span className="hidden sm:inline">G7 Live View — Grand Genève</span>
            <span className="sm:hidden">Grand Genève</span>
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Nav links — desktop only */}
          <nav className="hidden sm:flex items-center gap-3 text-[11px] font-mono">
            <Link href="/map"    className="text-white/80">Carte</Link>
            <Link href="/alerts" className="text-white/45 hover:text-white/80 transition-colors">Alertes</Link>
            <Link href="/veille" className="text-white/45 hover:text-white/80 transition-colors">Veille G7</Link>
            <Link href="/admin"  className="text-white/45 hover:text-white/80 transition-colors">Admin</Link>
          </nav>

          {/* Live indicator dot — minimal, text is in MapControls pill */}
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />

          {/* Mobile menu button — shows nav links on tap */}
          <MobileMenu />
        </div>
      </header>

      {/* Map — takes all remaining height */}
      <div className="flex-1 relative overflow-hidden">
        <MapView
          initialLat={46.2044}
          initialLng={6.1432}
          initialZoom={11}
        />
      </div>
    </div>
  )
}

// ── Mobile hamburger menu ─────────────────────────────────────────────────────
function MobileMenu() {
  // Server component — use details/summary for zero-JS toggle
  return (
    <details className="relative sm:hidden">
      <summary
        className="list-none w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer
                   select-none transition-colors active:bg-white/10"
        style={{ color: 'rgba(255,255,255,0.45)' }}
      >
        {/* Hamburger icon */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
          <rect y="0"  width="16" height="1.5" rx="1"/>
          <rect y="5"  width="12" height="1.5" rx="1"/>
          <rect y="10" width="16" height="1.5" rx="1"/>
        </svg>
      </summary>

      {/* Dropdown menu — Liquid Glass */}
      <div
        className="absolute right-0 top-10 w-44 rounded-2xl overflow-hidden z-50 py-1"
        style={{
          background:           'rgba(18,18,22,0.92)',
          backdropFilter:       'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border:               '1px solid rgba(255,255,255,0.13)',
          boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.13), 0 16px 48px rgba(0,0,0,0.6)',
        }}
      >
        {[
          { href: '/map',    label: 'Carte',    active: true },
          { href: '/alerts', label: 'Alertes',  active: false },
          { href: '/veille', label: 'Veille G7',active: false },
          { href: '/admin',  label: 'Admin',    active: false },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center px-4 py-3 text-sm transition-colors hover:bg-white/[0.05] active:bg-white/10"
            style={{ color: item.active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)' }}
          >
            {item.label}
            {item.active && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </Link>
        ))}
      </div>
    </details>
  )
}
