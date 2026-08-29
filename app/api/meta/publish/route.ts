import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please sign in before publishing.' }, { status: 401 })
    const body = await request.json()
    const caption = typeof body.caption === 'string' ? body.caption.trim() : ''
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
    if (!caption) return NextResponse.json({ error: 'Caption is required.' }, { status: 400 })
    const requested = Array.isArray(body.channels) ? body.channels.filter((channel: unknown) => channel === 'facebook' || channel === 'instagram') : []
    if (!requested.length) return NextResponse.json({ error: 'Select a publishing channel.' }, { status: 400 })
    const { data: connections, error: connectionError } = await supabase.from('social_connections').select('provider,account_handle,access_token,connected').eq('user_id', user.id).in('provider', requested).eq('connected', true)
    if (connectionError) return NextResponse.json({ error: connectionError.message }, { status: 500 })
    const results: Record<string, string> = {}
    for (const channel of requested) {
      const connection = connections?.find((item: any) => item.provider === channel)
      if (!connection?.access_token || !connection.account_handle) return NextResponse.json({ error: `${channel} is connected without a publish token. Disconnect and reconnect it.` }, { status: 409 })
      const endpoint = channel === 'facebook' ? `${connection.account_handle}/feed` : `${connection.account_handle}/media`
      const params = new URLSearchParams({ access_token: connection.access_token })
      if (channel === 'facebook') { params.set('message', caption); if (imageUrl) params.set('link', imageUrl) }
      else { if (!imageUrl) return NextResponse.json({ error: 'Instagram publishing requires an image URL.' }, { status: 400 }); params.set('image_url', imageUrl); params.set('caption', caption) }
      const response = await fetch(`https://graph.facebook.com/v23.0/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params })
      const result = await response.json()
      if (!response.ok || !result.id) return NextResponse.json({ error: `${channel} publish failed: ${result.error?.message || 'Meta rejected the post.'}`, published: results }, { status: 502 })
      if (channel === 'instagram') {
        const publishParams = new URLSearchParams({ creation_id: result.id, access_token: connection.access_token })
        const publishResponse = await fetch(`https://graph.facebook.com/v23.0/${connection.account_handle}/media_publish`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: publishParams })
        const published = await publishResponse.json()
        if (!publishResponse.ok || !published.id) return NextResponse.json({ error: `Instagram publish failed: ${published.error?.message || 'Meta rejected the media.'}`, published: results }, { status: 502 })
        results[channel] = published.id
      } else results[channel] = result.id
    }
    return NextResponse.json({ published: results })
  } catch (error) {
    console.error('[v0] Meta publish failed:', error)
    return NextResponse.json({ error: 'Publishing failed. Please reconnect Facebook and try again.' }, { status: 500 })
  }
}
