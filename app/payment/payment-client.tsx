'use client'

import { useState } from 'react'
import { ArrowLeft, Check, CreditCard, Loader2, ShieldCheck } from 'lucide-react'

const VISA = 'https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/visa/default.svg'
const MASTERCARD = 'https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/mastercard/default.svg'

export default function PaymentClient({ plan }: { plan: 'creator' | 'studio' }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const name = plan === 'studio' ? 'Studio' : 'Creator'
  const price = plan === 'studio' ? 'रु 2,499' : 'रु 999'

  async function startCheckout() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }) })
      const data = await response.json()
      if (!response.ok || !data.url) {
        throw new Error(
          data.error ?? 'Stripe checkout is unavailable. Please configure Stripe before continuing.',
        )
      }
      window.location.assign(data.url)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to start checkout')
      setLoading(false)
    }
  }

  return <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12"><div className="mx-auto max-w-5xl"><a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft data-icon="inline-start" />Back to plans</a><div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8"><p className="text-sm font-bold uppercase tracking-widest text-primary">Sajilo {name}</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Upgrade your workspace</h1><p className="mt-4 leading-7 text-muted-foreground">Unlock the tools you need to create, schedule, and understand your social content.</p><div className="mt-8 flex items-end justify-between border-t border-border pt-6"><span className="text-sm text-muted-foreground">Monthly subscription</span><strong className="text-3xl">{price}</strong></div></section><section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Secure card checkout</p><p className="mt-1 text-sm text-muted-foreground">Powered by Stripe</p></div><CreditCard className="text-primary" /></div><div className="mt-8 flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4"><img src={VISA} alt="Visa" className="h-7 w-11 object-contain" /><img src={MASTERCARD} alt="Mastercard" className="h-7 w-11 object-contain" /><span className="text-sm text-muted-foreground">Visa and Mastercard accepted</span></div>{error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}<button type="button" onClick={startCheckout} disabled={loading} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{loading ? <><Loader2 className="animate-spin" />Opening secure checkout</> : <>Continue to Stripe <Check /></>}</button><p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><ShieldCheck /> Your card details are handled securely by Stripe.</p></section></div></div></main>
}
