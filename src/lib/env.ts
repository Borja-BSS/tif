import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL:               z.string().url(),
  DIRECT_URL:                 z.string().url(),
  NEXTAUTH_URL:               z.string().url(),
  NEXTAUTH_SECRET:            z.string().min(32),
  GOOGLE_CLIENT_ID:           z.string(),
  GOOGLE_CLIENT_SECRET:       z.string(),
  UPSTASH_REDIS_REST_URL:     z.string().url(),
  UPSTASH_REDIS_REST_TOKEN:   z.string(),
  ABLY_API_KEY:               z.string(),
  NEXT_PUBLIC_ABLY_KEY:       z.string(),
  NEXT_PUBLIC_MAPBOX_TOKEN:   z.string(),
  SENTRY_DSN:                  z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN:      z.string().url().optional(),
  SENTRY_ORG:                  z.string().optional(),
  SENTRY_PROJECT:              z.string().optional(),
  AXIOM_DATASET:               z.string().optional(),
  AXIOM_TOKEN:                 z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']),
})

export const env = envSchema.parse(process.env)
// App crashe au démarrage si une variable manque — intentionnel (ADR-001)
