// node --experimental-strip-types scripts/test-sitg.mts [--reel]
// Échantillon figé (tests/sitg/echantillon-chantiers-2026-11-04.json), pannes simulées, et service réel avec --reel.
import fs from 'node:fs'
import { parseChantiers, lireChantiers, dateValide } from '../src/lib/sitg/chantiers-core.ts'
import { parseCameras, imageValide } from '../src/lib/sitg/cameras-core.ts'
import { jamDepuisEtat, lecturesDepuisSegments } from '../src/lib/etat-routes/sources/sitg-trafic-core.ts'
import { decider } from '../src/lib/etat-routes/decide.ts'

let echec = 0
const t = (nom: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) echec++; console.log((ok ? 'PASSE ' : 'ECHEC ') + nom + ' -> ' + JSON.stringify(got) + (ok ? '' : ' attendu ' + JSON.stringify(want))) }
const reel = process.argv.includes('--reel')

// ── 1. Échantillon figé, compte indépendant à la main ───────────────────────
const raw = JSON.parse(fs.readFileSync(new URL('../tests/sitg/echantillon-chantiers-2026-11-04.json', import.meta.url), 'utf8'))
const AUJ = '20261104'
let main = 0, mainFerm = 0, termine = 0, finie = 0, pasCommence = 0
for (const f of raw.features) {
  const a = f.attributes
  if (a.DATE_STATUT !== 'Ouvert') { termine++; continue }
  if (a.DATE_FIN < AUJ) { finie++; continue }
  if (a.DATE_DEBUT > AUJ) { pasCommence++; continue }
  main++
  if (String(a.PERTURBATION).toLowerCase().includes('fermeture')) mainFerm++
}
const r = parseChantiers(raw, AUJ, '2026-11-04T20:00:00Z')
console.log(`echantillon: ${raw.features.length} lues, ${termine} non Ouvert, ${finie} Ouvert mais finies, ${pasCommence} pas commencees, ${main} actives dont ${mainFerm} fermetures (compte a la main)`)
t('actives : code = compte a la main', r.compte.actives, main)
t('fermetures : code = compte a la main', r.compte.fermetures, mainFerm)
t('aucune entree illisible dans l echantillon', r.compte.illisibles, 0)
t('toutes les entrees rendues sont actives et dans le Grand Geneve', r.features.every(f => f.properties.startTime.replace(/-/g, '') <= AUJ && f.properties.endTime.replace(/-/g, '') >= AUJ && f.geometry.coordinates[0] > 5.8 && f.geometry.coordinates[0] < 6.6 && f.geometry.coordinates[1] > 45.9 && f.geometry.coordinates[1] < 46.5), true)
// Chantier terminé jamais affiché comme ouvert
const nonOuverts = raw.features.filter((f: any) => f.attributes.DATE_STATUT !== 'Ouvert').map((f: any) => 'sitg-chantier-' + f.attributes.OBJECTID)
t('un chantier non Ouvert n apparait jamais', r.features.some(f => nonOuverts.includes(f.properties.id)), false)
// Expiration lue au jour près
const f1 = { attributes: { OBJECTID: 9001, DATE_STATUT: 'Ouvert', DATE_DEBUT: '20261104', DATE_FIN: '20261104', PERTURBATION: 'Fermeture totale', ADRESSE: 'Test' }, geometry: { x: 6.14, y: 46.2 } }
t('debut = fin = aujourd hui : actif', parseChantiers({ features: [f1] }, '20261104', 'x').compte.actives, 1)
t('fin = hier : exclu', parseChantiers({ features: [f1] }, '20261105', 'x').compte.actives, 0)
t('debut = demain : exclu', parseChantiers({ features: [f1] }, '20261103', 'x').compte.actives, 0)
t('date illisible : exclue et comptee, jamais devinee', parseChantiers({ features: [{ ...f1, attributes: { ...f1.attributes, DATE_FIN: '2026-11-04' } }] }, '20261104', 'x').compte, { lues: 1, ouvertes: 1, actives: 0, fermetures: 0, illisibles: 1 })
t('date impossible 20261340', dateValide('20261340'), null)
t('coordonnees projetees (Suisse 2056) refusees', parseChantiers({ features: [{ ...f1, geometry: { x: 2500000, y: 1118000 } }] }, '20261104', 'x').compte.actives, 0)
// Coordonnées sur un chantier connu : Route de Malagnou
const mal = r.features.find(f => /Route de Malagnou/i.test(f.properties.adresse))
console.log('chantier connu :', mal ? `${mal.properties.adresse} -> lng ${mal.geometry.coordinates[0].toFixed(4)}, lat ${mal.geometry.coordinates[1].toFixed(4)}` : 'absent de l echantillon')
t('Route de Malagnou est dans la commune de Geneve (lng 6.15 a 6.20, lat 46.18 a 46.22)', !!mal && mal.geometry.coordinates[0] > 6.15 && mal.geometry.coordinates[0] < 6.20 && mal.geometry.coordinates[1] > 46.18 && mal.geometry.coordinates[1] < 46.22, true)

