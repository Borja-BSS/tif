import type { NextRequest } from 'next/server'

/**
 * Adresse du visiteur pour la limitation de débit.
 * Derrière un proxy, chaque saut AJOUTE l'adresse qu'il a vue à la fin de x-forwarded-for : l'entrée de gauche
 * est écrite par le client (falsifiable), celle de droite par notre proxy. On retient donc la dernière.
 * À confirmer sur l'hébergement Infomaniak (comportement du proxy non vérifié en ligne).
 */
export function clientIp(req: NextRequest | Request, fallback = 'anon'): string {
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const last = xff.split(',').map(s => s.trim()).filter(Boolean).at(-1)
    if (last) return last
  }
  return fallback
}
