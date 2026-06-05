import type { UserJourneyData, JourneyStatus } from './types'

// ── Calcul du score d'impact global 0.0–1.0 ──────────────────────────────────
// congestionScore : 0–1 (depuis TrafficZone.congestionScore)
// incidentCount   : nombre d'incidents actifs sur le trajet
// maxZScore       : anomalie z-score max sur le trajet (depuis EWMA)
export function calculateImpactScore(
  congestionScore: number,
  incidentCount:   number,
  maxZScore:       number,
): number {
  const congestionPart = congestionScore * 0.6
  const incidentPart   = Math.min(incidentCount / 3, 1) * 0.3
  const anomalyPart    = Math.min(maxZScore / 5, 1) * 0.1
  return Math.min(congestionPart + incidentPart + anomalyPart, 1)
}

// ── Minutes jusqu'au prochain départ habituel ─────────────────────────────────
export function minutesUntilDeparture(journey: UserJourneyData, now: Date): number {
  const dayOfWeek = now.getDay()
  if (!journey.schedule.dayOfWeek.includes(dayOfWeek)) return Infinity

  const deptMs = new Date(now).setHours(
    journey.schedule.departureHour,
    journey.schedule.departureMinute,
    0, 0,
  )
  return (deptMs - now.getTime()) / 60000
}

// ── Message headline utilisateur ──────────────────────────────────────────────
export function buildHeadline(
  status:  JourneyStatus,
  deptIn:  number,
  delay:   number,
  hour:    number,
  minute:  number,
): string {
  const t = `${hour}h${minute.toString().padStart(2, '0')}`
  if (status === 'normal')    return `Trajet normal · Partez à ${t}`
  if (status === 'delayed')   return `Léger retard · +${delay} min estimées`
  return `Trajet perturbé · Partez dans ${Math.max(0, deptIn - 5)} min`
}

// ── Status depuis impact score ────────────────────────────────────────────────
export function scoreToStatus(score: number): JourneyStatus {
  if (score >= 0.6) return 'disrupted'
  if (score >= 0.3) return 'delayed'
  return 'normal'
}
