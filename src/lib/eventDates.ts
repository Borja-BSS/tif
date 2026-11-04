// Aides de date des evenements. Reconstituees le 20.10.2026 depuis le build de
// production du 31.07.2026 (module 99844 du chunk src_data_events_ts), dont la
// source etait perdue. Le nom du fichier d'origine n'est pas connu.
import type { EventItem } from '@/data/types'

/** Dates distinctes d'un evenement, triees. */
export function allDates(ev: EventItem): string[] {
  return [...new Set(ev.occurrences.map(o => o.date))].sort()
}

/** Dates a venir (aujourd'hui compris). */
export function upcomingDates(ev: EventItem, today: string): string[] {
  return allDates(ev).filter(d => d >= today)
}

export function isUndated(ev: EventItem): boolean {
  return ev.occurrences.length === 0
}

/** Au moins une date a venir. */
export function isUpcoming(ev: EventItem, today: string): boolean {
  return upcomingDates(ev, today).length > 0
}

/** Evenement date dont toutes les dates sont passees. */
export function isPast(ev: EventItem, today: string): boolean {
  return !isUndated(ev) && !isUpcoming(ev, today)
}

/** Prochaine date a venir, ou undefined. */
export function nextDate(ev: EventItem, today: string): string | undefined {
  return upcomingDates(ev, today)[0]
}

export function lastDate(ev: EventItem): string | undefined {
  const d = allDates(ev)
  return d[d.length - 1]
}

export function isCurrentMonth(month: string, today: string): boolean {
  return month === today.slice(0, 7)
}

export function isPastMonth(month: string, today: string): boolean {
  return month < today.slice(0, 7)
}

/** A venir trie par prochaine date, sans date, passes trie du plus recent au plus ancien. */
export function splitByTime(list: EventItem[], today: string) {
  const upcoming = list
    .filter(e => isUpcoming(e, today))
    .sort((a, b) => (nextDate(a, today) ?? '').localeCompare(nextDate(b, today) ?? ''))
  return {
    upcoming,
    undated: list.filter(isUndated),
    past: list
      .filter(e => isPast(e, today))
      .sort((a, b) => (lastDate(b) ?? '').localeCompare(lastDate(a) ?? '')),
  }
}

/** Date du jour a Geneve, au format AAAA-MM-JJ. */
export function todayInGeneva(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}
