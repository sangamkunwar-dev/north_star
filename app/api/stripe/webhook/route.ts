import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

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
    const planId = session.metadata?.plan
    const email = session.customer_details?.email ?? session.customer_email
    const amountNpr = Math.round((session.amount_total ?? 0) / 100)
    if (planId && email && amountNpr > 0) {
      const supabase = await createClient()
      const { error } = await supabase.rpc('record_stripe_purchase', {
        p_session_id: session.id,
        p_customer_id: typeof session.customer === 'string' ? session.customer : null,
        p_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
        p_customer_email: email,
        p_plan_id: planId,
        p_amount_npr: amountNpr,
      })
      if (error) {
        console.error('[v0] Could not record Stripe purchase', error)
        return new NextResponse('Purchase record failed', { status: 500 })
      }
    }
    console.log('[v0] Payment completed', { sessionId: session.id, plan: planId, email, paymentStatus: session.payment_status })
  }

  return NextResponse.json({ received: true })
}
