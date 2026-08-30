'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function normalizePhone(value: string) {
  const compact = value.replace(/[\s()-]/g, '')
  if (compact.startsWith('00')) return `+${compact.slice(2)}`
  if (compact.startsWith('0')) return `+977${compact.slice(1)}`
  return compact.startsWith('+') ? compact : `+${compact}`
}

function GoogleMark() {
  return <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-card text-sm font-black text-[#4285f4]">G</span>
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
      if (mode === 'login' && message.includes('invalid')) onNotice('The phone number or password is incorrect.')
      else if (message.includes('password')) onNotice('Use a password with at least 6 characters.')
      else if (message.includes('phone')) onNotice('Enter a valid phone number in international format, such as +977 9800000000.')
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
