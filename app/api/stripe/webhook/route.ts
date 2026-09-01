import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
  if (!stripe) return new NextResponse('Stripe is not configured', { status: 503 })
  const body = await request.text()
  const signature = (await headers()).get('stripe-signature')
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) return new NextResponse('Missing webhook configuration', { status: 400 })

  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (error) {
    console.error('[v0] Stripe webhook signature failed', error)
    return new NextResponse('Invalid signature', { status: 400 })
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object
    console.log('[v0] Payment completed', { sessionId: session.id, plan: session.metadata?.plan, email: session.customer_details?.email, paymentStatus: session.payment_status })
    // Supabase activation is intentionally handled by the SQL/RLS layer supplied below.
  }

  return NextResponse.json({ received: true })
}
