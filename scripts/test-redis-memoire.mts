// Test du magasin interne : node --experimental-strip-types scripts/test-redis-memoire.mts
// (importe src/lib/redis.ts tel quel ; TIF_STATE_FILE et les plafonds se reglent par variables)
import fs from 'node:fs'
import path from 'node:path'
import { redis, Ratelimit, flushStateNow, snapshotIdle, stateFilePath, memoryStats } from '../src/lib/redis.ts'
const ok = (c: boolean, m: string) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + m); if (!c) process.exitCode = 1 }

await redis.set('a', { x: 1 }); ok(JSON.stringify(await redis.get('a')) === '{"x":1}', 'set/get objet')
await redis.set('n', '1', { ex: 1 }); ok((await redis.set('n', '2', { nx: true })) === null, 'nx refuse')
ok((await redis.incr('c')) === 1 && (await redis.incrby('c', 4)) === 5 && (await redis.get('c')) === 5, 'incr/incrby')
await redis.zadd('z', { score: 1, member: 'a' }, { score: 5, member: 'b' }); await redis.zremrangebyscore('z', '-inf', 2)
ok((await redis.zcard('z')) === 1, 'zset')
const p = redis.pipeline(); p.lpush('l', '1'); p.lpush('l', '2'); p.lpush('l', '3'); p.ltrim('l', 0, 1); await p.exec()
ok(JSON.stringify(await redis.lrange('l', 0, -1)) === '[3,2]', 'pipeline lpush/ltrim/lrange')
await redis.set('e', 'v', { ex: 1 }); await new Promise(r => setTimeout(r, 1100)); ok((await redis.get('e')) === null, 'TTL expire a la lecture')
const rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1m') }); const r: boolean[] = []
for (let i = 0; i < 4; i++) r.push((await rl.limit('ip')).success); ok(JSON.stringify(r) === '[true,true,true,false]', 'ratelimit 3/min')

const MAXK = Number(process.env.TIF_MEM_MAX_KEYS), MAXL = Number(process.env.TIF_MEM_MAX_LIST)
await redis.set('tif:signalements', [{ id: 1 }])
for (let i = 0; i < MAXK * 5; i++) await redis.set(`tif:geocode:ip${i}`, 'x', { ex: 3600 })
const eph = memoryStats().ephemere.keys
ok(eph <= MAXK, `plafond de cles ephemeres : ${eph} <= ${MAXK} apres ${MAXK * 5} ecritures`)
ok((await redis.get('tif:signalements')) !== null, 'la cle durable a survecu a l eviction')
for (let i = 0; i < MAXL * 3; i++) await redis.lpush('biglist', 'v' + i)
ok((await redis.lrange('biglist', 0, -1)).length === MAXL, `liste plafonnee a ${MAXL}`)
const big = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(1, '1h') })
for (let i = 0; i < 200_000; i++) await big.limit('ip' + i)
const hits = (big as unknown as { hits: Map<string, number[]> }).hits.size
ok(hits <= Number(process.env.TIF_MEM_MAX_RL) + 1, `limiteur plafonne : ${hits} identifiants (plafond + 1 compteur de debordement) apres 200000 IP`)

await redis.set('tif:media:x', 'y'.repeat(2_000_000), { ex: 3600 })
let maxGap = 0, last = Date.now(); const iv = setInterval(() => { const t = Date.now(); maxGap = Math.max(maxGap, t - last); last = t }, 5)
const t0 = Date.now(); flushStateNow(); const sync = Date.now() - t0; await snapshotIdle(); clearInterval(iv)
console.log(`flush: ${sync} ms synchrones (serialisation), ecriture disque asynchrone, plus long arret de boucle ${maxGap} ms`)
const f = fs.statSync(stateFilePath), d = fs.statSync(path.dirname(stateFilePath))
console.log('taille fichier', f.size, 'octets ; mode fichier', (f.mode & 0o777).toString(8), 'mode dossier', (d.mode & 0o777).toString(8))
const snap = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'))
ok(Object.keys(snap).every(k => k.startsWith('tif:')) && !Object.keys(snap).some(k => k.startsWith('tif:geocode')), 'liste blanche : ' + Object.keys(snap).join(','))
process.exit()
