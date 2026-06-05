export interface UserJourneyData {
  id: string
  userId: string
  name: string
  from: { lat: number; lng: number; label: string }
  to:   { lat: number; lng: number; label: string }
  schedule: {
    dayOfWeek:       number[]
    departureHour:   number
    departureMinute: number
    flexMinutes:     number
  }
  preferredMode:       'car' | 'transit' | 'both'
  notifyMinutesBefore: number
  active: boolean
}

export type JourneyStatus = 'normal' | 'delayed' | 'disrupted'

export interface JourneyStatusResult {
  journeyId:    string
  evaluatedAt:  string   // ISO string
  status:       JourneyStatus
  confidence:   number   // 0–1
  headline:     string
  detail:       string
  delayMinutes: number
  alternative?: {
    mode:        'car' | 'transit'
    description: string
    timeSaved:   number   // minutes gagnées
    departureIn: number   // minutes avant de partir
  }
  newArrivalTime?: string // ISO string
}

export interface CreateJourneyInput {
  name:               string
  fromLat:            number
  fromLng:            number
  fromLabel:          string
  toLat:              number
  toLng:              number
  toLabel:            string
  dayOfWeek:          number[]
  departureHour:      number
  departureMinute:    number
  flexMinutes?:       number
  preferredMode?:     'car' | 'transit' | 'both'
  notifyMinutesBefore?: number
}
