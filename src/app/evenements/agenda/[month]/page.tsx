import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { events } from '@/data/events'

const BASE = 'https://tif.borja-swiss-solutions.ch'

const MONTHS: Record<string, { num: string; label: string; labelLong: string; season: string }> = {
  'juin-2026':      { num: '06', label: 'juin 2026',      labelLong: 'Juin 2026',      season: 'début d\'été' },
  'juillet-2026':   { num: '07', label: 'juillet 2026',   labelLong: 'Juillet 2026',   season: 'plein été' },
  'aout-2026':      { num: '08', label: 'août 2026',      labelLong: 'Août 2026',      season: 'cœur de l\'été' },
  'septembre-2026': { num: '09', label: 'septembre 2026', labelLong: 'Septembre 2026', season: 'rentrée' },
  'octobre-2026':   { num: '10', label: 'octobre 2026',   labelLong: 'Octobre 2026',   season: 'automne' },
}

const CAT_FR: Record<string, string> = {
  theatre: 'Théâtre', comedie: 'Comédie', concert: 'Concert',
  classique: 'Musique Classique', nightlife: 'Vie Nocturne', danse: 'Danse',
  art: 'Art', sport: 'Sport', festival: 'Festival',
  football: 'Football', cinema: 'Cinéma',
}

const CAT_COLOR: Record<string, string> = {
  football: '#FF9F0A', festival: '#0A84FF', concert: '#0A84FF',
  classique: '#0A84FF', cinema: '#FF375F', art: '#BF5AF2',
  sport: '#30D158', theatre: '#BF5AF2', danse: '#BF5AF2',
  comedie: '#BF5AF2', nightlife: '#BF5AF2',
}

function formatDateShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })
}

export async function generateStaticParams() {
  return Object.keys(MONTHS).map(month => ({ month }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ month: string }> }
): Promise<Metadata> {
  const { month } = await params
  const m = MONTHS[month]
  if (!m) return {}

  const title = `Agenda Genève ${m.labelLong} — Que faire ? Événements & Sorties | TIF`
  const description = `Tous les événements à Genève en ${m.label} : festivals, concerts, football, cinéma, expositions, sport. L'agenda complet du Grand Genève pour ${m.season} 2026 — programme, billets, accès.`

  return {
    title,
    description,
    keywords: [
      `agenda Genève ${m.label}`, `événements Genève ${m.label}`,
      `que faire à Genève ${m.label}`, `sorties Genève ${m.label}`,
      `Grand Genève ${m.label}`, `festivals Genève ${m.label}`,
      `concerts Genève ${m.label}`, `sport Genève ${m.label}`,
    ].join(', '),
    openGraph: {
      title,
      description,
      url: `${BASE}/evenements/agenda/${month}`,
      type: 'website',
      siteName: 'TIF — Intelligence Territoriale Grand Genève',
      images: [{ url: `${BASE}/borja-og.png`, width: 900, height: 639 }],
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: `${BASE}/evenements/agenda/${month}` },
  }
}

