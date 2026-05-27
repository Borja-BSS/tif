import { createHash } from 'crypto'
import { inngest } from '@/lib/inngest'
import { db } from '@/lib/db'

// Nettoie le HTML en texte brut minimal pour la comparaison de hash
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50_000)
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

export const watchG7Sources = inngest.createFunction(
  {
    id:       'watch-g7-sources',
    name:     'Veille G7 — sources officielles',
    triggers: [{ cron: '0 * * * *' }], // chaque heure
    concurrency: { limit: 1 },
  },
  async ({ step, logger }) => {
    const sources = await step.run('load-sources', async () => {
      return db.g7Source.findMany({ where: { active: true } })
    })

    if (!sources.length) {
      logger.info('Aucune source G7 active à surveiller')
      return { checked: 0, changed: 0 }
    }

    let changed = 0

    for (const source of sources) {
      const result = await step.run(`check-${source.id}`, async () => {
        let status = 0
        let newHash: string | null = null
        let snippet = ''

        try {
          const res = await fetch(source.url, {
            signal:  AbortSignal.timeout(12_000),
            headers: {
              'Accept':          'text/html,application/xhtml+xml',
              'Accept-Language': 'fr-CH,fr;q=0.9',
              'User-Agent':      'TIF-G7-Monitor/1.0 (+https://tif.borja-swiss-solutions.ch)',
            },
          })

          status = res.status

          if (res.ok) {
            const html  = await res.text()
            const text  = extractText(html)
            newHash     = sha256(text)
            snippet     = text.slice(0, 300)
          }
        } catch (err) {
          logger.warn(`Fetch failed for ${source.url}`, { err })
          status = 0
        }

        return { sourceId: source.id, status, newHash, oldHash: source.lastHash, snippet }
      })

      const isChanged = result.newHash && result.newHash !== result.oldHash

      await step.run(`update-${source.id}`, async () => {
        await db.g7Source.update({
          where: { id: source.id },
          data: {
            lastChecked: new Date(),
            lastStatus:  result.status,
            ...(result.newHash ? { lastHash: result.newHash } : {}),
          },
        })

        if (isChanged) {
          await db.g7WatchAlert.create({
            data: {
              sourceId:  source.id,
              summary:   `Changement détecté sur ${source.label} — extrait: ${result.snippet.slice(0, 200)}`,
              newHash:   result.newHash!,
              oldHash:   result.oldHash ?? undefined,
              detectedAt: new Date(),
            },
          })
        }
      })

      if (isChanged) changed++
    }

    return { checked: sources.length, changed }
  },
)
