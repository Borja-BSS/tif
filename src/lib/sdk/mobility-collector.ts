'use client'

/**
 * Collecteur de mobilité anonyme — tourne dans un Web Worker (jamais main thread).
 * Utilise exclusivement SubtleCrypto (API navigateur) et h3-js.
 *
 * Flux :
 *   GPS raw → filtre qualité → anonymisation → buffer → batch POST /api/v1/signals/mobility
 */

import { toGeohash6, toSpeedBucket, toDirectionOctant, toMinuteTimestamp, isValidRaw, inBbox } from './anonymize'

export interface ConsentFlags {
  location:       boolean   // partager geohash6
  mobility:       boolean   // partager speedBucket
  devicePresence: boolean   // être compté dans la densité
}

interface AnonymizedSignal {
  geohash6:        string
  speedBucket:     0 | 1 | 2 | 3 | 4 | 5
  direction:       0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
  minuteTimestamp: number
  sessionToken:    string
}

const BATCH_SIZE     = 30
const BATCH_INTERVAL = 60_000  // ms — max 60s entre envois

/** Génère un sessionToken via SubtleCrypto (rotatif 24h) */
async function buildSessionToken(deviceId: string, userId: string): Promise<string> {
  const enc      = new TextEncoder()
  const dateStr  = new Date().toISOString().slice(0, 10)
  const saltData = enc.encode(userId + dateStr)
  const saltHash = await crypto.subtle.digest('SHA-256', saltData)

  const key = await crypto.subtle.importKey(
    'raw', saltHash,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(deviceId))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Retourne ou crée un deviceId persistant (localStorage) */
function getDeviceId(): string {
  const key = 'tif:device-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

export class MobilityCollector {
  private buffer:       AnonymizedSignal[] = []
  private timer:        ReturnType<typeof setInterval> | null = null
  private watchId:      number | null = null
  private consent:      ConsentFlags
  private sessionToken: string = ''
  private endpoint:     string

  constructor(
    private readonly userId: string,
    consent:  ConsentFlags,
    endpoint = '/api/v1/signals/mobility',
  ) {
    this.consent  = consent
    this.endpoint = endpoint
  }

  async start(): Promise<void> {
    if (!this.consent.location) return
    if (!('geolocation' in navigator)) return

    const deviceId    = getDeviceId()
    this.sessionToken = await buildSessionToken(deviceId, this.userId)

    this.watchId = navigator.geolocation.watchPosition(
      pos => this.onPosition(pos),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    )

    this.timer = setInterval(() => this.flush(), BATCH_INTERVAL)
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.flush()
  }

  updateConsent(flags: ConsentFlags): void {
    const wasActive = this.consent.location
    this.consent    = flags

    if (!flags.location && wasActive) this.stop()
    else if (flags.location && !wasActive) this.start()
  }

  private onPosition(pos: GeolocationPosition): void {
    const { latitude: lat, longitude: lng, speed, heading, accuracy } = pos.coords
    const speedMs = speed ?? 0
    const hdg     = heading ?? 0

    // Filtre qualité
    if (!isValidRaw(speedMs, accuracy)) return
    if (!inBbox(lat, lng)) return

    const signal: AnonymizedSignal = {
      geohash6:        toGeohash6(lat, lng),
      speedBucket:     this.consent.mobility  ? toSpeedBucket(speedMs)   : 0,
      direction:       this.consent.location  ? toDirectionOctant(hdg)   : 0,
      minuteTimestamp: toMinuteTimestamp(pos.timestamp),
      sessionToken:    this.consent.devicePresence ? this.sessionToken   : '',
    }

    this.buffer.push(signal)
    if (this.buffer.length >= BATCH_SIZE) this.flush()
  }

  private flush(): void {
    if (!this.buffer.length) return
    const batch   = this.buffer.splice(0, BATCH_SIZE)

    // fire-and-forget — exponential backoff géré par le service worker
    fetch(this.endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(batch),
      keepalive: true,
    }).catch(() => {})
  }
}
