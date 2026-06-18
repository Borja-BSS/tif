import type { Metadata } from 'next'
import { events } from '@/data/events'

const BASE = 'https://tif.borja-swiss-solutions.ch'

export const metadata: Metadata = {
  title: 'Agenda Genève 2026 — Tous les événements du Grand Genève | TIF',
  description: 'Agenda complet des événements à Genève et Grand Genève en 2026 : FIFA World Cup, Paléo Festival, Montreux Jazz, Servette FC, cinéma plein air, expositions et sport. Programme, billets et infos pratiques.',
  keywords: 'agenda Genève 2026, événements Genève, que faire Grand Genève, FIFA World Cup Genève, Paléo Festival, Montreux Jazz, Servette FC, festivals Genève, concerts Genève, cinéma Genève',
  openGraph: {
    title: 'Agenda Genève 2026 — Tous les événements du Grand Genève | TIF',
    description: 'Agenda complet des événements à Genève et Grand Genève en 2026.',
    url: `${BASE}/evenements`,
    type: 'website',
    siteName: 'TIF — Intelligence Territoriale Grand Genève',
    images: [{ url: `${BASE}/borja-og.png`, width: 900, height: 639 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agenda Genève 2026 — Grand Genève | TIF',
    description: 'Tous les événements du Grand Genève : festivals, football, cinéma, sport, culture.',
  },
  alternates: { canonical: `${BASE}/evenements` },
}

const CAT_FR: Record<string, string> = {
  theatre: 'Théâtre', comedie: 'Comédie', concert: 'Concert',
  classique: 'Musique Classique', nightlife: 'Vie Nocturne', danse: 'Danse',
  art: 'Art & Expos', sport: 'Sport', festival: 'Festival',
  football: 'Football', cinema: 'Cinéma',
}

const CAT_COLOR: Record<string, string> = {
  football: '#FF9F0A', festival: '#0A84FF', concert: '#0A84FF',
  classique: '#0A84FF', cinema: '#FF375F', art: '#BF5AF2',
  sport: '#30D158', theatre: '#BF5AF2', danse: '#BF5AF2',
  comedie: '#BF5AF2', nightlife: '#BF5AF2',
}

const MONTHS = [
  { slug: 'juin-2026',      label: 'Juin 2026',      num: '06' },
  { slug: 'juillet-2026',   label: 'Juillet 2026',   num: '07' },
  { slug: 'aout-2026',      label: 'Août 2026',      num: '08' },
  { slug: 'septembre-2026', label: 'Septembre 2026', num: '09' },
  { slug: 'octobre-2026',   label: 'Octobre 2026',   num: '10' },
]

function formatDateShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })
}

