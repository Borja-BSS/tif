# Signalements — Automatisation publication & retrait

**Date :** 2026-06-16  
**Projet :** TIF — G7 Grand Genève  
**Scope :** Automatisation complète du cycle de vie des signalements utilisateurs (publication, votes géolocalisés, expiry, badge crédibilité)

---

## Contexte

Le système de signalements actuel nécessite une validation manuelle par un admin avant toute publication sur la carte. L'objectif est de rendre la publication automatique, d'introduire un mécanisme de vote communautaire géolocalisé pour confirmer ou infirmer les signalements, et de retirer automatiquement les signalements périmés via TTL.

L'admin conserve toujours la main pour désactiver ou prolonger un signalement.

---

## Architecture générale

### Publication automatique

À la soumission, le signalement reçoit immédiatement `status: 'approved'` et un `expiresAt` calculé selon sa priorité :

| Priorité | TTL |
|---|---|
| `info` | 3h |
| `vigilance` | 2h |
| `perturbation` | 1h30 |
| `important` | 1h |
| `urgent` | 30min |
| `critique` | 20min |

### Double stockage Redis

- `tif:signalements` — tableau JSON principal (admin + historique), inchangé structurellement
- `tif:sig:ttl:{id}` — clé individuelle avec TTL natif Redis égal à la durée ci-dessus (via `SETEX`)

### Retrait automatique

`/api/v1/signalements/public` filtre à chaque appel : `status === 'approved' && new Date(s.expiresAt) > now`. Retrait visible au prochain refresh de la carte (toutes les 15s).

Garbage collection lazy : à chaque appel public, les entrées dont la clé `tif:sig:ttl:{id}` n'existe plus dans Redis sont retirées du tableau principal. Aucun cron nécessaire.

---

## Données

### Interface `Signalement` — nouveaux champs

```typescript
expiresAt:    string          // ISO — calculé à la création selon priorité
confirmCount: number          // votes "c'est vrai" (défaut: 0)
denyCount:    number          // votes "c'est faux" (défaut: 0)
credibility:  'confirmed' | 'contested' | 'false' | 'neutral'
```

### Calcul `credibility`

```
total = confirmCount + denyCount
total < 2              → 'neutral'
confirm/total >= 0.7   → 'confirmed'
deny/total   >= 0.7    → 'false'
sinon                  → 'contested'
```

### Clé Redis votes

`tif:vote:{id}` — hashmap `{ [userId]: 'confirm' | 'deny' }` — empêche le double vote par utilisateur.

---

## Endpoints API

### POST `/api/v1/signalements` — modifié

