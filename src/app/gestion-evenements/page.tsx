import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'

export const metadata: Metadata = {
  title: 'Gestion d\'événements de masse — TIF × Börja Swiss Solutions',
  description:
    'Plateforme d\'intelligence territoriale pour festivals, concerts, manifestations et événements sportifs en Suisse et Grand Genève. ' +
    'Mobilité en temps réel, alertes, douanes, transport — éprouvé au G7 Évian 2026 (9 000+ utilisateurs).',
  openGraph: {
    title: 'Gestion d\'événements de grande envergure — TIF × Börja',
    description:
      'Festivals · Concerts · Foot · Manifestations : une plateforme mobilité déployée en 48h, éprouvée au G7 Évian 2026.',
    url: 'https://tif.borja-swiss-solutions.ch/gestion-evenements',
    images: [{ url: '/borja-og.png', width: 900, height: 639, alt: 'TIF × Börja — Événements de masse' }],
  },
  alternates: { canonical: 'https://tif.borja-swiss-solutions.ch/gestion-evenements' },
  keywords: [
    'gestion événements masse Genève',
    'plateforme mobilité festivals Suisse',
    'intelligence territoriale événements',
    'concerts Genève mobilité temps réel',
    'manifestations gestion foule',
    'football événements mobilité',
    'TIF Börja Swiss Solutions',
    'G7 événements grande envergure',
  ],
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'TIF — Gestion d\'événements de masse',
  description:
    'Plateforme d\'intelligence territoriale pour la gestion de la mobilité lors d\'événements de grande envergure : festivals, concerts, manifestations, football.',
  provider: {
    '@type': 'Organization',
    name: 'Börja Swiss Solutions',
    url: 'https://borja-swiss-solutions.ch',
    address: { '@type': 'PostalAddress', addressLocality: 'Genève', addressCountry: 'CH' },
  },
  areaServed: [
    { '@type': 'City', name: 'Genève' },
    { '@type': 'Place', name: 'Grand Genève' },
    { '@type': 'Country', name: 'Suisse' },
  ],
  serviceType: 'Intelligence territoriale · Mobilité événementielle',
  offers: { '@type': 'Offer', availability: 'https://schema.org/InStock' },
}

const CASES = [
  {
    icon: '🎪',
    title: 'Festivals',
    desc: 'Montreux Jazz, Paléo, Fête de la Musique, Balélec — anticiper l\'afflux, gérer les parkings et les transports en temps réel.',
  },
  {
    icon: '🎤',
    title: 'Concerts & shows',
    desc: 'Arena, Victoria Hall, Palexpo — flux d\'entrée et sortie, trafic autour du site, alertes automatiques pour les spectateurs.',
  },
  {
    icon: '✊',
    title: 'Manifestations',
    desc: 'Cortèges, rassemblements — périmètres dynamiques, déviations TPG, douanes et points de blocage en temps réel.',
  },
  {
    icon: '⚽',
    title: 'Football & sport',
    desc: 'Matchs Stade de Genève, Mondial 2026, tournois — zones de fan, transports publics, coordination avec les services de sécurité.',
  },
  {
    icon: '🏛️',
    title: 'Sommets & conférences',
    desc: 'G7 Évian 2026 — cas réel. Carte live pour 9 000+ utilisateurs, 46 douanes, alertes officielles, itinéraires intelligents.',
  },
  {
    icon: '🎆',
    title: 'Feux d\'artifice & kermesses',
    desc: 'Fêtes nationales, feux du lac — afflux concentré, fermetures de rues, transport lacustre CGN intégré.',
  },
]

const STATS = [
  { value: '9 000+', label: 'utilisateurs actifs — G7 2026' },
  { value: '46', label: 'postes douaniers surveillés' },
  { value: '48h', label: 'déploiement d\'une instance dédiée' },
  { value: '15j', label: 'de disponibilité ininterrompue (G7)' },
  { value: '7', label: 'sources officielles agrégées' },
  { value: '9', label: 'langues supportées' },
]

