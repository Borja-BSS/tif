import type { NextRequest } from 'next/server'

/**
 * Adresse du visiteur pour la limitation de débit. Rien n'est supposé sur le proxy de l'hébergeur :
 *  - TIF_IP_HEADER : nom de l'en-tête qui porte l'adresse (ex. x-forwarded-for). Sans lui, AUCUN en-tête n'est lu.
 *  - TIF_IP_TRUSTED_HOPS : nombre de proxys de confiance devant l'application (défaut 1). Pour x-forwarded-for,
 *    on retient l'entrée située à ce nombre de sauts depuis la DROITE (celles de gauche sont écrites par le client).
 * Si la source est absente ou illisible, on ne bloque personne : l'identifiant est unique à la requête
 * (aucune limitation pour elle) et le fait est journalisé, au plus une fois par minute.
 */
const g = globalThis as unknown as { __tifIpWarnAt?: number }

function avertir(raison: string) {
  const t = Date.now()
  if (t - (g.__tifIpWarnAt ?? 0) < 60_000) return
  g.__tifIpWarnAt = t
  console.warn(JSON.stringify({ level: 'warn', scope: 'client-ip', msg: 'adresse du visiteur non determinee, limitation de debit non appliquee', raison }))
}

export function resoudreIp(headers: Headers, env: { header?: string; hops?: string } = {
  header: process.env.TIF_IP_HEADER, hops: process.env.TIF_IP_TRUSTED_HOPS,
}): { ip: string | null; raison?: string } {
  const nom = env.header?.trim().toLowerCase()
  if (!nom) return { ip: null, raison: 'TIF_IP_HEADER non défini' }
  const brut = headers.get(nom)
  if (!brut) return { ip: null, raison: `en-tête ${nom} absent` }
  const hops = Math.max(1, Math.floor(Number(env.hops) || 1))
  const parts = brut.split(',').map(s => s.trim()).filter(Boolean)
  const choisi = nom === 'x-forwarded-for' ? parts[parts.length - hops] : parts[0]
  if (!choisi || choisi.length > 64 || !/^[0-9a-fA-F:.]+$/.test(choisi)) return { ip: null, raison: `valeur illisible dans ${nom}` }
  return { ip: choisi }
}

export function clientIp(req: NextRequest | Request): string {
  const r = resoudreIp(req.headers)
  if (r.ip) return r.ip
  avertir(r.raison ?? 'inconnue')
  return `inconnu:${crypto.randomUUID()}`
}
