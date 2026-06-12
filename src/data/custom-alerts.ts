export type CustomAlertType = 'barrage' | 'accident' | 'restriction' | 'info' | 'other'

export interface CustomAlert {
  id:          string
  type:        CustomAlertType
  title:       string
  description?: string
  source?:     string    // URL source (lien externe)
  lat:         number
  lng:         number
  radius?:     number    // mètres — pour les zones de restriction circulaires
  color?:      string    // surcharge hex (ex: '#FF3B30')
  activeFrom:  string    // ISO datetime
  activeTo?:   string    // ISO datetime — undefined = jusqu'à suppression admin
  createdAt:   string    // ISO datetime
}

export const TYPE_COLOR: Record<CustomAlertType, string> = {
  barrage:     '#FF9500',
  accident:    '#FF3B30',
  restriction: '#AF52DE',
  info:        '#007AFF',
  other:       '#636366',
}

export const TYPE_ICON: Record<CustomAlertType, string> = {
  barrage:     '🚧',
  accident:    '🚨',
  restriction: '🚫',
  info:        'ℹ️',
  other:       '⚠️',
}

export const REDIS_KEY_ALERTS = 'tif:admin:custom-alerts'
