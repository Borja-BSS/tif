import { decider } from './decide'
import { pointsObservation } from './points'
import { sourcesActives } from './sources'
import type { DecisionRoute, Lecture } from './types'

export type { DecisionRoute, EtatRoute } from './types'

export async function lireToutes(): Promise<{ lectures: Lecture[]; sources: string[] }> {
  const actives = sourcesActives()
  const points = await pointsObservation()
  const parts = await Promise.allSettled(actives.map(s => s.lire(points)))
  return { lectures: parts.flatMap(p => (p.status === 'fulfilled' ? p.value : [])), sources: actives.map(s => s.id) }
}

/** État de chaque point, calculé par nous. « inconnu » dès que les sources manquent ou se contredisent. */
export async function getEtatRoutes() {
  const [points, { lectures, sources }] = await Promise.all([pointsObservation(), lireToutes()])
  const decisions: DecisionRoute[] = points.map(p => decider(p, lectures))
  return { decisions, sourcesActives: sources, calculeLe: new Date().toISOString() }
}
