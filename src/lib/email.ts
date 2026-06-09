import nodemailer from 'nodemailer'

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
}

const STATUS_FR: Record<string, string> = {
  normal:    '🟢 Trajet normal',
  delayed:   '🟡 Retard prévu',
  disrupted: '🔴 Perturbation',
}

export async function sendJourneyAlert(payload: JourneyAlertPayload): Promise<void> {
  const { to, journeyName, status, headline, detail, delayMinutes, departureHour, departureMin } = payload

  const dep = `${String(departureHour).padStart(2,'0')}h${String(departureMin).padStart(2,'0')}`
  const subject = `${STATUS_FR[status] ?? '⚠️ Alerte'} — ${journeyName} · ${dep}`

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
      <div style="font-size:17px;font-weight:700;color:#fff;margin-bottom:20px;">${journeyName}</div>

      <!-- Status badge -->
      <div style="display:inline-block;padding:8px 16px;border-radius:12px;font-size:14px;font-weight:700;margin-bottom:20px;
        background:${status === 'disrupted' ? 'rgba(255,69,58,0.15)' : status === 'delayed' ? 'rgba(255,159,10,0.15)' : 'rgba(48,209,88,0.15)'};
        color:${status === 'disrupted' ? '#FF453A' : status === 'delayed' ? '#FF9F0A' : '#30D158'};
        border:1px solid ${status === 'disrupted' ? 'rgba(255,69,58,0.3)' : status === 'delayed' ? 'rgba(255,159,10,0.3)' : 'rgba(48,209,88,0.3)'};">
        ${STATUS_FR[status] ?? '⚠️ Alerte'}
      </div>

      <!-- Headline -->
      <div style="font-size:16px;font-weight:600;color:#fff;margin-bottom:10px;line-height:1.4;">${headline}</div>
      ${detail ? `<div style="font-size:14px;color:rgba(255,255,255,0.6);margin-bottom:16px;line-height:1.5;">${detail}</div>` : ''}
      ${delayMinutes > 0 ? `<div style="background:rgba(255,159,10,0.08);border:1px solid rgba(255,159,10,0.2);border-radius:12px;padding:12px 16px;font-size:13px;color:#FF9F0A;font-weight:600;margin-bottom:16px;">⏱ Retard estimé : +${delayMinutes} min · Départ prévu ${dep}</div>` : ''}

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