export default function GestionEvenementsPage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      {/* ── Hero ── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '96px 24px 64px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 20, fontWeight: 600 }}>
          TIF × Börja Swiss Solutions
        </p>
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 60px)', fontWeight: 900, lineHeight: 1.1, marginBottom: 24 }}>
          Vos événements de grande&nbsp;envergure,<br />
          <span style={{ color: 'var(--brand)' }}>une intelligence mobilité</span> déployée en&nbsp;48h
        </h1>
        <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 680, margin: '0 auto 40px', lineHeight: 1.65 }}>
          Festivals, concerts, manifestations, football — nous livrons une plateforme cartographique
          temps réel, éprouvée au G7 Évian 2026, adaptée à votre territoire et à votre audience.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="mailto:contact@borja-swiss-solutions.ch?subject=Gestion événements — demande de démo"
            style={{
              display: 'inline-block',
              background: 'var(--brand)',
              color: '#fff',
              padding: '14px 32px',
              borderRadius: 100,
              fontWeight: 700,
              fontSize: 16,
              textDecoration: 'none',
            }}
          >
            Demander une démo →
          </a>
          <a
            href="/map"
            style={{
              display: 'inline-block',
              border: '1.5px solid rgba(255,255,255,0.18)',
              color: 'var(--text-primary)',
              padding: '14px 32px',
              borderRadius: 100,
              fontWeight: 600,
              fontSize: 16,
              textDecoration: 'none',
            }}
          >
            Voir la carte live
          </a>
        </div>
      </section>

      {/* ── Preuve : G7 ── */}
      <section style={{ background: 'rgba(255,255,255,0.03)', borderTop: '0.5px solid rgba(255,255,255,0.08)', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '56px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 48, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 300px' }}>
            <p style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>Cas réel · Juin 2026</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>G7 Évian-les-Bains — éprouvé sous pression réelle</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
              Lors du sommet du G7 (15–17 juin 2026), TIF a agrégé en continu les données de 46 postes
              frontaliers, les alertes officielles du canton de Genève, les perturbations TPG et CFF,
              et les restrictions de l'espace aérien — pour 9 000 utilisateurs actifs dans le Grand Genève.
            </p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              15 jours de disponibilité sans interruption, zero incident de sécurité, mises à jour
              en temps réel à moins de 30 secondes des sources officielles.
            </p>
          </div>
          <div style={{ flex: '1 1 220px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {STATS.map(s => (
              <div
                key={s.label}
                style={{
                  padding: '20px 16px',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.04)',
                  border: '0.5px solid rgba(255,255,255,0.10)',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--brand)', marginBottom: 4 }}>{s.value}</p>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cas d'usage ── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '72px 24px' }}>
        <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8, textAlign: 'center' }}>Pour tous les types d'événements</h2>
        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 48, fontSize: 15 }}>
          Une plateforme unique, adaptée à chaque contexte opérationnel.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {CASES.map(c => (
            <div
              key={c.title}
              style={{
                padding: '28px 24px',
                borderRadius: 20,
                background: 'rgba(255,255,255,0.035)',
                border: '0.5px solid rgba(255,255,255,0.10)',
              }}
            >
              <p style={{ fontSize: 32, marginBottom: 12 }}>{c.icon}</p>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{c.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Ce que vous obtenez ── */}
      <section style={{ background: 'rgba(255,255,255,0.03)', borderTop: '0.5px solid rgba(255,255,255,0.08)', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '72px 24px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 40, textAlign: 'center' }}>Ce que vous obtenez</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 32 }}>
            {[
              {
                title: '🗺️ Carte interactive dédiée',
                points: [
                  'Périmètre de l\'événement en temps réel',
                  'Trafic et incidents HERE Mobility API',
                  'Zones de stationnement + transports publics',
                  'Alertes officielles intégrées',
                ],
              },
              {
                title: '📡 Intelligence temps réel',
                points: [
                  'Agrégation de données officielles automatisée',
                  'Pushs Ably (< 1s de latence)',
                  'Mises à jour douanes/trafic toutes les 30s',
                  'Dashboard admin pour vos équipes',
                ],
              },
              {
                title: '📱 Expérience spectateur',
                points: [
                  'App PWA mobile (Android + iOS)',
                  'Itinéraires intelligents personnalisés',
                  'Alertes push pré-événement (Mon Trajet)',
                  '9 langues : FR, EN, DE, IT, ES, PT, AR, SQ, JA',
                ],
              },
              {
                title: '🔒 Fiabilité & sécurité',
                points: [
                  'Hébergement Vercel + Upstash eu-west-1',
                  'Aucune donnée personnelle vendue',
                  'RGPD by design (cookie consent, DPO)',
                  'Support 24/7 pendant l\'événement',
                ],
              },
            ].map(block => (
              <div key={block.title}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{block.title}</h3>
                <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {block.points.map(p => (
                    <li key={p} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--text-secondary)', fontSize: 14 }}>
                      <span style={{ color: 'var(--brand)', marginTop: 2 }}>✓</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TIF × Börja — synergie ── */}
      <section style={{ maxWidth: 820, margin: '0 auto', padding: '72px 24px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16, textAlign: 'center' }}>TIF + Börja — deux forces, un seul outil</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 600, margin: '0 auto 48px', lineHeight: 1.7 }}>
          TIF apporte la couche d\'intelligence territoriale. Börja Swiss Solutions apporte la conception
          produit, l\'intégration technique et le déploiement opérationnel. Ensemble, nous livrons en 48h
          ce qu'il faudrait normalement 6 mois à construire.
        </p>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            {
              label: 'TIF Framework',
              color: '#30D158',
              items: ['Cartographie temps réel', 'Données mobilité agrégées', 'APIs ouvertes (HERE, SBB, TPG)', 'Routing transfrontalier intelligent'],
            },
            {
              label: 'Börja Swiss Solutions',
              color: 'var(--brand)',
              items: ['Design produit & UX événementiel', 'Intégration & déploiement sur mesure', 'Dashboard admin personnalisé', 'Support événement live 24/7'],
            },
          ].map(col => (
            <div
              key={col.label}
              style={{
                flex: '1 1 300px',
                padding: '28px 24px',
                borderRadius: 20,
                border: `1.5px solid ${col.color}22`,
                background: `${col.color}08`,
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 700, color: col.color, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{col.label}</p>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.items.map(i => (
                  <li key={i} style={{ display: 'flex', gap: 10, color: 'var(--text-secondary)', fontSize: 14 }}>
                    <span style={{ color: col.color }}>→</span>{i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{
        margin: '0 24px 80px',
        maxWidth: 820,
        marginLeft: 'auto',
        marginRight: 'auto',
        borderRadius: 28,
        background: 'rgba(255,255,255,0.04)',
        border: '0.5px solid rgba(255,255,255,0.12)',
        padding: '56px 40px',
        textAlign: 'center',
      }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Votre prochain événement mérite la même intelligence que le G7</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32, maxWidth: 540, margin: '0 auto 32px', lineHeight: 1.65 }}>
          Décrivez-nous votre événement — lieu, date, nombre de spectateurs attendus.
          Nous vous revenons sous 24h avec une proposition adaptée.
        </p>
        <a
          href="mailto:contact@borja-swiss-solutions.ch?subject=Gestion événements de masse — projet"
          style={{
            display: 'inline-block',
            background: 'var(--brand)',
            color: '#fff',
            padding: '16px 40px',
            borderRadius: 100,
            fontWeight: 700,
            fontSize: 17,
            textDecoration: 'none',
          }}
        >
          contact@borja-swiss-solutions.ch →
        </a>
        <p style={{ marginTop: 20, fontSize: 13, color: 'var(--text-tertiary)' }}>
          Ou directement sur{' '}
          <a href="https://borja-swiss-solutions.ch" style={{ color: 'var(--brand)' }}>borja-swiss-solutions.ch</a>
        </p>
      </section>
    </div>
  )
}
