export const springs = {
  sheet:    'cubic-bezier(0.23, 1, 0.32, 1) 350ms',
  filter:   'cubic-bezier(0.23, 1, 0.32, 1) 200ms',
  alertIn:  'cubic-bezier(0.23, 1, 0.32, 1) 280ms',
  alertOut: 'cubic-bezier(0.4, 0, 1, 1) 200ms',
  search:   'cubic-bezier(0.16, 1, 0.3, 1) 300ms',
  card:     'cubic-bezier(0.23, 1, 0.32, 1) 150ms',
} as const

export type SpringKey = keyof typeof springs
