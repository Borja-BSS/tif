import { inngest } from '@/lib/inngest'
import { db } from '@/lib/db'

// Purge automatique RGPD — ADR-002 : rétention 90 jours
export const purgeRgpd = inngest.createFunction(
  {
    id:       'purge-rgpd',
    name:     'RGPD — purge données 90j',
    triggers: [{ cron: '0 2 * * *' }], // chaque nuit à 2h
  },
  async ({ step }) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const dateStr = cutoff.toISOString().slice(0, 10)

    const deleted = await step.run('delete-mobility-signals', async () => {
      const result = await db.$executeRaw`
        DELETE FROM "MobilitySignal"
        WHERE "datePartition" < ${dateStr}
      `
      return result
    })

    await step.run('delete-expired-events', async () => {
      await db.$executeRaw`
        DELETE FROM "TerritorialEvent"
        WHERE "expiresAt" < NOW() - INTERVAL '1 year'
      `
    })

    await step.run('delete-rgpd-users', async () => {
      await db.$executeRaw`
        DELETE FROM "User"
        WHERE status = 'DELETED'
        AND "updatedAt" < NOW() - INTERVAL '30 days'
      `
    })

    return { purgedSignals: deleted, cutoffDate: dateStr }
  }
)
