export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

export async function requestPushPermission(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined') return null
  if (!('Notification' in window) || !('PushManager' in window)) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  try {
    const reg = await navigator.serviceWorker.ready
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return null

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    await fetch('/api/v1/my-journey/push-subscription', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(sub.toJSON()),
    })

    return sub
  } catch {
    return null
  }
}

function urlBase64ToUint8Array(base64: string): BufferSource {
  const pad    = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64    = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw    = atob(b64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i)
  return output
}
