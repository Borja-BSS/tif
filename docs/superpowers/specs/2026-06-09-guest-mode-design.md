# Guest Mode — TIF Grand Genève
**Date:** 2026-06-09
**Status:** Approved

## Objectif

Permettre l'accès à la carte TIF sans compte, via une session invité de 60 secondes, pour que les habitants puissent découvrir la plateforme avant de créer un compte. Demande de la Conseillère d'État.

---

## Contraintes

- Ne pas modifier AuthContext (Firebase) — risque zéro sur l'auth existante
- Ne pas toucher aux composants carte, layers, ou APIs de données
- La feature guest doit être 100% isolée — supprimable en retirant 4 fichiers et 3 petites modifications
- Aucun enregistrement en base de données pour les invités (stateless)
- La version stable déployée ne doit pas être affectée avant merge

---

## Architecture

### Deux gardiens à passer

L'accès à `/map` est protégé par :
1. **Middleware Edge** (`middleware.ts`) — vérifie `next-auth.session-token` (JWT jose)
2. **Garde client** (`map/page.tsx`) — `if (!session) router.replace('/login')` via Firebase `useSession()`

Le mode invité doit satisfaire les deux.

---

## Fichiers créés (4)

### `src/app/api/auth/guest/route.ts`
Route POST. Ne prend pas de body.
- Génère un JWT signé avec `jose` (même `NEXTAUTH_SECRET` que le middleware)
- Claims : `{ sub: 'guest', role: 'guest', iat, exp: iat + 60 }`
- Pose le cookie `tif-guest-token` (httpOnly, Secure, SameSite=Strict, maxAge=60)
- Retourne `{ ok: true, expiresAt: number }` (timestamp ms)

### `src/context/GuestContext.tsx`
Context autonome, ne dépend pas de Firebase ni de AuthContext.
- `startGuest(expiresAt: number)` : stocke `expiresAt` dans `sessionStorage('tif-guest-expiry')`
- Hydrate depuis `sessionStorage` au montage (résistant aux re-renders)
- `isGuest: boolean` — true si guest token actif et non expiré
- `secondsLeft: number` — countdown en temps réel (setInterval 1s)
- `hasExpired: boolean` — true quand secondsLeft atteint 0
- `endGuest()` : vide sessionStorage + cookie côté client (pour "se connecter")

### `src/components/guest/GuestBanner.tsx`
Barre fixe en bas de la carte (z-index au-dessus des UI carte).
- S'affiche uniquement si `isGuest && !hasExpired`
- Affiche le countdown (`0:42` → `0:01`)
- CTA "Créer un compte →" qui navigue vers `/login` (tab register)
- Couleur d'urgence progressive : neutre → orange (≤15s) → rouge (≤5s)

### `src/components/guest/GuestExpiredModal.tsx`
Overlay plein écran, apparaît quand `hasExpired === true`.
- Bloque l'accès à la carte (pointer-events)
- Message : "Votre accès invité a expiré."
- Deux CTAs : "Créer mon compte" (→ /login#register) et "Se connecter" (→ /login)
- Design cohérent avec le système Liquid Glass existant

---

## Fichiers modifiés (3)

### `middleware.ts` — ajout additionnel (~12 lignes)
Après le check `next-auth.session-token` existant (inchangé) :
```
if (!token) {
  // NOUVEAU : check guest token
  const guestToken = req.cookies.get('tif-guest-token')?.value
  if (guestToken) {
    try {
      await jwtVerify(guestToken, secret)
      return res  // guest valide → passe
    } catch {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }
  return NextResponse.redirect(new URL('/login', req.url))
}
```
Rien de l'existant n'est retiré ou modifié.

### `src/app/(auth)/login/page.tsx`
Ajout sous les onglets (séparé visuellement par un divider "ou") :
- Bouton "Explorer en mode invité (1 min)"
- `handleGuest()` : POST `/api/auth/guest`, appelle `startGuest(expiresAt)` depuis GuestContext, `router.push('/map')`
- Le disclaimer existant "Accès restreint" est remplacé/complété pour mentionner l'accès invité

### `src/app/(dashboard)/map/page.tsx`
3 changements minimaux :
1. Import `useGuest` depuis GuestContext
2. Guard modifié : `if (status !== 'loading' && !session && !isGuest) router.replace('/login')`
3. Render de `<GuestBanner />` et `<GuestExpiredModal />` dans le JSX (après les autres UI)

---

## Flux utilisateur complet

```
/login
  → bouton "Explorer en mode invité (1 min)"
  → POST /api/auth/guest
      ← { ok: true, expiresAt: T+60000 }
      ← cookie tif-guest-token (httpOnly, 60s)
  → startGuest(expiresAt) → sessionStorage
  → router.push('/map')

/map
  → middleware : tif-guest-token valide → passe
  → useGuest() : isGuest=true, secondsLeft=60
  → guard : !session && isGuest → ne redirige pas
  → GuestBanner visible, countdown démarre
  
  T+45s → secondsLeft=15 → bannière orange
  T+55s → secondsLeft=5 → bannière rouge
  T+60s → hasExpired=true → GuestExpiredModal plein écran
         → cookie expiré côté serveur → toute navigation redirige /login

  clic "Créer mon compte"
  → router.push('/login') → tab register pré-sélectionné
```

---

## Ce qui n'est PAS modifié

- `src/context/AuthContext.tsx` — intact
- `src/lib/firebase.ts` — intact
- Prisma schema — intact (0 migration)
- Tous les composants carte (MapView, layers, BottomSheet, etc.) — intacts
- Toutes les APIs de données — intactes
- `src/lib/auth.ts` (NextAuth) — intact

---

## Suppression future

Pour retirer le mode invité :
1. Supprimer `src/app/api/auth/guest/`
2. Supprimer `src/context/GuestContext.tsx`
3. Supprimer `src/components/guest/`
4. Revert des 3 modifications (middleware, login, map/page)
