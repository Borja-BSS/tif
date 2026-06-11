import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const PRODUCT_ID = 'prod_Uft0WvjXTuI28T'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key, { apiVersion: '2026-05-27.dahlia' })
}

export async function POST(req: NextRequest) {
  let amount: number
  let email: string | undefined

  try {
    const body = await req.json() as { amount?: unknown; email?: unknown }
    amount = Math.round(Number(body.amount))
    email  = typeof body.email === 'string' && body.email.includes('@') ? body.email : undefined
    if (!Number.isFinite(amount) || amount < 1 || amount > 10000) {
      return NextResponse.json({ error: 'Montant invalide (1–10 000 CHF)' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const CANONICAL = 'https://tif.borja-swiss-solutions.ch'
  const ALLOWED_ORIGINS = new Set([CANONICAL, 'http://localhost:3000'])
  const requestedOrigin = req.headers.get('origin') ?? ''
  const origin = ALLOWED_ORIGINS.has(requestedOrigin) ? requestedOrigin : CANONICAL

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode:       'payment',
      line_items: [{
        price_data: {
          currency:     'chf',
          product:      PRODUCT_ID,
          unit_amount:  amount * 100,
        },
        quantity: 1,
      }],
      customer_email: email,
      submit_type:    'donate',
      success_url:    `${origin}/donate/success?amount=${amount}`,
      cancel_url:                `${origin}/#soutien`,
      metadata: { source: 'tif-homepage', amount_chf: String(amount) },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[donate] Stripe error full:', msg)
    return NextResponse.json({ error: `Erreur Stripe: ${msg}` }, { status: 500 })
  }
}
