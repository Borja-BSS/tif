/**
 * Magasin clé/valeur interne, en mémoire, de même interface que le client
 * Upstash qu'il remplace (04.11.2026, décision « TIF sans abonnement »).
 *
 * Toutes les méthodes réellement appelées dans le code sont couvertes :
 * get, set (ex, nx), setex, del, expire, exists, incr, incrby, mget, scan,
 * lrange, lpush, ltrim, zadd, zcard, zremrangebyscore, ping, pipeline.
 * Plus `Ratelimit` (fenêtre glissante) et l'instance `ratelimit` de 100 req/min.
 *
 * Sémantique reprise d'Upstash : une valeur non textuelle est stockée en JSON,
 * et `get` rend la valeur désérialisée quand le texte est du JSON valide.
 *
 * Limite assumée : le magasin vit dans UN processus Node. Il se vide au
 * redémarrage, sauf instantané disque (voir plus bas), et n'est pas partagé
 * entre plusieurs instances. TIF tourne sur une seule instance (node server.js).
 *
 * Instantané disque : au plus une écriture toutes les 30 s, fichier
 * `TIF_STATE_FILE` (défaut `.data/tif-state.json`, `off` pour le couper). Il
 * garde les signalements, trajets, avis et surcharges d'un redémarrage à
 * l'autre. Si le disque refuse l'écriture, le magasin continue en mémoire seule.
 */
import fs from 'node:fs'
import path from 'node:path'

type Entry =
  | { t: 's'; v: string; exp: number | null }
  | { t: 'l'; v: string[]; exp: number | null }
  | { t: 'z'; v: Array<[string, number]>; exp: number | null }

const store = new Map<string, Entry>()

function now() { return Date.now() }

function alive(key: string): Entry | undefined {
  const e = store.get(key)
  if (!e) return undefined
  if (e.exp !== null && e.exp <= now()) { store.delete(key); markDirty(); return undefined }
  return e
}

function ser(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function deser<T>(raw: string): T {
  try { return JSON.parse(raw) as T } catch { return raw as unknown as T }
}

// ── Instantané disque ───────────────────────────────────────────────────────
const SNAP_OFF = process.env.TIF_STATE_FILE === 'off'
const STATE_FILE = process.env.TIF_STATE_FILE && !SNAP_OFF
  ? process.env.TIF_STATE_FILE
  : path.join(process.cwd(), '.data', 'tif-state.json')
let dirty = false
let timer: ReturnType<typeof setTimeout> | null = null
let loaded = false

function markDirty() {
  dirty = true
  if (timer || SNAP_OFF) return
  timer = setTimeout(() => {
    timer = null
    if (!dirty) return
    dirty = false
    try {
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
      const out: Record<string, Entry> = {}
      for (const [k, e] of store) {
        if (e.exp !== null && e.exp <= now()) continue
        // Compteurs de métriques : sans valeur à conserver.
        if (k.startsWith('tif:metrics:')) continue
        out[k] = e
      }
      const tmp = STATE_FILE + '.tmp'
      fs.writeFileSync(tmp, JSON.stringify(out))
      fs.renameSync(tmp, STATE_FILE)
    } catch { /* disque en lecture seule : mémoire seule */ }
  }, 30_000)
  if (typeof timer === 'object' && 'unref' in timer) timer.unref()
}

function loadOnce() {
  if (loaded) return
  loaded = true
  if (SNAP_OFF) return
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    const obj = JSON.parse(raw) as Record<string, Entry>
    for (const [k, e] of Object.entries(obj)) {
      if (e.exp !== null && e.exp <= now()) continue
      store.set(k, e)
    }
  } catch { /* pas d'instantané : départ à vide */ }
}

// Balayage des clés expirées, pour que la mémoire ne grossisse pas.
const sweeper = setInterval(() => {
  const t = now()
  let changed = false
  for (const [k, e] of store) {
    if (e.exp !== null && e.exp <= t) { store.delete(k); changed = true }
  }
  if (changed) markDirty()
}, 60_000)
if (typeof sweeper === 'object' && 'unref' in sweeper) sweeper.unref()

// ── Opérations ──────────────────────────────────────────────────────────────
interface SetOpts { ex?: number; px?: number; nx?: boolean; xx?: boolean }

function opSet(key: string, value: unknown, opts?: SetOpts): 'OK' | null {
  loadOnce()
  const cur = alive(key)
  if (opts?.nx && cur) return null
  if (opts?.xx && !cur) return null
  const exp = opts?.ex ? now() + opts.ex * 1000 : opts?.px ? now() + opts.px : null
  store.set(key, { t: 's', v: ser(value), exp })
  markDirty()
  return 'OK'
}

