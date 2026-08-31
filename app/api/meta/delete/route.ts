import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please sign in before deleting.' }, { status: 401 })
    const body = await request.json()
    const ids = body?.publishedIds && typeof body.publishedIds === 'object' ? body.publishedIds as Record<string, unknown> : {}
    const channels = Object.entries(ids).filter(([channel, id]) => (channel === 'facebook' || channel === 'instagram') && typeof id === 'string' && id.trim())
    if (!channels.length) return NextResponse.json({ deleted: {} })
    const providers = [...new Set(channels.map(([channel]) => channel))]
    const { data: connections, error } = await supabase.from('social_connections').select('provider,access_token').eq('user_id', user.id).in('provider', providers).eq('connected', true)
    if (error) return NextResponse.json({ error: 'Could not load social connections.' }, { status: 500 })
    const deleted: Record<string, boolean> = {}
    const failures: string[] = []
    for (const [channel, rawId] of channels) {
      const connection = connections?.find((item: any) => item.provider === channel)
      if (!connection?.access_token) { failures.push(channel); continue }
      const response = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(String(rawId))}?access_token=${encodeURIComponent(connection.access_token)}`, { method: 'DELETE' })
      const result = await response.json().catch(() => ({}))
      if (response.ok && result.success !== false) deleted[channel] = true
      else failures.push(`${channel}: ${result.error?.message || 'Meta rejected deletion.'}`)
    }
    return NextResponse.json({ deleted, failures }, { status: failures.length ? 502 : 200 })
  } catch (error) {
    console.error('[v0] Meta delete failed:', error)
    return NextResponse.json({ error: 'Remote deletion failed.' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
