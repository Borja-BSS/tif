# TIF — Redesign UX Elite · Spec Technique
**Date :** 2026-06-05  
**Statut :** Approuvé — en attente d'implémentation  
**Audience :** Grand Genève, mobile-first, 500 000 utilisateurs simultanés  
**Infrastructure :** Option B — Infomaniak Jelastic + Cloudflare + Ably

---

## 1. Contexte & Objectifs

### Produit
TIF (Territoire Intelligence Frontalière) est une plateforme de mobilité temps réel pour le Grand Genève, couvrant trafic, passages frontière, transports publics (TPG/CFF/CEVA) et alertes G7 (8–18 juin 2026).

### Problème actuel
L'UX actuelle (bottom sheet + pilule de layers gauche + search bar) fonctionne mais n'est pas encore au niveau de référence. Les informations nécessitent trop d'interactions pour être accessibles, et l'architecture ne garantit pas une expérience instantanée à 500K concurrent.

### Objectif
Construire la référence mondiale de mobilité urbaine grand-genevoise :
- Statut trajet visible en **< 2 secondes** à l'ouverture
- **≤ 2 taps** pour accomplir 90 % des tâches
- **0 spinner visible** grâce au pattern Stale-While-Revalidate
- Support **500 000 utilisateurs simultanés** sans dégradation
- **0 données quittant la Suisse** (hors Ably, seule exception documentée)

---

## 2. Architecture Infrastructure — Option B

### Stack validée

```
UTILISATEUR MOBILE (4G/5G)
         │
         ▼
┌─────────────────────────────┐
│   CLOUDFLARE (obligatoire)  │
│   - DDoS L3/L4/L7           │
│   - WAF (règles OWASP)      │
│   - CDN 310 PoP mondiaux    │
│   - HTTP/3 (QUIC) auto      │
│   - Cache edge dashboard 30s│
│   - Rate limiting IP-level  │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│   INFOMANIAK JELASTIC       │
│   Geneva · Swiss data       │
│   Next.js Docker containers │
│   Auto-scaling 2→N instanc. │
│   Load balancer intégré     │
│   Reverse proxy Nginx       │
└──────┬──────────┬───────────┘
       │          │
  ┌────▼────┐ ┌───▼─────────────┐
  │  Redis  │ │  PostgreSQL      │
  │  VPS    │ │  Primary (write) │
  │  dédié  │ │  + Read Replica  │
  │  Geneva │ │  Geneva          │
  └────┬────┘ └──────────────────┘
       │
  ┌────▼───────────────┐
  │   ABLY             │
  │   Real-time push   │
  │   (seul composant  │
  │    non-suisse,     │
  │    documenté)      │
  └────────────────────┘
```

### Scalabilité — 500K concurrent

| Composant | Capacité | Stratégie |
|---|---|---|
| Cloudflare edge | Illimitée | Cache dashboard 30s → 1 origin request / 30s pour tous |
| Infomaniak Jelastic | Auto-scale 2→N | Docker + health checks |
| Redis | ~200K req/s | Cluster 3 nodes, Pub/Sub pour WS sync |
| PostgreSQL Primary | Écritures seulement | < 1 % du trafic total |
| PostgreSQL Replica | Toutes les lectures | Failover automatique |
| Ably | 1M+ connexions natif | Channels partitionnés par zone |

### Caching — pattern Stale-While-Revalidate (SWR)

**Principe :** l'utilisateur voit toujours des données immédiatement (stale), pendant que le refresh se fait en arrière-plan.

```
Cache Hit  → Réponse immédiate (< 5ms perçu)
             + Background revalidation silencieuse

Cache Miss → Compute + Stocker + Répondre (50–150ms)
             Cas rare grâce aux TTL longs sur données stables
```

**Clés Redis critiques :**

| Clé | TTL | Description |
|---|---|---|
| `tif:dashboard:global` | 30s | Dashboard partagé tous users |
| `tif:network:tpg:status` | 60s | Statut réseau TPG |
| `tif:network:cff:status` | 60s | Statut réseau CFF |
| `tif:network:ceva:status` | 60s | Statut réseau CEVA |
| `tif:journey:{userId}:status` | 300s | Prédiction Mon Trajet |
| `tif:border:{crossingId}` | 60s | Attente passage frontière |
| `tif:active-zones-count` | 30s | Compteur zones actives |

### Circuit Breakers — APIs externes

