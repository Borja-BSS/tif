import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// En dev local : Redis natif via @upstash/redis compat mode
// En prod     : Upstash REST API (ADR-001)
export const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Sliding window 100 req/min par IP (ADR-001 security gate)
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1m'),
  analytics: false,
})
