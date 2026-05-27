// seed-g7.mjs — Peuple G7Source + G7Directive à partir des directives officielles connues
// Usage: node scripts/seed-g7.mjs
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// ── Sources à surveiller ──────────────────────────────────────────────────────
const SOURCES = [
  {
    url:      'https://www.eda.admin.ch/fr/sommet-du-g7-a-evian',
    label:    'EDA — Sommet du G7 à Évian',
    category: 'federal',
  },
  {
    url:      'https://www.ge.ch/document/sommet-du-g7-2026-evian-faq',
    label:    'Canton GE — FAQ G7 Évian',
    category: 'cantonal',
  },
  {
    url:      'https://www.ge.ch/communiques-presse/conseil-detat',
    label:    'Canton GE — Communiqués Conseil d'État',
    category: 'cantonal',
  },
  {
    url:      'https://www.admin.ch/gov/fr/accueil/documentation/communiques.msg-id-110000.html',
    label:    'Confédération — Communiqués de presse',
    category: 'federal',
  },
  {
    url:      'https://www.ge.ch/document/sommet-du-g7-evian-suggestions-eviter-perturbations',
    label:    'Canton GE — Mobilité G7 suggestions',
    category: 'cantonal',
  },
  {
    url:      'https://www.ofdf.admin.ch/ofdf/fr/home/documentation/communiques-de-presse.html',
    label:    'OFDF — Douanes communiqués',
    category: 'federal',
  },
]

