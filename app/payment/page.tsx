import PaymentClient from './payment-client'

export default async function PaymentPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const params = await searchParams
  const plan = params.plan === 'studio' ? 'studio' : 'creator'
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? ''
  const stripePublishableKey = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? process.env.STRIPE_PUBLISHABLE_KEY)?.trim() ?? ''
  const stripeConfigured = /^(sk|rk)_(test_|live_)?[A-Za-z0-9]+$/.test(stripeSecretKey) && /^(pk|rk)_(test_|live_)?[A-Za-z0-9]+$/.test(stripePublishableKey)

  return <PaymentClient plan={plan} stripeConfigured={stripeConfigured} />
}
