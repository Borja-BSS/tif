/**
 * EWMA store — persistence Redis des états EWMA par zone + métrique + bucket horaire.
 * Re-exporte les fonctions de ewma.ts avec l'interface attendue par Phase 3.
 */
export {
  getEwmaState,
  setEwmaState,
  updateEwma,
  hourOfWeek,
} from './ewma'

export type { EwmaState } from './types'

/** Retourne le bucket horaire courant (0–167 : 0=Dim 0h, 167=Sam 23h). */
export function getCurrentHourOfWeek(): number {
  const now = new Date()
  return now.getDay() * 24 + now.getHours()
}
