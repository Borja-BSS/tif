import { redis } from '@/lib/redis'

export interface CrossingOverride {
  id:           string
  status?:      string
  waitMinutes?: number
  lat?:         number
  lng?:         number
  updatedAt:    string
}

const KEY = 'tif:crossings:overrides'

export async function getOverrides(): Promise<Record<string, CrossingOverride>> {
  const data = await redis.get<Record<string, CrossingOverride>>(KEY)
  return data ?? {}
}

export async function setOverride(
  id:       string,
  override: Omit<CrossingOverride, 'id' | 'updatedAt'>,
): Promise<void> {
  const all = await getOverrides()
  all[id] = { ...override, id, updatedAt: new Date().toISOString() }
  await redis.set(KEY, all)
}

export async function clearOverride(id: string): Promise<void> {
  const all = await getOverrides()
  delete all[id]
  await redis.set(KEY, all)
}
