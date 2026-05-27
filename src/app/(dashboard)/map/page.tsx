import type { Metadata } from 'next'
import Link from 'next/link'
import MapView from '@/components/map/MapView'

export const metadata: Metadata = { title: 'Carte Live' }

export default function MapPage() {
  return (
    <div className="flex flex-col h-screen bg-[#0d0d10]">
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono tracking-[0.18em] text-white/30 uppercase">TIF</span>
          <span className="w-px h-3 bg-white/10" />
          <span className="text-sm font-medium text-white/80">G7 Live View — Grand Genève</span>
        </div>
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-3 text-[11px] font-mono">
            <Link href="/map"     className="text-white/80">Carte</Link>
            <Link href="/alerts"  className="text-white/50 hover:text-white/80 transition-colors">Alertes</Link>
            <Link href="/veille"  className="text-white/50 hover:text-white/80 transition-colors">Veille G7</Link>
            <Link href="/admin"   className="text-white/50 hover:text-white/80 transition-colors">Admin</Link>
          </nav>
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-400/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        </div>
      </header>

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
