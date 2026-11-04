/**
 * Magasin clé/valeur interne, en mémoire, de même interface que le client
 * Upstash qu'il remplace (04.11.2026, décision « TIF sans abonnement »).
 *
 * Méthodes réellement appelées dans le code : get, set (ex, nx), setex, del, expire, exists, incr, incrby,
 * mget, scan, lrange, lpush, ltrim, zadd, zcard, zremrangebyscore, ping, pipeline. Plus `Ratelimit`
 * (fenêtre glissante) et l'instance `ratelimit` de 100 req/min.
 *
 * Sémantique reprise d'Upstash : une valeur non textuelle est stockée en JSON, et `get` rend la valeur
 * désérialisée quand le texte est du JSON valide.
 *
 * DIFFÉRENCES ASSUMÉES avec Upstash :
 *  - un seul processus Node, pas de partage entre instances, état vidé au redémarrage hors instantané disque ;
 *  - trois classes de clés avec des quotas séparés (voir classOf) : une écriture refusée LÈVE une erreur
 *    `MemoireSaturee` (Upstash n'avait pas de quota côté appelant) ; jamais d'écrasement silencieux ;
 *  - `scan` rend tout en un passage (curseur final « 0 »).
 *
 * Instantané disque : au plus une écriture toutes les 30 s, fichier `TIF_STATE_FILE`
 * (défaut `<cwd>/.data/tif-state.json`, `off` pour le couper), dossier 0700, fichier 0600. État lisible par
 * `getPersistenceStatus()` (exposé sur /api/health).
 */
import fs from 'node:fs'
import path from 'node:path'

type Entry =
  | { t: 's'; v: string; exp: number | null }
  | { t: 'l'; v: string[]; exp: number | null }
  | { t: 'z'; v: Array<[string, number]>; exp: number | null }

export class MemoireSaturee extends Error {
  constructor(message: string) { super(message); this.name = 'MemoireSaturee' }
}

const store = new Map<string, Entry>()

// ── Classes de clés et quotas ───────────────────────────────────────────────
// reservee : administration et référence, jamais chassée, jamais refusée tant que son plafond (petit) tient.
// visiteur : durable mais créée par des visiteurs, quota propre ; plein = écriture refusée, rien n'est écrasé.
// ephemere : caches et états recalculables, chassés du plus ancien au plus récent, seulement entre eux.
type Classe = 'reservee' | 'visiteur' | 'ephemere'
const RESERVEES = ['tif:admin:custom-alerts', 'tif:crossings:overrides', 'tif:signalements', 'tif:tomtom:budget:']
const VISITEUR  = ['tif:journey:fb:', 'tif:media:', 'tif:survey:', 'tif:ratings:', 'tif:sig:ttl:']

function classOf(key: string): Classe {
  if (RESERVEES.some(p => key.startsWith(p))) return 'reservee'
  if (VISITEUR.some(p => key.startsWith(p))) return 'visiteur'
  return 'ephemere'
}
function isDurable(key: string): boolean { return classOf(key) !== 'ephemere' }

const num = (v: string | undefined, d: number) => (Number(v) > 0 ? Number(v) : d)
const MB = 1024 * 1024
const Q = {
  maxValueBytes:  num(process.env.TIF_MEM_MAX_VALUE_B,  16 * MB),   // une valeur (clé entière)
  maxItemBytes:   num(process.env.TIF_MEM_MAX_ITEM_B,   64 * 1024), // un élément de liste ou de zset
  ephemereKeys:   num(process.env.TIF_MEM_MAX_KEYS,     20_000),
  ephemereBytes:  num(process.env.TIF_MEM_MAX_EPH_B,    128 * MB),
  visiteurKeys:   num(process.env.TIF_MEM_MAX_VKEYS,    5_000),
  visiteurBytes:  num(process.env.TIF_MEM_MAX_VBYTES,   96 * MB),
  reserveeBytes:  num(process.env.TIF_MEM_MAX_RES_B,    16 * MB),
  maxListLen:     num(process.env.TIF_MEM_MAX_LIST,     10_000),
  maxZsetLen:     num(process.env.TIF_MEM_MAX_ZSET,     50_000),
  maxRlIds:       num(process.env.TIF_MEM_MAX_RL,       50_000),
  maxSnapshotB:   num(process.env.TIF_MEM_MAX_SNAP,     160 * MB),
}
// Les quotas durables (visiteurs + réservées, plus 15 % de surcoût JSON) doivent toujours tenir dans l'instantané :
// un visiteur ne peut ainsi jamais empêcher la sauvegarde. Sinon on réduit le quota visiteurs.
if ((Q.visiteurBytes + Q.reserveeBytes) * 1.15 > Q.maxSnapshotB) {
  Q.visiteurBytes = Math.max(0, Math.floor(Q.maxSnapshotB / 1.15) - Q.reserveeBytes)
}

