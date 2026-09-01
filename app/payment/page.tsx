import PaymentClient from './payment-client'

export default async function PaymentPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const params = await searchParams
  const plan = params.plan === 'studio' ? 'studio' : 'creator'
  return <PaymentClient plan={plan} stripeConfigured={Boolean(process.env.STRIPE_SECRET_KEY)} />
}
