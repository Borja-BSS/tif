import * as Ably from 'ably'

// Singleton client-side (navigateur uniquement)
let _client: Ably.Realtime | null = null

export function getAblyClient(): Ably.Realtime {
  if (!_client) {
    _client = new Ably.Realtime({
      key:            process.env.NEXT_PUBLIC_ABLY_KEY!,
      clientId:       'tif-browser',
      autoConnect:    true,
      echoMessages:   false,
    })
  }
  return _client
}

// Channels TIF
export const CHANNELS = {
  signals:  'tif:signals:grand-geneve',   // signaux mobilité temps réel
  events:   'tif:events:territorial',     // événements territoriaux
  presence: 'tif:presence',              // utilisateurs connectés
} as const

export type ChannelName = typeof CHANNELS[keyof typeof CHANNELS]