function opGet<T>(key: string): T | null {
  loadOnce()
  const e = alive(key)
  if (!e || e.t !== 's') return null
  return deser<T>(e.v)
}

function opIncrBy(key: string, by: number): number {
  loadOnce()
  const e = alive(key)
  const cur = e && e.t === 's' ? Number(e.v) : 0
  const next = (Number.isFinite(cur) ? cur : 0) + by
  store.set(key, { t: 's', v: String(next), exp: e ? e.exp : null })
  markDirty()
  return next
}

function opExpire(key: string, seconds: number): 0 | 1 {
  loadOnce()
  const e = alive(key)
  if (!e) return 0
  e.exp = now() + seconds * 1000
  markDirty()
  return 1
}

function opDel(keys: string[]): number {
  loadOnce()
  let n = 0
  for (const k of keys) if (alive(k)) { store.delete(k); n++ }
  if (n) markDirty()
  return n
}

function listOf(key: string, create: boolean): string[] | undefined {
  const e = alive(key)
  if (e && e.t === 'l') return e.v
  if (!create) return undefined
  const v: string[] = []
  store.set(key, { t: 'l', v, exp: null })
  return v
}

function opLpush(key: string, items: unknown[]): number {
  loadOnce()
  const l = listOf(key, true)!
  for (const it of items) l.unshift(ser(it))
  markDirty()
  return l.length
}

function opLtrim(key: string, start: number, stop: number): 'OK' {
  loadOnce()
  const e = alive(key)
  if (e && e.t === 'l') {
    const n = e.v.length
    const s = start < 0 ? Math.max(n + start, 0) : start
    const t = stop < 0 ? n + stop : stop
    e.v = e.v.slice(s, t + 1)
    markDirty()
  }
  return 'OK'
}

function opLrange<T = string>(key: string, start: number, stop: number): T[] {
  loadOnce()
  const e = alive(key)
  if (!e || e.t !== 'l') return []
  const n = e.v.length
  const s = start < 0 ? Math.max(n + start, 0) : start
  const t = stop < 0 ? n + stop : stop
  return e.v.slice(s, t + 1).map(x => deser<T>(x))
}

function zsetOf(key: string, create: boolean): Array<[string, number]> | undefined {
  const e = alive(key)
  if (e && e.t === 'z') return e.v
  if (!create) return undefined
  const v: Array<[string, number]> = []
  store.set(key, { t: 'z', v, exp: null })
  return v
}

function opZadd(key: string, members: Array<{ score: number; member: string }>): number {
  loadOnce()
  const z = zsetOf(key, true)!
  let added = 0
  for (const m of members) {
    const i = z.findIndex(x => x[0] === m.member)
    if (i >= 0) z[i][1] = m.score
    else { z.push([m.member, m.score]); added++ }
  }
  markDirty()
  return added
}

function bound(b: number | string): number {
  if (b === '-inf') return -Infinity
  if (b === '+inf' || b === 'inf') return Infinity
  const n = Number(b)
  return Number.isFinite(n) ? n : 0
}

function opZrem(key: string, min: number | string, max: number | string): number {
  loadOnce()
  const e = alive(key)
  if (!e || e.t !== 'z') return 0
  const lo = bound(min), hi = bound(max)
  const before = e.v.length
  e.v = e.v.filter(([, s]) => s < lo || s > hi)
  const removed = before - e.v.length
  if (removed) markDirty()
  return removed
}

function opZcard(key: string): number {
  loadOnce()
  const e = alive(key)
  return e && e.t === 'z' ? e.v.length : 0
}

function globToRegExp(glob: string): RegExp {
  const esc = glob.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp('^' + esc + '$')
}

function opScan(_cursor: number | string, opts?: { match?: string; count?: number }): [string, string[]] {
  loadOnce()
  // Un seul passage : la liste complète est rendue avec le curseur final « 0 ».
  const re = opts?.match ? globToRegExp(opts.match) : null
  const keys: string[] = []
  for (const k of Array.from(store.keys())) {
    if (!alive(k)) continue
    if (!re || re.test(k)) keys.push(k)
  }
  return ['0', keys]
}