const sizes = new Map<string, number>()
const tot: Record<Classe, { keys: number; bytes: number }> = {
  reservee: { keys: 0, bytes: 0 }, visiteur: { keys: 0, bytes: 0 }, ephemere: { keys: 0, bytes: 0 },
}

function sizeOf(key: string, e: Entry): number {
  let n = Buffer.byteLength(key) + 32
  if (e.t === 's') n += Buffer.byteLength(e.v)
  else if (e.t === 'l') for (const x of e.v) n += Buffer.byteLength(x) + 8
  else for (const [m] of e.v) n += Buffer.byteLength(m) + 16
  return n
}

function reaccount(key: string) {
  const e = store.get(key)
  const c = classOf(key)
  const old = sizes.get(key)
  if (old !== undefined) { tot[c].bytes -= old; tot[c].keys-- ; sizes.delete(key) }
  if (e) { const s = sizeOf(key, e); sizes.set(key, s); tot[c].bytes += s; tot[c].keys++ }
}

function drop(key: string) {
  store.delete(key)
  reaccount(key)
}

function now() { return Date.now() }

function alive(key: string): Entry | undefined {
  const e = store.get(key)
  if (!e) return undefined
  if (e.exp !== null && e.exp <= now()) { drop(key); markDirty(key); return undefined }
  return e
}

/** Inscrit une entrée en respectant les quotas de sa classe. Lève MemoireSaturee si c'est refusé. */
function put(key: string, entry: Entry) {
  const c = classOf(key)
  const sz = sizeOf(key, entry)
  if (sz > Q.maxValueBytes) throw new MemoireSaturee(`valeur trop grande (${sz} o) pour ${c}`)
  const oldSz = sizes.get(key) ?? 0
  const isNew = !store.has(key)

  if (c === 'visiteur') {
    if (tot.visiteur.keys + (isNew ? 1 : 0) > Q.visiteurKeys || tot.visiteur.bytes - oldSz + sz > Q.visiteurBytes)
      throw new MemoireSaturee('quota des données visiteurs atteint, écriture refusée')
  } else if (c === 'reservee') {
    if (tot.reservee.bytes - oldSz + sz > Q.reserveeBytes) throw new MemoireSaturee('plafond des clés réservées atteint')
  } else {
    // éphémère : on chasse les plus anciennes éphémères, jamais les autres classes
    for (const k of Array.from(store.keys())) {
      if (tot.ephemere.keys + (isNew ? 1 : 0) <= Q.ephemereKeys && tot.ephemere.bytes - oldSz + sz <= Q.ephemereBytes) break
      if (k !== key && classOf(k) === 'ephemere') drop(k)
    }
    if (tot.ephemere.keys + (isNew ? 1 : 0) > Q.ephemereKeys || tot.ephemere.bytes - oldSz + sz > Q.ephemereBytes)
      throw new MemoireSaturee('plafond du cache atteint')
  }
  store.set(key, entry)
  reaccount(key)
  markDirty(key)
}

