import { MetadataRoute } from 'next'
import { events } from '@/data/events'
import { isPast, todayInGeneva } from '@/lib/eventDates'

// Reconstitue le 20.10.2026 depuis le build de production du 31.07.2026 (module 63034),
// dont la source etait perdue : sept mois d'agenda, /donate retire (route inexistante),
// mois et evenements passes declasses (yearly, priorite 0.3).

const BASE = 'https://tif.borja-swiss-solutions.ch'

const MONTHS = [
  { slug: 'juin-2026',      prefix: '2026-06' },
  { slug: 'juillet-2026',   prefix: '2026-07' },
  { slug: 'aout-2026',      prefix: '2026-08' },
  { slug: 'septembre-2026', prefix: '2026-09' },
  { slug: 'octobre-2026',   prefix: '2026-10' },
  { slug: 'novembre-2026',  prefix: '2026-11' },
  { slug: 'decembre-2026',  prefix: '2026-12' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const today = todayInGeneva(now)

  // ── Pages statiques ──────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                        lastModified: now, changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${BASE}/map`,               lastModified: now, changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${BASE}/evenements`,        lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/infos`,             lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE}/gestion-evenements`,lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/a-propos`,          lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/privacy`,           lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
  ]

  // ── Pages agenda mensuelles (les mois passes restent, en archive) ────────
  const monthPages: MetadataRoute.Sitemap = MONTHS.map(({ slug, prefix }) => {
    const past = prefix < today.slice(0, 7)
    return {
      url: `${BASE}/evenements/agenda/${slug}`,
      lastModified: now,
      changeFrequency: past ? 'yearly' as const : 'daily' as const,
      priority: past ? 0.3 : 0.9,
    }
  })

  // ── Pages catégories ─────────────────────────────────────────────────────
  const usedCats = [...new Set(
    events.filter(e => e.occurrences.length > 0).map(e => e.category)
  )]
  const catPages: MetadataRoute.Sitemap = usedCats.map(cat => ({
    url: `${BASE}/evenements/categorie/${cat}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }))

  // ── Pages événements individuels ─────────────────────────────────────────
  const eventPages: MetadataRoute.Sitemap = events
    .filter(e => e.occurrences.length > 0)
    .map(ev => {
      const dates = [...new Set(ev.occurrences.map(o => o.date))].sort()
      const lastDate = new Date(dates[dates.length - 1] + 'T12:00:00')
      const past = isPast(ev, today)
      return {
        url: `${BASE}/evenements/${ev.slug}`,
        lastModified: lastDate > now ? now : lastDate,
        changeFrequency: past ? 'yearly' as const : 'weekly' as const,
        priority: past ? 0.3 : 0.9,
      }
    })

  return [...staticPages, ...monthPages, ...catPages, ...eventPages]
}
