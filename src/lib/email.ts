import nodemailer from 'nodemailer'
import type { G7Alert } from '@/data/types'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

let _transport: nodemailer.Transporter | null = null

function getTransport(): nodemailer.Transporter {
  if (_transport) return _transport
  _transport = nodemailer.createTransport({
    host:   process.env.SMTP_HOST ?? 'mail.infomaniak.com',
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER ?? 'contact@borja-swiss-solutions.ch',
      pass: process.env.SMTP_PASS,
    },
  })
  return _transport
}

export interface JourneyAlertPayload {
  to:            string
  journeyName:   string
  status:        'normal' | 'delayed' | 'disrupted'
  headline:      string
  detail?:       string
  delayMinutes:  number
  departureHour: number
  departureMin:  number
  g7Alerts?:     G7Alert[]
}

const STATUS_FR: Record<string, string> = {
  normal:    '🟢 Trajet normal',
  delayed:   '🟡 Retard prévu',
  disrupted: '🔴 Perturbation',
}

export async function sendJourneyAlert(payload: JourneyAlertPayload): Promise<void> {
  const { to, journeyName, status, headline, detail, delayMinutes, departureHour, departureMin, g7Alerts } = payload

  const dep = `${String(departureHour).padStart(2,'0')}h${String(departureMin).padStart(2,'0')}`
  const subject = `${STATUS_FR[status] ?? '⚠️ Alerte'} — ${journeyName} · ${dep}`

  let g7Section = ''
  if (g7Alerts && g7Alerts.length > 0) {
    const alertRows = g7Alerts.map(a => {
      const bg   = a.severity === 'critical' ? 'rgba(255,69,58,0.08)'  : a.severity === 'warning' ? 'rgba(255,196,0,0.07)'  : 'rgba(255,255,255,0.03)'
      const bd   = a.severity === 'critical' ? 'rgba(255,69,58,0.25)'  : a.severity === 'warning' ? 'rgba(255,196,0,0.20)'  : 'rgba(255,255,255,0.08)'
      const icon = a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : 'ℹ️'
      return `<div style="background:${bg};border:1px solid ${bd};border-radius:10px;padding:10px 14px;margin-bottom:8px;"><div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.88);">${icon} ${esc(a.title)}</div><div style="font-size:12px;color:rgba(255,255,255,0.52);margin-top:4px;line-height:1.5;">${esc(a.detail)}</div></div>`
    }).join('')
    g7Section = `<div style="margin-bottom:20px;"><div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">⚠️ Alertes G7 actives aujourd'hui</div>${alertRows}</div>`
  }

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px 24px;">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <div style="width:40px;height:40px;border-radius:10px;background:#E8000E;display:flex;align-items:center;justify-content:center;font-size:20px;">🗺️</div>
        <div>
          <div style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.08em;">TIF · G7 Grand Genève</div>
          <div style="font-size:15px;font-weight:700;color:#fff;margin-top:2px;">Mon Trajet — Alerte</div>
        </div>
      </div>

      <!-- Journey name -->
      <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:6px;">Trajet favori</div>
      <div style="font-size:17px;font-weight:700;color:#fff;margin-bottom:20px;">${esc(journeyName)}</div>

      <!-- Status badge -->
      <div style="display:inline-block;padding:8px 16px;border-radius:12px;font-size:14px;font-weight:700;margin-bottom:20px;
        background:${status === 'disrupted' ? 'rgba(255,69,58,0.15)' : status === 'delayed' ? 'rgba(255,159,10,0.15)' : 'rgba(48,209,88,0.15)'};
        color:${status === 'disrupted' ? '#FF453A' : status === 'delayed' ? '#FF9F0A' : '#30D158'};
        border:1px solid ${status === 'disrupted' ? 'rgba(255,69,58,0.3)' : status === 'delayed' ? 'rgba(255,159,10,0.3)' : 'rgba(48,209,88,0.3)'};">
        ${esc(STATUS_FR[status] ?? '⚠️ Alerte')}
      </div>

      <!-- Headline -->
      <div style="font-size:16px;font-weight:600;color:#fff;margin-bottom:10px;line-height:1.4;">${esc(headline)}</div>
      ${detail ? `<div style="font-size:14px;color:rgba(255,255,255,0.6);margin-bottom:16px;line-height:1.5;">${esc(detail)}</div>` : ''}
      ${delayMinutes > 0 ? `<div style="background:rgba(255,159,10,0.08);border:1px solid rgba(255,159,10,0.2);border-radius:12px;padding:12px 16px;font-size:13px;color:#FF9F0A;font-weight:600;margin-bottom:16px;">⏱ Retard estimé : +${delayMinutes} min · Départ prévu ${dep}</div>` : ''}

      <!-- G7 Alerts -->
      ${g7Section}

      <!-- CTA -->
      <a href="https://tif.borja-swiss-solutions.ch/map" style="display:inline-block;padding:12px 24px;background:#E8000E;color:#fff;text-decoration:none;border-radius:14px;font-size:14px;font-weight:700;margin-top:4px;">
        Voir sur la carte →
      </a>

      <!-- Footer -->
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.07);font-size:11px;color:rgba(255,255,255,0.3);line-height:1.6;">
        TIF · Application de mobilité G7 Grand Genève 2026<br>
        Développé par <a href="https://borja-swiss-solutions.ch" style="color:rgba(255,255,255,0.4);">Börja Swiss Solutions</a>
      </div>
    </div>
  </div>
