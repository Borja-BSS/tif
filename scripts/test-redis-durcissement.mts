// Usage : IMPL=<chemin du module> node --experimental-strip-types scripts/test-redis-durcissement.mts <scenario>
// Scenarios : evince-admin | valeur-geante | quota-octets | limiteur | echec-ecriture | corrompu | arret
import fs from 'node:fs'
import path from 'node:path'
const M: any = await import('file:///' + process.env.IMPL!.split(String.fromCharCode(92)).join('/'))
const { redis, Ratelimit } = M
const sc = process.argv[2]
const ok = (c: boolean, m: string) => { console.log((c ? 'PASSE ' : 'ECHEC ') + sc + ' : ' + m); if (!c) process.exitCode = 1 }
const tente = async (f: () => Promise<unknown>) => { try { await f(); return null } catch (e) { return (e as Error).name } }

if (sc === 'evince-admin') {
  await redis.set('tif:admin:custom-alerts', [{ id: 'a' }]); await redis.set('tif:crossings:overrides', { x: 1 }); await redis.set('tif:signalements', [{ id: 1 }])
  let refus = 0
  for (let i = 0; i < 1500; i++) { if (await tente(() => redis.set('tif:media:' + i, 'x', { ex: 3600 }))) refus++ }
  const surv = [await redis.get('tif:admin:custom-alerts'), await redis.get('tif:crossings:overrides'), await redis.get('tif:signalements')]
  ok(surv.every(v => v !== null), `les 3 cles d'administration survivent a 1500 ecritures visiteur (survivantes: ${surv.filter(v => v !== null).length}/3)`)
  ok(refus > 0, `les ecritures visiteur en trop sont refusees (${refus} refus)`)
}
if (sc === 'valeur-geante') {
  const e = await tente(() => redis.set('tif:media:geant', 'y'.repeat(5 * 1024 * 1024)))
  ok(e === 'MemoireSaturee', `valeur de 5 Mo refusee quand le maximum est ${process.env.TIF_MEM_MAX_VALUE_B} o (reponse: ${e})`)
}
if (sc === 'quota-octets') {
  let ecrites = 0
  for (let i = 0; i < 100; i++) { if (!(await tente(() => redis.set('tif:media:b' + i, 'z'.repeat(900_000))))) ecrites++ }
  ok(ecrites <= 12, `total visiteur plafonne en octets : ${ecrites} valeurs de 0,9 Mo acceptees sur 100 (plafond ${process.env.TIF_MEM_MAX_VBYTES} o)`)
}
if (sc === 'limiteur') {
  const rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(1, '1h') })
  await rl.limit('abuseur'); const bloque = (await rl.limit('abuseur')).success === false
  for (let i = 0; i < 5000; i++) await rl.limit('autre' + i)
  const encore = (await rl.limit('abuseur')).success === false
  ok(bloque && encore, `l'abuseur reste bloque apres 5000 autres identifiants (plafond ${process.env.TIF_MEM_MAX_RL})`)
}
if (sc === 'echec-ecriture') {
  await redis.set('tif:signalements', [1]); M.flushStateNow?.(); await M.snapshotIdle?.()
  const st = M.getPersistenceStatus?.()
  ok(!!st && !!st.derniereErreur && !!st.nonSauvegardeDepuis, `echec d'ecriture visible : ${st ? st.derniereErreur : 'getPersistenceStatus absent'}`)
}
if (sc === 'corrompu') {
  const f = process.env.TIF_STATE_FILE!; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, '{"tif:signalements": {BROKEN')
  await redis.set('tif:ratings:v1:count:1', 1); M.flushStateNow(); await M.snapshotIdle?.()
  const copies = fs.readdirSync(path.dirname(f)).filter(n => n.includes('.corrompu-'))
  ok(copies.length === 1, `fichier corrompu conserve avant ecrasement (${copies.join(',') || 'aucune copie'})`)
}
if (sc === 'arret') {
  await redis.set('tif:signalements', [{ id: 'dernier' }])
  process.on('SIGTERM', () => {}) // empeche la sortie, pour mesurer l'ecriture seule
  process.emit('SIGTERM' as any)
  const f = process.env.TIF_STATE_FILE!
  ok(fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('dernier'), "ecriture a l'arret avant les 30 s")
}
process.exit()
