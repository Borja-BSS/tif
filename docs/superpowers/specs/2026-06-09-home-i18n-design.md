# Home Page i18n + Börja Header Link — Design Spec
**Date:** 2026-06-09
**Status:** Approved

## Objectif

Ajouter la traduction de la page d'accueil en 7 langues (FR existant + EN, DE, IT, ES, PT, SQ) et un lien branded "Börja Swiss Solutions" dans le header — uniquement sur la page d'accueil, sans toucher aucune autre partie de l'application.

---

## Contraintes absolues

- `next.config.ts` — **intact**
- `middleware.ts` — **intact**
- `layout.tsx` — **intact** (`lang="fr"` reste, pas de routing i18n)
- `/map`, `/login`, `/register`, dashboard, API routes — **aucun impact**
- Aucune nouvelle dépendance npm
- Performances : +~12KB gzippé max (7 dictionnaires)

---

## Architecture — Approche A (standalone client-side)

### Fichiers créés (2)

#### `src/lib/i18n/home-translations.ts`

Dictionnaire TypeScript typé pour les 7 langues. Structure en deux niveaux :

```typescript
export type Locale = 'fr' | 'en' | 'de' | 'it' | 'es' | 'pt' | 'sq'
export const LOCALES: Locale[] = ['fr', 'en', 'de', 'it', 'es', 'pt', 'sq']
export const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'FR', en: 'EN', de: 'DE', it: 'IT', es: 'ES', pt: 'PT', sq: 'SQ'
}
export const LOCALE_NAMES: Record<Locale, string> = {
  fr: 'Français', en: 'English', de: 'Deutsch',
  it: 'Italiano', es: 'Español', pt: 'Português', sq: 'Shqip'
}

export type HomeT = {
  // Navigation
  nav: { live: string; sources: string; support: string; transparency: string; signIn: string; mapCta: string }
  // Hero
  hero: { title: string; subtitle1: string; subtitle2: string; subtitle3: string; cta: string }
  // Dashboard
  dash: { sectionTitle: string; refreshLabel: string; trafficLabel: string; tpgLabel: string; cffLabel: string; weatherLabel: string; g7Label: string; bordersLabel: string; cevaLabel: string }
  // Social sharing
  share: { title: string; subtitle: string; twitter: string; linkedin: string; whatsapp: string; copyLink: string; copied: string }
  // Why section (carousel)
  why: { sectionTitle: string; sectionSub: string; scenarios: Array<{ icon: string; title: string; badge?: string; rows?: Array<{ label: string; value: string; color?: string }>; note?: string; body?: string }> }
  // FAQ
  faq: { sectionTitle: string; items: Array<{ q: string; a: string }> }
  // Parking
  parking: { sectionTitle: string; sectionSub: string; tpgAccess: string }
  // Sources
  sources: { sectionTitle: string; sectionSub: string; updateEvery: string }
  // CTA Dark
  ctaDark: { title: string; cta: string; stat1: string; stat2: string; stat3: string }
  // Contribution
  contrib: { sectionTitle: string; sectionSub: string; citizen: { title: string; desc: string; cta: string }; pro: { title: string; desc: string; cta: string; features: string[] } }
  // Contact band
  contact: { prompt: string; detail: string; cta: string }
  // Transparency
  trust: { sectionTitle: string; sectionSub: string; cards: Array<{ icon: string; title: string; cta: string }> }
  // Final CTA
  finalCta: { title: string; subtitle: string; primaryCta: string; secondaryCta: string }
  // Footer
  footer: { tagline: string; copyright: string; legal: string }
  // Modals
  modals: {
    support: { title: string; subtitle: string }
    proAccess: { title: string }
    contact: { title: string }
    hosting: { title: string }
    dataProtection: { title: string }
    privacy: { title: string }
    security: { title: string }
    faq: { title: string }
    docs: { title: string }
    useCases: { title: string }
    architecture: { title: string }
    vulnerability: { title: string }
    audit: { title: string }
    partnership: { title: string }
  }
  // Ticker
  ticker: { sources: string; g7: string; frontaliers: string; refresh: string }
  // Generic UI
  ui: { close: string; open: string; loading: string; next: string; prev: string }
}

export const translations: Record<Locale, HomeT> = {
  fr: { /* contenu existant extrait de HomeContent.tsx */ },
  en: { /* traduction anglaise complète */ },
  de: { /* traduction allemande complète */ },
  it: { /* traduction italienne complète */ },
  es: { /* traduction espagnole complète */ },
  pt: { /* traduction portugaise complète */ },
  sq: { /* traduction albanaise complète */ },
}

export function getTranslation(locale: Locale): HomeT {
  return translations[locale] ?? translations['fr']
}
```

