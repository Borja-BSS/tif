export const springs = {
  sheet:    'cubic-bezier(0.22, 0.61, 0.36, 1) 160ms',
  filter:   'cubic-bezier(0.22, 0.61, 0.36, 1) 100ms',
  alertIn:  'cubic-bezier(0.22, 0.61, 0.36, 1) 120ms',
  alertOut: 'cubic-bezier(0.4, 0, 1, 1) 90ms',
  search:   'cubic-bezier(0.22, 0.61, 0.36, 1) 130ms',
  card:     'cubic-bezier(0.22, 0.61, 0.36, 1) 80ms',
} as const

export type SpringKey = keyof typeof springs