export default function AgendaPage() {
  const allWithDates = events
    .filter(e => e.occurrences.length > 0)
    .map(e => {
      const dates = [...new Set(e.occurrences.map(o => o.date))].sort()
      return { ev: e, d0: dates[0], dN: dates[dates.length - 1], count: dates.length }
    })
    .sort((a, b) => a.d0.localeCompare(b.d0))

  // Stats
  const cats = [...new Set(allWithDates.map(x => x.ev.category))]
  const catCounts = cats.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = allWithDates.filter(x => x.ev.category === cat).length
    return acc
  }, {})

  // JSON-LD WebPage + ItemList
  const pageLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Agenda Genève 2026 — Événements Grand Genève',
    description: 'Agenda complet des événements à Genève et dans le Grand Genève en 2026.',
    url: `${BASE}/evenements`,
    provider: {
      '@type': 'Organization',
      name: 'TIF — Intelligence Territoriale Grand Genève',
      url: BASE,
    },
    hasPart: allWithDates.slice(0, 50).map(({ ev }) => ({
      '@type': 'Event',
      name: ev.title,
      url: `${BASE}/evenements/${ev.slug}`,
      location: { '@type': 'Place', name: ev.venue.name, addressLocality: 'Genève', addressCountry: 'CH' },
    })),
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Agenda Événements', item: `${BASE}/evenements` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 24px 64px', fontFamily: 'var(--font-geist-sans, system-ui)', color: 'var(--text-primary, #111)' }}>

        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" style={{ fontSize: 13, color: 'var(--text-secondary, #666)', marginBottom: 28, display: 'flex', gap: 6, alignItems: 'center' }}>
          <a href="/" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Accueil</a>
          <span aria-hidden>›</span>
          <span>Agenda 2026</span>
        </nav>

        {/* Header */}
        <header style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 'clamp(28px, 6vw, 52px)', fontWeight: 800, margin: '0 0 14px', lineHeight: 1.1 }}>
            Agenda Genève 2026<br />
            <span style={{ color: 'var(--blue, #0A84FF)' }}>Grand Genève</span>
          </h1>
          <p style={{ fontSize: 17, color: 'var(--text-secondary, #666)', maxWidth: 720, lineHeight: 1.7, margin: '0 0 28px' }}>
            {allWithDates.length} événements référencés — festivals, football FIFA World Cup, cinéma de plein air,
            concerts, expositions et sport dans le Grand Genève. Programme complet avec billets et accès transports.
          </p>

          {/* Filtres catégories */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
              <a key={cat} href={`/evenements/categorie/${cat}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                  textDecoration: 'none',
                  color: CAT_COLOR[cat] ?? '#666',
                  background: (CAT_COLOR[cat] ?? '#666') + '15',
                  border: `1px solid ${CAT_COLOR[cat] ?? '#666'}30`,
                }}>
                {CAT_FR[cat] ?? cat}
                <span style={{ fontSize: 11, opacity: 0.8 }}>({count})</span>
              </a>
            ))}
          </div>
        </header>

        {/* Navigation par mois */}
        <section aria-label="Agenda par mois" style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>Parcourir par mois</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {MONTHS.map(({ slug, label, num }) => {
              const count = allWithDates.filter(({ ev }) =>
                ev.occurrences.some(o => o.date.startsWith(`2026-${num}`))
              ).length
              return (
                <a key={slug} href={`/evenements/agenda/${slug}`}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 4,
                    padding: '18px 20px', borderRadius: 14, textDecoration: 'none',
                    background: 'var(--bg-card, #f5f5f5)', border: '1px solid var(--border, #e0e0e0)',
                    color: 'var(--text-primary, #111)', transition: 'border-color 0.15s',
                  }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{label}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary, #666)' }}>{count} événements</span>
                  <span style={{ fontSize: 13, color: 'var(--blue, #0A84FF)', fontWeight: 600, marginTop: 4 }}>Voir l&apos;agenda →</span>
                </a>
              )
            })}
          </div>
        </section>

        {/* Liste complète */}
        <section aria-label="Tous les événements">
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px' }}>
            Tous les événements — Grand Genève 2026
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {allWithDates.map(({ ev, d0, dN, count }) => {
              const color = CAT_COLOR[ev.category] ?? '#0A84FF'
              const ticketLink = ev.links.find(l => l.kind === 'tickets')
              const mainUrl = ticketLink?.url ?? ev.links[0]?.url
              return (
                <article key={ev.slug} style={{
                  background: 'var(--bg-card, #f5f5f5)', borderRadius: 14,
                  border: '1px solid var(--border, #e0e0e0)', padding: 18,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color, background: color + '1a', padding: '3px 8px', borderRadius: 5 }}>
                      {CAT_FR[ev.category] ?? ev.category}
                    </span>
                    {ev.priceInfo && (ev.priceInfo.toLowerCase().includes('gratuit') || ev.priceInfo.toLowerCase().includes('libre')) && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green, #30D158)', background: 'rgba(48,209,88,0.12)', padding: '3px 8px', borderRadius: 5 }}>
                        GRATUIT
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                    <a href={`/evenements/${ev.slug}`} style={{ color: 'var(--text-primary, #111)', textDecoration: 'none' }}>
                      {ev.title}
                    </a>
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary, #666)', margin: 0 }}>
                    📍 {ev.venue.name}
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-primary, #111)', margin: 0, lineHeight: 1.6, flex: 1 }}>
                    {ev.description.length > 90 ? ev.description.slice(0, 88) + '…' : ev.description}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    <time dateTime={d0} style={{ fontSize: 12, fontWeight: 600, color }}>
                      {formatDateShort(d0)}{dN !== d0 ? ` – ${formatDateShort(dN)}` : ''}
                      {count > 1 ? ` (${count} dates)` : ''}
                    </time>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a href={`/evenements/${ev.slug}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Détails →</a>
                      {mainUrl && (
                        <a href={mainUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #666)', textDecoration: 'none' }}>↗</a>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        {/* CTA Carte */}
        <section style={{ marginTop: 56, padding: 32, borderRadius: 16, background: 'linear-gradient(135deg, rgba(10,132,255,0.08), rgba(48,209,88,0.08))', border: '1px solid rgba(10,132,255,0.2)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 10px' }}>
            Grand Genève — Intelligence Territoriale en temps réel
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary, #666)', margin: '0 0 20px', maxWidth: 600, lineHeight: 1.7 }}>
            TIF cartographie en direct tous les événements avec le trafic, les passages douanes, les transports publics et les alertes du Grand Genève.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="/map" style={{ display: 'inline-block', padding: '12px 28px', background: 'var(--blue, #0A84FF)', color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
              Carte temps réel →
            </a>
            <a href="/" style={{ display: 'inline-block', padding: '12px 28px', background: 'var(--bg-card, #f5f5f5)', color: 'var(--text-primary, #111)', borderRadius: 12, fontSize: 15, fontWeight: 600, textDecoration: 'none', border: '1px solid var(--border, #e0e0e0)' }}>
              Accueil TIF
            </a>
          </div>
        </section>

        {/* Footer SEO */}
        <footer style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--border, #e0e0e0)', fontSize: 13, color: 'var(--text-secondary, #666)', lineHeight: 1.9 }}>
          <p>
            <strong>TIF — Intelligence Territoriale Grand Genève</strong> est la référence en matière d&apos;agenda événementiel pour Genève et sa région transfrontalière.
            Que vous cherchiez un match de la Coupe du Monde FIFA 2026, le programme du Paléo Festival de Nyon, un film en plein air au Parc de la Grange, ou les matchs du Servette FC,
            TIF vous donne accès en temps réel à tous les événements du Grand Genève — de Genève à Nyon, Carouge, Grand-Saconnex, Annemasse et Ferney-Voltaire.
          </p>
          <nav aria-label="Navigation événements" style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
            <a href="/evenements/categorie/football" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Football & FIFA World Cup</a>
            <a href="/evenements/categorie/festival" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Festivals Genève 2026</a>
            <a href="/evenements/categorie/cinema" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Cinéma de plein air</a>
            <a href="/evenements/categorie/sport" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Sport Grand Genève</a>
            <a href="/evenements/categorie/art" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Expositions & Musées</a>
            <a href="/evenements/agenda/juin-2026" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Agenda Juin 2026</a>
            <a href="/evenements/agenda/juillet-2026" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Agenda Juillet 2026</a>
            <a href="/evenements/agenda/aout-2026" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Agenda Août 2026</a>
            <a href="/map" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Carte TIF temps réel</a>
          </nav>
        </footer>
      </main>
    </>
  )
}
