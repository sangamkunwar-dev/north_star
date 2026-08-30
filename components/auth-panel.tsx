'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function normalizePhone(value: string) {
  const compact = value.replace(/[\s()-]/g, '')
  if (compact.startsWith('00')) return `+${compact.slice(2)}`
  if (compact.startsWith('+')) return compact
  // Treat a 10-digit Nepali mobile number such as 9701234567 as +9779701234567.
  if (/^9\d{9}$/.test(compact)) return `+977${compact}`
  return `+${compact}`
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" role="img">
    <path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.22-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z" />
    <path fill="#34A853" d="M12 21.99c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.54 14.08A5.86 5.86 0 0 1 6.23 12c0-.72.12-1.42.31-2.08V7.39H3.3A9.99 9.99 0 0 0 2.25 12c0 1.66.4 3.22 1.05 4.61l3.24-2.53Z" />
    <path fill="#EA4335" d="M12 5.89c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 2.97 14.63 2 12 2a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 7.61 9.46 5.89 12 5.89Z" />
  </svg>
}

export function AuthPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? createClient() : null
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [needsVerification, setNeedsVerification] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const normalizedPhone = normalizePhone(phone.trim())
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      onNotice('Enter a valid phone number, for example +977 9800000000.')
      return
    }
    if (password.length < 6) {
      onNotice('Use a password with at least 6 characters.')
      return
    }
    if (!supabase) { onNotice('Authentication is not configured yet. Add the Supabase URL and publishable key.'); return }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ phone: normalizedPhone, password })
        if (error) throw error
        if (data.user && !data.session) {
          setPhone(normalizedPhone)
          setNeedsVerification(true)
          onNotice('Your account was created. We sent a verification code by SMS.')
        } else {
          onNotice('Account created successfully.')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ phone: normalizedPhone, password })
        if (error) throw error
        onNotice('Signed in successfully.')
      }
    } catch (error: any) {
      const message = String(error?.message ?? '').toLowerCase()
      if (mode === 'login' && (message.includes('invalid') || message.includes('incorrect'))) onNotice('The phone number or password is incorrect.')
      else if (mode === 'signup' && (message.includes('weak') || message.includes('at least') || message.includes('password should'))) onNotice('Use a password with at least 6 characters.')
      else if (message.includes('phone')) onNotice('Enter a valid phone number in international format, such as +977 9800000000 or 9700000000.')
      else if (message.includes('rate')) onNotice('Too many attempts. Please wait a moment and try again.')
      else onNotice('We could not create your account. Please check your details and try again.')
    } finally { setBusy(false) }
  }

  async function verify() {
    if (!code.trim()) return onNotice('Enter the SMS verification code.')
    if (!supabase) { onNotice('Authentication is not configured yet.'); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: normalizePhone(phone.trim()), token: code.trim(), type: 'sms' })
      if (error) throw error
      onNotice('Phone verified. Your account is ready.')
    } catch { onNotice('That code is invalid or expired.') } finally { setBusy(false) }
  }

  async function google() {
    if (!supabase) { onNotice('Authentication is not configured yet.'); return }
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/auth/callback` } })
    if (error) onNotice('Google sign-in could not start. Please try again.')
  }

  return <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-2xl shadow-primary/10">
    <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Northstar Social</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">{needsVerification ? 'Verify your phone' : mode === 'login' ? 'Welcome back' : 'Create your account'}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{needsVerification ? 'Enter the code sent to your phone to open your workspace.' : 'Plan, write, and publish from one focused workspace.'}</p></div>
    {needsVerification ? <div className="space-y-4"><label className="label" htmlFor="otp">SMS verification code</label><input id="otp" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" className="field" placeholder="123456" /><button type="button" disabled={busy} onClick={verify} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? 'Verifying…' : 'Verify and continue'}</button><button type="button" disabled={busy} onClick={async () => { const { error } = await supabase.auth.signInWithOtp({ phone: normalizePhone(phone.trim()) }); if (error) onNotice('We could not resend the code. Please try again.'); else onNotice('A new verification code was sent.') }} className="w-full text-sm font-semibold text-primary">Resend code</button></div> : <form onSubmit={submit} className="space-y-4"><div><label className="label" htmlFor="phone">Phone number</label><input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" className="field mt-2" placeholder="+977 9800000000" /></div><div><label className="label" htmlFor="password">Password</label><input id="password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="field mt-2" placeholder="At least 6 characters" /></div><button disabled={busy} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button><div className="relative py-1 text-center text-xs text-muted-foreground"><span className="bg-card px-3">or</span></div><button type="button" onClick={google} className="flex w-full items-center justify-center gap-3 rounded-xl border border-border px-4 py-3 text-sm font-bold hover:bg-muted"><GoogleMark />Continue with Google</button></form>}
    {!needsVerification && <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="mt-5 w-full text-sm font-semibold text-muted-foreground hover:text-foreground">{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}</button>}
  </div>
}