// ── Directives officielles déjà connues ──────────────────────────────────────
const DIRECTIVES = [
  {
    publishedAt: new Date('2025-11-26T00:00:00Z'),
    authority:   'Conseil d\'État Genève',
    category:    'DEMONSTRATION_RULES',
    title:       'Restrictions temporaires des manifestations liées au G7 à Évian',
    summary:     'Du 1er au 28 juin 2026, les manifestations sportives, culturelles et festives au centre-ville de Genève ayant un fort impact sur le domaine public ne peuvent pas être autorisées. Exceptions : Bol d\'Or (5-7 juin), Fête de la musique (19-21 juin), Fêtes des écoles (22-28 juin).',
    url:         'https://www.ge.ch/communiques-presse/conseil-detat',
    severity:    'MEDIUM',
    impact:      ['manifestations', 'domaine_public', 'juin_2026'],
  },
  {
    publishedAt: new Date('2026-01-28T00:00:00Z'),
    authority:   'Conseil fédéral',
    category:    'ARMY_DEPLOYMENT',
    title:       'Engagement de l\'armée — 5000 militaires en service d\'appui G7',
    summary:     'Engagement subsidiaire de l\'armée suisse : jusqu\'à 5000 militaires pour soutenir les polices cantonales de Genève, Vaud et Valais. Tâches : protection d\'objets, surveillance, reconnaissance, transport, logistique. Coordination avec l\'Armée française.',
    url:         'https://www.admin.ch/gov/fr/accueil/documentation/communiques.msg-id-110000.html',
    severity:    'HIGH',
    impact:      ['armée', 'genève', 'vaud', 'valais', 'sécurité'],
  },
  {
    publishedAt: new Date('2026-01-28T00:00:00Z'),
    authority:   'Conseil fédéral',
    category:    'AIRSPACE_RESTRICTION',
    title:       'Restriction espace aérien région lémanique — 10 au 18 juin 2026',
    summary:     'Zone de restriction centrée sur Évian, Lausanne et l\'Aéroport international de Genève. Active du 10 juin 13h00 au 18 juin 03h00. Concerne le trafic VFR et IFR non commercial. Forces aériennes suisses en service de police aérienne, en coordination avec la police genevoise et l\'Armée de l\'air française.',
    url:         'https://www.eda.admin.ch/fr/sommet-du-g7-a-evian',
    severity:    'HIGH',
    impact:      ['espace_aérien', 'genève', 'lausanne', 'évian', '10-18_juin'],
  },
  {
    publishedAt: new Date('2026-03-04T00:00:00Z'),
    authority:   'Conseil d\'État Genève',
    category:    'SECURITY_MEASURE',
    title:       'Dispositif sécuritaire Genève G7 — polices municipales mobilisées',
    summary:     'Les polices municipales genevoises appuient la police cantonale du 10 au 18 juin 2026. Mesures de sécurité coordonnées entre polices cantonales, municipales et armée.',
    url:         'https://www.ge.ch/communiques-presse/conseil-detat',
    severity:    'MEDIUM',
    impact:      ['police', 'genève', 'sécurité', '10-18_juin'],
  },
  {
    publishedAt: new Date('2026-04-01T00:00:00Z'),
    authority:   'Conseil fédéral',
    category:    'COST_SHARING',
    title:       'Confédération participe à 80% aux coûts de sécurité G7 (GE, VD, VS)',
    summary:     'Le Conseil fédéral qualifie le sommet G7 d\'événement extraordinaire. La Confédération couvre 80% des coûts de sécurité des cantons de Genève, Vaud et Valais. Les coûts sont estimés à plusieurs millions de francs.',
    url:         'https://www.admin.ch/gov/fr/accueil/documentation/communiques.msg-id-110000.html',
    severity:    'MEDIUM',
    impact:      ['financement', 'genève', 'vaud', 'valais'],
  },
  {
    publishedAt: new Date('2026-05-06T00:00:00Z'),
    authority:   'Conseil fédéral',
    category:    'BORDER_CONTROL',
    title:       'Contrôles temporaires aux frontières intérieures CH-FR — 10 au 19 juin 2026',
    summary:     'Réintroduction des contrôles aux frontières intérieures terrestres et lacustres entre la Suisse et la France. Uniquement 7 points de passage autorisés du 12 au 18 juin : Anières, Moillesulaz, Thônex-Vallard, Bardonnex, Perly, Meyrin, Ferney-Voltaire. Gares Cornavin et Annemasse + aéroport Genève restent ouverts. Tout autre franchissement interdit (y compris à vélo ou à pied).',
    url:         'https://www.admin.ch/gov/fr/accueil/documentation/communiques.msg-id-110000.html',
    severity:    'HIGH',
    impact:      ['frontières', 'mobilité', '12-18_juin', 'douanes', 'contrôles'],
  },
  {
    publishedAt: new Date('2026-05-08T00:00:00Z'),
    authority:   'DFAE',
    category:    'DIPLOMATIC',
    title:       'Rencontre Cassis — Barrot : coopération sécuritaire CH-FR G7',
    summary:     'Le conseiller fédéral Cassis reçoit le ministre Barrot à Genève. Coopération en cours pour un G7 fructueux et sans incidents. La France salue l\'engagement suisse et s\'engage à lui donner une visibilité dans le cadre du sommet.',
    url:         'https://www.eda.admin.ch/fr/sommet-du-g7-a-evian',
    severity:    'LOW',
    impact:      ['diplomatie', 'france', 'suisse'],
  },
  {
    publishedAt: new Date('2026-05-13T00:00:00Z'),
    authority:   'Conseil d\'État Genève',
    category:    'BORDER_CONTROL',
    title:       'Carte des passages frontières fermés + système de macarons annoncé',
    summary:     'Seuls 7 points de passage ouverts du 12 au 18 juin. Macarons prioritaires pour personnels critiques (santé, sécurité, TPG, SIG, aéroport) aux points de Bardonnex et Thônex-Vallard. Délai de demande : 28 mai 2026 à 23h59.',
    url:         'https://www.ge.ch/document/sommet-du-g7-2026-evian-faq',
    severity:    'HIGH',
    impact:      ['frontières', 'macarons', 'mobilité', 'bardonnex', 'thônex-vallard'],
  },
  {
    publishedAt: new Date('2026-05-20T00:00:00Z'),
    authority:   'Conseil d\'État Genève',
    category:    'DEMONSTRATION_RULES',
    title:       'Manifestation du 14 juin autorisée — rive droite, sous conditions',
    summary:     'La police a proposé d\'autoriser une manifestation en rive droite le dimanche 14 juin sous conditions. Interdiction de toute manifestation du 12 au 17 juin sauf autorisations préalables. Aide financière extraordinaire de 6M CHF pour les entreprises en cas de déprédations.',
    url:         'https://www.ge.ch/communiques-presse/conseil-detat',
    severity:    'MEDIUM',
    impact:      ['manifestations', 'rive_droite', '14_juin', 'entreprises'],
  },
  {
    publishedAt: new Date('2026-05-21T00:00:00Z'),
    authority:   'Conseil d\'État Genève',
    category:    'MACARON_SYSTEM',
    title:       'Système de macarons opérationnel — détails pratiques',
    summary:     'Macarons prioritaires valables du 12 au 18 juin aux douanes de Bardonnex et Thônex-Vallard. Ouvertures spécifiques de 3 douanes secondaires : 6h-9h30 et 15h30-19h. Réservés aux personnels indispensables (santé, sécurité, TPG, SIG, aéroport) résidant en France. Macaron personnel, intransmissible, usage soumis à contrôle.',
    url:         'https://www.ge.ch/document/sommet-g7-obtenir-macaron',
    severity:    'MEDIUM',
    impact:      ['macarons', 'douanes', 'personnels_critiques', 'bardonnex', 'thônex-vallard'],
  },
]

async function main() {
  console.log('Seeding G7 sources...')
  for (const s of SOURCES) {
    await db.g7Source.upsert({
      where:  { url: s.url },
      create: s,
      update: { label: s.label, category: s.category },
    })
    console.log(`  ✓ ${s.label}`)
  }

  console.log('\nSeeding G7 directives...')
  for (const d of DIRECTIVES) {
    await db.g7Directive.upsert({
      where:  { id: d.publishedAt.toISOString() + d.title.slice(0, 20) },
      create: d,
      update: { title: d.title, summary: d.summary, severity: d.severity },
    }).catch(async () => {
      // upsert sur champ non-unique → create si inexistant
      const exists = await db.g7Directive.findFirst({
        where: { title: d.title },
      })
      if (!exists) {
        await db.g7Directive.create({ data: d })
        console.log(`  ✓ ${d.publishedAt.toISOString().slice(0, 10)} — ${d.title.slice(0, 60)}`)
      } else {
        console.log(`  ~ déjà présent: ${d.title.slice(0, 60)}`)
      }
    })
    console.log(`  ✓ ${d.publishedAt.toISOString().slice(0, 10)} — ${d.title.slice(0, 60)}`)
  }

  console.log('\nDone.')
  await db.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