</body>
</html>`

  await getTransport().sendMail({
    from:    `"TIF · Grand Genève" <${process.env.SMTP_USER ?? 'contact@borja-swiss-solutions.ch'}>`,
    to,
    subject,
    html,
  })
}

// ── Journey confirmation ──────────────────────────────────────────────────────

export interface JourneyConfirmationPayload {
  to:                  string
  journeyName:         string
  fromLabel:           string
  toLabel:             string
  departureHour:       number
  departureMin:        number
  dayOfWeek:           number[]
  notifyMinutesBefore: number
  preferredMode:       'car' | 'transit' | 'both'
}

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const DAY_NAMES  = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const MODE_FR: Record<string, string> = {
  car:     '🚗 Voiture',
  transit: '🚌 Transports publics',
  both:    '🚗/🚌 Voiture & transports',
}

export async function sendJourneyConfirmation(payload: JourneyConfirmationPayload): Promise<void> {
  const { to, journeyName, fromLabel, toLabel, departureHour, departureMin, dayOfWeek, notifyMinutesBefore, preferredMode } = payload

  const dep     = `${String(departureHour).padStart(2,'0')}h${String(departureMin).padStart(2,'0')}`
  const subject = `✓ Trajet configuré — ${journeyName}`

  const daysFormatted = [1,2,3,4,5,6,0]
    .map(d => {
      const active = dayOfWeek.includes(d)
      return `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;font-size:12px;font-weight:700;
        background:${active ? 'rgba(232,0,14,0.2)' : 'rgba(255,255,255,0.05)'};
        color:${active ? '#E8000E' : 'rgba(255,255,255,0.25)'};
        border:1px solid ${active ? 'rgba(232,0,14,0.4)' : 'rgba(255,255,255,0.08)'};">${DAY_LABELS[d]}</span>`
    })
    .join('')

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px 24px;">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <div style="width:40px;height:40px;border-radius:10px;background:#E8000E;display:flex;align-items:center;justify-content:center;font-size:20px;">✓</div>
        <div>
          <div style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.08em;">TIF · G7 Grand Genève</div>
          <div style="font-size:15px;font-weight:700;color:#fff;margin-top:2px;">Trajet configuré</div>
        </div>
      </div>

      <!-- Journey name -->
      <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:6px;">Nom du trajet</div>
      <div style="font-size:17px;font-weight:700;color:#fff;margin-bottom:20px;">${esc(journeyName)}</div>

      <!-- Route -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin-bottom:20px;">
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;">
          <div style="width:8px;height:8px;border-radius:50%;background:#30D158;margin-top:5px;flex-shrink:0;"></div>
          <div style="font-size:14px;color:rgba(255,255,255,0.8);">${esc(fromLabel)}</div>
        </div>
        <div style="width:1px;height:12px;background:rgba(255,255,255,0.1);margin-left:3px;margin-bottom:12px;"></div>
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="width:8px;height:8px;border-radius:50%;background:#E8000E;margin-top:5px;flex-shrink:0;"></div>
          <div style="font-size:14px;color:rgba(255,255,255,0.8);">${esc(toLabel)}</div>
        </div>
      </div>

      <!-- Details row -->
      <div style="display:flex;gap:12px;margin-bottom:20px;">
        <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;">
          <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:4px;">Heure de départ</div>
          <div style="font-size:18px;font-weight:700;color:#fff;">${dep}</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;">
          <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:4px;">Mode</div>
          <div style="font-size:13px;font-weight:600;color:#fff;">${esc(MODE_FR[preferredMode] ?? preferredMode)}</div>
        </div>
      </div>

      <!-- Days -->
      <div style="margin-bottom:20px;">
        <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:8px;">Jours actifs</div>
        <div style="display:flex;gap:6px;">${daysFormatted}</div>
      </div>

      <!-- Alert info -->
      <div style="background:rgba(48,209,88,0.06);border:1px solid rgba(48,209,88,0.2);border-radius:12px;padding:12px 16px;font-size:13px;color:#30D158;font-weight:600;margin-bottom:20px;">
        🔔 Vous recevrez une alerte ${notifyMinutesBefore} min avant chaque départ
      </div>

      <!-- CTA -->
      <a href="https://tif.borja-swiss-solutions.ch/map" style="display:inline-block;padding:12px 24px;background:#E8000E;color:#fff;text-decoration:none;border-radius:14px;font-size:14px;font-weight:700;margin-top:4px;">
        Voir sur la carte →
      </a>

      <!-- Footer -->
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.07);font-size:11px;color:rgba(255,255,255,0.3);line-height:1.6;">
        TIF · Application de mobilité G7 Grand Genève 2026<br>
        Développé par <a href="https://borja-swiss-solutions.ch" style="color:rgba(255,255,255,0.4);">Börja Swiss Solutions</a>
      </div>
    </div>
  </div>
