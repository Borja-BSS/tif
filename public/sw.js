// Service Worker TIF — Web Push
const CACHE_NAME = 'tif-v2'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  if (!event.data) return

  const data    = event.data.json()
  const options = {
    body:    data.body,
    icon:    '/icons/tif-192.png',
    badge:   '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    data:    data.data ?? {},
    actions: data.action ? [{ action: 'open', title: data.action }] : [],
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/map'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const existing = clients.find(c => c.url.includes('/map'))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
