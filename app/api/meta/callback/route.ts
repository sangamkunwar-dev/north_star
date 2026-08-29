import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const META_APP_ID = process.env.META_APP_ID?.trim() || '1604738994727607'
const META_APP_SECRET = process.env.META_APP_SECRET?.trim()
function getRedirectUri(request: Request) {
  if (process.env.META_REDIRECT_URI) return process.env.META_REDIRECT_URI
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost.split(',')[0].trim()}` : url.origin
  return `${origin}/api/meta/callback`
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const redirectUri = getRedirectUri(request)
  const code = requestUrl.searchParams.get('code')
  const returnedState = requestUrl.searchParams.get('state')
  const providerError = requestUrl.searchParams.get('error')
  const oauthCookie = request.headers.get('cookie')?.match(/(?:^|; )meta_oauth_state=([^;]*)/)?.[1]
  const [savedState, channel] = decodeURIComponent(oauthCookie || ':').split(':')
  const redirect = new URL('/', requestUrl.origin)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect.searchParams.set('meta', 'error')

  let failure = providerError || (!user ? 'not_authenticated' : !code ? 'missing_code' : !returnedState || returnedState !== savedState ? 'invalid_state' : !channel ? 'missing_channel' : !META_APP_SECRET ? 'missing_app_secret' : '')
  if (!failure) {
    try {
      const tokenResponse = await fetch(`https://graph.facebook.com/v23.0/oauth/access_token?client_id=${encodeURIComponent(META_APP_ID)}&client_secret=${encodeURIComponent(META_APP_SECRET!)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code!)}`)
      const token = await tokenResponse.json()
      if (!tokenResponse.ok || !token.access_token) throw new Error(token.error?.message ? `meta_${token.error.code || 'oauth'}: ${token.error.message}` : 'token_exchange_failed')
      const pagesResponse = await fetch(`https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&limit=100&access_token=${encodeURIComponent(token.access_token)}`)
      const pages = await pagesResponse.json()
      if (!pagesResponse.ok) throw new Error(pages.error?.message ? `meta_${pages.error.code || 'pages'}: ${pages.error.message}` : 'pages_request_failed')
      const pagesWithInstagram = pages.data?.filter((candidate: any) => candidate.instagram_business_account) ?? []
      const page = channel === 'instagram' ? pagesWithInstagram[0] || pages.data?.[0] : pages.data?.[0]
      if (!page) throw new Error('no_facebook_page')
      if (channel === 'instagram' && !page.instagram_business_account) throw new Error('no_instagram_business_account')
      const rows = [{ user_id: user!.id, provider: 'facebook', account_name: page.name, account_handle: page.id, access_token: page.access_token || token.access_token, connected: true }, ...(page.instagram_business_account ? [{ user_id: user!.id, provider: 'instagram', account_name: page.instagram_business_account.username || page.instagram_business_account.name || page.name, account_handle: page.instagram_business_account.id, access_token: page.access_token || token.access_token, connected: true }] : [])]
      const { error } = await supabase.from('social_connections').upsert(rows, { onConflict: 'user_id,provider' })
      if (error) throw new Error('database_save_failed')
      redirect.searchParams.set('meta', 'connected')
      redirect.searchParams.set('channel', channel)
      failure = ''
    } catch (error) {
      failure = error instanceof Error ? error.message : 'oauth_failed'
      console.error('[v0] Meta OAuth callback failed:', failure)
    }
  }
  if (failure) {
    const safeReason = failure.startsWith('meta_1: Error validating client secret.') ? 'invalid_meta_app_secret' : failure
    redirect.searchParams.set('reason', safeReason.slice(0, 120))
  }
  const response = NextResponse.redirect(redirect)
  response.cookies.delete('meta_oauth_state')
  return response
}
