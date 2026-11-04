// node --experimental-strip-types scripts/test-client-ip.mts
import { resoudreIp } from '../src/lib/client-ip.ts'
let echec = 0
const t = (nom: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) echec++; console.log((ok ? 'PASSE ' : 'ECHEC ') + nom + ' -> ' + JSON.stringify(got)) }
const H = (o: Record<string, string>) => new Headers(o)
t('sans TIF_IP_HEADER, x-real-ip ignore', resoudreIp(H({ 'x-real-ip': '6.6.6.6' }), {}).ip, null)
t('XFF 1 saut : entree de droite', resoudreIp(H({ 'x-forwarded-for': '9.9.9.9, 203.0.113.7' }), { header: 'x-forwarded-for', hops: '1' }).ip, '203.0.113.7')
t('XFF falsifie par le client, 1 saut : le faux a gauche est ignore', resoudreIp(H({ 'x-forwarded-for': '1.2.3.4, 8.8.8.8, 203.0.113.7' }), { header: 'x-forwarded-for', hops: '1' }).ip, '203.0.113.7')
t('XFF 2 sauts de confiance', resoudreIp(H({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7, 10.0.0.2' }), { header: 'x-forwarded-for', hops: '2' }).ip, '203.0.113.7')
t('en-tete absent -> non determine', resoudreIp(H({}), { header: 'x-forwarded-for' }).ip, null)
t('valeur illisible -> non determine', resoudreIp(H({ 'x-forwarded-for': '<script>' }), { header: 'x-forwarded-for' }).ip, null)
t('moins d entrees que de sauts -> non determine', resoudreIp(H({ 'x-forwarded-for': '203.0.113.7' }), { header: 'x-forwarded-for', hops: '3' }).ip, null)
t('autre en-tete (cf-connecting-ip)', resoudreIp(H({ 'cf-connecting-ip': '2001:db8::1' }), { header: 'cf-connecting-ip' }).ip, '2001:db8::1')
process.exit(echec ? 1 : 0)
