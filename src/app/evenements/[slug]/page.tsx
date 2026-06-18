import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { events } from '@/data/events'

const BASE = 'https://tif.borja-swiss-solutions.ch'

const CAT_FR: Record<string, string> = {
  theatre: 'Théâtre', comedie: 'Comédie & Humour', concert: 'Concert',
  classique: 'Musique Classique', nightlife: 'Vie Nocturne', danse: 'Danse',
  art: 'Art & Expositions', sport: 'Sport', festival: 'Festival',
  football: 'Football', cinema: 'Cinéma',
}

const CAT_COLOR: Record<string, string> = {
  football: '#FF9F0A', festival: '#0A84FF', concert: '#0A84FF',
  classique: '#0A84FF', cinema: '#FF375F', art: '#BF5AF2',
  sport: '#30D158', theatre: '#BF5AF2', danse: '#BF5AF2',
  comedie: '#BF5AF2', nightlife: '#BF5AF2',
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-CH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatDateShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-CH', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export async function generateStaticParams() {
  return events
    .filter(e => e.occurrences.length > 0)
    .map(e => ({ slug: e.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const ev = events.find(e => e.slug === slug)
  if (!ev) return {}

  const dates = [...new Set(ev.occurrences.map(o => o.date))].sort()
  const d0 = dates[0], dN = dates[dates.length - 1]
  const dateStr = d0 === dN
    ? formatDateShort(d0)
    : `${formatDateShort(d0)} – ${formatDateShort(dN)}`
  const catLabel = CAT_FR[ev.category] ?? ev.category
  const year = new Date(d0 + 'T12:00:00').getFullYear()

  const title = `${ev.title} — ${ev.venue.name} · Genève ${year}`
  const description = `${ev.description} · ${dateStr} à ${ev.venue.name}${ev.venue.address ? `, ${ev.venue.address}` : ''}. Programme, billets et infos — ${catLabel} Grand Genève ${year}.`

  return {
    title,
    description,
    keywords: [
      ev.title, ev.venue.name, catLabel,
      `${ev.title} Genève`, `${ev.title} ${year}`,
      `${catLabel} Genève ${year}`, 'Grand Genève', 'agenda Genève',
      `événements Genève ${year}`, ev.venue.area ?? 'Genève',
    ].join(', '),
    openGraph: {
      title,
      description,
      url: `${BASE}/evenements/${ev.slug}`,
      type: 'article',
      siteName: 'TIF — Intelligence Territoriale Grand Genève',
      images: [{ url: `${BASE}/borja-og.png`, width: 900, height: 639 }],
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: `${BASE}/evenements/${ev.slug}` },
  }
}

export default async function EventPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const ev = events.find(e => e.slug === slug)
  if (!ev) notFound()

  const dates = [...new Set(ev.occurrences.map(o => o.date))].sort()
  const d0 = dates[0], dN = dates[dates.length - 1]
  const catLabel = CAT_FR[ev.category] ?? ev.category
  const color = CAT_COLOR[ev.category] ?? '#0A84FF'
  const year = new Date(d0 + 'T12:00:00').getFullYear()

  const ticketLink = ev.links.find(l => l.kind === 'tickets')
  const infoLink   = ev.links.find(l => l.kind === 'info')
  const venueLink  = ev.links.find(l => l.kind === 'venue')
  const mainUrl    = ticketLink?.url ?? infoLink?.url ?? venueLink?.url

  const related = events
    .filter(e => e.slug !== ev.slug && e.category === ev.category && e.occurrences.length > 0)
    .slice(0, 6)

  // JSON-LD: Event
  const eventLd = {
    '@context': 'https://schema.org',
    '@type': ev.occurrences.length > 1 ? 'EventSeries' : 'Event',
    name: ev.title,
    description: ev.description,
    startDate: d0,
    ...(dN !== d0 ? { endDate: dN } : {}),
    location: {
      '@type': 'Place',
      name: ev.venue.name,
      address: {
        '@type': 'PostalAddress',
        ...(ev.venue.address ? { streetAddress: ev.venue.address } : {}),
        addressLocality: 'Genève',
        addressRegion: 'GE',
        addressCountry: 'CH',
      },
      ...(ev.venue.lat && ev.venue.lng
        ? { geo: { '@type': 'GeoCoordinates', latitude: ev.venue.lat, longitude: ev.venue.lng } }
        : {}),
    },
    url: mainUrl ?? `${BASE}/evenements/${ev.slug}`,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    organizer: { '@type': 'Organization', name: ev.venue.name },
    ...(ev.priceInfo ? { offers: { '@type': 'Offer', description: ev.priceInfo } } : {}),
    subjectOf: { '@type': 'WebPage', url: `${BASE}/evenements/${ev.slug}` },
  }

  // JSON-LD: Breadcrumb
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Événements', item: `${BASE}/evenements` },
      { '@type': 'ListItem', position: 3, name: catLabel, item: `${BASE}/evenements/categorie/${ev.category}` },
      { '@type': 'ListItem', position: 4, name: ev.title, item: `${BASE}/evenements/${ev.slug}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px 64px', fontFamily: 'var(--font-geist-sans, system-ui)', color: 'var(--text-primary, #111)' }}>

        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" style={{ fontSize: 13, color: 'var(--text-secondary, #666)', marginBottom: 28, display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <a href="/" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Accueil</a>
          <span aria-hidden>›</span>
          <a href="/evenements" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Événements</a>
          <span aria-hidden>›</span>
          <a href={`/evenements/categorie/${ev.category}`} style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>{catLabel}</a>
          <span aria-hidden>›</span>
          <span>{ev.title}</span>
        </nav>

        {/* Badge + Titre */}
        <header style={{ marginBottom: 32 }}>
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: color, background: color + '1a',
            padding: '4px 12px', borderRadius: 6, marginBottom: 12,
          }}>
            {catLabel}
          </span>
          <h1 style={{ fontSize: 'clamp(26px, 5vw, 44px)', fontWeight: 800, margin: '0 0 10px', lineHeight: 1.15, color: 'var(--text-primary, #111)' }}>
            {ev.title}
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary, #666)', margin: 0 }}>
            📍 {ev.venue.name}{ev.venue.address ? ` · ${ev.venue.address}` : ''}
          </p>
        </header>

        {/* Description */}
        <section aria-label="Description" style={{ marginBottom: 28, padding: 24, background: 'var(--bg-card, #f5f5f5)', borderRadius: 14, border: '1px solid var(--border, #e0e0e0)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 10px', color: 'var(--text-primary, #111)' }}>À propos</h2>
          <p style={{ fontSize: 16, lineHeight: 1.75, margin: 0, color: 'var(--text-primary, #111)' }}>{ev.description}</p>
          {ev.priceInfo && (
            <p style={{ marginTop: 14, fontSize: 14, fontWeight: 600, color: 'var(--green, #30D158)' }}>
              💶 {ev.priceInfo}
            </p>
          )}
        </section>

        {/* Dates */}
        <section aria-label="Dates et horaires" style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-primary, #111)' }}>
            Dates &amp; horaires — {ev.venue.name}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(dates.length > 14 ? dates.slice(0, 7) : dates).map(date => {
              const occs = ev.occurrences.filter(o => o.date === date)
              return (
                <div key={date} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-card, #f5f5f5)', borderRadius: 10, border: '1px solid var(--border, #e0e0e0)' }}>
                  <time dateTime={date} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #111)', textTransform: 'capitalize', minWidth: 200 }}>
                    {formatDate(date)}
                  </time>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {occs.map((o, i) => o.start ? (
                      <span key={i} style={{ fontSize: 13, color: 'var(--text-secondary, #666)', background: 'var(--bg, white)', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border, #e0e0e0)' }}>
                        {o.start}{o.end ? ` – ${o.end}` : ''}{o.note ? ` (${o.note})` : ''}
                      </span>
                    ) : null)}
                  </div>
                </div>
              )
            })}
            {dates.length > 14 && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary, #666)', padding: '8px 16px', background: 'var(--bg-card, #f5f5f5)', borderRadius: 10, border: '1px solid var(--border, #e0e0e0)', margin: 0 }}>
                + {dates.length - 7} autres dates · programme complet sur le site officiel
              </p>
            )}
          </div>
        </section>

        {/* Liens */}
        {ev.links.length > 0 && (
          <section aria-label="Billets et informations" style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-primary, #111)' }}>Billets &amp; Infos</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {ev.links.map((link, i) => {
                const isPrimary = link.kind === 'tickets'
                return (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                      textDecoration: 'none', transition: 'opacity 0.15s',
                      background: isPrimary ? 'var(--blue, #0A84FF)' : 'var(--bg-card, #f5f5f5)',
                      color: isPrimary ? '#fff' : 'var(--text-primary, #111)',
                      border: isPrimary ? 'none' : '1px solid var(--border, #e0e0e0)',
                    }}>
                    {link.kind === 'tickets' ? '🎟' : link.kind === 'venue' ? '📍' : 'ℹ️'}
                    {link.label}
                  </a>
                )
              })}
            </div>
          </section>
        )}

        {/* CTA Carte TIF */}
        <section aria-label="Carte TIF" style={{
          padding: 24, borderRadius: 14, marginBottom: 28,
          background: 'linear-gradient(135deg, rgba(10,132,255,0.08) 0%, rgba(48,209,88,0.08) 100%)',
          border: '1px solid rgba(10,132,255,0.2)',
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary, #111)' }}>
            Voir sur la carte — Grand Genève en temps réel
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary, #666)', margin: '0 0 16px', lineHeight: 1.6 }}>
            Retrouvez <strong>{ev.title}</strong> et tous les événements du Grand Genève avec le trafic, les transports publics, les passages douanes et les alertes en direct.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/map" style={{ display: 'inline-block', padding: '10px 22px', background: 'var(--blue, #0A84FF)', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Ouvrir la carte TIF →
            </a>
            <a href="/evenements" style={{ display: 'inline-block', padding: '10px 22px', background: 'var(--bg-card, #f5f5f5)', color: 'var(--text-primary, #111)', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none', border: '1px solid var(--border, #e0e0e0)' }}>
              Tous les événements
            </a>
          </div>
        </section>

        {/* Événements similaires */}
        {related.length > 0 && (
          <section aria-label={`Autres événements ${catLabel}`} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-primary, #111)' }}>
              Autres {catLabel.toLowerCase()} · Grand Genève {year}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {related.map(r => {
                const rDates = [...new Set(r.occurrences.map(o => o.date))].sort()
                return (
                  <a key={r.slug} href={`/evenements/${r.slug}`} style={{
                    display: 'block', padding: 16, borderRadius: 12,
                    background: 'var(--bg-card, #f5f5f5)', border: '1px solid var(--border, #e0e0e0)',
                    textDecoration: 'none', color: 'inherit', transition: 'border-color 0.15s',
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #111)', marginBottom: 4 }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #666)', marginBottom: 6 }}>{r.venue.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--blue, #0A84FF)', fontWeight: 600 }}>
                      {formatDateShort(rDates[0])}{rDates.length > 1 ? ` +${rDates.length - 1}` : ''}
                    </div>
                  </a>
                )
              })}
            </div>
          </section>
        )}

        {/* Footer SEO */}
        <footer style={{ paddingTop: 24, borderTop: '1px solid var(--border, #e0e0e0)', fontSize: 13, color: 'var(--text-secondary, #666)', lineHeight: 1.8 }}>
          <p>
            <strong>TIF — Intelligence Territoriale Grand Genève</strong> référence en temps réel tous les événements de Genève et du Grand Genève : festivals, concerts, matchs de football, expositions, cinéma et événements sportifs.
            Retrouvez <em>{ev.title}</em> ainsi que l&apos;agenda complet des événements à Genève, Nyon, Carouge, Annemasse et Ferney-Voltaire sur <a href="/" style={{ color: 'var(--blue, #0A84FF)' }}>TIF</a>.
          </p>
          <nav aria-label="Liens internes" style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <a href="/evenements" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Agenda complet Genève {year}</a>
            <a href={`/evenements/categorie/${ev.category}`} style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>{catLabel} à Genève</a>
            <a href="/map" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Carte du Grand Genève</a>
            <a href="/" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>TIF — Accueil</a>
          </nav>
        </footer>
      </main>
    </>
  )
}