- `status` forcé à `'approved'`
- `expiresAt` calculé selon la priorité
- `confirmCount: 0`, `denyCount: 0`, `credibility: 'neutral'`
- Crée `tif:sig:ttl:{id}` avec `SETEX` au TTL correspondant
- Email de notification admin conservé (informatif uniquement, pas d'action requise)

### POST `/api/v1/signalements/vote` — nouveau

**Corps :** `{ id: string, vote: 'confirm' | 'deny', lat: number, lng: number }`

**Logique :**
1. Charge le signalement, vérifie `status === 'approved'` et `expiresAt > now`
2. Vérifie distance ≤ 100m entre `[lat, lng]` et `[s.lat, s.lng]` (formule haversine)
3. Vérifie rate limit Upstash `vote:{ip}:{id}` (max 1 vote par IP par signalement par heure)
4. Met à jour `confirmCount` ou `denyCount`
5. Si vote `deny` : réduit `expiresAt` de 10 minutes, met à jour TTL Redis (`EXPIRE`)
6. Si `denyCount >= 3` : `expiresAt = now` (retrait immédiat)
7. Recalcule `credibility`
8. Sauvegarde dans `tif:signalements`
9. Retourne `{ credibility, confirmCount, denyCount, expiresAt }`

**Authentification :** Pas de login requis. Dédup double vote via deux mécanismes combinés :
- Côté client : `localStorage: tif:voted:{id}` écrit immédiatement après vote
- Côté serveur : rate limit Upstash par IP (`vote:{ip}:{id}`, max 1/h) pour bloquer les contournements localStorage

### GET `/api/v1/signalements/public` — modifié

- Filtre : `status === 'approved' && new Date(s.expiresAt) > now`
- Expose les nouveaux champs : `confirmCount`, `denyCount`, `credibility`, `expiresAt`
- Garbage collect lazy : retire du tableau principal les entrées expirées dont `tif:sig:ttl:{id}` n'existe plus

### PATCH `/api/v1/signalements` — ajout

Nouveau cas : `{ id, expiresAt }` → prolonge de 1h (admin uniquement). Met à jour `expiresAt` + renouvelle TTL Redis via `EXPIRE`.

---

## Composants

### `SignalementsLayer.tsx` — badge crédibilité

Couleur du marker selon `credibility` :

| Valeur | Couleur |
|---|---|
| `neutral` | couleur par priorité (inchangée) |
| `confirmed` | `#30D158` vert |
| `contested` | `#FF9500` orange |
| `false` | `#FF453A` rouge atténué |

### `VoteToast.tsx` — nouveau composant

Toast compact fixé en bas de l'écran, au-dessus de la BottomSheet.

**Déclenchement :** l'utilisateur est détecté à ≤ 100m d'un signalement approuvé qu'il n'a pas encore voté (vérification via `localStorage: tif:voted:{id}`).

**UX :**
- Affichage : compact, `position: fixed`, `bottom: env(safe-area-inset-bottom) + 72px` (au-dessus de la nav)
- Contenu : icône catégorie + titre signalement + question + deux boutons `✅ Confirmer` / `❌ Signaler faux`
- Croix `×` en haut à droite : ferme sans voter — ne repose pas la question avant 10min (`sessionStorage: tif:vote-dismissed:{id}`)
- Barre de progression qui se vide en 15s → auto-dismiss sans vote
- Un seul toast affiché à la fois (priorité : signalement le plus proche)
- Après vote : toast disparaît, `localStorage: tif:voted:{id}` écrit

**Position z-index :** au-dessus de la carte et des QuickFilters, sous les modaux.

### `BottomSheet.tsx` — fiche signalement (EventDetail-style)

Ajouts dans la vue détail d'un signalement :
- Ligne `⏱ Expire dans Xh Ymin` sous la date de création
- Badge crédibilité coloré : `✅ Confirmé par X` / `⚠️ Contesté (X confirm, Y faux)` / `❌ Signalé faux`
- Si l'utilisateur a déjà voté → affiche son vote, pas de boutons

### `/admin/signalements` — ajouts mineurs

- Colonne `expiresAt` visible dans la liste (format `Xh Ymin restantes` ou `Expiré`)
- Bouton "Prolonger +1h" sur chaque signalement (PATCH `expiresAt += 3600s`)
- Badge `⏱ Expiré` sur les signalements dont `expiresAt` est passé (visibles admin même après expiry)

---

## Règles métier

- **Distance 100m** : calculée avec la formule haversine côté serveur (pas de confiance GPS client seul)
- **Double vote** : bloqué via rate limit Upstash `vote:{ip}:{id}` (serveur) + `localStorage: tif:voted:{id}` (client) — pas de login requis
- **Seuil retrait auto** : `denyCount >= 3` → `expiresAt = now`
- **Réduction TTL par deny** : -10min par vote `deny`
- **Admin prolonge** : +1h sur `expiresAt`, SETEX Redis mis à jour
- **Admin désactive** : `status: 'disabled'` — prioritaire sur tout, signalement retiré même si `expiresAt` pas encore atteint
- **Notification email** : conservée à la soumission, libellé mis à jour ("publié automatiquement, vérifiez si pertinent")

---

## Ce qui ne change pas

- Structure Redis `tif:signalements` (tableau JSON)
- Upload médias (`/api/v1/signalements/upload`)
- Rate limiting Upstash sur la soumission
- Auth Firebase admin pour PATCH/DELETE
- BroadcastChannel `tif:signalements` pour refresh inter-onglets