</body>
</html>`

  await getTransport().sendMail({
    from:    `"TIF · Grand Genève" <${process.env.SMTP_USER ?? 'contact@borja-swiss-solutions.ch'}>`,
    to,
    subject,
    html,
  })
}

// ── Signalement notification ──────────────────────────────────────────────────

export interface SignalementNotifPayload {
  id:          string
  category:    string
  subcategory: string
  priority:    string
  description: string
  address?:    string
  lat?:        number
  lng?:        number
  mediaCount:  number
  createdAt:   string
}

const PRIORITY_COLOR_HEX: Record<string, string> = {
  info:         '#8E8E93',
  vigilance:    '#30D158',
  perturbation: '#FF9500',
  important:    '#FF9F0A',
  urgent:       '#FF3B30',
  critique:     '#FF2D55',
}

const PRIORITY_LABEL: Record<string, string> = {
  info:         'Info',
  vigilance:    'Vigilance',
  perturbation: 'Perturbation',
  important:    'Important',
  urgent:       'Urgent',
  critique:     'Critique',
}

export async function sendSignalementNotification(payload: SignalementNotifPayload): Promise<void> {
  const { id, category, subcategory, priority, description, address, lat, lng, mediaCount, createdAt } = payload
  const to = (process.env.ADMIN_NOTIFICATION_EMAILS ?? 'aruncalstas@gmail.com,lostropicosbox@gmail.com')
    .split(',').map(s => s.trim()).join(', ')

  const priColor = PRIORITY_COLOR_HEX[priority] ?? '#8E8E93'
  const priLabel = PRIORITY_LABEL[priority]     ?? priority
  const date = new Date(createdAt).toLocaleString('fr-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const locationLine = lat != null && lng != null
    ? `GPS ${lat.toFixed(5)}, ${lng.toFixed(5)} — <a href="https://maps.google.com/?q=${lat},${lng}" style="color:#0A84FF;">Maps →</a>`
    : address ? esc(address) : '—'

  const mediaLine = mediaCount > 0
    ? `<span style="color:#0A84FF;font-weight:600;">📎 ${mediaCount} pièce${mediaCount > 1 ? 's' : ''} jointe${mediaCount > 1 ? 's' : ''}</span>`
    : '<span style="color:rgba(255,255,255,0.3);">Aucun média</span>'

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px 24px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <div style="width:40px;height:40px;border-radius:10px;background:#FF3B30;display:flex;align-items:center;justify-content:center;font-size:20px;">📡</div>
      <div>
        <div style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.08em;">TIF Admin · G7 Grand Genève</div>
        <div style="font-size:15px;font-weight:700;color:#fff;margin-top:2px;">Nouveau signalement</div>
      </div>
    </div>
    <div style="display:inline-block;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:700;margin-bottom:18px;background:${priColor}18;color:${priColor};border:1px solid ${priColor}35;">
      ${esc(priLabel)}
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:0 16px;margin-bottom:20px;">
      <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;gap:12px;">
        <div style="width:110px;flex-shrink:0;font-size:11px;font-weight:600;color:rgba(255,255,255,0.35);padding-top:2px;text-transform:uppercase;letter-spacing:.05em;">Catégorie</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);">${esc(category)} · ${esc(subcategory)}</div>
      </div>
      <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;gap:12px;">
        <div style="width:110px;flex-shrink:0;font-size:11px;font-weight:600;color:rgba(255,255,255,0.35);padding-top:2px;text-transform:uppercase;letter-spacing:.05em;">Description</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.5;">${esc(description)}</div>
      </div>
      <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;gap:12px;">
        <div style="width:110px;flex-shrink:0;font-size:11px;font-weight:600;color:rgba(255,255,255,0.35);padding-top:2px;text-transform:uppercase;letter-spacing:.05em;">Localisation</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.75);">${locationLine}</div>
      </div>
      <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;gap:12px;">
        <div style="width:110px;flex-shrink:0;font-size:11px;font-weight:600;color:rgba(255,255,255,0.35);padding-top:2px;text-transform:uppercase;letter-spacing:.05em;">Médias</div>
        <div style="font-size:13px;">${mediaLine}</div>
      </div>
      <div style="padding:10px 0;display:flex;gap:12px;">
        <div style="width:110px;flex-shrink:0;font-size:11px;font-weight:600;color:rgba(255,255,255,0.35);padding-top:2px;text-transform:uppercase;letter-spacing:.05em;">Reçu le</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.6);">${esc(date)}</div>
      </div>
    </div>
    <a href="https://tif.borja-swiss-solutions.ch/admin/signalements" style="display:inline-block;padding:13px 28px;background:#0A84FF;color:#fff;text-decoration:none;border-radius:14px;font-size:14px;font-weight:700;">
      Voir &amp; traiter dans l'admin →
    </a>
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.07);font-size:11px;color:rgba(255,255,255,0.3);line-height:1.6;">
      TIF · Application de mobilité G7 Grand Genève 2026 · ID: ${esc(id)}
    </div>
  </div>
</div>
</body>
</html>`

  await getTransport().sendMail({
    from:    `"TIF Admin" <${process.env.SMTP_USER ?? 'contact@borja-swiss-solutions.ch'}>`,
    to,
    subject: `📡 Nouveau signalement — ${esc(priLabel)} · ${esc(category)}`,
    html,
  })
}

