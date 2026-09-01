import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

const PLANS = {
  creator: { name: 'Sajilo Creator', amount: 99900 },
  studio: { name: 'Sajilo Studio', amount: 249900 },
} as const

export async function POST(request: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe checkout is unavailable because STRIPE_SECRET_KEY is not configured.' },
        { status: 503 },
      )
    }
    const { plan } = (await request.json()) as { plan?: keyof typeof PLANS }
    if (!plan || !PLANS[plan]) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

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
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[v0] Stripe checkout failed', error)
    return NextResponse.json({ error: 'Unable to start checkout' }, { status: 500 })
  }
}
