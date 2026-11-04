/**
 * Chantiers et fermetures du canton de Genève, données ouvertes SITG (niveau A, accès libre).
 * Fiche : https://sitg.ge.ch/donnees/infomob-chantier-point  (mise à jour quotidienne).
 * Conditions (https://sitg.ge.ch/ressources/conditions-utilisation-donnees, consultées le 04.11.2026) :
 * « Vous pouvez utiliser ce jeu de données à des fins commerciales. Vous devez obligatoirement indiquer la
 * source (ex : « Données SITG », date/fréquence d'extraction) et, le cas échéant, les traitements effectués. »
 * Traitements effectués ici : filtre sur le statut « Ouvert » et sur la date du jour (fuseau Europe/Zurich),
 * puis tri des entrées dont la perturbation mentionne une fermeture.
 * Le service de la fiche (ge.ch/terags/.../INFOMOB_CHANTIER_TEMPS_REEL) rend ORA-04043 : NE PAS l'utiliser.
 */
export const SITG_CHANTIERS_URL =
  'https://vector.sitg.ge.ch/arcgis/rest/services/INFOMOB_CHANTIER_POINT/FeatureServer/0/query'
export const SITG_CHANTIERS_SOURCE =
  'Données SITG (INFOMOB_CHANTIER_POINT), mise à jour quotidienne, traitées par TIF'

interface RawFeature {
  attributes: Record<string, string | number | null>
  geometry?: { x?: number; y?: number }
}
interface RawResponse {
  features?: RawFeature[]
  exceededTransferLimit?: boolean
  error?: { code?: number; message?: string }
}

export interface ChantierProps {
  id:          string
  kind:        'chantier-planifie'
  planifie:    true
  fermeture:   boolean
  adresse:     string
  description: string
  startTime:   string   // AAAA-MM-JJ
  endTime:     string   // AAAA-MM-JJ
  moa:         string | null
  ficheInfo:   string | null
  criticality: 'major' | 'minor'
  source:      string
}
export interface ChantierFeature {
  type:       'Feature'
  properties: ChantierProps
  geometry:   { type: 'Point'; coordinates: [number, number] }
}

export interface ChantiersResult {
  etat:        'ok' | 'source-indisponible'
  raison?:     string
  source:      string
  lectureLe:   string
  /** Entrées lues, ouvertes, actives aujourd'hui, dont fermetures. */
  compte:      { lues: number; ouvertes: number; actives: number; fermetures: number; illisibles: number }
  features:    ChantierFeature[]
}

/** Date du jour à Genève au format AAAAMMJJ. */
export function aujourdhuiGeneve(d: Date = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  return p.replace(/-/g, '')
}

/** AAAAMMJJ lisible et réel, sinon null (jamais de date devinée). */
export function dateValide(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{8}$/.test(v)) return null
  const y = Number(v.slice(0, 4)), m = Number(v.slice(4, 6)), d = Number(v.slice(6, 8))
  const t = new Date(Date.UTC(y, m - 1, d))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null
  return v
}
const iso = (v: string) => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`

/** Transformation pure, testable sur un échantillon figé. */
export function parseChantiers(raw: RawResponse, aujourdhui: string, lectureLe: string): ChantiersResult {
  const feats = raw.features ?? []
  const compte = { lues: feats.length, ouvertes: 0, actives: 0, fermetures: 0, illisibles: 0 }
  const out: ChantierFeature[] = []
  for (const f of feats) {
    const a = f.attributes
    if (a.DATE_STATUT !== 'Ouvert') continue
    compte.ouvertes++
    const debut = dateValide(a.DATE_DEBUT), fin = dateValide(a.DATE_FIN)
    if (!debut || !fin) { compte.illisibles++; continue }
    if (aujourdhui < debut || aujourdhui > fin) continue
    const x = f.geometry?.x, y = f.geometry?.y
    // Coordonnées demandées en WGS84 (outSR=4326) : on refuse tout ce qui n'est pas dans le Grand Genève.
    if (typeof x !== 'number' || typeof y !== 'number' || x < 5.8 || x > 6.6 || y < 45.9 || y > 46.5) { compte.illisibles++; continue }
    compte.actives++
    const description = String(a.PERTURBATION ?? '').trim()
    const fermeture = /fermeture/i.test(description)
    if (fermeture) compte.fermetures++
    out.push({
      type: 'Feature',
      properties: {
        id: `sitg-chantier-${a.OBJECTID}`, kind: 'chantier-planifie', planifie: true, fermeture,
        adresse: String(a.ADRESSE ?? '').trim(), description,
        startTime: iso(debut), endTime: iso(fin),
        moa: a.MOA ? String(a.MOA) : null, ficheInfo: a.FICHE_INFO ? String(a.FICHE_INFO) : null,
        criticality: fermeture ? 'major' : 'minor', source: SITG_CHANTIERS_SOURCE,
      },
      geometry: { type: 'Point', coordinates: [x, y] },
    })
  }
  return { etat: 'ok', source: SITG_CHANTIERS_SOURCE, lectureLe, compte, features: out }
}

export function indisponible(raison: string): ChantiersResult {
  return {
    etat: 'source-indisponible', raison, source: SITG_CHANTIERS_SOURCE, lectureLe: new Date().toISOString(),
    compte: { lues: 0, ouvertes: 0, actives: 0, fermetures: 0, illisibles: 0 }, features: [],
  }
}

/** Lecture du service avec un `fetch` injectable (tests de panne). Panne = « source-indisponible ». */
export async function lireChantiers(fetchFn: typeof fetch = fetch): Promise<ChantiersResult> {
  try {
    const url = new URL(SITG_CHANTIERS_URL)
    url.searchParams.set('where', '1=1')
    url.searchParams.set('outFields', '*')
    url.searchParams.set('outSR', '4326')
    url.searchParams.set('f', 'json')
    const res = await fetchFn(url.toString(), { signal: AbortSignal.timeout(10_000), cache: 'no-store' })
    if (!res.ok) return indisponible(`SITG a répondu ${res.status}`)
    const raw = await res.json() as RawResponse
    if (raw.error) return indisponible(`SITG a rendu une erreur : ${raw.error.message ?? raw.error.code}`)
    if (!Array.isArray(raw.features)) return indisponible('Réponse SITG sans liste de chantiers')
    if (raw.exceededTransferLimit) return indisponible('Réponse SITG incomplète (limite de transfert atteinte)')
    return parseChantiers(raw, aujourdhuiGeneve(), new Date().toISOString())
  } catch (err) {
    return indisponible(err instanceof Error ? err.message : 'service SITG injoignable')
  }
}

/** Seules les fermetures, en GeoJSON pour la couche de la carte. */
export function fermetures(r: ChantiersResult) {
  return r.features.filter(f => f.properties.fermeture)
}