// ── Contact form ──────────────────────────────────────────────────────────────

export interface ContactFormPayload {
  type:          'contact' | 'pro' | 'audit' | 'partner'
  name:          string
  email:         string
  subject?:      string
  message?:      string
  organisation?: string
  fonction?:     string
  institution?:  string
  expertise?:    string
}

const TYPE_FR: Record<string, string> = {
  contact: 'Contact général',
  pro:     'Demande pro',
  audit:   'Demande d\'audit',
  partner: 'Partenariat',
}

function fieldRow(label: string, value: string | undefined): string {
  if (!value) return ''
  return `
    <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div style="width:120px;flex-shrink:0;font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);padding-top:2px;">${label}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.5;">${esc(value)}</div>
    </div>`
}

export async function sendContactForm(payload: ContactFormPayload): Promise<void> {
  const { type, name, email, subject, message, organisation, fonction, institution, expertise } = payload

  const forwardSubject = `[TIF Contact — ${type}] ${name} — ${subject ?? ''}`

  const forwardHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px 24px;">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <div style="width:40px;height:40px;border-radius:10px;background:#E8000E;display:flex;align-items:center;justify-content:center;font-size:20px;">📬</div>
        <div>
          <div style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.08em;">TIF · G7 Grand Genève</div>
          <div style="font-size:15px;font-weight:700;color:#fff;margin-top:2px;">${esc(TYPE_FR[type] ?? type)}</div>
        </div>
      </div>

      <!-- Fields -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:0 16px;">
        ${fieldRow('Type', TYPE_FR[type] ?? type)}
        ${fieldRow('Nom', name)}
        ${fieldRow('Email', email)}
        ${fieldRow('Sujet', subject)}
        ${fieldRow('Organisation', organisation)}
        ${fieldRow('Fonction', fonction)}
        ${fieldRow('Institution', institution)}
        ${fieldRow('Expertise', expertise)}
        ${fieldRow('Message', message)}
      </div>

      <!-- Footer -->
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.07);font-size:11px;color:rgba(255,255,255,0.3);line-height:1.6;">
        TIF · Application de mobilité G7 Grand Genève 2026<br>
        Développé par <a href="https://borja-swiss-solutions.ch" style="color:rgba(255,255,255,0.4);">Börja Swiss Solutions</a>
      </div>
    </div>
  </div>