Chaque API externe dispose d'un circuit breaker à 3 états :

```
CLOSED  → appels normaux
OPEN    → retour cache, 0 appel externe (déclenche si 5 erreurs/10s)
HALF    → 1 appel test toutes les 30s pour vérifier le recovery
```

APIs concernées : HERE Maps routing, Ably, opendata.ch, TPG, CFF.  
Si le circuit est OPEN → afficher les dernières données cached, jamais une erreur visible.

---

## 3. Sécurité

### Middleware (existant — compléter)

Le fichier `middleware.ts` a déjà : X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP.

**À ajouter :**
```typescript
res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
res.headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()')
```

**CSP à renforcer :** remplacer `unsafe-inline` / `unsafe-eval` par des nonces Next.js dès que possible.

### Rate Limiting (Upstash — déjà en codebase)

Appliquer sur **tous** les endpoints API :

| Endpoint | Limite |
|---|---|
| `/api/v1/dashboard` | 120 req/min/IP |
| `/api/v1/routing/*` | 20 req/min/IP |
| `/api/v1/my-journey` | 10 req/min/userId |
| `/api/v1/signals/*` | 100 req/min/IP |
| `/api/auth/*` | 10 req/min/IP |

### Validation des entrées

Toutes les routes API utilisent **Zod** pour valider les inputs avant traitement. Aucune donnée utilisateur non-validée n'atteint Prisma ou Redis.

### Données personnelles

- Emails : stockés chiffrés (`emailEncrypted`) + hash unique (`emailHash`) — existant
- Positions GPS : anonymisées via geohash6 (precision ~1km) — existant
- Trajets personnels (nouveau) : chiffrés au repos, liés au userId
- Logs : 0 PII dans les logs applicatifs

---

## 4. Architecture UI — 7 Layers

### Vue d'ensemble

```
┌─────────────────────────────────────────┐
│ Layer 2 : SearchBar     fixed top z-30  │
│ Layer 3 : QuickFilters  fixed top z-20  │
│ Layer 4 : SmartAlerts   fixed top z-25  │
│                                         │
│  Layer 1 : Carte Mapbox (plein écran)   │
│                                         │
│                    Layer 5 : FloatCtrls │
│           Layer 6 : G7Mode overlay      │
│─────────────────────────────────────────│
│ Layer 7 : BottomSheet   fixed bot z-30  │
└─────────────────────────────────────────┘
```

### Fichiers à créer

```
src/components/map/ui/
  SearchBar.tsx          ← barre de recherche sticky top
  QuickFilters.tsx       ← filtres horizontaux scrollables
  FloatingControls.tsx   ← boutons droite (GPS, zoom, orientation)
  BottomSheet.tsx        ← bottom sheet 3 états (pièce maîtresse)
  SmartAlert.tsx         ← alertes contextuelles auto-dismiss

src/components/my-journey/
  JourneySetup.tsx       ← flow setup 5 étapes
  JourneyCard.tsx        ← card statut dans le bottom sheet

src/components/map/widgets/
  BorderPredictionWidget.tsx  ← sparkline 60min frontières

src/components/map/modes/
  G7Mode.tsx             ← overlay zones G7 (8–17 juin 2026)

src/components/accessibility/
  VoiceStatus.tsx        ← lecture vocale Web Speech API

src/lib/my-journey/
  types.ts               ← interfaces UserJourney, JourneyStatus
  predictor.ts           ← Inngest cron prediction engine

src/lib/features/
  border-prediction.ts   ← prédiction attente frontières
  domino-detector.ts     ← détection effets cascade

src/lib/animations/
  springs.ts             ← constantes d'animation partagées

src/lib/notifications/
  push.ts                ← Web Push API

src/app/api/v1/
  dashboard/route.ts     ← endpoint central bottom sheet
  my-journey/route.ts    ← CRUD trajets utilisateur
  my-journey/status/route.ts  ← statut prédictif actuel
```

### Fichiers à modifier

```
src/app/(dashboard)/map/page.tsx    ← nouvelle architecture 7 layers
src/app/globals.css                 ← keyframes animations
middleware.ts                       ← HSTS + Permissions-Policy
prisma/schema.prisma                ← table UserJourney + PushSubscription
```

### Fichiers à ne PAS toucher

