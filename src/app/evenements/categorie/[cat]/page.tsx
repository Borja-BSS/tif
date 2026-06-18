import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { events } from '@/data/events'

const BASE = 'https://tif.borja-swiss-solutions.ch'

const CAT_META: Record<string, {
  label: string; labelPlural: string; color: string
  title: string; description: string; keywords: string
  h1: string; intro: string
}> = {
  football: {
    label: 'Football', labelPlural: 'matchs de football', color: '#FF9F0A',
    title: 'Football à Genève 2026 — FIFA World Cup, Nati, Servette FC | TIF',
    description: 'Agenda football complet au Grand Genève : Coupe du Monde FIFA 2026, matchs de la Nati, Fanzone Plan-les-Ouates, Servette FC, football local. Dates, billets, accès — TIF Grand Genève.',
    keywords: 'football Genève 2026, FIFA World Cup Genève, Nati Suisse match, Servette FC, fanzone Genève, Coupe du Monde Genève, football Grand Genève',
    h1: 'Football à Genève & Grand Genève — 2026',
    intro: 'Suivez toute l\'actualité football dans le Grand Genève : la Coupe du Monde FIFA 2026, les fanzones officielles, les matchs de la Nati, le Servette FC et le football local. Billets, programme et infos pratiques.',
  },
  sport: {
    label: 'Sport', labelPlural: 'événements sportifs', color: '#30D158',
    title: 'Sport à Genève 2026 — Triathlon, Beach Volley, Tennis, Tour de France | TIF',
    description: 'Tous les événements sportifs du Grand Genève en 2026 : Triathlon Tour de Genève, Beach Pro Tour, Swiss Open Geneva, Tour de France Femmes. Agenda sport complet.',
    keywords: 'sport Genève 2026, triathlon Genève, beach volley Genève, tennis Genève, Tour de France Genève, Grand Genève sport',
    h1: 'Sport à Genève & Grand Genève — été 2026',
    intro: 'Tous les grands événements sportifs du Grand Genève : triathlon, beach-volley, tennis, cyclisme et bien plus. Restez informés des compétitions et rendez-vous sportifs de l\'été 2026.',
  },
  festival: {
    label: 'Festival', labelPlural: 'festivals', color: '#0A84FF',
    title: 'Festivals à Genève 2026 — Paléo, Montreux Jazz, Caribana, La Bâtie | TIF',
    description: 'Le programme complet des festivals dans le Grand Genève et en Suisse romande : Paléo Festival Nyon, Montreux Jazz Festival, Caribana Festival, La Bâtie — Festival de Genève, Plein les Watts et plus.',
    keywords: 'festivals Genève 2026, Paléo Festival, Montreux Jazz, Caribana Festival, La Bâtie Genève, festival été Genève, Grand Genève festivals',
    h1: 'Festivals été 2026 — Grand Genève & Suisse Romande',
    intro: 'Ne manquez aucun festival cet été dans le Grand Genève et en Suisse romande. Du Paléo Festival de Nyon au Montreux Jazz, en passant par Caribana et la Fête de la Musique à Genève.',
  },
  concert: {
    label: 'Concert', labelPlural: 'concerts', color: '#0A84FF',
    title: 'Concerts à Genève 2026 — Agenda complet | TIF',
    description: 'Agenda des concerts à Genève et Grand Genève en 2026. Toutes les salles, tous les styles musicaux. Programme, billets et infos pratiques.',
    keywords: 'concerts Genève 2026, agenda concerts Genève, musique Genève, Grand Genève concerts',
    h1: 'Concerts à Genève 2026',
    intro: 'Découvrez l\'agenda complet des concerts à Genève et dans le Grand Genève. Toute la musique live de l\'été 2026.',
  },
  classique: {
    label: 'Musique Classique', labelPlural: 'concerts classiques', color: '#0A84FF',
    title: 'Musique Classique à Genève 2026 — OSR, Concerts | TIF',
    description: 'Agenda musique classique à Genève : Orchestre de la Suisse Romande, OSR Genève-Plage, récitals et concerts en plein air. Programme 2026.',
    keywords: 'musique classique Genève 2026, OSR Genève, Orchestre Suisse Romande, concert classique Genève',
    h1: 'Musique Classique à Genève 2026',
    intro: 'L\'agenda musique classique de Genève : l\'OSR sur la plage, récitals et concerts sous les étoiles dans le cadre exceptionnel du Grand Genève.',
  },
  cinema: {
    label: 'Cinéma', labelPlural: 'séances cinema', color: '#FF375F',
    title: 'Cinéma à Genève 2026 — Plein Air, CinéTransat, Allianz Cinema | TIF',
    description: 'Programme cinéma à Genève : Allianz Cinema Parc de la Grange, CinéTransat, cinémas de quartier (Pathé, Spoutnik, Bio, Voltaire). Séances, horaires et tarifs 2026.',
    keywords: 'cinéma Genève 2026, Allianz Cinema, CinéTransat, cinéma plein air Genève, Pathé Genève, Spoutnik cinéma, programme cinéma Genève',
    h1: 'Cinéma à Genève 2026 — Plein air & Salles',
    intro: 'Toute la programmation cinématographique de Genève : films en plein air avec Allianz Cinema et CinéTransat, et le programme des salles indépendantes et multiplexes du Grand Genève.',
  },
  art: {
    label: 'Art & Expositions', labelPlural: 'expositions', color: '#BF5AF2',
    title: 'Expositions & Art à Genève 2026 — Musées, Galeries | TIF',
    description: 'Agenda expositions et art à Genève : Musée Ariana, Musée Rath, galeries et événements culturels du Grand Genève 2026.',
    keywords: 'expositions Genève 2026, musée Genève, Musée Ariana, Musée Rath, art Genève, galeries Genève',
    h1: 'Art & Expositions à Genève 2026',
    intro: 'Les grandes expositions et événements artistiques de Genève : musées, galeries et espaces culturels du Grand Genève en 2026.',
  },
  theatre: {
    label: 'Théâtre', labelPlural: 'spectacles de théâtre', color: '#BF5AF2',
    title: 'Théâtre à Genève 2026 — Spectacles & Programme | TIF',
    description: 'Agenda théâtre à Genève : spectacles, pièces et représentations dans les théâtres du Grand Genève. Programme 2026.',
    keywords: 'théâtre Genève 2026, spectacles Genève, programme théâtre Genève',
    h1: 'Théâtre à Genève 2026',
    intro: 'Découvrez les spectacles et pièces de théâtre à l\'affiche dans les salles du Grand Genève tout au long de l\'année 2026.',
  },
  comedie: {
    label: 'Comédie & Humour', labelPlural: 'spectacles comiques', color: '#BF5AF2',
    title: 'Comédie & Humour à Genève 2026 — Caustic Comedy Club | TIF',
    description: 'Agenda comédie et humour à Genève : Caustic Comedy Club, spectacles comiques, stand-up. Programme 2026.',
    keywords: 'comédie Genève 2026, humour Genève, Caustic Comedy Club, stand-up Genève',
    h1: 'Comédie & Humour à Genève 2026',
    intro: 'Les meilleurs spectacles comiques et soirées stand-up de Genève. Retrouvez le programme du Caustic Comedy Club et des autres scènes d\'humour du Grand Genève.',
  },
  danse: {
    label: 'Danse', labelPlural: 'spectacles de danse', color: '#BF5AF2',
    title: 'Danse à Genève 2026 — Spectacles & Programme | TIF',
    description: 'Agenda danse à Genève : ballet, danse contemporaine, spectacles et performances dans le Grand Genève 2026.',
    keywords: 'danse Genève 2026, ballet Genève, danse contemporaine Genève',
    h1: 'Danse à Genève 2026',
    intro: 'Toutes les créations chorégraphiques et spectacles de danse à voir à Genève en 2026.',
  },
  nightlife: {
    label: 'Vie Nocturne', labelPlural: 'événements nocturnes', color: '#BF5AF2',
    title: 'Vie Nocturne à Genève 2026 — Soirées, Clubs, Events | TIF',
    description: 'Agenda vie nocturne à Genève : soirées, événements clubbing, AMR et scènes nocturnes du Grand Genève 2026.',
    keywords: 'vie nocturne Genève 2026, soirées Genève, clubbing Genève, AMR Genève',
    h1: 'Vie Nocturne à Genève 2026',
    intro: 'La scène nocturne genevoise en 2026 : soirées, clubs, événements et nuits musicales dans le Grand Genève.',
  },
}

function formatDateShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-CH', {
    day: 'numeric', month: 'short',
  })
}

export async function generateStaticParams() {
  const cats = [...new Set(events.filter(e => e.occurrences.length > 0).map(e => e.category))]
  return cats.map(cat => ({ cat }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ cat: string }> }
): Promise<Metadata> {
  const { cat } = await params
  const meta = CAT_META[cat]
  if (!meta) return {}
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${BASE}/evenements/categorie/${cat}`,
      type: 'website',
      siteName: 'TIF — Intelligence Territoriale Grand Genève',
      images: [{ url: `${BASE}/borja-og.png`, width: 900, height: 639 }],
    },
    twitter: { card: 'summary_large_image', title: meta.title, description: meta.description },
    alternates: { canonical: `${BASE}/evenements/categorie/${cat}` },
  }
}

export default async function CategoryPage(
  { params }: { params: Promise<{ cat: string }> }
) {
  const { cat } = await params
  const meta = CAT_META[cat]
  if (!meta) notFound()

  const catEvents = events
    .filter(e => e.category === cat && e.occurrences.length > 0)
    .sort((a, b) => {
      const da = [...new Set(a.occurrences.map(o => o.date))].sort()[0]
      const db = [...new Set(b.occurrences.map(o => o.date))].sort()[0]
      return da.localeCompare(db)
    })

  if (catEvents.length === 0) notFound()

  // JSON-LD ItemList
  const listLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: meta.label + ' — Grand Genève 2026',
    description: meta.description,
    url: `${BASE}/evenements/categorie/${cat}`,
    numberOfItems: catEvents.length,
    itemListElement: catEvents.map((ev, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: ev.title,
      url: `${BASE}/evenements/${ev.slug}`,
    })),
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Événements', item: `${BASE}/evenements` },
      { '@type': 'ListItem', position: 3, name: meta.label, item: `${BASE}/evenements/categorie/${cat}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 64px', fontFamily: 'var(--font-geist-sans, system-ui)', color: 'var(--text-primary, #111)' }}>

        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" style={{ fontSize: 13, color: 'var(--text-secondary, #666)', marginBottom: 28, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <a href="/" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Accueil</a>
          <span aria-hidden>›</span>
          <a href="/evenements" style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>Événements</a>
          <span aria-hidden>›</span>
          <span>{meta.label}</span>
        </nav>

        {/* Header */}
        <header style={{ marginBottom: 36 }}>
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: meta.color, background: meta.color + '1a',
            padding: '4px 12px', borderRadius: 6, marginBottom: 12,
          }}>
            {catEvents.length} événements
          </span>
          <h1 style={{ fontSize: 'clamp(26px, 5vw, 44px)', fontWeight: 800, margin: '0 0 14px', lineHeight: 1.15 }}>
            {meta.h1}
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary, #666)', maxWidth: 700, lineHeight: 1.7, margin: 0 }}>
            {meta.intro}
          </p>
        </header>

        {/* Grid événements */}
        <section aria-label={`Liste ${meta.labelPlural}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {catEvents.map(ev => {
              const dates = [...new Set(ev.occurrences.map(o => o.date))].sort()
              const d0 = dates[0], dN = dates[dates.length - 1]
              const ticketLink = ev.links.find(l => l.kind === 'tickets')
              const mainUrl = ticketLink?.url ?? ev.links[0]?.url
              return (
                <article key={ev.slug} style={{
                  background: 'var(--bg-card, #f5f5f5)', borderRadius: 14,
                  border: '1px solid var(--border, #e0e0e0)',
                  padding: 20, display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary, #111)' }}>
                      <a href={`/evenements/${ev.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {ev.title}
                      </a>
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary, #666)', margin: 0 }}>
                      📍 {ev.venue.name}
                    </p>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary, #111)', margin: 0, lineHeight: 1.6, flex: 1 }}>
                    {ev.description.length > 100 ? ev.description.slice(0, 98) + '…' : ev.description}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <time dateTime={d0} style={{ fontSize: 12, fontWeight: 600, color: meta.color }}>
                      {formatDateShort(d0)}{dN !== d0 ? ` — ${formatDateShort(dN)}` : ''}
                      {dates.length > 1 ? ` · ${dates.length} dates` : ''}
                    </time>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a href={`/evenements/${ev.slug}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>
                        Détails →
                      </a>
                      {mainUrl && (
                        <a href={mainUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #666)', textDecoration: 'none' }}>
                          Site officiel ↗
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        {/* CTA */}
        <section style={{ marginTop: 48, padding: 28, borderRadius: 14, background: 'linear-gradient(135deg, rgba(10,132,255,0.08), rgba(48,209,88,0.08))', border: '1px solid rgba(10,132,255,0.2)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Voir tous les événements sur la carte</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary, #666)', margin: '0 0 16px' }}>
            TIF cartographie en temps réel les {meta.labelPlural} du Grand Genève avec le trafic, les transports et les alertes.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/map" style={{ display: 'inline-block', padding: '10px 22px', background: 'var(--blue, #0A84FF)', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Carte TIF →</a>
            <a href="/evenements" style={{ display: 'inline-block', padding: '10px 22px', background: 'var(--bg-card, #f5f5f5)', color: 'var(--text-primary, #111)', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none', border: '1px solid var(--border, #e0e0e0)' }}>Agenda complet</a>
          </div>
        </section>

        {/* Footer SEO */}
        <footer style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border, #e0e0e0)', fontSize: 13, color: 'var(--text-secondary, #666)', lineHeight: 1.8 }}>
          <p>
            TIF recense tous les {meta.labelPlural} à Genève, Nyon, Carouge, Annemasse et dans tout le Grand Genève.
            Agenda {meta.label.toLowerCase()} 2026 complet avec billets, horaires et accès transports publics.
          </p>
          <nav aria-label="Autres catégories" style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {Object.entries(CAT_META).filter(([k]) => k !== cat).slice(0, 6).map(([k, m]) => (
              <a key={k} href={`/evenements/categorie/${k}`} style={{ color: 'var(--blue, #0A84FF)', textDecoration: 'none' }}>{m.label}</a>
            ))}
          </nav>
        </footer>
      </main>
    </>
  )
}
