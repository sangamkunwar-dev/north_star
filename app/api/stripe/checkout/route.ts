import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

const PLANS = {
  creator: { name: 'Sajilo Creator', amount: 99900 },
  studio: { name: 'Sajilo Studio', amount: 249900 },
} as const

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !stripe) {
    return NextResponse.json(
      { error: 'Stripe checkout is not enabled for this deployment.' },
      { status: 503 },
    )
  }

  let plan: keyof typeof PLANS | undefined
  try {
    const body = (await request.json()) as { plan?: string }
    if (body.plan === 'creator' || body.plan === 'studio') plan = body.plan
  } catch {
    return NextResponse.json({ error: 'Invalid checkout request.' }, { status: 400 })
  }

  if (!plan) return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })

  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
    const selected = PLANS[plan]
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price_data: { currency: 'npr', product_data: { name: selected.name }, unit_amount: selected.amount, recurring: { interval: 'month' } }, quantity: 1 }],
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment?plan=${plan}`,
      billing_address_collection: 'auto',
      customer_creation: 'always',
      integration_identifier: `sajilo_${Math.random().toString(36).slice(2, 10)}`,
      metadata: { plan },
    })
    if (!session.url) return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 502 })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[v0] Stripe checkout failed', error)
    return NextResponse.json(
      { error: 'Stripe is temporarily unavailable. Please try again later.' },
      { status: 502 },
    )
  }
}