```
src/app/api/v1/routing/car/route.ts      ← routing voiture existant
src/app/api/v1/routing/transport/route.ts ← routing transport existant
src/app/api/v1/routing/geocode/route.ts  ← geocoding existant
src/app/api/v1/layers/*                  ← tous les layer endpoints
src/app/api/v1/signals/*                 ← signal collection
src/lib/territory/*                      ← territory logic
src/lib/transport/*                      ← transport data
src/lib/waze/*                           ← waze integration
```

---

## 5. Composants UI — Spec Détaillée

### Layer 2 : SearchBar.tsx

**Position :** `fixed top-0 left-0 right-0 z-30`, padding horizontal 16px  
**Hauteur :** 52px  
**Style :** Liquid Glass (rgba(18,18,22,0.88) dark / rgba(255,255,255,0.9) light) + backdrop-blur-xl  
**Border-radius :** 16px  
**Shadow :** `0 2px 12px rgba(0,0,0,0.15)`

**Comportement :**
- État idle : placeholder animé (rotation 4s entre 4 suggestions)
- Tap → keyboard monte, overlay carte opacity 0.3, résultats apparaissent (spring 300ms)
- Résultat sélectionné → zoom carte + pin rouge + close keyboard
- Si connecté et Mon Trajet configuré → suggestions rapides "🏠 Domicile" "💼 Travail"
- 3 dernières recherches depuis localStorage

**Placeholders :**
```
"Où allez-vous ?"
"Bardonnex, Cornavin, Rive..."
"Un arrêt, une adresse, un lieu"
"Rechercher dans le Grand Genève"
```

### Layer 3 : QuickFilters.tsx

**Position :** `fixed top-[60px] left-0 right-0 z-20`  
**Hauteur :** 40px, scroll horizontal natif  
**Style pill :** rgba(44,44,46,0.9) dark + backdrop-blur 12px, border-radius 20px