// ── Pipeline ────────────────────────────────────────────────────────────────
class MemoryPipeline {
  private ops: Array<() => unknown> = []
  incr(key: string)                         { this.ops.push(() => opIncrBy(key, 1)); return this }
  incrby(key: string, by: number)           { this.ops.push(() => opIncrBy(key, by)); return this }
  lpush(key: string, ...items: unknown[])   { this.ops.push(() => opLpush(key, items)); return this }
  ltrim(key: string, s: number, e: number)  { this.ops.push(() => opLtrim(key, s, e)); return this }
  expire(key: string, sec: number)          { this.ops.push(() => opExpire(key, sec)); return this }
  set(key: string, v: unknown, o?: SetOpts) { this.ops.push(() => opSet(key, v, o)); return this }
  get(key: string)                          { this.ops.push(() => opGet(key)); return this }
  del(...keys: string[])                    { this.ops.push(() => opDel(keys)); return this }
  async exec(): Promise<unknown[]> { return this.ops.map(f => f()) }
}

// ── Client ──────────────────────────────────────────────────────────────────
class MemoryRedis {
  async get<T = unknown>(key: string): Promise<T | null> { return opGet<T>(key) }
  async set(key: string, value: unknown, opts?: SetOpts) { return opSet(key, value, opts) }
  async setex(key: string, seconds: number, value: unknown) { return opSet(key, value, { ex: seconds }) }
  async del(...keys: string[]) { return opDel(keys) }
  async expire(key: string, seconds: number) { return opExpire(key, seconds) }
  async exists(...keys: string[]) { loadOnce(); return keys.filter(k => alive(k)).length }
  async incr(key: string) { return opIncrBy(key, 1) }
  async incrby(key: string, by: number) { return opIncrBy(key, by) }
  async mget<T extends unknown[] = unknown[]>(...keys: string[]): Promise<T> {
    return keys.map(k => opGet(k)) as unknown as T
  }
  async scan(cursor: number | string, opts?: { match?: string; count?: number }) { return opScan(cursor, opts) }
  async lrange<T = string>(key: string, s: number, e: number) { return opLrange<T>(key, s, e) }
  async lpush(key: string, ...items: unknown[]) { return opLpush(key, items) }
  async ltrim(key: string, s: number, e: number) { return opLtrim(key, s, e) }
  async zadd(key: string, ...members: Array<{ score: number; member: string }>) { return opZadd(key, members) }
  async zcard(key: string) { return opZcard(key) }
  async zremrangebyscore(key: string, min: number | string, max: number | string) { return opZrem(key, min, max) }
  async ping() { return 'PONG' }
  pipeline() { return new MemoryPipeline() }
}

export const redis = new MemoryRedis()

// ── Limiteur à fenêtre glissante ────────────────────────────────────────────
type Unit = 'ms' | 's' | 'm' | 'h' | 'd'
type Duration = `${number} ${Unit}` | `${number}${Unit}`

function toMs(d: string): number {
  const m = /^(\d+)\s*(ms|s|m|h|d)$/.exec(d)
  if (!m) throw new Error(`Durée invalide: ${d}`)
  const n = Number(m[1])
  return n * ({ ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const)[m[2] as Unit]
}

interface Limiter { tokens: number; windowMs: number }

export class Ratelimit {
  private hits = new Map<string, number[]>()
  private tokens: number
  private windowMs: number
  private prefix: string

  constructor(cfg: { redis?: unknown; limiter: Limiter; prefix?: string; analytics?: boolean }) {
    this.tokens = cfg.limiter.tokens
    this.windowMs = cfg.limiter.windowMs
    this.prefix = cfg.prefix ?? '@rl'
    const gc = setInterval(() => {
      const cutoff = now() - this.windowMs
      for (const [k, v] of this.hits) {
        if (!v.length || v[v.length - 1] <= cutoff) this.hits.delete(k)
      }
    }, Math.max(this.windowMs, 60_000))
    if (typeof gc === 'object' && 'unref' in gc) gc.unref()
  }

  static slidingWindow(tokens: number, window: Duration): Limiter {
    return { tokens, windowMs: toMs(window) }
  }

  async limit(identifier: string) {
    const key = `${this.prefix}:${identifier}`
    const t = now()
    const arr = (this.hits.get(key) ?? []).filter(x => x > t - this.windowMs)
    const success = arr.length < this.tokens
    if (success) arr.push(t)
    this.hits.set(key, arr)
    const reset = (arr[0] ?? t) + this.windowMs
    return {
      success,
      limit: this.tokens,
      remaining: Math.max(this.tokens - arr.length, 0),
      reset,
      pending: Promise.resolve(),
    }
  }
}

// Fenêtre glissante 100 req/min par IP (ADR-001, passage de sécurité)
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1m'),
  analytics: false,
})
