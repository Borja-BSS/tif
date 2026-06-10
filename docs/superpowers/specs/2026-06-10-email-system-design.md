# Email System — TIF G7 Grand Genève
**Date:** 2026-06-10 | **Status:** Approved

## Scope

Four independent email flows:
1. Journey creation confirmation → user
2. Morning briefing alert → user (X min before departure)
3. Contact forms (4 types) → contact@borja-swiss-solutions.ch + sender copy

Out of scope: push notifications, SMS, existing predict-journeys alert logic (untouched).

---

## 1. Email Templates (`src/lib/email.ts`)

### `sendJourneyConfirmation(payload)`
```ts
interface JourneyConfirmationPayload {
  to: string
  journeyName: string
  fromLabel: string
  toLabel: string
  departureHour: number
  departureMin: number
  dayOfWeek: number[]
  notifyMinutesBefore: number
  preferredMode: 'car' | 'transit' | 'both'
}
```
Dark-mode glass-morphism template matching existing alert email design.
Subject: `✓ Trajet configuré — {journeyName}`

### `sendMorningBriefing(payload)`
```ts
interface MorningBriefingPayload extends JourneyAlertPayload {
  // same as JourneyAlertPayload — status can be 'normal' | 'delayed' | 'disrupted'
}
```
Reuses `sendJourneyAlert` — same template, always sends (not just on change).

### `sendContactForm(payload)`
```ts
interface ContactFormPayload {
  type: 'contact' | 'pro' | 'audit' | 'partner'
  name: string
  email: string
  subject?: string
  message?: string
  organisation?: string
  fonction?: string
  institution?: string
  expertise?: string
}
```
Two emails sent: forward to `contact@borja-swiss-solutions.ch` + auto-reply to sender.

---

## 2. Journey Confirmation (`/api/v1/my-journey` POST)

After `db.userJourney.create()` (already in try/catch), call `sendJourneyConfirmation()`.
Fire-and-forget: wrapped in its own try/catch — journey save never blocked by email failure.
Email goes to `session.user.email` (same as `emailNotify`).

---

## 3. Morning Briefing Inngest Job (`src/inngest/morning-briefing.ts`)

**Cron:** `*/5 * * * *` (every 5 min, same as predict-journeys)

**Algorithm per journey:**
1. Skip if `!journey.emailNotify`
2. Skip if today not in `journey.dayOfWeek` (JS `new Date().getDay()`)
3. Compute `alertTime = departureHour*60 + departureMinute - notifyMinutesBefore`
4. Compute `nowMin = now.getHours()*60 + now.getMinutes()`
5. Send if `nowMin >= alertTime && nowMin < alertTime + 5` (5-min window matches cron)
6. Redis dedup: `tif:briefing:${journeyId}:${yyyy-mm-dd}` SET NX EX 82800 (23h)
7. Evaluate current status using existing `calculateImpactScore` / `scoreToStatus`
8. Call `sendJourneyAlert()` with current status (including 'normal')

**Registered in:** `src/app/api/inngest/route.ts`

---

## 4. Contact API (`/api/v1/contact` POST)

**Auth:** None required (public endpoint)
**Rate limit:** 3 requests / 15 min / IP (Upstash sliding window)

**Zod schema:**
```ts
z.object({
  type: z.enum(['contact', 'pro', 'audit', 'partner']),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  subject: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  organisation: z.string().max(200).optional(),
  fonction: z.string().max(100).optional(),
  institution: z.string().max(200).optional(),
  expertise: z.string().max(2000).optional(),
})
```

**Response:** `{ ok: true }` on success, `{ error: string }` on failure.

---

## 5. HomeContent.tsx — Form Wiring

**4 forms to wire:**

| Modal ID | Fields | Type |
|----------|--------|------|
| `m-contact` | name, email, subject (select), message | `contact` |
| `m-pro` | name, organisation, email, fonction, message (textarea) | `pro` |
| `m-audit` | name, email, expertise (textarea) | `audit` |
| `m-partner` | institution, email, expertise (textarea) | `partner` |

**Per-form state:** `{ name, email, ..., loading, success, error }`
**On submit:** `POST /api/v1/contact`, show spinner, then success msg or error inline.
**No other code in HomeContent.tsx touched.**

---

## SMTP Config (already on Vercel)
- `SMTP_HOST=mail.infomaniak.com`
- `SMTP_PORT=587`
- `SMTP_USER=contact@borja-swiss-solutions.ch`
- `SMTP_PASS=<encrypted>`

## Files Changed
- `src/lib/email.ts` — add 2 templates
- `src/app/api/v1/my-journey/route.ts` — add confirmation call
- `src/inngest/morning-briefing.ts` — new file
- `src/app/api/inngest/route.ts` — register new function
- `src/app/api/v1/contact/route.ts` — new file
- `src/components/HomeContent.tsx` — wire 4 forms only
