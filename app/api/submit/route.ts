import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readScreenshot, cropScreenshot } from '@/lib/screenshot'
import { ocrImage } from '@/lib/ocr'
import { scoreAnswer } from '@/lib/scoring'
import { getQuiz } from '@/lib/quizData'

export const maxDuration = 60
export const runtime = 'nodejs'

const schema = z.object({
  sessionId: z.string().uuid(),
  quizId: z.string(),
  screenshotId: z.string().uuid(),
  screenshotUrl: z.string(),
  cropRect: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0.01).max(1),
    h: z.number().min(0.01).max(1),
  }),
  startedAt: z.number(),
})

export async function POST(req: Request) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { quizId, screenshotId, screenshotUrl, cropRect, startedAt } = parsed.data

  const quiz = getQuiz(quizId)
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })

  const elapsedSeconds = Math.min(
    quiz.timeLimitSeconds,
    Math.round((Date.now() - startedAt) / 1000)
  )

  try {
    const screenshotBuffer = await readScreenshot(screenshotId, screenshotUrl)
    const cropped = await cropScreenshot(screenshotBuffer, cropRect)
    const ocrText = await ocrImage(cropped)
    const result = scoreAnswer(quiz, ocrText, elapsedSeconds)

    // TODO P3: persist to game_sessions in Vercel Postgres
    return NextResponse.json(result)
  } catch (err) {
    console.error('Submit error:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
