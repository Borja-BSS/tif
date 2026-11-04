// node --experimental-strip-types scripts/test-etat-routes.mts : logique de decision, sans reseau
import { decider } from '../src/lib/etat-routes/decide.ts'
let echec = 0
const t = (nom: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) echec++; console.log((ok ? 'PASSE ' : 'ECHEC ') + nom + ' -> ' + JSON.stringify(got)) }
const P = { id: 'p', nom: 'Point', lat: 46.2, lng: 6.1, type: 'axe' as const }
const now = Date.parse('2026-11-04T12:00:00Z')
const L = (source: string, jam: number, minAgo = 1, conf = 0.9, fermee = false) => ({ source, pointId: 'p', at: new Date(now - minAgo * 60000).toISOString(), speed: 30, freeFlow: 50, jamFactor: jam, confidence: conf, fermee, coordinates: [] as [number, number][] })
t('aucune lecture -> inconnu, jamais vert', decider(P, [], now).etat, 'inconnu')
t('lecture trop ancienne (45 min) -> inconnu', decider(P, [L('a', 0, 45)], now).etat, 'inconnu')
t('confiance faible -> inconnu', decider(P, [L('a', 0, 1, 0.1)], now).etat, 'inconnu')
t('une source fluide -> fluide avec source et heure', (({ etat, sources }) => ({ etat, s: sources[0].source, at: sources[0].at }))(decider(P, [L('a', 1)], now)), { etat: 'fluide', s: 'a', at: '2026-11-04T11:59:00.000Z' })
t('deux sources a une classe d ecart -> classe la plus chargee', decider(P, [L('a', 1), L('b', 3)], now).etat, 'ralenti')
t('deux sources a deux classes d ecart -> inconnu (contradiction)', decider(P, [L('a', 1), L('b', 5)], now).etat, 'inconnu')
t('source declare fermee -> bloque', decider(P, [L('a', 0, 1, 0.9, true)], now).etat, 'bloque')
t('lecture d un autre point ignoree', decider({ ...P, id: 'q' }, [L('a', 9)], now).etat, 'inconnu')
process.exit(echec ? 1 : 0)
