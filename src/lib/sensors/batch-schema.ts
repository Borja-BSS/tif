import { z } from 'zod'

const AnonymizedSignalSchema = z.object({
  geohash6:         z.string().regex(/^[0-9bcdefghjkmnpqrstuvwxyz]{6,20}$/),
  speedBucket:      z.union([
    z.literal(0), z.literal(1), z.literal(2),
    z.literal(3), z.literal(4), z.literal(5),
  ]),
  direction: z.union([
    z.literal(0), z.literal(1), z.literal(2), z.literal(3),
    z.literal(4), z.literal(5), z.literal(6), z.literal(7),
  ]).nullable(),
  minuteTimestamp: z.number().int().positive(),
  sessionToken:    z.string().length(64),  // HMAC-SHA256 hex
})

export const MobilityBatchSchema = z.object({
  signals:       z.array(AnonymizedSignalSchema).min(1).max(50),
  clientVersion: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
})

export type MobilityBatch = z.infer<typeof MobilityBatchSchema>
export type AnonymizedSignal = z.infer<typeof AnonymizedSignalSchema>
