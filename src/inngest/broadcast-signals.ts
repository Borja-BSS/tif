import Ably from 'ably'

interface Signal {
  lat:    number
  lng:    number
  weight: number
  type:   string
}

let _rest: Ably.Rest | null = null

function getAblyRest(): Ably.Rest {
  if (!_rest) _rest = new Ably.Rest({ key: process.env.ABLY_API_KEY! })
  return _rest
}

export async function broadcastSignals(signals: Signal[]): Promise<void> {
  if (!signals.length) return
  if (!process.env.ABLY_API_KEY) return
  try {
    const channel = getAblyRest().channels.get('tif:signals:grand-geneve')
    const batches = chunk(signals, 50)
    await Promise.all(batches.map(batch => channel.publish('signal', batch)))
  } catch {
    // circuit breaker: non-bloquant si Ably indisponible
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}
