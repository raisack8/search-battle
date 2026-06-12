import { NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { takeBrowserScreenshot, isSafeUrl } from '@/lib/browser'
import { storeScreenshot } from '@/lib/screenshot'

export const maxDuration = 60
export const runtime = 'nodejs'

const schema = z.object({
  sessionId: z.string().uuid(),
  action: z.enum(['navigate', 'search', 'click', 'scroll']),
  url: z.string().url().optional(),
  query: z.string().max(200).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  deltaY: z.number().optional(),
  currentUrl: z.string().url().optional(),
  scrollY: z.number().default(0),
})

export async function POST(req: Request) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { action, url, query, x, y, deltaY, currentUrl, scrollY } = parsed.data

  let targetUrl: string
  let scrollTo = scrollY
  let clickX: number | undefined
  let clickY: number | undefined

  if (action === 'navigate') {
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })
    if (!isSafeUrl(url)) return NextResponse.json({ error: 'Unsafe URL' }, { status: 400 })
    targetUrl = url
  } else if (action === 'search') {
    if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })
    targetUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`
  } else if (action === 'click') {
    if (!currentUrl) return NextResponse.json({ error: 'currentUrl required' }, { status: 400 })
    if (!isSafeUrl(currentUrl)) return NextResponse.json({ error: 'Unsafe URL' }, { status: 400 })
    targetUrl = currentUrl
    clickX = x
    clickY = y
  } else {
    // scroll
    if (!currentUrl) return NextResponse.json({ error: 'currentUrl required' }, { status: 400 })
    if (!isSafeUrl(currentUrl)) return NextResponse.json({ error: 'Unsafe URL' }, { status: 400 })
    targetUrl = currentUrl
    scrollTo = Math.max(0, scrollY + (deltaY ?? 300))
  }

  try {
    const { screenshot, currentUrl: finalUrl, scrollY: finalScrollY } = await takeBrowserScreenshot(
      targetUrl, scrollTo, clickX, clickY
    )

    const id = randomUUID()
    const screenshotUrl = await storeScreenshot(id, screenshot)

    return NextResponse.json({
      screenshotId: id,
      screenshotUrl,
      currentUrl: finalUrl,
      scrollY: finalScrollY,
    })
  } catch (err) {
    console.error('Browser error:', err)
    return NextResponse.json({ error: 'Browser operation failed' }, { status: 500 })
  }
}