function ser(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function deser<T>(raw: string): T {
  try { return JSON.parse(raw) as T } catch { return raw as unknown as T }
}

function log(level: 'warn' | 'error', msg: string, extra: Record<string, unknown> = {}) {
  console[level](JSON.stringify({ level, scope: 'redis-memoire', msg, ...extra }))
}

// ── Instantané disque ───────────────────────────────────────────────────────
const SNAP_OFF = process.env.TIF_STATE_FILE === 'off'
const STATE_FILE = process.env.TIF_STATE_FILE && !SNAP_OFF
  ? process.env.TIF_STATE_FILE
  : path.join(process.cwd(), '.data', 'tif-state.json')
/** Chemin réel de l'instantané (pour le test et le diagnostic). */
export const stateFilePath = STATE_FILE

const status = {
  actif: !SNAP_OFF,
  fichier: STATE_FILE,
  dernierSuccesLe: null as string | null,
  dernierSuccesOctets: null as number | null,
  derniereErreur: null as string | null,
  derniereErreurLe: null as string | null,
  nonSauvegardeDepuis: null as string | null, // première modification durable pas encore écrite
  chargeAuDemarrage: null as 'ok' | 'absent' | 'corrompu' | null,
}
/** Lisible par l'administration et par /api/health. */
export function getPersistenceStatus() {
  return {
    ...status,
    cles: { reservee: tot.reservee.keys, visiteur: tot.visiteur.keys, ephemere: tot.ephemere.keys },
    octets: { reservee: tot.reservee.bytes, visiteur: tot.visiteur.bytes, ephemere: tot.ephemere.bytes },
  }
}

let dirty = false
let timer: ReturnType<typeof setTimeout> | null = null
let loaded = false
let writing = false

function markDirty(key?: string) {
  if (SNAP_OFF) return
  if (key !== undefined && !isDurable(key)) return // un cache qui change ne rend pas l'instantané obsolète
  dirty = true
  if (!status.nonSauvegardeDepuis) status.nonSauvegardeDepuis = new Date().toISOString()
  arm(30_000)
}
function arm(ms: number) {
  if (timer) return
  timer = setTimeout(() => { timer = null; writeSnapshot() }, ms)
  if (typeof timer === 'object' && 'unref' in timer) timer.unref()
}

function fail(msg: string) {
  dirty = true // la mémoire et le disque ont divergé : on réessaie, et on le dit
  status.derniereErreur = msg
  status.derniereErreurLe = new Date().toISOString()
  log('error', 'instantane-echec', { msg, nonSauvegardeDepuis: status.nonSauvegardeDepuis })
  arm(60_000)
}

function serialiser(): string {
  const out: Record<string, Entry> = {}
  // Les clés réservées (administration, référence) d'abord : elles sont toujours sauvegardées.
  for (const [k, e] of store) {
    if (e.exp !== null && e.exp <= now()) continue
    if (classOf(k) === 'reservee') out[k] = e
  }
  for (const [k, e] of store) {
    if (e.exp !== null && e.exp <= now()) continue
    if (classOf(k) === 'visiteur') out[k] = e
  }
  return JSON.stringify(out)
}

function writeSnapshot() {
  if (!dirty || SNAP_OFF || writing) return
  dirty = false
  try {
    const dir = path.dirname(STATE_FILE)
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    try { fs.chmodSync(dir, 0o700) } catch { /* conteneur qui ignore les modes */ }
    const data = serialiser()
    const octets = Buffer.byteLength(data)
    if (octets > Q.maxSnapshotB) return fail(`instantané trop gros (${octets} o, plafond ${Q.maxSnapshotB} o), non écrit`)
    const tmp = STATE_FILE + '.tmp'
    writing = true
    fs.promises.writeFile(tmp, data, { mode: 0o600 })
      .then(async () => {
        try { await fs.promises.chmod(tmp, 0o600) } catch { /* idem */ }
        await fs.promises.rename(tmp, STATE_FILE)
        status.dernierSuccesLe = new Date().toISOString()
        status.dernierSuccesOctets = octets
        status.derniereErreur = null
        if (!dirty) status.nonSauvegardeDepuis = null
      })
      .catch(err => fail(`écriture refusée: ${String(err && (err as Error).message || err)}`))
      .finally(() => { writing = false })
  } catch (err) { fail(`préparation impossible: ${String((err as Error).message || err)}`) }
}

/** Écriture immédiate et synchrone, pour l'arrêt du processus. */
function writeSnapshotSync() {
  if (!dirty || SNAP_OFF) return
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true, mode: 0o700 })
    const data = serialiser()
    if (Buffer.byteLength(data) > Q.maxSnapshotB) return
    const tmp = STATE_FILE + '.tmp'
    fs.writeFileSync(tmp, data, { mode: 0o600 })
    fs.renameSync(tmp, STATE_FILE)
    dirty = false
    status.dernierSuccesLe = new Date().toISOString()
    status.nonSauvegardeDepuis = null
  } catch (err) { log('error', 'instantane-arret-echec', { msg: String((err as Error).message || err) }) }
}

