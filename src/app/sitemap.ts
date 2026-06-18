import { MetadataRoute } from 'next'
import { events } from '@/data/events'

const BASE = 'https://tif.borja-swiss-solutions.ch'

const MONTHS = [
  'juin-2026', 'juillet-2026', 'aout-2026', 'septembre-2026', 'octobre-2026',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  // ── Pages statiques ──────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                        lastModified: now, changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${BASE}/map`,               lastModified: now, changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${BASE}/evenements`,        lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/infos`,             lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE}/gestion-evenements`,lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/a-propos`,          lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/donate`,            lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/privacy`,           lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
  ]

  // ── Pages agenda mensuelles ───────────────────────────────────────────────
  const monthPages: MetadataRoute.Sitemap = MONTHS.map(month => ({
    url: `${BASE}/evenements/agenda/${month}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.9,
  }))

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
      return {
        url: `${BASE}/evenements/${ev.slug}`,
        lastModified: lastDate > now ? now : lastDate,
        changeFrequency: 'weekly' as const,
        priority: 0.9,
      }
    })

  return [...staticPages, ...monthPages, ...catPages, ...eventPages]
}
