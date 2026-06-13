import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'

export const metadata: Metadata = {
  title: 'À propos & Mentions légales — TIF',
  description: 'TIF est une application gratuite de mobilité pour le Grand Genève, développée par Börja Swiss Solutions (Arun Calstas, Genève). Sources officielles, gratuit, sans publicité.',
  openGraph: {
    title: 'À propos de TIF — Intelligence Territoriale Grand Genève',
    description: 'Application gratuite de mobilité frontalière développée par Börja Swiss Solutions, Genève.',
  },
}

export default function AProposPage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Header />
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px 80px', color: 'var(--text-primary)', lineHeight: 1.6 }}>

        <h1 style={{ fontSize: 34, fontWeight: 800, marginBottom: 8 }}>À propos de TIF</h1>
        <p style={{ fontSize: 16, color: 'var(--text-tertiary)', marginBottom: 48 }}>Intelligence Territoriale — Grand Genève</p>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Qu'est-ce que TIF ?</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
            TIF (Territorial Intelligence Framework) est une application web <strong>gratuite et sans publicité</strong> qui centralise en temps réel les données de mobilité du Grand Genève : temps d'attente aux douanes, trafic, transports publics, alertes et événements.
          </p>
          <p style={{ color: 'var(--text-secondary)' }}>
            Développée pour le <strong>sommet du G7 à Évian-les-Bains (juin 2026)</strong>, elle s'adresse aux 90 000 frontaliers, habitants et visiteurs de la région transfrontalière franco-suisse.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Éditeur</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
            <strong>Arun Calstas</strong><br />
            Fondateur — Börja Swiss Solutions<br />
            Genève, Suisse
          </p>
          <p style={{ color: 'var(--text-secondary)' }}>
            Site web :{' '}
            <a href="https://borja-swiss-solutions.ch" style={{ color: 'var(--brand)' }}>borja-swiss-solutions.ch</a>
            <br />
            Contact :{' '}
            <a href="mailto:contact@borja-swiss-solutions.ch" style={{ color: 'var(--brand)' }}>contact@borja-swiss-solutions.ch</a>
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Sources de données</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Toutes les données proviennent de sources officielles publiques :</p>
          <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>Police Cantonale Genevoise (ge.ch)</li>
            <li>Office fédéral des douanes et de la sécurité des frontières (OFDF)</li>
            <li>Office fédéral des routes (OFROU)</li>
            <li>TPG — Transports Publics Genevois</li>
            <li>CFF — Chemins de Fer Fédéraux</li>
            <li>HERE Mobility API (données trafic)</li>
            <li>OpenStreetMap (fond de carte)</li>
          </ul>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 12 }}>
            Données mises à jour toutes les 2 à 5 minutes. TIF n'est pas affilié aux autorités officielles.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Données personnelles & confidentialité</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>TIF collecte uniquement :</p>
          <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>L'adresse IP (anonymisée, non stockée) pour la géolocalisation</li>
            <li>Les préférences de langue (stockées localement dans le navigateur)</li>
            <li>Les données d'authentification optionnelle (Firebase Auth — email uniquement)</li>
          </ul>
          <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>
            TIF <strong>ne vend aucune donnée</strong> et n'affiche <strong>aucune publicité</strong>. Conforme à la LPD (loi suisse) et au RGPD.
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 8 }}>
            Hébergement : Vercel Inc. (San Francisco, USA) — chiffrement TLS 1.3 en transit.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Gratuité & financement</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            TIF est entièrement gratuit. Financé bénévolement par{' '}
            <a href="https://borja-swiss-solutions.ch" style={{ color: 'var(--brand)' }}>Börja Swiss Solutions</a>{' '}
            comme service civique pendant le G7. Un{' '}
            <a href="/donate" style={{ color: 'var(--brand)' }}>bouton de don</a>{' '}
            permet de soutenir les coûts d'infrastructure.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Technologies</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Next.js 15, React 19, Mapbox GL JS, Firebase Auth, Redis (Upstash), PostgreSQL (Neon), Prisma, Claude AI (Anthropic), HERE Mobility API, Inngest, Vercel, PostHog.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Contact</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Pour toute question ou signalement d'erreur :{' '}
            <a href="mailto:contact@borja-swiss-solutions.ch" style={{ color: 'var(--brand)' }}>contact@borja-swiss-solutions.ch</a>
          </p>
        </section>

        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          © 2026 Börja Swiss Solutions — Genève, Suisse. Dernière mise à jour : 13 juin 2026.
        </p>
      </main>
    </div>
  )
}
