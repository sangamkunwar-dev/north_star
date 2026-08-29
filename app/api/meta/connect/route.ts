import { NextResponse } from 'next/server'

const META_APP_ID = process.env.META_APP_ID?.trim() || '1604738994727607'
function getRedirectUri(request: Request) {
  if (process.env.META_REDIRECT_URI) return process.env.META_REDIRECT_URI
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost.split(',')[0].trim()}` : url.origin
  return `${origin}/api/meta/callback`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const channel = url.searchParams.get('channel')
  const redirectUri = getRedirectUri(request)
  if (channel !== 'facebook' && channel !== 'instagram') return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })
  const state = crypto.randomUUID()
  const scopes = channel === 'facebook'
    ? 'pages_show_list,pages_read_engagement,pages_manage_posts'
    : 'instagram_basic,instagram_content_publish,pages_show_list'
  const response = NextResponse.redirect(`https://www.facebook.com/v23.0/dialog/oauth?client_id=${encodeURIComponent(META_APP_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scopes)}`)
  response.cookies.set('meta_oauth_state', `${state}:${channel}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/' })
  return response
}
