import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { BorjaTitle } from '@/components/ui/BorjaTitle'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { Card } from '@/components/ui/Card'

export const metadata: Metadata = { title: 'Flash Infos' }

export default function InfosPage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Header />

      {/* Hero */}
      <section className="px-6 md:px-8 py-16 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <SectionLabel className="mb-0">Centre de renseignement · Grand Genève</SectionLabel>
          <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
            style={{ background: 'var(--brand-subtle)', color: 'var(--brand)', border: '1px solid var(--brand-glow)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--brand)' }} />
            Live
          </span>
        </div>
        <BorjaTitle as="h1" accent="direct." className="mb-4">
          Informations en
        </BorjaTitle>
        <p className="text-[17px] leading-[1.65] max-w-xl" style={{ color: 'var(--text-secondary)' }}>
          Toutes les perturbations, alertes et informations territoriales du Grand Genève, agrégées en temps réel.
        </p>
      </section>

      {/* Content */}
      <section className="px-6 md:px-8 pb-24 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Feed principal */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase mb-4"
              style={{ color: 'var(--text-tertiary)' }}>
              Dernières informations
            </h2>

            {/* Placeholder — sera branché sur l'API */}
            <Card variant="featured">
              <SectionLabel className="mb-2">G7 · Priorité haute</SectionLabel>
              <h3 className="text-[17px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Périmètre sécurisé actif — Zone Palais des Nations
              </h3>
              <p className="text-[15px] leading-[1.6] mb-3" style={{ color: 'var(--text-secondary)' }}>
                Restrictions de circulation en vigueur autour du Palais des Nations jusqu'à 20h00.
                Déviations recommandées via Route de Ferney.
              </p>
              <div className="flex items-center gap-4 text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                <span>Source : Police cantonale GE</span>
                <span>·</span>
                <span>Il y a 12 min</span>
              </div>
            </Card>

            {[
              { title: 'Congestion A1 Genève-Lausanne', cat: 'Trafic', time: '18 min', desc: 'Ralentissements importants entre Nyon et Genève-Meyrin. Temps de parcours +25 min.' },
              { title: 'Perturbation TPG ligne 12', cat: 'Transport', time: '34 min', desc: 'Interruption entre Plainpalais et Carouge suite à un incident. Bus de remplacement en cours.' },
              { title: 'Attente frontière Bardonnex', cat: 'Frontière', time: '1h02', desc: 'Temps d\'attente estimé : 22 minutes côté suisse, 8 minutes côté français.' },
            ].map((item, i) => (
              <Card key={i} variant="default">
                <div className="flex items-start gap-3">
                  <div
                    className="w-1 self-stretch rounded-full flex-shrink-0"
                    style={{ background: i === 0 ? 'var(--red)' : i === 1 ? 'var(--orange)' : 'var(--yellow)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                        {item.cat}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                      {item.title}
                    </h3>
                    <p className="text-[14px] leading-[1.5] mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {item.desc}
                    </p>
                    <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                      Il y a {item.time}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Sidebar sources */}
          <div className="space-y-4">
            <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase mb-4"
              style={{ color: 'var(--text-tertiary)' }}>
              Sources actives
            </h2>

            {[
              { name: 'SIG Genève', status: 'OK', latency: '3 min', color: 'var(--green)' },
              { name: 'CFF / SBB GTFS-RT', status: 'OK', latency: '1 min', color: 'var(--green)' },
              { name: 'HERE Traffic', status: 'OK', latency: '2 min', color: 'var(--green)' },
              { name: 'Waze for Cities', status: 'OK', latency: '5 min', color: 'var(--green)' },
              { name: 'Frontières GE', status: 'Délai', latency: '8 min', color: 'var(--yellow)' },
            ].map((src) => (
              <Card key={src.name} variant="bordered" style={{ padding: '16px 20px' }}>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: src.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>
                      {src.name}
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      Actualisé il y a {src.latency}
                    </div>
                  </div>
                  <span className="text-[11px]" style={{ color: src.color }}>{src.status}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
