import type { DecisionRoute, EtatRoute, Lecture, PointObservation } from './types'

export const COULEUR: Record<EtatRoute, string> = {
  fluide:       '#34C759',
  ralenti:      '#FFCC00',
  congestionne: '#FF9500',
  bloque:       '#FF3B30',
  inconnu:      '#8E8E93',
}

// Mêmes seuils que l'ancien codage HERE (jamColor), pour ne pas changer l'affichage.
export function classeDepuisJam(j: number): Exclude<EtatRoute, 'inconnu'> {
  if (j < 2) return 'fluide'
  if (j < 4) return 'ralenti'
  if (j < 7) return 'congestionne'
  return 'bloque'
}

const ORDRE: Array<Exclude<EtatRoute, 'inconnu'>> = ['fluide', 'ralenti', 'congestionne', 'bloque']

/** Passe d'une vitesse mesurée à un facteur de bouchon 0..10. */
export function jamDepuisVitesses(speed: number, freeFlow: number): number {
  if (!(freeFlow > 0) || !(speed >= 0)) return 0
  return Math.max(0, Math.min(10, 10 * (1 - speed / freeFlow)))
}

const AGE_MAX_MS = (Number(process.env.TIF_TRAFFIC_MAX_AGE_MIN) || 20) * 60_000
const CONFIANCE_MIN = 0.3

/**
 * Décide l'état d'un point depuis les lectures de toutes les sources.
 * Une lecture trop ancienne ou peu fiable est écartée ; sans lecture valide l'état est « inconnu » ;
 * deux sources qui divergent de deux classes ou plus donnent « inconnu » ; sinon on retient la classe
 * la plus chargée (prudence). Jamais de vert par défaut.
 */
export function decider(point: PointObservation, lectures: Lecture[], now = Date.now()): DecisionRoute {
  const base = { id: point.id, nom: point.nom, lat: point.lat, lng: point.lng, calculeLe: new Date(now).toISOString() }
  const mine = lectures.filter(l => l.pointId === point.id)
  const valides = mine.filter(l => {
    const age = now - Date.parse(l.at)
    return Number.isFinite(age) && age >= 0 && age <= AGE_MAX_MS && l.confidence >= CONFIANCE_MIN
  })
  const trace = valides.map(l => ({ source: l.source, at: l.at, jamFactor: l.jamFactor, speed: l.speed, fermee: l.fermee }))

  if (valides.length === 0) {
    const raison = mine.length === 0
      ? 'Aucune source active n’a de mesure pour ce point'
      : 'Mesures trop anciennes ou peu fiables'
    return { ...base, etat: 'inconnu', couleur: COULEUR.inconnu, raison, jamFactor: null, sources: [] }
  }

  const classes = valides.map(l => (l.fermee ? 'bloque' : classeDepuisJam(l.jamFactor)) as Exclude<EtatRoute, 'inconnu'>)
  const idx = classes.map(c => ORDRE.indexOf(c))
  if (Math.max(...idx) - Math.min(...idx) >= 2) {
    return { ...base, etat: 'inconnu', couleur: COULEUR.inconnu, raison: 'Les sources se contredisent', jamFactor: null, sources: trace }
  }
  const etat = ORDRE[Math.max(...idx)]
  const jam = Math.max(...valides.map(l => l.jamFactor))
  return {
    ...base, etat, couleur: COULEUR[etat], jamFactor: Math.round(jam * 10) / 10,
    raison: valides.length > 1 ? 'Sources concordantes, classe la plus chargée retenue' : `Mesure de ${valides[0].source}`,
    sources: trace,
  }
}
