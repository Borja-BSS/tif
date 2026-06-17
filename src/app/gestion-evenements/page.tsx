import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'

export const metadata: Metadata = {
  title: "Gestion d'événements de masse — TIF × Börja Swiss Solutions",
  description:
    "Plateforme d'intelligence territoriale pour festivals, concerts, manifestations et événements sportifs en Suisse et Grand Genève. " +
    "Mobilité en temps réel, alertes, douanes, transport — éprouvé au G7 Évian 2026 (10'000+ utilisateurs).",
  openGraph: {
    title: "Gestion d'événements de grande envergure — TIF × Börja",
    description:
      "Festivals · Concerts · Foot · Manifestations : une plateforme mobilité déployée en 48h, éprouvée au G7 Évian 2026.",
    url: 'https://tif.borja-swiss-solutions.ch/gestion-evenements',
    images: [{ url: '/borja-og.png', width: 900, height: 639, alt: "TIF × Börja — Événements de masse" }],
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
  name: "TIF — Gestion d'événements de masse",
  description:
    "Plateforme d'intelligence territoriale pour la gestion de la mobilité lors d'événements de grande envergure : festivals, concerts, manifestations, football.",
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
  serviceType: "Intelligence territoriale · Mobilité événementielle",
  offers: { '@type': 'Offer', availability: 'https://schema.org/InStock' },
}

const CASES = [
  {
    icon: '🎪',
    title: 'Festivals',
    desc: "Montreux Jazz, Paléo, Fête de la Musique, Balélec : anticiper l'afflux, gérer les parkings et les transports en temps réel.",
  },
  {
    icon: '🎤',
    title: 'Concerts & shows',
    desc: "Arena, Victoria Hall, Palexpo : flux d'entrée et sortie, trafic autour du site, alertes automatiques pour les spectateurs.",
  },
  {
    icon: '✊',
    title: 'Manifestations',
    desc: "Cortèges, rassemblements : périmètres dynamiques, déviations TPG, douanes et points de blocage en temps réel.",
  },
  {
    icon: '⚽',
    title: 'Football & sport',
    desc: "Matchs Stade de Genève, Mondial 2026, tournois : zones de fan, transports publics, coordination avec les services de sécurité.",
  },
  {
    icon: '🏛️',
    title: 'Sommets & conférences',
    desc: "G7 Évian 2026, cas réel. Carte live pour 10'000+ utilisateurs, 46 douanes, alertes officielles, itinéraires intelligents.",
  },
  {
    icon: '🎆',
    title: "Feux d'artifice & kermesses",
    desc: "Fêtes nationales, feux du lac : afflux concentré, fermetures de rues, transport lacustre CGN intégré.",
  },
]

const STATS = [
  { value: "+10'000", label: 'utilisateurs actifs G7 2026' },
  { value: '46', label: 'postes douaniers surveillés' },
  { value: '48h', label: "déploiement d'une instance dédiée" },
  { value: '15j', label: 'de disponibilité ininterrompue G7' },
  { value: '7', label: 'sources officielles agrégées' },
  { value: '9', label: 'langues supportées' },
]

const CARD: React.CSSProperties = {
  display: 'block',
  textDecoration: 'none',
  color: 'inherit',
  padding: '28px 24px',
  borderRadius: 20,
  background: 'rgba(128,128,128,0.06)',
  border: '0.5px solid rgba(128,128,128,0.15)',
  cursor: 'pointer',
  transition: 'border-color 0.18s, background 0.18s',
}

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
          Festivals, concerts, manifestations, football : nous livrons une plateforme cartographique
          temps réel, éprouvée au G7 Évian 2026, adaptée à votre territoire et à votre audience.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="#contact"
            style={{
              display: 'inline-block',
              background: 'var(--brand)',
              color: 'var(--text-primary)',
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
              border: '1.5px solid var(--border)',
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
      <section style={{ background: 'var(--bg-secondary)', borderTop: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', padding: '56px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 48, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 300px' }}>
            <p style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>Cas réel · Juin 2026</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>G7 Évian-les-Bains, éprouvé sous pression réelle</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
              Lors du sommet du G7 (15–17 juin 2026), TIF a agrégé en continu les données de 46 postes
              frontaliers, les alertes officielles du canton de Genève, les perturbations TPG et CFF,
              et les restrictions de l&apos;espace aérien, pour 10&apos;000+ utilisateurs actifs dans le Grand Genève.
            </p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              15 jours de disponibilité sans interruption, zéro incident de sécurité, mises à jour
              en temps réel à moins de 30 secondes des sources officielles.
            </p>
          </div>
          <div style={{ flex: '1 1 220px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {STATS.map(s => (
              <a
                key={s.label}
                href="#contact"
                style={{
                  ...CARD,
                  padding: '20px 16px',
                  borderRadius: 16,
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--brand)', marginBottom: 4 }}>{s.value}</p>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{s.label}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cas d'usage ── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '72px 24px' }}>
        <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8, textAlign: 'center' }}>Pour tous les types d&apos;événements</h2>
        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 48, fontSize: 15 }}>
          Une plateforme unique, adaptée à chaque contexte opérationnel.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {CASES.map(c => (
            <a key={c.title} href="#contact" style={CARD}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>{c.icon}</p>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{c.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{c.desc}</p>
            </a>
          ))}
        </div>
      </section>

      {/* ── Ce que vous obtenez ── */}
      <section style={{ background: 'var(--bg-secondary)', borderTop: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', padding: '72px 24px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 40, textAlign: 'center' }}>Ce que vous obtenez</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
            {[
              {
                title: '🗺️ Carte interactive dédiée',
                points: [
                  "Périmètre de l'événement en temps réel",
                  'Trafic et incidents HERE Mobility API',
                  'Zones de stationnement et transports publics',
                  'Alertes officielles intégrées',
                ],
              },
              {
                title: '📡 Intelligence temps réel',
                points: [
                  'Agrégation de données officielles automatisée',
                  'Pushs Ably (moins de 1s de latence)',
                  'Mises à jour douanes/trafic toutes les 30s',
                  'Dashboard admin pour vos équipes',
                ],
              },
              {
                title: '📱 Expérience spectateur',
                points: [
                  'App PWA mobile (Android et iOS)',
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
                  "Support 24/7 pendant l'événement",
                ],
              },
            ].map(block => (
              <a key={block.title} href="#contact" style={CARD}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{block.title}</h3>
                <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {block.points.map(p => (
                    <li key={p} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--text-secondary)', fontSize: 14 }}>
                      <span style={{ color: 'var(--brand)', marginTop: 2 }}>✓</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Validation médias & utilisateurs ── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '72px 24px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, textAlign: 'center' }}>Validé par les médias et les utilisateurs</h2>
        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 56, fontSize: 15 }}>
          TIF a été déployé lors du G7 Évian 2026 et couvert par la presse régionale et nationale.
        </p>

        {/* Presse */}
        <div style={{ marginBottom: 56 }}>
          <p style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 28 }}>Vu dans la presse</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', alignItems: 'center' }}>
            {[
              { name: 'Le Temps', abbr: 'LT' },
              { name: 'RTS', abbr: 'RTS' },
              { name: 'Tribune de Genève', abbr: 'TdG' },
              { name: '20 Minutes', abbr: '20m' },
              { name: 'Heidi.news', abbr: 'HN' },
            ].map(m => (
              <div
                key={m.name}
                style={{
                  padding: '12px 24px',
                  borderRadius: 12,
                  border: '0.5px solid var(--border)',
                  background: 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minWidth: 140,
                  justifyContent: 'center',
                }}
              >
                <span style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--brand-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, color: 'var(--brand)', flexShrink: 0,
                  letterSpacing: '0.04em',
                }}>{m.abbr}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{m.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Validation utilisateurs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          <a href="#contact" style={CARD}>
            <p style={{ fontSize: 40, marginBottom: 8 }}>⭐</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--brand)', marginBottom: 4 }}>10'000+</p>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>utilisateurs actifs · G7 2026</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Frontaliers, habitants, visiteurs : la plateforme a été adoptée spontanément
              dès les premières 48h de déploiement, sans campagne publicitaire.
            </p>
          </a>
          <a href="#contact" style={CARD}>
            <p style={{ fontSize: 40, marginBottom: 8 }}>📡</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--brand)', marginBottom: 4 }}>15 jours</p>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>de disponibilité ininterrompue</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Zéro incident de sécurité, zéro interruption de service sur toute la durée du sommet,
              mises à jour en moins de 30 secondes des sources officielles.
            </p>
          </a>
          <a href="#contact" style={CARD}>
            <p style={{ fontSize: 40, marginBottom: 8 }}>🌍</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--brand)', marginBottom: 4 }}>9 langues</p>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>accessibilité internationale</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              FR · EN · DE · IT · ES · PT · AR · SQ · JA : TIF a servi les délégations
              et les journalistes accrédités du monde entier présents à Genève.
            </p>
          </a>
        </div>
      </section>

      {/* ── Conformité : RGPD · nLPD · vie privée ── */}
      <section style={{ background: 'var(--bg-secondary)', borderTop: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', padding: '72px 24px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, textAlign: 'center' }}>Respect de la vie privée</h2>
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 48, fontSize: 15, maxWidth: 560, margin: '0 auto 48px' }}>
            Conformité totale RGPD (UE 2016/679) et nLPD suisse (en vigueur depuis septembre 2023).
            Conçue dès le départ pour protéger les données de vos participants.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {[
              {
                badge: 'RGPD',
                icon: '🇪🇺',
                title: 'Conforme au RGPD',
                desc: "Consentement explicite (cookie banner), droit d'accès et de suppression, traitement documenté. Données stockées exclusivement dans l'UE (Vercel EU, Upstash eu-west-1).",
              },
              {
                badge: 'nLPD',
                icon: '🇨🇭',
                title: 'Conforme à la nLPD suisse',
                desc: "Respect de la Loi fédérale sur la Protection des Données révisée (sept. 2023) : minimisation des données, sécurité by design, obligation de notification en cas de violation.",
              },
              {
                badge: '0 vente',
                icon: '🔒',
                title: 'Zéro revente de données',
                desc: "Aucune donnée personnelle vendue ou partagée avec des tiers à des fins commerciales. Aucune publicité ciblée. Le modèle économique est basé sur les services B2B, pas sur les données.",
              },
              {
                badge: 'DPO',
                icon: '📋',
                title: 'Responsable du traitement identifié',
                desc: "Arun Calstas — Börja Swiss Solutions, Genève. Contact DPO : contact@borja-swiss-solutions.ch. Registre des traitements tenu à jour et disponible sur demande.",
              },
            ].map(block => (
              <a key={block.badge} href="#contact" style={CARD}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 22 }}>{block.icon}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                    background: 'var(--brand-subtle)', color: 'var(--brand)',
                    padding: '3px 8px', borderRadius: 6,
                  }}>{block.badge}</span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{block.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{block.desc}</p>
              </a>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: 'var(--text-tertiary)' }}>
            Politique de confidentialité complète disponible sur{' '}
            <a href="/a-propos" style={{ color: 'var(--brand)' }}>tif.borja-swiss-solutions.ch/a-propos</a>
          </p>
        </div>
      </section>

      {/* ── TIF × Börja — synergie ── */}
      <section style={{ maxWidth: 820, margin: '0 auto', padding: '72px 24px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16, textAlign: 'center' }}>TIF + Börja : deux forces, un seul outil</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 600, margin: '0 auto 48px', lineHeight: 1.7 }}>
          TIF apporte la couche d&apos;intelligence territoriale. Börja Swiss Solutions apporte la conception
          produit, l&apos;intégration technique et le déploiement opérationnel. Ensemble, nous livrons en 48h
          ce qu&apos;il faudrait normalement 6 mois à construire.
        </p>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            {
              label: 'TIF Framework',
              color: '#30D158',
              href: '/map',
              items: [
                'Cartographie temps réel',
                'Données mobilité agrégées',
                'APIs ouvertes (HERE, SBB, TPG)',
                'Routing transfrontalier intelligent',
              ],
            },
            {
              label: 'Börja Swiss Solutions',
              color: 'var(--brand)',
              href: 'https://borja-swiss-solutions.ch',
              items: [
                'Design produit & UX événementiel',
                'Intégration & déploiement sur mesure',
                'Dashboard admin personnalisé',
                'Support événement live 24/7',
              ],
            },
          ].map(col => (
            <a
              key={col.label}
              href={col.href}
              style={{
                flex: '1 1 300px',
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                padding: '28px 24px',
                borderRadius: 20,
                border: `1.5px solid color-mix(in srgb, ${col.color} 20%, transparent)`,
                background: `color-mix(in srgb, ${col.color} 6%, transparent)`,
                cursor: 'pointer',
                transition: 'border-color 0.18s',
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
            </a>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section
        id="contact"
        style={{
          margin: '0 24px 80px',
          maxWidth: 820,
          marginLeft: 'auto',
          marginRight: 'auto',
          borderRadius: 28,
          background: 'var(--bg-card)',
          border: '0.5px solid var(--border)',
          padding: '56px 40px',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Votre prochain événement mérite la même intelligence que le G7</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32, maxWidth: 540, margin: '0 auto 32px', lineHeight: 1.65 }}>
          Décrivez-nous votre événement : lieu, date, nombre de spectateurs attendus.
          Nous vous revenons sous 24h avec une proposition adaptée.
        </p>
        <a
          href="mailto:contact@borja-swiss-solutions.ch?subject=Gestion événements de masse — projet"
          style={{
            display: 'inline-block',
            background: 'var(--brand)',
            color: 'var(--text-primary)',
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