// ── 2. Pannes simulées : jamais « aucune fermeture » ────────────────────────
const pannes: Array<[string, typeof fetch]> = [
  ['reseau coupe', (async () => { throw new Error('ECONNRESET') }) as unknown as typeof fetch],
  ['HTTP 500', (async () => new Response('x', { status: 500 })) as unknown as typeof fetch],
  ['erreur ORA-04043 en JSON', (async () => new Response(JSON.stringify({ error: { code: 500, message: 'ORA-04043' } }), { status: 200 })) as unknown as typeof fetch],
  ['reponse sans liste', (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch],
  ['reponse tronquee', (async () => new Response(JSON.stringify({ features: [], exceededTransferLimit: true }), { status: 200 })) as unknown as typeof fetch],
  ['corps non JSON', (async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch],
]
for (const [nom, fn] of pannes) { const p = await lireChantiers(fn); t(`panne simulee (${nom}) : etat source-indisponible, 0 entree, raison donnee`, [p.etat, p.features.length, !!p.raison], ['source-indisponible', 0, true]) }
const vide = await lireChantiers((async () => new Response(JSON.stringify({ features: [] }), { status: 200 })) as unknown as typeof fetch)
t('service sain sans chantier : etat ok (vraie absence), distinct de la panne', [vide.etat, vide.features.length], ['ok', 0])

// ── 3. Caméras ──────────────────────────────────────────────────────────────
const cams = parseCameras({ features: [
  { attributes: { OBJECTID: 7, NOM: 'Bardonnex (douane)', DIRECTION_ALLER: 'toLausanne', DIRECTION_RETOUR: 'toFrance', IMAGE_ALLER: 'https://app2.ge.ch/tercameras/CAM_14.jpg', IMAGE_RETOUR: 'https://app2.ge.ch/tercameras/CAM_14.jpg' }, geometry: { x: 6.0973, y: 46.1523 } },
  { attributes: { OBJECTID: 8, NOM: 'Piege', DIRECTION_ALLER: 'toGeneva', IMAGE_ALLER: 'https://evil.example/x.jpg' }, geometry: { x: 6.1, y: 46.2 } },
] })
t('camera : nom, sens, source ; adresse hors ge.ch refusee', cams.map(c => [c.properties.nom, c.properties.sens, c.properties.source.startsWith('Données SITG')]), [['Bardonnex (douane)', 'vers Lausanne / vers la France', true]])
t('imageValide refuse http et autres hotes', [imageValide('http://app2.ge.ch/tercameras/CAM_2.jpg'), imageValide('https://app2.ge.ch/tercameras/CAM_2.jpg')], [false, true])

// ── 4. Trafic canton : données de 2022 = inconnu ────────────────────────────
t('ETAT 1,2,3,0 -> jam', [1, 2, 3, 0, null].map(jamDepuisEtat), [1, 3, 6, null, null])
const P = { id: 'p', nom: 'Point', lat: 46.19, lng: 6.165, type: 'axe' as const }
const seg = { attributes: { ETAT: 1, DATE_MAJ_ETAT: 1663054500000, NOM: 'Chemin Rieu' }, geometry: { paths: [[[6.165, 46.19], [6.1652, 46.1905]]] } }
const l = lecturesDepuisSegments([seg], [P])
t('segment proche trouve, heure = DATE_MAJ_ETAT', [l.length, l[0]?.at], [1, '2022-09-13T07:35:00.000Z'])
t('regle des 20 minutes : donnees de 2022 -> inconnu, jamais vert', decider(P, l, Date.parse('2026-11-04T20:00:00Z')).etat, 'inconnu')
t('si le canton remet le service a jour (mesure d il y a 2 min) -> fluide', decider(P, lecturesDepuisSegments([{ ...seg, attributes: { ...seg.attributes, DATE_MAJ_ETAT: Date.parse('2026-11-04T19:58:00Z') } }], [P]), Date.parse('2026-11-04T20:00:00Z')).etat, 'fluide')

// ── 5. Service réel (--reel) ────────────────────────────────────────────────
if (reel) {
  const auj = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date()).replace(/-/g, '')
  const base = 'https://vector.sitg.ge.ch/arcgis/rest/services/INFOMOB_CHANTIER_POINT/FeatureServer/0/query'
  const compter = async (where: string) => (await (await fetch(`${base}?where=${encodeURIComponent(where)}&returnCountOnly=true&f=json`)).json() as { count: number }).count
  const actives = await compter(`DATE_STATUT='Ouvert' AND DATE_DEBUT<='${auj}' AND DATE_FIN>='${auj}'`)
  const ferm = await compter(`DATE_STATUT='Ouvert' AND DATE_DEBUT<='${auj}' AND DATE_FIN>='${auj}' AND UPPER(PERTURBATION) LIKE '%FERMETURE%'`)
  const res = await lireChantiers()
  console.log(`reel ${auj} : serveur compte ${actives} actives dont ${ferm} fermetures ; code rend ${res.compte.actives} dont ${res.compte.fermetures} (lues ${res.compte.lues}, ouvertes ${res.compte.ouvertes})`)
  t('REEL : etat ok', res.etat, 'ok')
  t('REEL : actives, code = comptage independant du serveur', res.compte.actives, actives)
  t('REEL : fermetures, code = comptage independant du serveur', res.compte.fermetures, ferm)
  const cam = await (await fetch('https://vector.sitg.ge.ch/arcgis/rest/services/INFOMOB_CAMERA/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=json')).json() as { features: never[] }
  const pc = parseCameras(cam)
  t('REEL : cameras, 9 lues, 9 gardees', [cam.features.length, pc.length], [9, 9])
}
process.exit(echec ? 1 : 0)