**Filtres (ordre par fréquence d'usage) :**
```
🗺️ Tout  |  🚌 Transport  |  🚦 Trafic  |  ⚠️ Alertes  |  🛂 Frontières  |  🏛️ G7  |  ⭐ Mon Trajet
```

**Actif :** bg var(--brand), text blanc  
**Sélection :** scale 1.05 spring 200ms + feedback haptique  
**Changement de layer :** opacity 0→1 en 250ms sur la carte

### Layer 7 : BottomSheet.tsx (pièce maîtresse)

**3 snaps :**
- `COMPACT` : 56px — headline uniquement
- `MID` : 45vh — perturbations + détails
- `FULL` : 92vh — Flash Infos complet

**Gestes :** pointer events natifs (0 librairie externe)
- Drag up → snap suivant
- Drag down → snap précédent
- Velocity > 500px/s → saute directement COMPACT ou FULL
- Tap handle → toggle COMPACT ↔ MID

**Transition :** `transform 0.35s cubic-bezier(0.23, 1, 0.32, 1)`  
Pendant le drag → `transition: none` (suivi immédiat du doigt)

**Contenu COMPACT (56px) :**
- Si Mon Trajet configuré et dans fenêtre horaire :
  - 🟢 "Trajet normal · Partez à 7h45"
  - 🟡 "Léger retard · +8 min estimées"
  - 🔴 "Trajet perturbé · Alternative dispo"
- Sinon : "Grand Genève · 0 incident" ou "Grand Genève · 3 alertes ⚠️"

**Contenu MID (45vh) :**
1. JourneyCard (si Mon Trajet actif dans fenêtre horaire)
2. Alertes actives (liste horizontale si ≤ 3, verticale si > 3)
3. Statut réseau : `[🟢 TPG] [🟢 CFF] [🟡 Léman Express +5min]`

**Contenu FULL (92vh) :**
1. Barre recherche inline (filtre les infos)
2. Pills catégories horizontaux
3. Flash Infos complet (contenu de /infos)

### Layer 4 : SmartAlert.tsx

**Position :** `fixed top-[108px] z-25`, full width, padding 16px  
**Animation :** slide-down spring 280ms  
**Auto-dismiss :** 8 secondes (ou tap ×)  
**Max simultané :** 2 alertes (queue les suivantes)

**Styles severity :**
- `info` → bg rgba(10,132,255,0.12), border brand
- `warning` → bg rgba(255,159,10,0.12), border orange
- `critical` → bg rgba(255,69,58,0.15), border red + pulsation subtile

**Déclencheurs :**
- Ably channel `alerts:critical` → push immédiat
- Journey predictor → si statut change (normal→delayed, delayed→disrupted)
- Frontière BLOCKED → automatique

---

## 6. Feature Centrale — "Mon Trajet"

### Prisma — nouvelles tables

```prisma
model UserJourney {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  name  String @db.VarChar(100)       // "Domicile → Travail"

  fromLat   Float
  fromLng   Float
  fromLabel String @db.VarChar(200)

  toLat   Float
  toLng   Float
  toLabel String @db.VarChar(200)

  dayOfWeek      Int[]
  departureHour   Int
  departureMinute Int
  flexMinutes     Int   @default(15)

  preferredMode        String   @default("both")  // 'car' | 'transit' | 'both'
  notifyMinutesBefore  Int      @default(15)

  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  @@index([userId])
  @@index([active])
}

model PushSubscription {
  id       String @id @default(cuid())
  userId   String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  endpoint String   @db.Text
  p256dh   String   @db.Text
  auth     String   @db.Text

  createdAt DateTime @default(now()) @db.Timestamptz
  lastUsed  DateTime @updatedAt @db.Timestamptz

  @@unique([userId, endpoint])
  @@index([userId])
}
```

### Predictor — Inngest cron toutes les 5 min

```
Pour chaque UserJourney actif (départ dans ±60min) :
  1. getRouteGeohashes(from, to, mode)
  2. getConsensusForZones(geohashes)    ← Redis
  3. getIncidentsOnRoute(geohashes)     ← Prisma cache
  4. getTpgDisruptions()                ← Redis
  5. calculateImpactScore()             → 0.0–1.0
     0.0–0.3 : normal
     0.3–0.6 : delayed
     0.6–1.0 : disrupted
  6. findBestAlternative() si score > 0.3
  7. Redis.setex(`tif:journey:{userId}:status`, 300, result)
  8. Si statut changé → Ably.publish(`journey:{userId}`, result)
  9. Si disrupted + permission push → WebPush notification
```

### JourneyCard — 3 états visuels

```
NORMAL :
┌─────────────────────────────────────┐
│ 🟢  Domicile → Travail              │
│     Trajet normal · Partez à 7h45   │
│     Arrivée prévue 8h23             │
└─────────────────────────────────────┘

DELAYED :
┌─────────────────────────────────────┐
│ 🟡  Domicile → Travail              │
│     Léger retard · +8 min estimées  │
│     Arrivée 8h31 au lieu de 8h23    │
│ [Voir la cause]                     │
└─────────────────────────────────────┘

DISRUPTED :
┌─────────────────────────────────────┐
│ 🔴  Domicile → Travail  ⚠️ PERTURBÉ │
│     Bardonnex saturé · A40 bloquée  │
│                                     │
│ ✨ Alternative : Léman Express L1   │
│    12 min plus rapide · Partez dans 8min│
│ [Voir l'itinéraire →]               │
└─────────────────────────────────────┘
```

**Style :** barre couleur 4px gauche (vert/orange/rouge), bg var(--bg-card), radius 16px, padding 16px.

### JourneySetup — 5 étapes (< 90 secondes)

1. "Où commencez-vous ?" → SearchBox + [📍 Ma position]
2. "Où allez-vous ?" → SearchBox
3. "Quand partez-vous ?" → Pills jours (L M M J V S D) + time picker + slider flex ±Xmin
4. "Comment voyagez-vous ?" → [🚗 Voiture] [🚌 Transport] [Les deux]
5. "Alertez-moi X min avant" → Slider 5/10/15/20/30

**Animation entre étapes :** slide horizontal spring (style iOS)  
**Progress bar :** 5 étapes, 4px height, couleur brand

---

## 7. Features Exclusives

### A — Prédiction Passage Frontière

**Composant :** `BorderPredictionWidget.tsx` dans bottom sheet MID (filtre "Frontières" actif)

```
[🛂 Bardonnex] ──────────────────────────
 Maintenant : 12 min ↗ Pire dans 20 min
 Recommandation : Partez dans 5 min
 [▁▂▃▄▅▄▃] sparkline SVG 80×24px (60min)

[🛂 Thônex] ─────────────────────────────
 Maintenant : 3 min ↘ S'améliore
 [▅▄▃▂▁▁▁] sparkline SVG (vert→orange→rouge)
```

**Algorithme :** EWMA actuel + TemporalPattern (existant) + G7Directive impacts. 0 ML. 0 API externe.

**Sparkline :** SVG inline, 12 points = 60 minutes, couleur interpolée vert→orange→rouge.

### B — Alerte Domino

**Principe :** détecte les effets en cascade avant qu'ils arrivent.

```
Si incident sur zone X →
  1. Identifier geohash6 voisins
  2. Calculer flux reporté (basé sur capacité TrafficZone)
  3. Si flux > capacité zone voisine →
     SmartAlert "⚡ Effet cascade · Meyrin saturé dans 12 min"
     + "Alternative : Perly libre · 4 min de plus"
```

### C — G7 Mode Intelligent

**Activation :** automatique si `new Date() >= 2026-06-08 && <= 2026-06-17`

- Overlay polygones zones sécurisées sur la carte (rouge semi-transparent)
- Badge "G7" pulsant dans le header
- BottomSheet compact → "🏛️ G7 actif · Restrictions en vigueur"
- SmartAlert si utilisateur approche d'une zone sécurisée (GPS)
- Mon Trajet : recalcul automatique avec exclusion zones G7

**Données :** table `G7Directive` existante + coordonnées zones hardcodées.

### D — Voice Status (accessibilité)

**Bouton 🔊** dans FloatingControls. Tap → Web Speech API native (fr-CH).

```
"Grand Genève. Situation normale sur le réseau.
 Une alerte active : congestion à Bardonnex, 12 minutes d'attente.
 Votre trajet domicile-travail sera normal. Partez à sept heures quarante-cinq."
```

0 dépendance externe. 0 latence réseau. 0 coût.

---

## 8. API Dashboard — Endpoint Central

### `GET /api/v1/dashboard`

Cache Redis 30s. Réponse < 50ms depuis cache (< 200ms sur cache miss).

```typescript
interface DashboardData {
  myJourney?: {
    name: string
    status: 'normal' | 'delayed' | 'disrupted'
    headline: string
    detail?: string
    alternative?: { description: string; timeSaved: number; departureIn: number }
    delayMinutes: number
  }
  alerts: {
    id: string; icon: string; title: string
    severity: string; timeAgo: string
  }[]
  network: {
    tpg: 'normal' | 'delayed' | 'disrupted'
    cff: 'normal' | 'delayed' | 'disrupted'
    ceva: 'normal' | 'delayed' | 'disrupted'
  }
  globalStatus: 'calm' | 'active' | 'critical'
  activeZones: number
  lastUpdated: string
}
```

**Cache-Control header :** `public, s-maxage=30, stale-while-revalidate=30`  
Cloudflare capte ce header et met en cache au niveau edge → 0 request Vercel/Infomaniak pour les utilisateurs en cache.

---

## 9. Animations

### Constantes partagées — `src/lib/animations/springs.ts`

```typescript
export const springs = {
  sheet:    'cubic-bezier(0.23, 1, 0.32, 1) 350ms',
  filter:   'cubic-bezier(0.23, 1, 0.32, 1) 200ms',
  alertIn:  'cubic-bezier(0.23, 1, 0.32, 1) 280ms',
  alertOut: 'cubic-bezier(0.4, 0, 1, 1) 200ms',
  search:   'cubic-bezier(0.16, 1, 0.3, 1) 300ms',
  card:     'cubic-bezier(0.23, 1, 0.32, 1) 150ms',
}
```

**Règle absolue :** toutes les animations utilisent uniquement `transform` et `opacity`.  
Jamais `height`, `width`, `top`, `left` animés → 60fps garanti sur iPhone 12+.

### Keyframes à ajouter dans globals.css

```css
@keyframes slideDown  { from { transform: translateY(-100%) } to { transform: translateY(0) } }
@keyframes slideUp    { from { transform: translateY(100%)  } to { transform: translateY(0) } }
@keyframes scaleIn    { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
@keyframes pulseStatus { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
```

---

## 10. Notifications Push

### Service Worker — `public/sw.js`

Enregistré au login. Permission demandée **une seule fois** lors du setup Mon Trajet.

**Message UI avant permission :**
> "TIF peut vous alerter avant votre départ si votre trajet est perturbé. Aucune notification commerciale. Uniquement votre mobilité."

**Payload notification :**
```json
{
  "title": "⚠️ Votre trajet est perturbé",
  "body": "Bardonnex saturé · Partez 10 min plus tôt ou prenez le Léman Express",
  "icon": "/icons/tif-192.png",
  "badge": "/icons/badge-72.png",
  "data": { "type": "journey_alert", "journeyId": "..." }
}
```

**Déclencheur :** Inngest job `notify-journey`, uniquement si :
- Statut changé vers `delayed` ou `disrupted`
- Dans la fenêtre `notifyMinutesBefore`
- Permission push accordée par l'utilisateur

---

## 11. Ordre d'Implémentation

### Phase 1 — Foundation (bloquante)
1. Migration Prisma : `UserJourney` + `PushSubscription`
2. `src/lib/my-journey/types.ts`
3. `src/lib/my-journey/predictor.ts` (Inngest cron)
4. `src/app/api/v1/dashboard/route.ts`
5. `src/app/api/v1/my-journey/route.ts`
6. `src/app/api/v1/my-journey/status/route.ts`

### Phase 2 — UI Components
7. `src/lib/animations/springs.ts`
8. Mettre à jour `src/app/globals.css` (keyframes)
9. `src/components/map/ui/SearchBar.tsx`
10. `src/components/map/ui/QuickFilters.tsx`
11. `src/components/map/ui/FloatingControls.tsx`
12. `src/components/map/ui/BottomSheet.tsx` ← le plus complexe
13. `src/components/map/ui/SmartAlert.tsx`

### Phase 3 — Mon Trajet UI
14. `src/components/my-journey/JourneySetup.tsx`
15. `src/components/my-journey/JourneyCard.tsx`

### Phase 4 — Features exclusives
16. `src/lib/features/border-prediction.ts`
17. `src/components/map/widgets/BorderPredictionWidget.tsx`
18. `src/lib/features/domino-detector.ts`
19. `src/components/map/modes/G7Mode.tsx`
20. `src/components/accessibility/VoiceStatus.tsx`

### Phase 5 — Restructure + Sécurité + Push
21. Modifier `middleware.ts` (HSTS + Permissions-Policy)
22. Modifier `src/app/(dashboard)/map/page.tsx` (architecture 7 layers)
23. `public/sw.js` (Service Worker)
24. `src/lib/notifications/push.ts`

### Phase 6 — Validation
25. `npx tsc --noEmit` → 0 erreurs
26. `npm run build` → succès
27. Tests manuels : BottomSheet drag, SearchBar, QuickFilters, JourneyCard 3 états
28. git commit (sans push — push manuel après validation)

---

## 12. Definition of Done

### UX
- [ ] Ouverture → statut Mon Trajet visible en < 2 secondes
- [ ] 2 taps max pour accomplir 90 % des tâches
- [ ] BottomSheet drag fluide 60fps (transform only, 0 jank)
- [ ] 0 spinner visible grâce au SWR pattern
- [ ] Alertes contextuelles visibles sans chercher

### Mon Trajet
- [ ] Setup en < 90 secondes (5 étapes)
- [ ] Prédiction calculée dans les 5 minutes suivant le setup
- [ ] Notification push si perturbation (si permission accordée)
- [ ] Alternative proposée avec temps de gain chiffré

### Features exclusives
- [ ] Sparkline frontière 60 minutes visible et animée
- [ ] Alerte domino déclenchée si zone voisine prédit saturation
- [ ] G7 Mode actif automatiquement à partir du 8 juin 2026
- [ ] Voice status lit la situation en français correct (fr-CH)

### Technique
- [ ] 0 régression sur layers existants (routing, transport, territory)
- [ ] Dashboard API : réponse < 50ms depuis cache (< 200ms miss)
- [ ] BottomSheet : 0 librairie externe, CSS + pointer events natifs
- [ ] TypeScript strict : 0 erreur
- [ ] Build Next.js : succès sans warning critique
- [ ] Rate limiting actif sur tous les endpoints
- [ ] HSTS + Permissions-Policy ajoutés au middleware

### Infrastructure
- [ ] Cloudflare configuré devant Infomaniak Jelastic
- [ ] Cache edge Cloudflare 30s sur `/api/v1/dashboard`
- [ ] `Cache-Control: stale-while-revalidate=30` sur les réponses API
- [ ] Redis Cluster 3 nodes configuré
- [ ] Read Replica PostgreSQL active
- [ ] Circuit breakers en place pour HERE, Ably, opendata.ch, TPG, CFF
