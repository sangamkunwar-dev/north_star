'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { BarChart3, CalendarClock, Check, FileText, LayoutDashboard, LifeBuoy, LogOut, Menu, PenLine, Plus, Settings2, Sparkles, Trash2, Video, X } from 'lucide-react'
import { AuthPanel } from '@/components/auth-panel'

type Post = { id: string; title: string; description: string; caption: string; hashtags: string; cta: string; platforms: string[]; status: 'draft' | 'scheduled' | 'published'; date: string; imageUrl?: string; mediaType?: 'image' | 'video'; aspect?: 'portrait' | 'landscape'; publishedIds?: Record<string, string> }
type Channel = 'facebook' | 'instagram'
type SocialTarget = { id: string; name: string; channel: Channel; username?: string }
type Media = { url: string; type: 'image' | 'video'; aspect: 'portrait' | 'landscape'; fileName: string; file?: File }

const NEPAL_TIME_ZONE = 'Asia/Kathmandu'
const nepalDateFormatter = new Intl.DateTimeFormat('en-NP', { timeZone: NEPAL_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' })

function formatNepalDate(value: string) {
  return nepalDateFormatter.format(new Date(value))
}

function nepalInputToIso(value: string) {
  if (!value) return null
  const [date, time] = value.split('T')
  if (!date || !time) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  // Nepal is UTC+05:45. Convert the datetime-local value to UTC for storage.
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - 5 * 60 * 60 * 1000 - 45 * 60 * 1000).toISOString()
}

export function SocialDashboard() {
  const [showWelcome, setShowWelcome] = useState(true)
  const [showAuth, setShowAuth] = useState(false)
  const supabase = useMemo(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null
    return createClient()
  }, [])
  const [user, setUser] = useState<User | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [connections, setConnections] = useState<Record<Channel, boolean>>({ facebook: false, instagram: false })
  const [targets, setTargets] = useState<SocialTarget[]>([])
  const [selectedTargets, setSelectedTargets] = useState<string[]>([])
  const [tab, setTab] = useState<'overview' | 'create' | 'history' | 'analytics' | 'integrations' | 'support' | 'admin'>('overview')
  const [mobile, setMobile] = useState(false)
  const [settings, setSettings] = useState(false)
  const [topic, setTopic] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [cta, setCta] = useState('')
  const [mentions, setMentions] = useState('')
  const [channels, setChannels] = useState<Channel[]>([])
  const [schedule, setSchedule] = useState('')
  const [media, setMedia] = useState<Media | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'there'
  const avatarUrl = user?.user_metadata?.picture || user?.user_metadata?.avatar_url || ''

  useEffect(() => {
    if (window.localStorage.getItem('northstar-welcome-seen') === 'true') setShowWelcome(false)
    // Facebook may append #_=_ after OAuth. Remove it without reloading the app.
    if (window.location.hash === '#_=_') window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    const params = new URLSearchParams(window.location.search)
    const reason = params.get('reason')
    if (params.get('meta') === 'error') {
      const messages: Record<string, string> = {
        not_authenticated: 'Facebook was authorized, but your Northstar session was lost. Please sign in again.',
        invalid_state: 'Facebook security verification failed. Please start the connection again.',
        no_facebook_page: 'No Facebook Page was found on this account. Give the app Page access and retry.',
        no_instagram_business_account: 'Instagram requires a professional Instagram account linked to a Facebook Page. Link them in Meta Accounts Center, then retry.',
        database_save_failed: 'Facebook was authorized, but Northstar could not save the connection.',
        invalid_meta_app_secret: 'META_APP_SECRET does not match this Facebook App. Replace it with the current App Secret for App ID 1604738994727607.',
      }
      setNotice(messages[reason || ''] || `Facebook connection failed (${reason || 'unknown error'}).`)
      window.history.replaceState(null, '', window.location.pathname)
    }

    let mounted = true
    if (!supabase) return () => { mounted = false }
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => mounted && setUser(data.user))
    const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => setUser(session?.user ?? null))
    return () => { mounted = false; data.subscription.unsubscribe() }
  }, [supabase])

  useEffect(() => {
    if (!user || !supabase) return
    Promise.all([
      supabase.from('social_posts').select('id,title,description,caption,hashtags,call_to_action,platforms,status,scheduled_for,created_at,published_ids').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('social_connections').select('provider,account_name,account_handle,connected').eq('user_id', user.id),
    ]).then(([postResult, connectionResult]) => {
      if (postResult.data) setPosts(postResult.data.map((p: any) => ({ id: p.id, title: p.title, description: p.description ?? '', caption: p.caption, hashtags: p.hashtags ?? '', cta: p.call_to_action ?? '', platforms: p.platforms ?? [], status: p.status, date: formatNepalDate(p.scheduled_for || p.created_at), publishedIds: p.published_ids ?? {} })))
      if (connectionResult.data) {
        setConnections({ facebook: Boolean(connectionResult.data.find((c: any) => c.provider === 'facebook' && c.connected)), instagram: Boolean(connectionResult.data.find((c: any) => c.provider === 'instagram' && c.connected)) })
        const nextTargets: SocialTarget[] = []
        connectionResult.data.forEach((connection: any) => {
          if (!connection.connected || !connection.account_handle) return
          if (connection.provider === 'facebook') {
            try {
              const pages = JSON.parse(connection.account_name || '[]')
              if (Array.isArray(pages)) pages.forEach((page: any) => {
                nextTargets.push({ id: String(page.id), name: page.name || 'Facebook Page', channel: 'facebook' })
                if (page.instagram_business_account?.id) nextTargets.push({ id: String(page.instagram_business_account.id), name: page.instagram_business_account.username ? `Instagram @${page.instagram_business_account.username}` : (page.instagram_business_account.name || 'Instagram'), channel: 'instagram' })
              })
            } catch { nextTargets.push({ id: connection.account_handle, name: connection.account_name || 'Facebook Page', channel: 'facebook' }) }
          } else nextTargets.push({ id: connection.account_handle, name: connection.account_name || 'Instagram', channel: 'instagram' })
        })
        setTargets(nextTargets)
        setSelectedTargets(nextTargets.map((target) => target.id))
      }
    })
  }, [supabase, user])

  function signIn() {
    setShowAuth(true)
  }
  async function generate() {
    if (!topic.trim()) { setNotice('Describe what you want to share first.'); return }
    setBusy(true); setNotice('')
    try {
      const response = await fetch('/api/generate-caption', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic }) })
      const result = await response.json()
      if (!response.ok) setNotice(result.error || 'AI generation failed.')
      else { setCaption(result.caption || ''); setHashtags(result.hashtags || ''); setCta(result.cta || ''); setNotice(result.fallback ? 'Draft generated with the built-in writing assistant.' : 'Gemini draft generated. Review it before saving.') }
    } catch {
      setNotice('The writing assistant could not connect. Please try Generate again.')
    } finally {
      setBusy(false)
    }
  }
  async function savePost() {
    if (!topic.trim() || !caption.trim() || !channels.length) { setNotice('Add a topic, caption, and at least one connected channel.'); return }
    if (!user && !connections.facebook && !connections.instagram) { setNotice('Connect a channel to save or publish posts.'); return }
    if (!channels.every((channel) => connections[channel])) { setNotice('Connect each selected channel before posting.'); return }
    if (channels.includes('instagram') && media?.url.startsWith('blob:')) {
      setNotice('Instagram needs a public image URL. Add an image URL in the media field, or upload the image to public storage before publishing.')
      return
    }
    setBusy(true); setNotice('')
    const status = schedule ? 'scheduled' : 'published'
    const scheduledFor = nepalInputToIso(schedule)
    if (media?.file && user && supabase) {
      const safeName = media.file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-')
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('social-media').upload(path, media.file, { contentType: media.file.type, upsert: false })
      if (uploadError) { setNotice('Media upload failed. Please run the provided storage SQL and try again.'); setBusy(false); return }
      const { data: publicData } = supabase.storage.from('social-media').getPublicUrl(path)
      setMedia((current) => current ? { ...current, url: publicData.publicUrl } : current)
      media.url = publicData.publicUrl
    }
    let publishResult: any = null
    if (status === 'published') {
      let publishResponse: Response
      try {
        publishResponse = await fetch('/api/meta/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption: `${caption.trim()}${mentions.trim() ? `\n\n${mentions.trim()}` : ''}${hashtags ? `\n\n${hashtags}` : ''}${cta ? `\n\n${cta}` : ''}`, channels, targetPageIds: selectedTargets.filter((id) => targets.find((target) => target.id === id)?.channel === 'facebook'), mediaUrl: media?.url || '', mediaType: media?.type || '' }) })
      } catch {
        setNotice('Publishing could not connect to Northstar. Your post was not saved. Please try again.')
        setBusy(false)
        return
      }
      publishResult = await publishResponse.json()
      if (!publishResponse.ok) {
        const partial = publishResult.published ? ` Published: ${Object.keys(publishResult.published).join(', ')}.` : ''
        setNotice(`${publishResult.error || 'Publishing failed. Nothing was saved as published.'}${partial}`)
        setBusy(false)
        return
      }
    }
    const payload = { user_id: user?.id, title: topic.trim(), description: topic.trim(), caption: caption.trim(), hashtags, call_to_action: cta, platforms: channels, status, scheduled_for: scheduledFor, published_at: status === 'published' ? new Date().toISOString() : null, published_ids: status === 'published' ? (publishResult?.published || {}) : {} }
    const { data, error } = user ? await supabase.from('social_posts').insert(payload).select('id,created_at').single() : { data: { id: crypto.randomUUID(), created_at: new Date().toISOString() }, error: null }
    if (error) {
      console.error('[v0] Supabase social_posts insert failed:', error)
      setNotice(`Could not save: ${error.message || 'Supabase rejected the post.'}`)
    }
    else { setPosts((current) => [{ id: data.id, title: topic.trim(), description: topic.trim(), caption, hashtags, cta, platforms: channels, status, imageUrl: media?.url, publishedIds: publishResult?.published || {}, mediaType: media?.type, aspect: media?.aspect, date: formatNepalDate(scheduledFor || data.created_at) }, ...current]); const links = status === 'published' && typeof publishResult !== 'undefined' ? Object.entries(publishResult.permalinks || {}).map(([channel, url]) => `${channel}: ${url}`).join(' | ') : ''; setNotice(status === 'scheduled' ? 'Post scheduled successfully.' : `Meta confirmed publishing to ${channels.join(' and ')}.${links ? ` Open: ${links}` : ''}`); setTopic(''); setCaption(''); setHashtags(''); setCta(''); setSchedule(''); setMedia(null) }
    setBusy(false)
  }
  async function removePost(id: string) {
    const post = posts.find((item) => item.id === id)
    if (!post) return
    setBusy(true)
    try {
      if (post.publishedIds && Object.keys(post.publishedIds).length) {
        const response = await fetch('/api/meta/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publishedIds: post.publishedIds }) })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) { setNotice(`Remote deletion failed: ${result.failures?.join(', ') || result.error || 'Reconnect your social accounts and try again.'}`); return }
      }
      if (user && supabase) {
        const { error } = await supabase.from('social_posts').delete().eq('id', id).eq('user_id', user.id)
        if (error) { setNotice('The remote post was deleted, but the dashboard copy could not be removed.'); return }
      }
      setPosts((current) => current.filter((item) => item.id !== id))
      setNotice('Post deleted from all published channels.')
    } finally { setBusy(false) }
  }
  function connect(channel: Channel) { window.location.href = `/api/meta/connect?channel=${channel}` }
  function dismissWelcome() { window.localStorage.setItem('northstar-welcome-seen', 'true'); setShowWelcome(false) }

  if (!user) return showAuth ? <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground"><div className="w-full max-w-md"><button type="button" onClick={() => setShowAuth(false)} className="mb-4 text-sm font-semibold text-muted-foreground hover:text-foreground">← Back to homepage</button><AuthPanel onNotice={setNotice} /></div>{notice && <p role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-primary/20 bg-card px-4 py-3 text-sm font-semibold text-primary shadow-xl">{notice}</p>}</main> : <Landing onSignIn={signIn} notice={notice} />
  return <>
  <WelcomeScreen visible={showWelcome} onContinue={dismissWelcome} />
  <main className="min-h-screen bg-background text-foreground"><div className="flex min-h-screen">
    <aside className={`${mobile ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-40 h-dvh w-[min(18rem,calc(100vw-2rem))] min-h-0 flex-col overflow-y-auto overscroll-contain border-r border-border bg-card px-4 py-5 [-webkit-overflow-scrolling:touch] sm:px-5 sm:py-6 md:static md:flex md:h-auto md:min-h-screen md:w-72 md:overflow-visible`}><div className="flex items-center justify-between"><Brand /><button className="md:hidden" onClick={() => setMobile(false)} aria-label="Close menu"><X size={18}/></button></div><p className="mt-10 text-xs font-bold uppercase tracking-widest text-muted-foreground">Workspace</p><nav className="mt-3 space-y-1">{([['Overview', LayoutDashboard, 'overview'], ['Create post', PenLine, 'create'], ['History', FileText, 'history'], ['Analytics', BarChart3, 'analytics'], ['Integrations', Settings2, 'integrations'], ['Support tickets', LifeBuoy, 'support'], ...(user.email === 'sangamkunwar48@gmail.com' ? [['Admin panel', Settings2, 'admin'] as const] : [])] as const).map(([label, Icon, value]) => <button key={label} onClick={() => { setTab(value); setMobile(false) }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${tab === value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}><Icon size={18}/><span>{label}</span></button>)}</nav><div className="mt-8 border-t border-border pt-5"><button onClick={() => setSettings(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted"><Settings2 size={18}/>Settings</button><div className="mt-4 flex items-center gap-3 rounded-2xl bg-muted p-3"><div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground text-xs font-bold text-background">{avatarUrl ? <img src={avatarUrl} alt={`${displayName} profile`} className="size-full object-cover" /> : displayName.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{displayName}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div><button onClick={() => supabase.auth.signOut()} aria-label="Sign out"><LogOut size={16}/></button></div><p className="mt-5 text-center text-[10px] text-muted-foreground">Made by Sangam Kunwar</p></div></aside>
    <section className="min-w-0 flex-1 overflow-x-hidden"><header className="flex min-h-[76px] items-center border-b border-border bg-card px-4 py-4 sm:px-8"><button className="mr-3 md:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu size={21}/></button><span className="text-sm text-muted-foreground">Workspace <span className="px-2">/</span><b className="text-foreground">{tab[0].toUpperCase() + tab.slice(1)}</b></span></header><div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8"><p className="text-sm font-bold text-primary">Good morning, {displayName}</p><div className="mt-1 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-semibold tracking-tight">Create something meaningful.</h1><p className="mt-2 text-sm text-muted-foreground">Plan, write, and manage your social presence in one calm workspace.</p></div><button onClick={() => setTab('create')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"><Plus size={17}/>New post</button></div>{notice && <p role="status" className="mt-5 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">{notice}</p>}{tab === 'overview' && <Overview posts={posts} connections={connections} onCreate={() => setTab('create')}/>} {tab === 'create' && <Editor {...{topic,setTopic,caption,setCaption,hashtags,setHashtags,cta,setCta,mentions,setMentions,channels,setChannels,schedule,setSchedule,media,setMedia,connections,connect,generate,savePost,busy,targets,selectedTargets,setSelectedTargets}}/>}{tab === 'history' && <History posts={posts} onDelete={removePost}/>} {tab === 'analytics' && <Analytics posts={posts}/>} {tab === 'support' && <SupportTickets supabase={supabase} user={user} onNotice={setNotice}/>} {tab === 'admin' && user.email === 'sangamkunwar48@gmail.com' && <AdminPanel supabase={supabase} onNotice={setNotice}/>} {tab === 'integrations' && <Integrations connections={connections} connect={connect} disconnect={async (channel) => { if (!user || !supabase) return; const { error } = await supabase.from('social_connections').update({ connected: false }).eq('user_id', user.id).eq('provider', channel); if (error) setNotice('Could not disconnect this channel.'); else { setConnections((current) => ({ ...current, [channel]: false })); setNotice(`${channel} disconnected.`) } }}/>}</div></section></div>{settings && <Settings onClose={() => setSettings(false)} displayName={displayName} user={user} supabase={supabase} onNotice={setNotice}/>}</main>
  </>
}

function WelcomeScreen({ visible, onContinue }: { visible: boolean; onContinue: () => void }) {
  if (!visible) return null
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-foreground/40 p-6">
    <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-2xl">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><Sparkles size={24} /></div>
      <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-primary">स्वागत छ</p>
      <h1 className="mt-3 text-3xl font-semibold">नर्थस्टार सिर्जनालयमा स्व��गत छ</h1>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">Made by Sangam Kunwar — तपाईंका विचारलाई प्रकाशित सामग्रीमा बदल्ने शान्त workspace.</p>
      <div className="mt-5 flex flex-col gap-2 text-sm">
        <a href="mailto:info@sangamkunwar.com.np" className="font-semibold text-primary underline-offset-4 hover:underline">info@sangamkunwar.com.np</a>
        <a href="https://wa.me/9779701024066" target="_blank" rel="noreferrer" className="font-semibold text-primary underline-offset-4 hover:underline">WhatsApp: +977 9701024066</a>
      </div>
      <button type="button" onClick={(event) => { event.preventDefault(); onContinue() }} className="mt-7 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">सुरु गर्नुहोस्</button>
    </div>
  </div>
}
function Brand() { return <div className="flex items-center gap-3"><img src="/sajilo-logo.png" alt="Sajilo logo" className="size-9 rounded-xl object-contain"/><span className="text-lg font-semibold">Sajilo</span></div> }
function LegacyLanding({ onSignIn, notice }: { onSignIn: () => void; notice: string }) { return <main className="min-h-screen bg-background px-6 py-6 text-foreground"><header className="mx-auto flex max-w-6xl items-center justify-between"><Brand/><button onClick={onSignIn} className="text-sm font-bold text-muted-foreground">Sign in</button></header><section className="mx-auto max-w-6xl py-24"><p className="text-sm font-bold text-primary">A better way to show up online</p><h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight sm:text-7xl">Turn your ideas into posts people remember.</h1><p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">नर्थस्टा�� सिर्जनालय helps you write, schedule, and understand your content with one focused workspace.</p><button onClick={onSignIn} className="mt-9 inline-flex items-center gap-3 rounded-xl bg-primary px-5 py-4 text-sm font-bold text-primary-foreground"><img src="https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/google/default.svg" alt="" aria-hidden="true" className="size-5 rounded-full bg-background p-0.5"/> Continue with Google</button>{notice && <p className="mt-4 text-sm font-semibold text-primary">{notice}</p>}<p className="mt-20 text-xs text-muted-foreground">Made by Sangam Kunwar</p></section></main> }
function Landing({ onSignIn, notice }: { onSignIn: () => void; notice: string }) {
  const features = [
    { icon: PenLine, title: 'Write with clarity', text: 'Turn a rough idea into a polished caption, hook, and call to action.' },
    { icon: CalendarClock, title: 'Plan every format', text: 'Organize photo, carousel, short-form video, and campaign posts together.' },
    { icon: BarChart3, title: 'Learn what works', text: 'See your publishing rhythm and channel mix without noisy vanity metrics.' },
  ]
  return <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6"><Brand /><nav className="hidden items-center gap-7 text-sm font-semibold text-muted-foreground md:flex"><a href="/features" className="hover:text-foreground">Features</a><a href="/formats" className="hover:text-foreground">Formats</a><a href="/about" className="hover:text-foreground">About</a><a href="/contact" className="hover:text-foreground">सम्पर्क</a></nav><button onClick={onSignIn} className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-muted">Sign in</button></header>
    <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pt-24"><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Your content, in motion</p><h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-7xl">Make every post feel like your best one.</h1><p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">Sajio gives your ideas a clear path from first thought to published story, across the formats your audience already loves.</p><div className="mt-9 flex flex-wrap items-center gap-4"><button onClick={onSignIn} className="inline-flex items-center gap-3 rounded-xl bg-primary px-5 py-4 text-sm font-bold text-primary-foreground"><span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-background p-0.5 text-xs font-black text-primary">→</span>Get started</button><a href="#about" className="text-sm font-bold text-muted-foreground hover:text-foreground">Explore the workspace <span aria-hidden="true">→</span></a></div>{notice && <p role="status" className="mt-4 text-sm font-semibold text-primary">{notice}</p>}</div><div id="formats" className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-3 shadow-2xl shadow-primary/10"><div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-muted"><img src="/sajilo-dashboard.png" alt="Sajilo workspace preview" className="northstar-showcase-image absolute inset-0 size-full object-cover" /><div className="absolute left-1/2 top-1/2 z-10 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30" aria-label="Preview Northstar workflow"><Video size={22} fill="currentColor"/></div><div className="flex h-full flex-col justify-between p-6 sm:p-8"><div className="flex items-center justify-between"><span className="rounded-full bg-background px-3 py-1 text-xs font-bold">Campaign studio</span><span className="text-xs font-semibold text-muted-foreground">03 formats</span></div><div><div className="mb-5 flex items-end gap-2"><div className="h-20 w-16 rounded-t-xl bg-primary/80 sm:h-28 sm:w-24"/><div className="h-32 w-16 rounded-t-xl bg-foreground/80 sm:h-44 sm:w-24"/><div className="h-24 w-16 rounded-t-xl border-2 border-primary sm:h-36 sm:w-24"/></div><p className="max-w-xs text-2xl font-semibold tracking-tight">One idea. A whole week of content.</p></div></div></div><div className="grid grid-cols-3 gap-2 p-3"><div className="rounded-xl bg-muted p-3"><PenLine size={16} className="text-primary"/><p className="mt-2 text-xs font-bold">Photo</p></div><div className="rounded-xl bg-muted p-3"><Video size={16} className="text-primary"/><p className="mt-2 text-xs font-bold">Video</p></div><div className="rounded-xl bg-muted p-3"><CalendarClock size={16} className="text-primary"/><p className="mt-2 text-xs font-bold">Schedule</p></div></div></div></section>
    <section id="features" className="border-y border-border bg-card"><div className="mx-auto grid max-w-6xl gap-0 px-6 md:grid-cols-3">{features.map(({ icon: Icon, title, text }) => <div key={title} className="border-border py-10 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0"><Icon size={20} className="text-primary"/><h2 className="mt-5 text-lg font-semibold">{title}</h2><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{text}</p></div>)}</div></section>
    <section id="about" className="mx-auto grid max-w-6xl gap-8 px-6 py-24 md:grid-cols-[.8fr_1.2fr] md:items-start"><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">About Sajilo</p><div><h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">A calmer operating system for showing up online.</h2><p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground">Built for creators, founders, and small teams who want the confidence of a content system without losing their voice. Draft, refine, connect, schedule, and understand your work from one focused place.</p><p className="mt-12 text-xs text-muted-foreground">Made by Sangam Kunwar</p></div></section>
  </main>
}

function Overview({ posts, connections, onCreate }: { posts: Post[]; connections: Record<Channel, boolean>; onCreate: () => void }) { const connected = Object.values(connections).filter(Boolean).length; return <div className="mt-8 space-y-6"><div className="grid gap-4 sm:grid-cols-3">{[[posts.length, 'Total posts'], [posts.filter((p) => p.status === 'scheduled').length, 'Scheduled'], [`${connected}/2`, 'Channels connected']].map(([value, label]) => <div key={label as string} className="rounded-2xl border border-border bg-card p-5"><p className="text-3xl font-semibold">{value}</p><p className="mt-2 text-sm font-semibold">{label}</p></div>)}</div><div className="rounded-2xl border border-border bg-card p-6"><h2 className="font-semibold">Recent posts</h2>{posts.length ? posts.slice(0, 5).map((p) => <div key={p.id} className="flex items-center gap-3 border-b border-border py-4 last:border-0"><FileText size={18} className="text-primary"/><span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.title}</span><span className="text-xs text-muted-foreground">{p.status}</span></div>) : <div className="py-12 text-center"><p className="text-sm font-semibold">No posts yet</p><button onClick={onCreate} className="mt-3 text-sm font-bold text-primary">Create your first post</button></div>}</div></div> }
function Editor(p: any) { return <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><div className="space-y-6"><Card title="Post details"><label className="label">What do you want to share?</label><textarea value={p.topic} onChange={(e: any) => p.setTopic(e.target.value)} rows={4} className="field mt-2" placeholder="Describe your announcement, idea, or moment..."/><label className="label mt-4 block">Mention users or accounts</label><input value={p.mentions} onChange={(e: any) => p.setMentions(e.target.value)} className="field mt-2" placeholder="@username @partner"/><p className="mt-2 text-xs text-muted-foreground">Type @mentions, then select connected Pages and accounts below to tag them when publishing.</p><div className="mt-5 flex items-center justify-between"><div><h3 className="text-sm font-semibold">AI writing assistant</h3><p className="text-xs text-muted-foreground">Generate a caption, hashtags, and CTA.</p></div><button disabled={p.busy} onClick={p.generate} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"><Sparkles size={15}/>{p.busy ? 'Working...' : 'Generate'}</button></div></Card><Card title="Publishing targets"><p className="text-sm text-muted-foreground">Choose one or more connected Pages and accounts for this post.</p><div className="mt-4 space-y-2">{p.targets?.length ? p.targets.map((target: SocialTarget) => <label key={target.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted"><input type="checkbox" checked={p.selectedTargets?.includes(target.id)} onChange={() => p.setSelectedTargets((current: string[]) => current.includes(target.id) ? current.filter((id) => id !== target.id) : [...current, target.id])} /><span className="flex-1 text-sm font-semibold">{target.name}</span><span className="text-xs text-muted-foreground">{target.channel}</span></label>) : <p className="text-sm text-muted-foreground">Connect Facebook or Instagram in Integrations to choose targets.</p>}</div></Card><Card title="Media"><label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 px-5 py-8 text-center hover:bg-muted"><input type="file" accept="image/*,video/*" className="sr-only" onChange={(e: any) => { const file = e.target.files?.[0]; if (!file) return; const url = URL.createObjectURL(file); const probe = file.type.startsWith('video/') ? document.createElement('video') : new Image(); probe.onloadedmetadata = probe.onload = () => { const width = 'videoWidth' in probe ? probe.videoWidth : probe.naturalWidth; const height = 'videoHeight' in probe ? probe.videoHeight : probe.naturalHeight; p.setMedia({ url, type: file.type.startsWith('video/') ? 'video' : 'image', aspect: height > width ? 'portrait' : 'landscape', fileName: file.name, file }) }; probe.src = url }}/><span className="text-sm font-semibold">Add photo or video</span><span className="mt-1 text-xs text-muted-foreground">Portrait and landscape media supported</span></label><input value={p.media?.url.startsWith('blob:') ? '' : (p.media?.url || '')} onChange={(e: any) => { const url = e.target.value.trim(); if (!url) { p.setMedia(null); return }; const type = /\.(mp4|mov|webm)(\?.*)?$/i.test(url) ? 'video' : 'image'; p.setMedia({ url, type, aspect: 'landscape', fileName: 'Public media URL' }) }} className="field mt-3" placeholder="Or paste a public image/video URL for Meta publishing" /><p className="mt-2 text-xs leading-5 text-muted-foreground">Uploaded files are preview-only in this version. Use a public HTTPS URL to publish on Instagram.</p>{p.media && <div className={`mt-4 overflow-hidden rounded-xl border border-border bg-muted ${p.media.aspect === 'portrait' ? 'mx-auto max-w-xs' : 'w-full'}`}>{p.media.type === 'video' ? <video src={p.media.url} controls playsInline className="max-h-96 w-full object-contain" aria-label="Selected post video" /> : <img src={p.media.url} alt="Selected post media" className="max-h-96 w-full object-contain" />}<p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">{p.media.aspect} · {p.media.fileName}</p></div>}</Card><Card title="Caption"><textarea value={p.caption} onChange={(e: any) => p.setCaption(e.target.value)} rows={6} className="field" placeholder="Your caption..."/><input value={p.hashtags} onChange={(e: any) => p.setHashtags(e.target.value)} className="field mt-3" placeholder="#hashtags"/><input value={p.cta} onChange={(e: any) => p.setCta(e.target.value)} className="field mt-3" placeholder="Call to action"/></Card></div><div className="space-y-6"><Card title="Connect and publish"><p className="text-xs leading-5 text-muted-foreground">Only verified connected channels can receive posts.</p>{(['facebook', 'instagram'] as Channel[]).map((c) => <div key={c} className="mt-3 flex items-center gap-3 rounded-xl border border-border p-3"><div className="flex-1"><p className="text-sm font-semibold">{c === 'facebook' ? 'Facebook Page' : 'Instagram Business'}</p><p className="text-xs text-muted-foreground">{p.connections[c] ? 'Connected and ready' : 'Not connected'}</p></div><button onClick={() => p.connections[c] ? p.setChannels((x: Channel[]) => x.includes(c) ? x.filter((v) => v !== c) : [...x, c]) : p.connect(c)} className={`rounded-lg px-3 py-2 text-xs font-bold ${p.connections[c] && p.channels.includes(c) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{p.connections[c] ? (p.channels.includes(c) ? 'Selected' : 'Select') : 'Connect'}</button></div>)}<label className="label mt-5">Schedule (optional)</label><input type="datetime-local" aria-label="Schedule time in Nepal Time" value={p.schedule} onChange={(e: any) => p.setSchedule(e.target.value)} className="field mt-2"/><button disabled={p.busy} onClick={p.savePost} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"><Check size={17}/>{p.schedule ? 'Schedule post' : 'Save post'}</button></Card></div></div> }
function Integrations({ connections, connect, disconnect }: { connections: Record<Channel, boolean>; connect: (channel: Channel) => void; disconnect: (channel: Channel) => Promise<void> }) {
  const items: { channel: Channel; name: string; description: string }[] = [
    { channel: 'facebook', name: 'Facebook Pages', description: 'Publish posts to a Facebook Page.' },
    { channel: 'instagram', name: 'Instagram', description: 'Publish to a linked professional Instagram account.' },
  ]
  return <div className="mt-8 max-w-3xl space-y-4"><div><h2 className="text-2xl font-semibold">Integrations</h2><p className="mt-2 text-sm text-muted-foreground">Connect your social accounts to publish directly from your workspace.</p></div>{items.map(({ channel, name, description }) => <div key={channel} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center"><div className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-background p-2"><img src={`https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/${channel}/default.svg`} alt={`${name} official logo`} className="size-7 object-contain" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="font-semibold">{name}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${connections[channel] ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{connections[channel] ? 'Connected' : 'Not connected'}</span></div><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{connections[channel] ? <button onClick={() => disconnect(channel)} className="rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-muted">Disconnect</button> : <button onClick={() => connect(channel)} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Connect</button>}</div>)}</div> }
function AdminPanel({ supabase, onNotice }: { supabase: ReturnType<typeof createClient> | null; onNotice: (message: string) => void }) {
  const [tickets, setTickets] = useState<any[]>([])
  async function loadTickets() {
    if (!supabase) return
    const { data, error } = await supabase.from('support_tickets').select('id,user_id,type,subject,message,status,created_at').order('created_at', { ascending: false })
    if (error) onNotice('Admin ticket access is not configured yet. Run the updated Supabase schema.')
    else setTickets(data || [])
  }
  useEffect(() => { void loadTickets() }, [supabase])
  async function updateStatus(id: string, status: string) {
    if (!supabase) return
    const { error } = await supabase.from('support_tickets').update({ status }).eq('id', id)
    if (error) onNotice(`Could not update ticket status: ${error.message}`)
    else { onNotice('Ticket status updated.'); await loadTickets() }
  }
  return <div className="mt-8 max-w-5xl space-y-6"><div><h2 className="text-2xl font-semibold">Admin panel</h2><p className="mt-2 text-sm text-muted-foreground">Review incoming requests and manage their status. New tickets are addressed to info@sangamkunwar.com.np.</p></div><div className="space-y-3">{tickets.length ? tickets.map((ticket) => <div key={ticket.id} className="rounded-2xl border border-border bg-card p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{ticket.status.replace('_', ' ')}</span><span className="text-xs text-muted-foreground">{ticket.type}</span></div><h3 className="mt-3 font-semibold">{ticket.subject}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{ticket.message}</p><p className="mt-3 text-xs text-muted-foreground">User ID: {ticket.user_id}</p></div><select aria-label={`Update status for ${ticket.subject}`} value={ticket.status} onChange={(event) => updateStatus(ticket.id, event.target.value)} className="field sm:w-40"><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div></div>) : <Card title="No tickets yet"><p className="text-sm text-muted-foreground">Incoming support requests will appear here.</p></Card>}</div></div>
}

function SupportTickets({ supabase, user, onNotice }: { supabase: ReturnType<typeof createClient> | null; user: User | null; onNotice: (message: string) => void }) {
  const [type, setType] = useState('Support')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [sending, setSending] = useState(false)
  async function loadItems() {
    if (!supabase || !user) return
    const { data, error } = await supabase.from('support_tickets').select('id,type,subject,message,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false })
    if (error) onNotice(`Could not load your tickets: ${error.message}`)
    else setItems(data || [])
  }
  useEffect(() => { void loadItems() }, [supabase, user])
  async function submit() { if (!supabase || !user || !subject.trim() || !message.trim()) { onNotice('Add a subject and message first.'); return }; setSending(true); const { data, error } = await supabase.from('support_tickets').insert({ user_id: user.id, type, subject: subject.trim(), message: message.trim(), status: 'pending' }).select('id,type,subject,message,status,created_at').single(); setSending(false); if (error) { onNotice(`Could not send ticket: ${error.message}`); return }; if (data) setItems((current) => [data, ...current]); setSubject(''); setMessage(''); onNotice('Support ticket sent successfully.') }
  return <div className="mt-8 max-w-3xl space-y-6"><div><h2 className="text-2xl font-semibold">Support tickets</h2><p className="mt-2 text-sm text-muted-foreground">Report a problem, send a complaint, or ask for help.</p></div><Card title="Send a request"><div className="grid gap-4 sm:grid-cols-2"><label className="label">Request type<select value={type} onChange={(e) => setType(e.target.value)} className="field mt-2"><option>Support</option><option>Complaint</option><option>Feature request</option><option>Other</option></select></label><label className="label">Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} className="field mt-2" placeholder="What do you need help with?" /></label></div><label className="label mt-4 block">Message<textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="field mt-2" placeholder="Explain what happened or what you need..." /></label><button type="button" onClick={submit} disabled={sending} className="mt-4 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{sending ? 'Sending...' : 'Send ticket'}</button></Card><Card title="Your tickets">{items.length ? <div className="space-y-3">{items.map((item) => <div key={item.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{item.subject}</p><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{item.status || 'open'}</span></div><p className="mt-2 text-xs text-muted-foreground">{item.priority || 'normal'} priority</p><p className="mt-2 text-sm text-muted-foreground">{item.message}</p></div>)}</div> : <p className="text-sm text-muted-foreground">No tickets yet.</p>}</Card></div>
}
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="font-semibold">{title}</h2><div className="mt-5">{children}</div></div> }
function History({ posts, onDelete }: { posts: Post[]; onDelete: (id: string) => void }) { return <div className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="font-semibold">Post history</h2>{posts.length ? posts.map((p) => <div key={p.id} className="flex items-center gap-3 border-b border-border py-4 last:border-0"><FileText size={18} className="text-primary"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.title}</p><p className="text-xs text-muted-foreground">{p.platforms.join(' · ')} · {p.date}</p></div><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{p.status}</span><button onClick={() => onDelete(p.id)} aria-label={`Delete ${p.title}`} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><Trash2 size={16}/></button></div>) : <p className="py-12 text-center text-sm text-muted-foreground">No posts created yet.</p>}</div> }
function Analytics({ posts }: { posts: Post[] }) { return <div className="mt-8 grid gap-5 sm:grid-cols-3">{[['Publishing cadence', posts.length ? `${posts.length} posts created` : 'Start publishing to see trends'], ['Top channel', posts.length ? posts.flatMap((p) => p.platforms)[0] || '—' : '—'], ['Next action', posts.some((p) => p.status === 'scheduled') ? 'Review scheduled post' : 'Create a post']].map(([title, value]) => <div key={title} className="rounded-2xl border border-border bg-card p-6"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</p><p className="mt-4 text-xl font-semibold">{value}</p></div>)}</div> }
function Settings({ onClose, displayName, user, supabase, onNotice }: { onClose: () => void; displayName: string; user: User; supabase: ReturnType<typeof createClient>; onNotice: (message: string) => void }) { const [name, setName] = useState(displayName); const [saving, setSaving] = useState(false); async function save() { setSaving(true); const { error } = await supabase.auth.updateUser({ data: { ...user.user_metadata, full_name: name.trim() || displayName } }); setSaving(false); if (error) onNotice('Could not save your profile.'); else { onNotice('Profile settings saved.'); onClose() } } return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-5"><div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Account settings</h2><button onClick={onClose} aria-label="Close settings"><X size={18}/></button></div><label className="label mt-6">Display name</label><input value={name} onChange={(e) => setName(e.target.value)} className="field mt-2"/><label className="label mt-4">Email</label><input value={user.email ?? ''} readOnly className="field mt-2 opacity-70"/><p className="mt-4 text-xs leading-5 text-muted-foreground">Your Google account controls authentication. Update your workspace display name here.</p><button onClick={save} disabled={saving} className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{saving ? 'Saving...' : 'Save settings'}</button></div></div> }

export default SocialDashboard
