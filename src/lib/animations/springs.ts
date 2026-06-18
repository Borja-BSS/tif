export const springs = {
  sheet:    'cubic-bezier(0.23, 1, 0.32, 1) 120ms',
  filter:   'cubic-bezier(0.23, 1, 0.32, 1) 80ms',
  alertIn:  'cubic-bezier(0.23, 1, 0.32, 1) 100ms',
  alertOut: 'cubic-bezier(0.4, 0, 1, 1) 80ms',
  search:   'cubic-bezier(0.16, 1, 0.3, 1) 100ms',
  card:     'cubic-bezier(0.23, 1, 0.32, 1) 60ms',
} as const

export type SpringKey = keyof typeof springs