/** Écrit l'instantané tout de suite (tests). */
export function flushStateNow() {
  if (timer) { clearTimeout(timer); timer = null }
  writeSnapshot()
}
/** Attend la fin d'une écriture en cours (tests, arrêt propre). */
export async function snapshotIdle() { while (writing) await new Promise(r => setTimeout(r, 5)) }
/** Nombre de clés tenues en mémoire (diagnostic, tests). */
export function memorySize() { return store.size }
export function memoryStats() { return { reservee: { ...tot.reservee }, visiteur: { ...tot.visiteur }, ephemere: { ...tot.ephemere } } }

function loadOnce() {
  if (loaded) return
  loaded = true
  if (SNAP_OFF) return
  let raw: string
  try { raw = fs.readFileSync(STATE_FILE, 'utf8') } catch { status.chargeAuDemarrage = 'absent'; return }
  try {
    const obj = JSON.parse(raw) as Record<string, Entry>
    for (const [k, e] of Object.entries(obj)) {
      if (e.exp !== null && e.exp <= now()) continue
      try { put(k, e) } catch { log('warn', 'chargement-clé-refusée', { cle: k }) }
    }
    status.chargeAuDemarrage = 'ok'
    dirty = false
    status.nonSauvegardeDepuis = null
  } catch (err) {
    // Fichier illisible : on le garde pour examen avant que le prochain instantané ne l'écrase.
    const copie = `${STATE_FILE}.corrompu-${new Date().toISOString().replace(/[:.]/g, '-')}`
    try { fs.renameSync(STATE_FILE, copie) } catch { /* rien de plus à faire */ }
    status.chargeAuDemarrage = 'corrompu'
    status.derniereErreur = `instantané illisible, conservé sous ${copie}`
    status.derniereErreurLe = new Date().toISOString()
    log('error', 'instantane-corrompu', { copie, msg: String((err as Error).message || err) })
  }
}

// Écriture à l'arrêt : les 30 dernières secondes ne sont pas perdues.
if (!SNAP_OFF && typeof process !== 'undefined' && typeof process.once === 'function') {
  const arret = (sig: NodeJS.Signals) => {
    writeSnapshotSync()
    if (process.listenerCount(sig) === 0) process.exit(0)
  }
  process.once('SIGTERM', () => arret('SIGTERM'))
  process.once('SIGINT', () => arret('SIGINT'))
}

