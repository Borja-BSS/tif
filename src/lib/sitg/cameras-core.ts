/**
 * Caméras de trafic du canton de Genève, jeu INFOMOB_CAMERA (9 vues, niveau A, accès libre).
 * Fiche : https://sitg.ge.ch/donnees/infomob-camera . Source à citer : « Données SITG ».
 * Le service à 18 vues (ge.ch/terags/.../INFOMOB_CAMERA_TEMPS_REEL) n'a pas de fiche de licence retrouvée :
 * NON utilisé. Aucune image n'est stockée ni relayée : le navigateur la charge directement depuis l'adresse
 * publiée par le jeu. Aucune analyse automatique des images.
 */
export const SITG_CAMERAS_SOURCE = 'Données SITG (INFOMOB_CAMERA), images de l’Office cantonal des transports'

const SENS: Record<string, string> = { toLausanne: 'vers Lausanne', toFrance: 'vers la France', toGeneva: 'vers Genève' }

export interface RawCam {
  attributes: { OBJECTID: number; NOM: string; DIRECTION_ALLER?: string; DIRECTION_RETOUR?: string; IMAGE_ALLER?: string; IMAGE_RETOUR?: string }
  geometry?: { x?: number; y?: number }
}

export interface CameraFeature {
  type: 'Feature'
  properties: { id: string; nom: string; sens: string; imageUrl: string; imageAt: string | null; source: string }
  geometry: { type: 'Point'; coordinates: [number, number] }
}
export interface CamerasResult {
  etat: 'ok' | 'source-indisponible'
  raison?: string
  source: string
  lectureLe: string
  features: CameraFeature[]
}

/** Adresse d'image acceptée : uniquement le serveur cantonal, en https. */
export function imageValide(u: unknown): u is string {
  return typeof u === 'string' && /^https:\/\/app2\.ge\.ch\/tercameras\/[A-Za-z0-9_.-]+\.jpg$/.test(u)
}

export function parseCameras(raw: { features?: RawCam[] }): CameraFeature[] {
  const out: CameraFeature[] = []
  for (const f of raw.features ?? []) {
    const a = f.attributes
    const x = f.geometry?.x, y = f.geometry?.y
    const url = a.IMAGE_ALLER
    if (!imageValide(url) || typeof x !== 'number' || typeof y !== 'number' || x < 5.8 || x > 6.6 || y < 45.9 || y > 46.5) continue
    const sens = [a.DIRECTION_ALLER, a.DIRECTION_RETOUR].filter((s): s is string => !!s).map(s => SENS[s] ?? s)
    out.push({
      type: 'Feature',
      properties: { id: `sitg-cam-${a.OBJECTID}`, nom: a.NOM, sens: Array.from(new Set(sens)).join(' / '), imageUrl: url, imageAt: null, source: SITG_CAMERAS_SOURCE },
      geometry: { type: 'Point', coordinates: [x, y] },
    })
  }
  return out
}

