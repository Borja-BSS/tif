import type { G7Impact } from './types'

// G7 Évian 2026 — données TPG communiqué 15 mai 2026
const G7_START   = new Date('2026-06-08T00:00:00+02:00')
const G7_END     = new Date('2026-06-17T23:59:59+02:00')
const WARN_START = new Date('2026-06-01T00:00:00+02:00')  // 7j avant

const LINE29_START = new Date('2026-06-12T00:00:00+02:00')
const LINE29_END   = new Date('2026-06-14T23:59:59+02:00')

export function getG7Impact(): G7Impact {
  const now = new Date()

  const suspendedLines =
    now >= LINE29_START && now <= LINE29_END ? ['29'] : []

  return {
    isActive:        now >= G7_START && now <= G7_END,
    isWarningPeriod: now >= WARN_START && now < G7_START,
    affectedLines: [
      '1','2','3','4','5','6','7','8','9','10',
      '11','12','13','14','15','16','17','18','19','20',
      '21','22','23','24','25','D','E','F','G','H','Y','Z','T71','T72',
    ],
    suspendedLines,
    closedAgencies: [
      { name: 'Agence Cornavin',         closedFrom: '2026-06-12', reopenAt: '2026-06-19' },
      { name: 'Agence Rive',             closedFrom: '2026-06-12', reopenAt: '2026-06-22' },
      { name: 'Agence Lancy-Pont-Rouge', closedFrom: '2026-06-12', reopenAt: '2026-06-18' },
    ],
    hotline:   '0800 858 900',
    startDate: G7_START.toISOString(),
    endDate:   G7_END.toISOString(),
  }
}
