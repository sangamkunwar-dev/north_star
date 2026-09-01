import Link from 'next/link'

export default function PaymentSuccessPage() {
  return <main className="grid min-h-screen place-items-center bg-background px-4 py-12 text-foreground"><section className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-xl"><div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">✓</div><p className="mt-6 text-sm font-bold uppercase tracking-widest text-primary">Payment received</p><h1 className="mt-2 text-3xl font-semibold">Your plan is being activated</h1><p className="mt-4 leading-7 text-muted-foreground">Stripe has received your payment. The subscription will appear in the admin panel after the webhook is configured and the SQL setup is applied.</p><Link href="/" className="mt-7 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Return to dashboard</Link></section></main>
}