export default async function MonthlyAgendaPage(
  { params }: { params: Promise<{ month: string }> }
) {
  const { month } = await params
  const m = MONTHS[month]
  if (!m) notFound()

  const monthPrefix = `2026-${m.num}`

  const monthEvents = events
    .filter(e => e.occurrences.some(o => o.date.startsWith(monthPrefix)))
    .map(e => {
      const datesInMonth = [...new Set(
        e.occurrences.filter(o => o.date.startsWith(monthPrefix)).map(o => o.date)
      )].sort()
      return { ev: e, datesInMonth, firstDate: datesInMonth[0] }
    })
    .sort((a, b) => a.firstDate.localeCompare(b.firstDate))

  if (monthEvents.length === 0) notFound()

  // Group by category for the stats
  const byCat = monthEvents.reduce<Record<string, number>>((acc, { ev }) => {
    acc[ev.category] = (acc[ev.category] ?? 0) + 1
    return acc
  }, {})

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Événements', item: `${BASE}/evenements` },
      { '@type': 'ListItem', position: 3, name: `Agenda ${m.labelLong}`, item: `${BASE}/evenements/agenda/${month}` },
    ],
  }

  const listLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Agenda Genève ${m.labelLong}`,
    description: `Événements à Genève en ${m.label}`,
    url: `${BASE}/evenements/agenda/${month}`,
    numberOfItems: monthEvents.length,
    itemListElement: monthEvents.map(({ ev }, i) => ({
      '@type': 'ListItem', position: i + 1,
      name: ev.title, url: `${BASE}/evenements/${ev.slug}`,
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listLd) }} />

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 64px', fontFamily: 'var(--font-geist-sans, system-ui)', color: 'var(--text-primary, #111)' }}>

        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" style={{ fontSize: 13, color: 'var(--text-secondary, #666)', marginBottom: 28, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <a href="/" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Accueil</a>
          <span aria-hidden>›</span>
          <a href="/evenements" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Événements</a>
          <span aria-hidden>›</span>
          <span>Agenda {m.labelLong}</span>
        </nav>

        {/* Navigation mois */}
        <nav aria-label="Mois" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
          {Object.entries(MONTHS).map(([slug, info]) => (
            <a key={slug} href={`/evenements/agenda/${slug}`}
              style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                textDecoration: 'none', border: '1px solid var(--border, #e0e0e0)',
                background: slug === month ? 'var(--blue, #0A84FF)' : 'var(--bg-card, #f5f5f5)',
                color: slug === month ? '#fff' : 'var(--text-primary, #111)',
              }}>
              {info.labelLong}
            </a>
          ))}
        </nav>

        {/* Header */}
        <header style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 'clamp(26px, 5vw, 44px)', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.15 }}>
            Que faire à Genève en {m.label} ?
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary, #666)', margin: '0 0 20px', lineHeight: 1.7, maxWidth: 700 }}>
            L&apos;agenda complet des événements à Genève et dans le Grand Genève pour {m.season} — {monthEvents.length} événements, du festival au match de football en passant par les cinémas, musées et concerts.
          </p>
          {/* Stats catégories */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
              <a key={cat} href={`/evenements/categorie/${cat}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  textDecoration: 'none', color: CAT_COLOR[cat] ?? '#666',
                  background: (CAT_COLOR[cat] ?? '#666') + '1a',
                  border: `1px solid ${CAT_COLOR[cat] ?? '#666'}33`,
                }}>
                {CAT_FR[cat] ?? cat} ({count})
              </a>
            ))}
          </div>
        </header>

        {/* Liste événements */}
        <section aria-label={`Événements ${m.labelLong}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {monthEvents.map(({ ev, datesInMonth }) => {
              const allDates = [...new Set(ev.occurrences.map(o => o.date))].sort()
              const ticketLink = ev.links.find(l => l.kind === 'tickets')
              const mainUrl = ticketLink?.url ?? ev.links[0]?.url
              const color = CAT_COLOR[ev.category] ?? '#0A84FF'
              return (
                <article key={ev.slug} style={{
                  display: 'flex', gap: 16, padding: 20, borderRadius: 14,
                  background: 'var(--bg-card, #f5f5f5)', border: '1px solid var(--border, #e0e0e0)',
                  flexWrap: 'wrap',
                }}>
                  {/* Date badge */}
                  <div style={{ minWidth: 56, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>
                      {new Date(datesInMonth[0] + 'T12:00:00').getDate()}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #666)', textTransform: 'uppercase' }}>
                      {new Date(datesInMonth[0] + 'T12:00:00').toLocaleDateString('fr-CH', { month: 'short' })}
                    </div>
                  </div>

                  {/* Contenu */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                      <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, flex: 1 }}>
                        <a href={`/evenements/${ev.slug}`} style={{ color: 'var(--text-primary, #111)', textDecoration: 'none' }}>
                          {ev.title}
                        </a>
                      </h2>
                      <span style={{ fontSize: 11, fontWeight: 700, color, background: color + '1a', padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                        {CAT_FR[ev.category] ?? ev.category}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary, #666)', margin: '0 0 8px' }}>
                      📍 {ev.venue.name}{ev.venue.address ? ` · ${ev.venue.address}` : ''}
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-primary, #111)', margin: '0 0 10px', lineHeight: 1.6 }}>
                      {ev.description.length > 120 ? ev.description.slice(0, 118) + '…' : ev.description}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color, fontWeight: 600 }}>
                        {formatDateShort(datesInMonth[0])}{datesInMonth.length > 1 ? ` — ${formatDateShort(datesInMonth[datesInMonth.length - 1])}` : ''}
                        {allDates.length > datesInMonth.length ? ` (+${allDates.length - datesInMonth.length} hors mois)` : ''}
                      </span>
                      <a href={`/evenements/${ev.slug}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Programme →</a>
                      {mainUrl && <a href={mainUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #666)', textDecoration: 'none' }}>Billets ↗</a>}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        {/* Prochains mois */}
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>Agenda des prochains mois</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(MONTHS).filter(([slug]) => slug !== month).map(([slug, info]) => (
              <a key={slug} href={`/evenements/agenda/${slug}`} style={{
                display: 'block', padding: '14px 20px', borderRadius: 12,
                background: 'var(--bg-card, #f5f5f5)', border: '1px solid var(--border, #e0e0e0)',
                textDecoration: 'none', color: 'var(--text-primary, #111)', fontWeight: 600, fontSize: 14,
              }}>
                Agenda {info.labelLong} →
              </a>
            ))}
          </div>
        </section>

        {/* CTA Carte */}
        <section style={{ marginTop: 36, padding: 28, borderRadius: 14, background: 'linear-gradient(135deg, rgba(10,132,255,0.08), rgba(48,209,88,0.08))', border: '1px solid rgba(10,132,255,0.2)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Carte temps réel du Grand Genève</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary, #666)', margin: '0 0 16px' }}>
            Trafic, passages douanes, transports publics et événements — tout en un seul coup d&apos;œil.
          </p>
          <a href="/map" style={{ display: 'inline-block', padding: '10px 22px', background: 'var(--blue, #0A84FF)', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            Ouvrir la carte TIF →
          </a>
        </section>

        {/* Footer SEO */}
        <footer style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border, #e0e0e0)', fontSize: 13, color: 'var(--text-secondary, #666)', lineHeight: 1.8 }}>
          <p>
            TIF — Intelligence Territoriale Grand Genève recense en continu tous les événements culturels, sportifs et festifs
            à Genève, Carouge, Nyon, Grand-Saconnex, Annemasse et Ferney-Voltaire.
            Agenda {m.label} complet : festivals, concerts, matchs de football, cinéma de plein air, expositions de musées et événements sportifs.
          </p>
          <nav aria-label="Liens" style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <a href="/evenements" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Agenda complet 2026</a>
            <a href="/evenements/categorie/football" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Football Genève</a>
            <a href="/evenements/categorie/festival" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Festivals</a>
            <a href="/evenements/categorie/cinema" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Cinéma</a>
            <a href="/map" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Carte TIF</a>
          </nav>
        </footer>
      </main>
    </>
  )
}
