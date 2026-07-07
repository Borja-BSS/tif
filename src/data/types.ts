export type EventCategory =
  | 'theatre' | 'comedie' | 'concert' | 'classique' | 'nightlife'
  | 'danse' | 'art' | 'sport' | 'festival' | 'football' | 'cinema'

export type VerifStatus = 'confirmed' | 'plausible' | 'unverified'
export type LinkStatus  = 'verified' | 'to_confirm' | 'venue_fallback'

export interface EventLink {
  label:  string
  url:    string
  kind:   'venue' | 'tickets' | 'info' | 'organizer'
  status: LinkStatus
}

export interface Occurrence {
  date:   string    // ISO 'YYYY-MM-DD'
  start?: string    // 'HH:mm'
  end?:   string    // 'HH:mm'
  note?:  string
}

export interface EventItem {
  id:           string
  slug:         string
  title:        string
  category:     EventCategory
  description:  string
  venue: {
    name:     string
    address?: string
    phone?:   string
    area?:    'GE' | 'Carouge' | 'Grand-Saconnex' | 'autour'
    lat?:     number
    lng?:     number
  }
  occurrences:  Occurrence[]
  priceInfo?:   string
  links:        EventLink[]
  verif:        VerifStatus
}