</body>
</html>`

  const ackSubject = 'Votre message a bien été reçu — TIF G7 Grand Genève'

  const ackHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px 24px;">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <div style="width:40px;height:40px;border-radius:10px;background:#E8000E;display:flex;align-items:center;justify-content:center;font-size:20px;">✓</div>
        <div>
          <div style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.08em;">TIF · G7 Grand Genève</div>
          <div style="font-size:15px;font-weight:700;color:#fff;margin-top:2px;">Message reçu</div>
        </div>
      </div>

      <div style="font-size:15px;color:rgba(255,255,255,0.8);line-height:1.6;margin-bottom:20px;">
        Bonjour ${esc(name)},<br><br>
        Votre message a bien été reçu. Nous vous répondrons sous 48h ouvrées.
      </div>

      <!-- Footer -->
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.07);font-size:11px;color:rgba(255,255,255,0.3);line-height:1.6;">
        TIF · Application de mobilité G7 Grand Genève 2026<br>
        Développé par <a href="https://borja-swiss-solutions.ch" style="color:rgba(255,255,255,0.4);">Börja Swiss Solutions</a>
      </div>
    </div>
  </div>
</body>
</html>`

  const transport = getTransport()
  const from = `"TIF · Grand Genève" <${process.env.SMTP_USER ?? 'contact@borja-swiss-solutions.ch'}>`

  await Promise.all([
    transport.sendMail({
      from,
      to:      'contact@borja-swiss-solutions.ch',
      replyTo: email,
      subject: forwardSubject,
      html:    forwardHtml,
    }),
    transport.sendMail({
      from,
      to:      email,
      subject: ackSubject,
      html:    ackHtml,
    }),
  ])
}
