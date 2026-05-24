import { serve } from 'inngest/next'
import { inngest }                  from '@/lib/inngest'
import { ingestSigGeneve }          from '@/inngest/ingest-sig-geneve'
import { ingestSbb }                from '@/inngest/ingest-sbb'
import { purgeRgpd }                from '@/inngest/purge-rgpd'
import { computeConsensusJob }      from '@/inngest/compute-consensus'
import { detectAnomaliesJob }       from '@/inngest/detect-anomalies'
import { processMobilitySignals }   from '@/inngest/process-mobility-signals'
import { learnPatterns }            from '@/inngest/learn-patterns'
import { resolveEvents }            from '@/inngest/resolve-events'
import { shipLogs }                 from '@/inngest/ship-logs'

export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: [
    ingestSigGeneve,
    ingestSbb,
    purgeRgpd,
    computeConsensusJob,
    detectAnomaliesJob,
    processMobilitySignals,
    learnPatterns,
    resolveEvents,
    shipLogs,
  ],
})
