import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description:
    'Politique de confidentialité et protection des données personnelles de TIF — Intelligence Territoriale Grand Genève. Conforme RGPD (UE) et nLPD (Suisse).',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://tif.borja-swiss-solutions.ch/privacy' },
}

const S = {
  page: {
    minHeight: '100vh',
    padding: '48px 24px 80px',
    maxWidth: '800px',
    margin: '0 auto',
  } as React.CSSProperties,
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    borderRadius: '100px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    background: 'rgba(10,132,255,0.12)',
    color: '#0A84FF',
    border: '1px solid rgba(10,132,255,0.25)',
    marginBottom: '20px',
  },
  h1: {
    fontSize: 'clamp(26px, 5vw, 36px)',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.15,
    marginBottom: '12px',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '15px',
    lineHeight: 1.6,
    opacity: 0.6,
    marginBottom: '8px',
  } as React.CSSProperties,
  updated: {
    fontSize: '12px',
    opacity: 0.4,
    marginBottom: '48px',
  } as React.CSSProperties,
  divider: {
    height: '1px',
    background: 'rgba(128,128,128,0.15)',
    margin: '40px 0',
  } as React.CSSProperties,
  section: {
    marginBottom: '36px',
  } as React.CSSProperties,
  h2: {
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    marginBottom: '14px',
  } as React.CSSProperties,
  h3: {
    fontSize: '14px',
    fontWeight: 700,
    opacity: 0.7,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: '8px',
    marginTop: '20px',
  } as React.CSSProperties,
  p: {
    fontSize: '14px',
    lineHeight: 1.75,
    opacity: 0.75,
    marginBottom: '12px',
  } as React.CSSProperties,
  ul: {
    fontSize: '14px',
    lineHeight: 1.75,
    opacity: 0.75,
    paddingLeft: '20px',
    marginBottom: '12px',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
    marginBottom: '16px',
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: '8px 12px',
    fontWeight: 700,
    fontSize: '11px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    opacity: 0.45,
    borderBottom: '1px solid rgba(128,128,128,0.2)',
  } as React.CSSProperties,
  td: {
    padding: '10px 12px',
    verticalAlign: 'top' as const,
    borderBottom: '1px solid rgba(128,128,128,0.1)',
    opacity: 0.75,
    lineHeight: 1.6,
  } as React.CSSProperties,
  infoBox: {
    padding: '16px 20px',
    borderRadius: '14px',
    background: 'rgba(10,132,255,0.07)',
    border: '1px solid rgba(10,132,255,0.2)',
    fontSize: '13px',
    lineHeight: 1.6,
    marginBottom: '16px',
  } as React.CSSProperties,
  contactBox: {
    padding: '20px 24px',
    borderRadius: '16px',
    background: 'rgba(128,128,128,0.06)',
    border: '1px solid rgba(128,128,128,0.15)',
    fontSize: '14px',
    lineHeight: 1.75,
  } as React.CSSProperties,
}

