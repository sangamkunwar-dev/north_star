import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Helper function to pause execution for status polling
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Helper function to check if a string is a valid public HTTP/HTTPS URL
function isValidHttpUrl(stringUrl: string) {
  try {
    const url = new URL(stringUrl)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Please sign in before publishing.' }, { status: 401 })
    }

    const body = await request.json()
    const caption = typeof body.caption === 'string' ? body.caption.trim() : ''
    const rawMediaUrl = typeof body.mediaUrl === 'string' ? body.mediaUrl.trim() : ''
    const mediaType = body.mediaType === 'video' ? 'video' : 'image'
    const targetPageIds = Array.isArray(body.targetPageIds) ? body.targetPageIds.filter((id: unknown): id is string => typeof id === 'string' && Boolean(id.trim())).map((id: string) => id.trim()) : []

    if (!caption) return NextResponse.json({ error: 'Caption is required.' }, { status: 400 })

    // Validate image URL strictly
    const hasValidMediaUrl = isValidHttpUrl(rawMediaUrl)
    const mediaUrl = hasValidMediaUrl ? rawMediaUrl : ''

    const requested = Array.isArray(body.channels)
      ? body.channels.filter((channel: unknown) => channel === 'facebook' || channel === 'instagram')
      : []

    if (!requested.length) return NextResponse.json({ error: 'Select a publishing channel.' }, { status: 400 })

    const { data: connections, error: connectionError } = await supabase
      .from('social_connections')
      .select('provider,account_handle,access_token,connected')
      .eq('user_id', user.id)
      .in('provider', requested)
      .eq('connected', true)

    if (connectionError) return NextResponse.json({ error: connectionError.message }, { status: 500 })

    const results: Record<string, string> = {}
    const permalinks: Record<string, string> = {}

    for (const channel of requested) {
      const connection = connections?.find((item: any) => item.provider === channel)
      if (!connection?.access_token || !connection.account_handle) {
        return NextResponse.json(
          { error: `${channel} is connected without a publish token. Disconnect and reconnect it.` },
          { status: 409 }
        )
      }

      if (channel === 'facebook') {
        let pageId = connection.account_handle
        if (targetPageIds.length) {
          try {
            const pages = JSON.parse((await supabase.from('social_connections').select('account_name').eq('user_id', user.id).eq('provider', 'facebook').single()).data?.account_name || '[]')
            const selectedPage = Array.isArray(pages) ? pages.find((page: any) => targetPageIds.includes(String(page.id))) : null
            if (selectedPage) pageId = String(selectedPage.id)
          } catch { /* use the saved default page */ }
        }
        const params = new URLSearchParams({ access_token: connection.access_token })
        let endpoint = `${pageId}/feed`

        if (hasValidMediaUrl && mediaType === 'video') {
          endpoint = `${connection.account_handle}/videos`
          params.set('file_url', mediaUrl)
          params.set('description', caption)
        } else if (hasValidMediaUrl) {
          // Post native photo via /photos endpoint
          endpoint = `${connection.account_handle}/photos`
          params.set('url', mediaUrl)
          params.set('caption', caption)
        } else {
          // Fallback to text feed post
          params.set('message', caption)
        }

        const response = await fetch(`https://graph.facebook.com/v23.0/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params,
        })

        const result = await response.json()
        if (!response.ok || (!result.id && !result.post_id)) {
          return NextResponse.json(
            { error: `Facebook publish failed: ${result.error?.message || 'Meta rejected the post.'}`, published: results },
            { status: 502 }
          )
        }
        const publishedId = result.post_id || result.id
        let permalink: string | undefined
        try {
          const detailsResponse = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(publishedId)}?fields=id,permalink_url&access_token=${encodeURIComponent(connection.access_token)}`)
          const details = await detailsResponse.json()
          if (details.permalink_url) permalink = details.permalink_url
        } catch (detailsError) {
          console.error('[v0] Could not read Facebook permalink:', detailsError)
        }
        results[channel] = publishedId
        if (permalink) permalinks[channel] = permalink

      } else if (channel === 'instagram') {
        if (!hasValidMediaUrl) {
          return NextResponse.json(
            { error: 'Instagram publishing requires a valid public image HTTP/HTTPS URL.' },
            { status: 400 }
          )
        }

        const containerParams = new URLSearchParams({
          access_token: connection.access_token,
          [mediaType === 'video' ? 'video_url' : 'image_url']: mediaUrl,
          ...(mediaType === 'video' ? { media_type: 'REELS' } : {}),
          caption: caption,
        })

        // Step 1: Create container
        const response = await fetch(`https://graph.facebook.com/v23.0/${connection.account_handle}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: containerParams,
        })

        const containerResult = await response.json()
        if (!response.ok || !containerResult.id) {
          return NextResponse.json(
            { error: `Instagram container creation failed: ${containerResult.error?.message || 'Meta rejected the media.'}`, published: results },
            { status: 502 }
          )
        }

        const containerId = containerResult.id

        // Step 2: Poll status
        let isReady = false
        let attempts = 0
        const maxAttempts = mediaType === 'video' ? 30 : 15

        while (!isReady && attempts < maxAttempts) {
          await sleep(2000)
          attempts++

          const statusRes = await fetch(
            `https://graph.facebook.com/v23.0/${containerId}?fields=status_code&access_token=${connection.access_token}`
          )
          const statusData = await statusRes.json()

          if (statusData.status_code === 'FINISHED') {
            isReady = true
          } else if (statusData.status_code === 'ERROR') {
            return NextResponse.json(
              { error: `Instagram failed to process the ${mediaType}. Ensure the HTTPS URL is public, downloadable without authentication, and supported by Instagram.`, published: results },
              { status: 502 }
            )
          }
        }

        if (!isReady) {
          return NextResponse.json(
            { error: `Instagram timed out while processing your ${mediaType}. Try a smaller supported file or a different public HTTPS URL.`, published: results },
            { status: 504 }
          )
        }

        // Step 3: Publish container
        const publishParams = new URLSearchParams({
          creation_id: containerId,
          access_token: connection.access_token,
        })

        const publishResponse = await fetch(`https://graph.facebook.com/v23.0/${connection.account_handle}/media_publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: publishParams,
        })

        const published = await publishResponse.json()
        if (!publishResponse.ok || !published.id) {
          return NextResponse.json(
            { error: `Instagram publish failed: ${published.error?.message || 'Meta rejected the media.'}`, published: results },
            { status: 502 }
          )
        }

        let permalink: string | undefined
        try {
          const detailsResponse = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(published.id)}?fields=id,permalink&access_token=${encodeURIComponent(connection.access_token)}`)
          const details = await detailsResponse.json()
          if (details.permalink) permalink = details.permalink
        } catch (detailsError) {
          console.error('[v0] Could not read Instagram permalink:', detailsError)
        }
        results[channel] = published.id
        if (permalink) permalinks[channel] = permalink
      }
    }

    return NextResponse.json({ published: results, permalinks })
  } catch (error: any) {
    console.error('[Northstar Social] Meta publish failed:', error)
    return NextResponse.json(
      { error: error?.message || 'Publishing failed. Please reconnect Facebook/Instagram and try again.' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