Hook inline dans HomeContent (pas de fichier séparé pour limiter les changements) :
```typescript
function useHomeTranslation() {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window === 'undefined') return 'fr'
    return (localStorage.getItem('tif-locale') as Locale) ?? 'fr'
  })
  useEffect(() => { localStorage.setItem('tif-locale', locale) }, [locale])
  const t = useMemo(() => getTranslation(locale), [locale])
  return { t, locale, setLocale }
}
```

#### `src/components/home/LanguageSwitcher.tsx`

Composant client léger : globe 🌐 + code langue actuelle, dropdown avec les 7 options.

```tsx
// Apparence : bouton compact style Liquid Glass, cohérent avec le nav existant
// Desktop : dropdown au survol/clic
// Mobile : adapté (pas de hover)
// Props : locale, setLocale
```

---

### Fichier modifié (1)

#### `src/components/HomeContent.tsx`

**4 modifications ciblées :**

1. **Import** de `getTranslation`, `Locale`, `LOCALES`, `LOCALE_LABELS` depuis `@/lib/i18n/home-translations`
2. **Hook** `useHomeTranslation()` déclaré dans le composant — `const { t, locale, setLocale } = useHomeTranslation()`
3. **Substitution** de toutes les chaînes hardcodées par `t.section.clé` — les arrays de données (WHY_SLIDES, FAQ_ITEMS, etc.) sont remplacés par `t.why.scenarios`, `t.faq.items`, etc.
4. **Nav** : ajout du `<LanguageSwitcher>` + lien Börja dans la barre de navigation existante

---

## Lien Börja Swiss Solutions dans le header

### Placement
Top-right du nav, à droite du bouton "Carte live →", avant ou après selon l'espace.

### Design
```tsx
<a
  href="https://borja-swiss-solutions.ch/"
  target="_blank"
  rel="noopener noreferrer"
  className="borja-link"
>
  <span>Propulsé par</span>
  <strong>Börja</strong>
  <span className="borja-arrow">↗</span>
</a>
```

Style : texte dégradé subtil (blanc→brand blue), effet shimmer au hover, `↗` qui se déplace légèrement en haut-droite au hover. Discret mais cliquable — visible sans polluer le nav.

Sur mobile : se réduit à "Börja ↗" seulement.

---

## Sélecteur de langue

### Placement
Dans le nav, entre les liens existants et les boutons d'action, ou groupé avec le Börja link côté droit.

### Comportement
- Clic → dropdown des 7 langues (FR / EN / DE / IT / ES / PT / SQ)
- Sélection → `setLocale(lang)`, `localStorage.setItem('tif-locale', lang)`, re-render immédiat
- Persistance via localStorage (la langue est mémorisée entre visites)
- Default : `'fr'` (comportement actuel préservé pour tous les utilisateurs existants)

---

## Langues et traductions

| Code | Langue | Spécificité |
|------|--------|-------------|
| `fr` | Français (fr_CH) | Contenu source — extraction directe |
| `en` | English | Traduction standard |
| `de` | Deutsch | Traduction Hochdeutsch |
| `it` | Italiano | Traduction standard |
| `es` | Español | Traduction standard (castillan) |
| `pt` | Português | Traduction standard (européen) |
| `sq` | Shqip (Albanian) | Traduction standard |

Noms propres et sigles **non traduits** : TIF, Grand Genève, TPG, CFF, CEVA, G7, RGPD, nLPD, BAZG, OFROU, Börja, CHF.

---

## Ce qui n'est PAS touché

| Fichier/Dossier | Statut |
|-----------------|--------|
| `next.config.ts` | ✅ Intact |
| `middleware.ts` | ✅ Intact |
| `src/app/layout.tsx` | ✅ Intact |
| `src/app/(auth)/login/` | ✅ Intact |
| `src/app/(dashboard)/` | ✅ Intact |
| `src/app/api/` | ✅ Intact |
| `src/context/AuthContext.tsx` | ✅ Intact |
| `src/context/GuestContext.tsx` | ✅ Intact |
| Prisma schema | ✅ Intact |
| `package.json` (aucune dépendance) | ✅ Intact |

---

## Impact performance

- **Bundle JS** : +~12KB gzippé (7 dictionnaires × ~100 chaînes)
- **Runtime** : `useMemo` sur `getTranslation(locale)` — recompute seulement si la langue change
- **LCP/FID** : aucun impact — HomeContent.tsx est déjà client-side, aucun fetch supplémentaire
- **localStorage** : lecture synchrone au premier render, 1 écriture au changement de langue
