'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [preferences, setPreferences] = useState(false)
  useEffect(() => { setVisible(document.cookie.indexOf('northstar-cookie-choice=') === -1) }, [])
  function choose(value: string) { document.cookie = `northstar-cookie-choice=${value}; path=/; max-age=31536000; SameSite=Lax`; setVisible(false) }
  if (!visible) return null
  return <aside role="dialog" aria-label="Cookie preferences" className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-border bg-card p-5 shadow-2xl sm:inset-x-auto sm:right-6 sm:max-w-md"><h2 className="font-semibold">A little privacy note</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">We use essential cookies to keep sign-in and preferences working. Optional analytics help us improve नर्थस्टार सिर्जनालय.</p><div className="mt-4 flex flex-wrap items-center gap-3"><button onClick={() => choose('essential')} className="rounded-lg border border-border px-3 py-2 text-xs font-bold">Essential only</button><button onClick={() => choose('all')} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Accept all</button><button onClick={() => setPreferences(!preferences)} className="text-xs font-bold text-primary">Preferences</button><Link href="/privacy" className="text-xs text-muted-foreground underline">Privacy policy</Link></div>{preferences && <div className="mt-4 rounded-xl bg-muted p-3 text-xs text-muted-foreground">Essential cookies are always enabled. Optional analytics are never required to use the product.</div>}</aside>
}