// Balayage des clés expirées, pour que la mémoire ne grossisse pas.
const sweeper = setInterval(() => {
  const t = now()
  for (const [k, e] of Array.from(store)) {
    if (e.exp !== null && e.exp <= t) { drop(k); markDirty(k) }
  }
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
  put(key, { t: 's', v: ser(value), exp })
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
  put(key, { t: 's', v: String(next), exp: e ? e.exp : null })
  return next
}

function opExpire(key: string, seconds: number): 0 | 1 {
  loadOnce()
  const e = alive(key)
  if (!e) return 0
  e.exp = now() + seconds * 1000
  markDirty(key)
  return 1
}

function opDel(keys: string[]): number {
  loadOnce()
  let n = 0
  for (const k of keys) if (alive(k)) { drop(k); markDirty(k); n++ }
  return n
}

function listOf(key: string): string[] {
  const e = alive(key)
  if (e && e.t === 'l') return e.v
  put(key, { t: 'l', v: [], exp: null })
  return (store.get(key) as Extract<Entry, { t: 'l' }>).v
}

function opLpush(key: string, items: unknown[]): number {
  loadOnce()
  const sers = items.map(ser)
  for (const s of sers) if (Buffer.byteLength(s) > Q.maxItemBytes) throw new MemoireSaturee(`élément trop grand (> ${Q.maxItemBytes} o)`)
  const l = listOf(key)
  for (const s of sers) l.unshift(s)
  if (l.length > Q.maxListLen) l.length = Q.maxListLen
  reaccount(key)
  while (sizes.get(key)! > Q.maxValueBytes && l.length > 1) { l.pop(); reaccount(key) }
  // quota visiteur : si l'ajout le dépasse, on retire ce qu'on vient d'ajouter et on refuse
  if (classOf(key) === 'visiteur' && (tot.visiteur.bytes > Q.visiteurBytes)) {
    for (let i = 0; i < sers.length; i++) l.shift()
    reaccount(key)
    throw new MemoireSaturee('quota des données visiteurs atteint, écriture refusée')
  }
  markDirty(key)
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
    reaccount(key)
    markDirty(key)
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

function zsetOf(key: string): Array<[string, number]> {
  const e = alive(key)
  if (e && e.t === 'z') return e.v
  put(key, { t: 'z', v: [], exp: null })
  return (store.get(key) as Extract<Entry, { t: 'z' }>).v
}

function opZadd(key: string, members: Array<{ score: number; member: string }>): number {
  loadOnce()
  for (const m of members) if (Buffer.byteLength(m.member) > Q.maxItemBytes) throw new MemoireSaturee('membre trop grand')
  const z = zsetOf(key)
  let added = 0
  for (const m of members) {
    const i = z.findIndex(x => x[0] === m.member)
    if (i >= 0) z[i][1] = m.score
    else { z.push([m.member, m.score]); added++ }
  }
  if (z.length > Q.maxZsetLen) { z.sort((a, b) => b[1] - a[1]); z.length = Q.maxZsetLen }
  reaccount(key)
  markDirty(key)
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
  if (removed) { reaccount(key); markDirty(key) }
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
// Les fenêtres vivent dans l'objet Ratelimit, PAS dans le magasin : aucune éviction du magasin ne les touche.
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
    const gc = setInterval(() => this.purge(), Math.max(Math.min(this.windowMs, 60_000), 1_000))
    if (typeof gc === 'object' && 'unref' in gc) gc.unref()
  }

  private purge() {
    const cutoff = now() - this.windowMs
    for (const [k, v] of this.hits) if (!v.length || v[v.length - 1] <= cutoff) this.hits.delete(k)
  }

  static slidingWindow(tokens: number, window: Duration): Limiter {
    return { tokens, windowMs: toMs(window) }
  }

  async limit(identifier: string) {
    let key = `${this.prefix}:${identifier}`
    const t = now()
    let tokens = this.tokens
    if (!this.hits.has(key) && this.hits.size >= Q.maxRlIds) {
      this.purge()
      if (this.hits.size >= Q.maxRlIds) {
        // Plafond atteint avec des fenêtres toutes actives : on ne chasse JAMAIS une fenêtre active
        // (ce serait remettre à zéro le compteur d'un abuseur). Les nouveaux identifiants partagent
        // un seul compteur global, plus large, pour cette limite.
        key = `${this.prefix}:__debordement__`
        tokens = this.tokens * 20
      }
    }
    const arr = (this.hits.get(key) ?? []).filter(x => x > t - this.windowMs)
    const success = arr.length < tokens
    if (success) arr.push(t)
    this.hits.set(key, arr)
    const reset = (arr[0] ?? t) + this.windowMs
    return {
      success,
      limit: tokens,
      remaining: Math.max(tokens - arr.length, 0),
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
