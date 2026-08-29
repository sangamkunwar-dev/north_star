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
    const rawImageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''

    if (!caption) return NextResponse.json({ error: 'Caption is required.' }, { status: 400 })

    // Validate image URL strictly
    const hasValidImageUrl = isValidHttpUrl(rawImageUrl)
    const imageUrl = hasValidImageUrl ? rawImageUrl : ''

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

    for (const channel of requested) {
      const connection = connections?.find((item: any) => item.provider === channel)
      if (!connection?.access_token || !connection.account_handle) {
        return NextResponse.json(
          { error: `${channel} is connected without a publish token. Disconnect and reconnect it.` },
          { status: 409 }
        )
      }

      if (channel === 'facebook') {
        const params = new URLSearchParams({ access_token: connection.access_token })
        let endpoint = `${connection.account_handle}/feed`

        if (hasValidImageUrl) {
          // Post native photo via /photos endpoint
          endpoint = `${connection.account_handle}/photos`
          params.set('url', imageUrl)
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
        results[channel] = result.post_id || result.id

      } else if (channel === 'instagram') {
        if (!hasValidImageUrl) {
          return NextResponse.json(
            { error: 'Instagram publishing requires a valid public image HTTP/HTTPS URL.' },
            { status: 400 }
          )
        }

        const containerParams = new URLSearchParams({
          access_token: connection.access_token,
          image_url: imageUrl,
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
        const maxAttempts = 10

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
              { error: 'Instagram failed to process the image URL. Ensure it is publicly accessible.', published: results },
              { status: 502 }
            )
          }
        }

        if (!isReady) {
          return NextResponse.json(
            { error: 'Instagram timed out while processing your media image.', published: results },
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

        results[channel] = published.id
      }
    }

    return NextResponse.json({ published: results })
  } catch (error: any) {
    console.error('[Northstar Social] Meta publish failed:', error)
    return NextResponse.json(
      { error: error?.message || 'Publishing failed. Please reconnect Facebook/Instagram and try again.' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'