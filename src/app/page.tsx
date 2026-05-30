import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { BorjaTitle } from '@/components/ui/BorjaTitle'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { StatRow } from '@/components/ui/StatRow'
import { HeroBadges } from '@/components/ui/HeroBadges'
import { Card } from '@/components/ui/Card'

export const metadata: Metadata = { title: 'Intelligence Territoriale · Grand Genève' }

const FEATURES = [
  { icon: '🚦', title: 'Trafic temps réel', desc: 'Congestion, incidents et fluidité sur tout le Grand Genève en continu.' },
  { icon: '🛂', title: 'Passages frontière', desc: 'Temps d\'attente aux 8 postes frontaliers franco-suisses, mis à jour toutes les 5 minutes.' },
  { icon: '🚌', title: 'Transport public', desc: 'TPG, CFF et lignes transfrontalières — retards et perturbations en direct.' },
  { icon: '🏛️', title: 'Veille G7', desc: 'Alertes territoriales et événements officiels impactant la mobilité.' },
]

const SOURCES = [
  { level: '01', title: 'Sources officielles', items: ['SITG Geneva', 'CFF / SBB', 'TPG', 'OFROU / ASTRA'] },
  { level: '02', title: 'Open data publiques', items: ['OpenTransportData.swiss', 'HERE Maps', 'Waze for Cities', 'MétéoSuisse'] },
  { level: '03', title: 'Réseau Börja', items: ['Capteurs anonymes', 'Signalements communauté', 'Corrélation terrain'] },
]

export default function HomePage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Header />

      {/* ─── HERO ──────────────────────────────────────────────────── */}
      <section className="px-6 md:px-8 py-24 md:py-32 max-w-6xl mx-auto">
        <SectionLabel>Intelligence Territoriale · Grand Genève</SectionLabel>

        <BorjaTitle as="h1" accent="temps réel." className="max-w-3xl mb-6">
          Le Grand Genève en
        </BorjaTitle>

        <p className="text-[17px] leading-[1.65] max-w-xl mb-10" style={{ color: 'var(--text-secondary)' }}>
          Trafic, frontières, transport public et alertes en direct.<br />
          Avant les sources officielles. Avant Google Maps.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-8">
          <Link
            href="/map"
            className="inline-flex items-center justify-center text-[17px] font-medium px-7 py-4 rounded-[14px] transition-all duration-200"
            style={{ background: 'var(--text-primary)', color: 'var(--bg)', borderRadius: '14px' }}
          >
            Voir la carte live →
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center text-[17px] font-medium px-7 py-4 rounded-[14px] transition-all duration-200"
            style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '14px' }}
          >
            Créer un compte gratuit
          </Link>
        </div>

        <HeroBadges items={['Données officielles', 'Mise à jour 30s', 'Grand Genève']} />
      </section>

      {/* ─── STATS ─────────────────────────────────────────────────── */}
      <section
        className="px-6 md:px-8 py-16 border-y"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
      >
        <div className="max-w-6xl mx-auto">
          <StatRow stats={[
            { value: 24,  label: 'Zones surveillées',   source: '// Temps réel' },
            { value: 8,   label: 'Passages frontière',  source: '// Grand Genève' },
            { value: 30,  suffix: 's', label: 'Refresh automatique', source: '// SLA TIF' },
            { value: 5,   label: 'Sources de données',  source: '// Officielles' },
          ]} />
        </div>
      </section>

      {/* ─── FONCTIONNALITÉS ───────────────────────────────────────── */}
      <section className="px-6 md:px-8 py-24 max-w-6xl mx-auto">
        <SectionLabel number="01">Carte interactive</SectionLabel>
        <BorjaTitle as="h2" accent="complet." className="mb-4">
          Territoire
        </BorjaTitle>
        <p className="text-[17px] leading-[1.65] max-w-xl mb-12" style={{ color: 'var(--text-secondary)' }}>
          Toutes les couches de données fusionnées sur une carte unique.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {FEATURES.map((f) => (
            <Card key={f.title} variant="default">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="text-[17px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                {f.title}
              </h3>
              <p className="text-[15px] leading-[1.6]" style={{ color: 'var(--text-secondary)' }}>
                {f.desc}
              </p>
            </Card>
          ))}
        </div>

        <Link
          href="/map"
          className="inline-flex items-center text-[15px] font-medium"
          style={{ color: 'var(--brand)' }}
        >
          → Ouvrir la carte live
        </Link>
      </section>

      {/* ─── SOURCES ───────────────────────────────────────────────── */}
      <section
        className="px-6 md:px-8 py-24 border-t"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-6xl mx-auto">
          <SectionLabel number="02">Méthodologie</SectionLabel>
          <BorjaTitle as="h2" accent="vérifiées." className="mb-4">
            Sources
          </BorjaTitle>
          <p className="text-[17px] leading-[1.65] max-w-xl mb-12" style={{ color: 'var(--text-secondary)' }}>
            Aucune donnée inventée. Chaque information est tracée jusqu'à sa source officielle.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SOURCES.map((s) => (
              <Card key={s.level} variant="bordered">
                <SectionLabel number={s.level} className="mb-4">
                  {s.title}
                </SectionLabel>
                <ul className="space-y-2">
                  {s.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-[15px]" style={{ color: 'var(--text-secondary)' }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--brand)' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─────────────────────────────────────────────── */}
      <section className="px-6 md:px-8 py-24 text-center max-w-6xl mx-auto">
        <SectionLabel number="03" className="justify-center">
          Participer
        </SectionLabel>
        <BorjaTitle as="h2" accent="Grand Genève." className="mb-4 text-center">
          Rejoignez le réseau
        </BorjaTitle>
        <p className="text-[17px] leading-[1.65] max-w-md mx-auto mb-10" style={{ color: 'var(--text-secondary)' }}>
          Compte gratuit. Aucune carte de crédit. Données protégées.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center justify-center text-[17px] font-medium px-8 py-4 rounded-[14px] mb-6"
          style={{ background: 'var(--text-primary)', color: 'var(--bg)', borderRadius: '14px' }}
        >
          Créer mon compte gratuit →
        </Link>
        <div className="flex justify-center">
          <HeroBadges items={['RGPD conforme', 'Hébergé en Suisse', 'Données anonymisées']} />
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────────────── */}
      <footer
        className="px-6 md:px-8 py-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-sm"
        style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}
      >
        <span>© 2025 TIF · Börja Swiss Solutions</span>
        <div className="flex items-center gap-6">
          <Link href="/infos" style={{ color: 'var(--text-tertiary)' }}>Flash Infos</Link>
          <Link href="/map" style={{ color: 'var(--text-tertiary)' }}>Carte Live</Link>
          <Link href="/login" style={{ color: 'var(--text-tertiary)' }}>Connexion</Link>
        </div>
        <span>Plateforme non commerciale · RGPD</span>
      </footer>
    </div>
  )
}
