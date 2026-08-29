import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'

// Use official Gemini model identifiers: 'gemini-1.5-flash' or 'gemini-1.5-pro'
const MODEL = 'gemini-1.5-flash'

function parseCaption(text: string) {
  const lines = text
    .replace(/```(?:text|markdown)?/gi, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean)

  const values = { caption: '', hashtags: '', cta: '' }
  const labeled = /^(caption|hashtags?|call\s*to\s*action|cta)\s*:\s*(.*)$/i
  const unlabeled: string[] = []

  for (const line of lines) {
    const match = line.match(labeled)
    if (!match) {
      unlabeled.push(line)
      continue
    }
    const key = match[1].toLowerCase().replace(/\s+/g, '')
    if (key === 'caption') values.caption = match[2]
    else if (key === 'hashtag' || key === 'hashtags') values.hashtags = match[2]
    else values.cta = match[2]
  }

  const fallback = [values.caption, values.hashtags, values.cta]
  for (const line of unlabeled) {
    const index = fallback.findIndex((value) => !value)
    if (index !== -1) fallback[index] = line
  }

  return { caption: fallback[0] || '', hashtags: fallback[1] || '', cta: fallback[2] || '' }
}

export async function POST(request: Request) {
  let topic = ''

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.')
    }

    // Initialize provider dynamically inside request handler for Edge Runtime compatibility
    const google = createGoogleGenerativeAI({ apiKey })

    const body = await request.json()
    topic = typeof body.topic === 'string' ? body.topic.trim() : ''

    if (!topic) return NextResponse.json({ error: 'Add a post topic first.' }, { status: 400 })
    if (topic.length > 2_000) return NextResponse.json({ error: 'Keep the topic under 2,000 characters.' }, { status: 400 })

    const result = await generateText({
      model: google(MODEL),
      system: 'You are Northstar Social’s expert social media copywriter. Write original content about the user’s exact topic. Never append boilerplate such as “shaped into a clear, thoughtful story for your audience.” Return exactly three lines: the complete caption, relevant hashtags, and a specific call to action. Do not use labels, markdown, generic filler, or mention that you are AI.',
      prompt: `Create a natural, culturally respectful social media post specifically about this topic. Preserve the topic’s meaning and add useful details, context, or emotion instead of describing the writing process. The first line must be the finished caption, not a summary of the request.\n\nTopic: ${topic}`,
    })

    const parsed = parseCaption(result.text)
    if (!parsed.caption) throw new Error('Gemini returned an empty caption.')
    return NextResponse.json({ ...parsed, fallback: false })
  } catch (error: any) {
    console.error('[Northstar Social] Gemini caption generation failed:', error)
    
    // Returns real error details during debugging instead of hiding it behind fallback text
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to generate caption with Gemini API.',
        fallback: true 
      }, 
      { status: 500 }
    )
  }
}

export const runtime = 'edge'