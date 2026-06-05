import type { Metadata } from 'next'
import Link from 'next/link'
import MapView from '@/components/map/MapView'

export const metadata: Metadata = { title: 'TIF — Grand Genève Live' }

export default function MapPage() {
  return (
    // Full-bleed: 100dvh, no flex column, relative container
    <div className="relative w-full h-[100dvh] bg-[#0d0d10] overflow-hidden">

      {/* MAP — fullscreen, absolute fill */}
      <div className="absolute inset-0">
        <MapView initialLat={46.2044} initialLng={6.1432} initialZoom={11} />
      </div>

      {/* FLOATING HEADER — absolute top, gradient strip that fades into the map */}
      <header
        className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between
                   px-4 h-12 sm:h-[52px]"
        style={{
          background: 'linear-gradient(180deg, rgba(10,10,13,0.75) 0%, rgba(10,10,13,0.0) 100%)',
        }}
      >
        {/* Logo — minimal */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono tracking-[0.25em] text-white/40 uppercase select-none">TIF</span>
          <span className="w-px h-3 bg-white/[0.08]" />
          <span className="text-[11px] font-medium text-white/60 hidden sm:inline">Grand Genève</span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-white/40">
            <Link href="/alerts" className="hover:text-white/70 transition-colors">Alertes</Link>
            <Link href="/veille" className="hover:text-white/70 transition-colors">Veille G7</Link>
            <Link href="/admin"  className="hover:text-white/70 transition-colors">Admin</Link>
          </nav>

          {/* Mobile menu — 3-dot, no live badge (it's in the map pill) */}
          <MobileMenu />
        </div>
      </header>
    </div>
  )
}

// ── Mobile 3-dot menu ─────────────────────────────────────────────────────────
function MobileMenu() {
  // Server component — uses details/summary HTML native, zero JS
  return (
    <details className="relative sm:hidden">
      <summary
        className="list-none w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer select-none active:bg-white/10"
        style={{ color: 'rgba(255,255,255,0.35)' }}
      >
        {/* 3 dots horizontal — more Apple than hamburger */}
        <svg width="18" height="4" viewBox="0 0 18 4" fill="currentColor">
          <circle cx="2"  cy="2" r="2"/>
          <circle cx="9"  cy="2" r="2"/>
          <circle cx="16" cy="2" r="2"/>
        </svg>
      </summary>

      <div
        className="absolute right-0 top-10 w-44 rounded-2xl overflow-hidden z-50 py-1"
        style={{
          background:           'rgba(18,18,22,0.94)',
          backdropFilter:       'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border:               '1px solid rgba(255,255,255,0.12)',
          boxShadow:            'inset 0 0.5px 0 rgba(255,255,255,0.1), 0 16px 48px rgba(0,0,0,0.65)',
        }}
      >
        {[
          { href: '/map',    label: 'Carte',     active: true  },
          { href: '/alerts', label: 'Alertes',   active: false },
          { href: '/veille', label: 'Veille G7', active: false },
          { href: '/admin',  label: 'Admin',     active: false },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center px-4 py-3 text-sm transition-colors hover:bg-white/5 active:bg-white/10"
            style={{ color: item.active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)' }}
          >
            {item.label}
            {item.active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
          </Link>
        ))}
      </div>
    </details>
  )
}
