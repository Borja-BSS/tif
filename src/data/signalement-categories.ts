export interface SignalCategory {
  id:    string
  icon:  string
  label: string
  color: string
  subs:  string[]
}

export const SIGNAL_CATEGORIES: SignalCategory[] = [
  {
    id: 'circulation', icon: '🚦', label: 'Circulation', color: '#FF9500',
    subs: ['Embouteillage','Ralentissement','Route bloquée','Déviation','Travaux','Feux défectueux','Route fermée'],
  },
  {
    id: 'forces-ordre', icon: '🚨', label: "Forces de l'ordre", color: '#FF3B30',
    subs: ['Contrôle routier','Présence policière','Contrôle douanier','Police militaire','Opération de sécurité','Zone sous surveillance renforcée'],
  },
  {
    id: 'douanes', icon: '🛂', label: 'Douanes', color: '#AF52DE',
    subs: ["Temps d'attente",'Forte affluence','Contrôles renforcés','Douane fluide','Incident à la douane','Fermeture partielle'],
  },
  {
    id: 'urgences', icon: '🚑', label: 'Urgences', color: '#FF2D55',
    subs: ['Accident','Véhicule en panne','Intervention pompiers','Intervention ambulance','Obstacle sur la chaussée'],
  },
  {
    id: 'rassemblements', icon: '👥', label: 'Rassemblements', color: '#5856D6',
    subs: ['Manifestation','Mouvement de foule','Événement public','Cortège','Point de rassemblement','Zone à forte affluence'],
  },
  {
    id: 'securite', icon: '⚠️', label: 'Sécurité', color: '#FF9F0A',
    subs: ['Détonations entendues','Incident signalé','Zone à éviter','Contrôles ponctuels','Présence inhabituelle','Risque potentiel'],
  },
  {
    id: 'transports', icon: '🚆', label: 'Transports publics', color: '#30D158',
    subs: ['Retard','Perturbation','Ligne interrompue','Contrôle dans les transports','Gare sous surveillance'],
  },
  {
    id: 'conditions', icon: '🌦️', label: 'Conditions extérieures', color: '#0A84FF',
    subs: ['Intempéries','Route glissante','Inondation',"Chute d'arbres",'Visibilité réduite'],
  },
]

export interface PriorityLevel {
  id:    string
  label: string
  color: string
  icon:  string
}

export const PRIORITY_LEVELS: PriorityLevel[] = [
  { id: 'info',         label: 'Information',  color: '#8E8E93', icon: 'ℹ️' },
  { id: 'vigilance',    label: 'Vigilance',    color: '#30D158', icon: '👁️' },
  { id: 'perturbation', label: 'Perturbation', color: '#FF9500', icon: '⚠️' },
  { id: 'important',    label: 'Important',    color: '#FF9F0A', icon: '🔶' },
  { id: 'urgent',       label: 'Urgent',       color: '#FF3B30', icon: '🔴' },
  { id: 'critique',     label: 'Critique',     color: '#FF2D55', icon: '🆘' },
]

export type Credibility = 'neutral' | 'confirmed' | 'contested' | 'false'

export interface Signalement {
  id:          string
  category:    string
  subcategory: string
  priority:    string
  description: string
  address?:    string
  lat?:        number
  lng?:        number
  mediaUrls?:  string[]
  createdAt:   string
  status:      'pending' | 'approved' | 'rejected' | 'disabled'
  approvedAt?: string
  rejectedAt?: string
  disabledAt?: string
  expiresAt:    string
  confirmCount: number
  denyCount:    number
  credibility:  Credibility
}

export const REDIS_KEY_SIGNALEMENTS = 'tif:signalements'

// TTL en secondes par niveau de priorité
export const TTL_SECONDS: Record<string, number> = {
  info:         3 * 60 * 60,   // 3h
  vigilance:    2 * 60 * 60,   // 2h
  perturbation: 90 * 60,       // 1h30
  important:    60 * 60,       // 1h
  urgent:       30 * 60,       // 30min
  critique:     20 * 60,       // 20min
}

export function computeExpiresAt(priority: string): string {
  const ttl = TTL_SECONDS[priority] ?? TTL_SECONDS.info
  return new Date(Date.now() + ttl * 1000).toISOString()
}

export function computeCredibility(confirmCount: number, denyCount: number): Credibility {
  const total = confirmCount + denyCount
  if (total < 2) return 'neutral'
  if (confirmCount / total >= 0.7) return 'confirmed'
  if (denyCount / total >= 0.7) return 'false'
  return 'contested'
}