export default function PrivacyPage() {
  return (
    <main style={S.page}>

      {/* Header */}
      <div style={S.badge}>🛡️ Données &amp; Confidentialité</div>
      <h1 style={S.h1}>Politique de confidentialité</h1>
      <p style={S.subtitle}>
        Cette politique décrit comment TIF collecte, utilise et protège vos données personnelles,
        conformément au Règlement général sur la protection des données (RGPD / UE 2016/679)
        et à la nouvelle Loi fédérale sur la protection des données (nLPD, en vigueur depuis le 1er septembre 2023).
      </p>
      <p style={S.updated}>Dernière mise à jour : 15 juin 2026</p>

      <div style={S.divider} />

      {/* 1. Responsable du traitement */}
      <section style={S.section}>
        <h2 style={S.h2}>1. Responsable du traitement</h2>
        <div style={S.contactBox}>
          <strong>Börja Swiss Solutions</strong><br />
          Genève, Suisse<br />
          <br />
          <strong>Délégué à la protection des données (DPO)</strong><br />
          Arun Calstas<br />
          <a href="mailto:privacy@borja-swiss-solutions.ch" style={{ color: '#0A84FF' }}>privacy@borja-swiss-solutions.ch</a><br />
          ou <a href="mailto:aruncalstas@gmail.com" style={{ color: '#0A84FF' }}>aruncalstas@gmail.com</a>
        </div>
        <p style={S.p}>
          TIF (Intelligence Territoriale) est une application de mobilité temps réel pour le Grand Genève,
          développée et opérée par Börja Swiss Solutions. L'application est accessible à l'adresse{' '}
          <a href="https://tif.borja-swiss-solutions.ch" style={{ color: '#0A84FF' }}>
            tif.borja-swiss-solutions.ch
          </a>.
        </p>
      </section>

      <div style={S.divider} />

      {/* 2. Données collectées */}
      <section style={S.section}>
        <h2 style={S.h2}>2. Données collectées et finalités</h2>

        <h3 style={S.h3}>2.1 Utilisation anonyme (sans compte)</h3>
        <p style={S.p}>
          L'application est utilisable sans créer de compte. Dans ce cadre, seules les données suivantes
          peuvent être collectées :
        </p>
        <ul style={S.ul}>
          <li><strong>Localisation GPS</strong> — uniquement si vous l'autorisez explicitement, pour centrer la carte sur votre position. Non transmise à nos serveurs.</li>
          <li><strong>Identifiant de session anonyme</strong> — un UUID aléatoire généré localement (localStorage), utilisé pour les statistiques d'usage agrégées. Non lié à votre identité.</li>
          <li><strong>Données d'analyse anonymes</strong> — type d'événement, pays (déduit du réseau), horodatage. Aucune information personnelle identifiable.</li>
          <li><strong>Présence active</strong> — un ping technique envoyé toutes les 60 secondes pour comptabiliser le nombre d'utilisateurs connectés en temps réel (sans identification).</li>
        </ul>

        <h3 style={S.h3}>2.2 Signalements</h3>
        <p style={S.p}>
          Si vous soumettez un signalement (incident de circulation, présence policière, etc.), nous collectons :
          la catégorie et sous-catégorie du signalement, le niveau de priorité, une description textuelle libre,
          une adresse ou des coordonnées GPS, et d'éventuels médias joints. Ces données sont soumises
          à modération avant publication. <strong>Elles ne sont pas liées à votre identité.</strong>
        </p>
        <div style={S.infoBox}>
          Attention : évitez d'inclure des données personnelles (noms, plaques d'immatriculation, etc.)
          dans vos descriptions de signalements, car ceux-ci peuvent être visibles publiquement après validation.
        </div>

        <h3 style={S.h3}>2.3 Compte utilisateur (fonctions avancées)</h3>
        <p style={S.p}>
          Si vous créez un compte, nous collectons et traitons :
        </p>
        <ul style={S.ul}>
          <li><strong>Adresse email</strong> — stockée sous forme chiffrée et hachée (pseudonymisation). Utilisée pour l'authentification et les notifications.</li>
          <li><strong>Consentements</strong> — vos préférences de consentement (localisation, mobilité, présence réseau) avec horodatage et version.</li>
          <li><strong>Trajets favoris</strong> — itinéraire, horaires, jours actifs, mode de transport. Utilisés pour vous envoyer des alertes personnalisées.</li>
          <li><strong>Données de session</strong> — adresse IP hachée, empreinte d'appareil hachée, user agent. Utilisées pour la sécurité.</li>
        </ul>

        <h3 style={S.h3}>2.4 Formulaire de contact</h3>
        <p style={S.p}>
          Si vous nous contactez via le formulaire, nous collectons votre nom, adresse email et message.
          Ces données sont utilisées uniquement pour répondre à votre demande.
        </p>
      </section>

      <div style={S.divider} />

      {/* 3. Base légale */}
      <section style={S.section}>
        <h2 style={S.h2}>3. Base légale des traitements</h2>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Traitement</th>
              <th style={S.th}>Base légale (RGPD)</th>
              <th style={S.th}>Base légale (nLPD)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={S.td}>Statistiques d&apos;usage anonymes</td>
              <td style={S.td}>Art. 6(1)(f) — intérêt légitime</td>
              <td style={S.td}>Art. 31 — intérêt prépondérant</td>
            </tr>
            <tr>
              <td style={S.td}>Localisation GPS</td>
              <td style={S.td}>Art. 6(1)(a) — consentement</td>
              <td style={S.td}>Art. 6(6) — consentement</td>
            </tr>
            <tr>
              <td style={S.td}>Compte utilisateur &amp; authentification</td>
              <td style={S.td}>Art. 6(1)(b) — exécution d&apos;un contrat</td>
              <td style={S.td}>Art. 31 — nécessité contractuelle</td>
            </tr>
            <tr>
              <td style={S.td}>Trajets favoris &amp; alertes email</td>
              <td style={S.td}>Art. 6(1)(a) — consentement</td>
              <td style={S.td}>Art. 6(6) — consentement</td>
            </tr>
            <tr>
              <td style={S.td}>Sécurité des sessions (IP hachée)</td>
              <td style={S.td}>Art. 6(1)(f) — intérêt légitime</td>
              <td style={S.td}>Art. 31 — intérêt prépondérant</td>
            </tr>
            <tr>
              <td style={S.td}>Formulaire de contact</td>
              <td style={S.td}>Art. 6(1)(b) — contrat / pré-contractuel</td>
              <td style={S.td}>Art. 31 — nécessité contractuelle</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div style={S.divider} />

      {/* 4. Sous-traitants */}
      <section style={S.section}>
        <h2 style={S.h2}>4. Sous-traitants et transferts de données</h2>
        <p style={S.p}>
          TIF fait appel aux prestataires techniques suivants. Chacun opère sous accord de traitement
          des données (DPA) conforme au RGPD et/ou à la nLPD :
        </p>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Prestataire</th>
              <th style={S.th}>Usage</th>
              <th style={S.th}>Localisation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={S.td}><strong>Vercel Inc.</strong></td>
              <td style={S.td}>Hébergement &amp; déploiement</td>
              <td style={S.td}>UE / US (clauses contractuelles types)</td>
            </tr>
            <tr>
              <td style={S.td}><strong>Google Firebase</strong></td>
              <td style={S.td}>Authentification utilisateurs</td>
              <td style={S.td}>US (DPA Google disponible)</td>
            </tr>
            <tr>
              <td style={S.td}><strong>Mapbox Inc.</strong></td>
              <td style={S.td}>Cartographie &amp; tuiles</td>
              <td style={S.td}>US (DPA Mapbox disponible)</td>
            </tr>
            <tr>
              <td style={S.td}><strong>Neon (PostgreSQL)</strong></td>
              <td style={S.td}>Base de données principale</td>
              <td style={S.td}>UE — Frankfurt ✅</td>
            </tr>
            <tr>
              <td style={S.td}><strong>Upstash (Redis)</strong></td>
              <td style={S.td}>Cache &amp; signalements</td>
              <td style={S.td}>UE — eu-west-1 ✅</td>
            </tr>
            <tr>
              <td style={S.td}><strong>Infomaniak</strong></td>
              <td style={S.td}>Envoi d&apos;emails transactionnels</td>
              <td style={S.td}>Suisse ✅</td>
            </tr>
          </tbody>
        </table>
        <p style={S.p}>
          En utilisant la carte interactive, votre navigateur communique avec les serveurs de Mapbox
          pour charger les tuiles cartographiques. Cette communication inclut votre adresse IP
          et la zone géographique consultée. Consultez la{' '}
          <a href="https://www.mapbox.com/legal/privacy" style={{ color: '#0A84FF' }} target="_blank" rel="noopener noreferrer">
            politique de confidentialité de Mapbox
          </a>.
        </p>
      </section>

      <div style={S.divider} />

      {/* 5. Conservation */}
      <section style={S.section}>
        <h2 style={S.h2}>5. Durée de conservation</h2>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Données</th>
              <th style={S.th}>Durée</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={S.td}>Sessions authentifiées</td>
              <td style={S.td}>Jusqu&apos;à expiration ou déconnexion</td>
            </tr>
            <tr>
              <td style={S.td}>Signalements approuvés</td>
              <td style={S.td}>Durée de l&apos;événement + 90 jours maximum</td>
            </tr>
            <tr>
              <td style={S.td}>Données de compte (email, consentements)</td>
              <td style={S.td}>Pendant la durée du compte + 1 an après suppression</td>
            </tr>
            <tr>
              <td style={S.td}>Trajets favoris</td>
              <td style={S.td}>Jusqu&apos;à suppression par l&apos;utilisateur ou 12 mois d&apos;inactivité</td>
            </tr>
            <tr>
              <td style={S.td}>Analytics anonymes</td>
              <td style={S.td}>12 mois glissants</td>
            </tr>
            <tr>
              <td style={S.td}>Formulaires de contact</td>
              <td style={S.td}>3 ans à compter de la dernière interaction</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div style={S.divider} />

      {/* 6. Cookies */}
      <section style={S.section}>
        <h2 style={S.h2}>6. Cookies et stockage local</h2>
        <p style={S.p}>
          TIF n&apos;utilise <strong>aucun cookie tiers</strong> à des fins publicitaires ou de tracking.
          Nous utilisons uniquement le stockage local (localStorage / sessionStorage) de votre navigateur :
        </p>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Clé</th>
              <th style={S.th}>Contenu</th>
              <th style={S.th}>Type</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={S.td}><code>tif-consent-v1</code></td>
              <td style={S.td}>Vos choix de consentement (analytics, géolocalisation)</td>
              <td style={S.td}>Fonctionnel</td>
            </tr>
            <tr>
              <td style={S.td}><code>tif-sid</code></td>
              <td style={S.td}>Identifiant de session anonyme (UUID aléatoire)</td>
              <td style={S.td}>Analytique anonyme</td>
            </tr>
            <tr>
              <td style={S.td}><code>tif-theme</code></td>
              <td style={S.td}>Préférence d&apos;affichage (clair / sombre)</td>
              <td style={S.td}>Fonctionnel</td>
            </tr>
          </tbody>
        </table>
        <p style={S.p}>
          Vous pouvez supprimer ces données à tout moment depuis les paramètres de votre navigateur
          (Outils → Effacer les données de navigation → Stockage local).
        </p>
        <p style={S.p}>
          Mapbox GL JS peut stocker des données techniques dans votre navigateur pour la performance
          cartographique. Ces données ne sont pas accessibles par TIF.
        </p>
      </section>

      <div style={S.divider} />

      {/* 7. Droits */}
      <section style={S.section}>
        <h2 style={S.h2}>7. Vos droits</h2>
        <p style={S.p}>
          Conformément au RGPD (Art. 15 à 22) et à la nLPD (Art. 25 à 32), vous disposez des droits suivants :
        </p>
        <ul style={S.ul}>
          <li><strong>Droit d&apos;accès</strong> — obtenir une copie de vos données personnelles</li>
          <li><strong>Droit de rectification</strong> — corriger des données inexactes</li>
          <li><strong>Droit à l&apos;effacement</strong> — demander la suppression de vos données («droit à l&apos;oubli»)</li>
          <li><strong>Droit à la portabilité</strong> — recevoir vos données dans un format structuré et lisible par machine</li>
          <li><strong>Droit d&apos;opposition</strong> — vous opposer à un traitement fondé sur l&apos;intérêt légitime</li>
          <li><strong>Droit de retrait du consentement</strong> — retirer votre consentement à tout moment, sans affecter la licéité des traitements passés</li>
          <li><strong>Droit à la limitation</strong> — demander la suspension temporaire d&apos;un traitement</li>
        </ul>
        <p style={S.p}>
          Pour exercer ces droits, contactez notre DPO par email à{' '}
          <a href="mailto:privacy@borja-swiss-solutions.ch" style={{ color: '#0A84FF' }}>
            privacy@borja-swiss-solutions.ch
          </a>{' '}
          en précisant votre demande. Nous répondrons dans un délai de 30 jours (RGPD Art. 12).
        </p>
        <div style={S.infoBox}>
          <strong>Réclamation auprès d&apos;une autorité de contrôle</strong><br />
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez déposer une réclamation
          auprès du <a href="https://www.edoeb.admin.ch" style={{ color: '#0A84FF' }} target="_blank" rel="noopener noreferrer">
            Préposé fédéral à la protection des données et à la transparence (PFPDT)
          </a> en Suisse, ou auprès de l&apos;autorité de protection des données de votre pays de résidence au sein de l&apos;UE.
        </div>
      </section>

      <div style={S.divider} />

      {/* 8. Sécurité */}
      <section style={S.section}>
        <h2 style={S.h2}>8. Sécurité des données</h2>
        <p style={S.p}>
          TIF met en œuvre les mesures techniques et organisationnelles suivantes pour protéger vos données :
        </p>
        <ul style={S.ul}>
          <li>Chiffrement des communications (HTTPS / TLS)</li>
          <li>Pseudonymisation des emails (hachage + chiffrement en base)</li>
          <li>Hachage des adresses IP et empreintes d&apos;appareils</li>
          <li>Authentification sécurisée via Firebase (tokens éphémères)</li>
          <li>Infrastructure hébergée dans l&apos;Union Européenne pour les données sensibles</li>
          <li>Accès administrateur restreint à une liste nominative d&apos;adresses email autorisées</li>
        </ul>
      </section>

      <div style={S.divider} />

      {/* 9. Mineurs */}
      <section style={S.section}>
        <h2 style={S.h2}>9. Personnes mineures</h2>
        <p style={S.p}>
          TIF est une application d&apos;information publique accessible à tous. Nous ne collectons pas
          sciemment de données personnelles concernant des enfants de moins de 16 ans dans le cadre
          de la création de comptes. Si vous êtes parent ou tuteur et pensez que votre enfant nous a
          transmis des données personnelles, contactez notre DPO pour en demander la suppression.
        </p>
      </section>

      <div style={S.divider} />

      {/* 10. Modifications */}
      <section style={S.section}>
        <h2 style={S.h2}>10. Modifications de cette politique</h2>
        <p style={S.p}>
          Nous pouvons mettre à jour cette politique pour refléter des changements dans nos pratiques
          ou dans la législation applicable. En cas de modification substantielle, les utilisateurs
          disposant d&apos;un compte seront informés par email. La date de dernière mise à jour est
          indiquée en haut de cette page.
        </p>
        <p style={S.p}>
          La version en vigueur est toujours accessible à l&apos;adresse{' '}
          <a href="https://tif.borja-swiss-solutions.ch/privacy" style={{ color: '#0A84FF' }}>
            tif.borja-swiss-solutions.ch/privacy
          </a>.
        </p>
      </section>

      <div style={S.divider} />

      {/* 11. Contact */}
      <section style={S.section}>
        <h2 style={S.h2}>11. Contact</h2>
        <div style={S.contactBox}>
          <strong>DPO — Arun Calstas</strong><br />
          <a href="mailto:privacy@borja-swiss-solutions.ch" style={{ color: '#0A84FF' }}>
            privacy@borja-swiss-solutions.ch
          </a>
          <br /><br />
          <strong>Responsable du traitement</strong><br />
          Börja Swiss Solutions<br />
          Genève, Suisse<br />
          <a href="https://borja-swiss-solutions.ch" style={{ color: '#0A84FF' }} target="_blank" rel="noopener noreferrer">
            borja-swiss-solutions.ch
          </a>
        </div>
      </section>

      {/* Back nav */}
      <div style={{ marginTop: '48px' }}>
        <Link
          href="/"
          style={{
            fontSize: '13px',
            color: '#0A84FF',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          ← Retour à l&apos;accueil
        </Link>
      </div>

    </main>
  )
}
