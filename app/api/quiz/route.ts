import { NextResponse } from 'next/server'
import { getQuiz, getRandomQuiz, QUIZZES } from '@/lib/quizData'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const quiz = id ? getQuiz(id) : getRandomQuiz()
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })

  // Strip answer from response
  const { answerText: _at, answerAliases: _aa, answerNumber: _an, ...safe } = quiz
  return NextResponse.json(safe)
}

// Return all quiz IDs (for listing)
export async function POST() {
  return NextResponse.json(QUIZZES.map(({ id, question, hint, imageUrl, type, timeLimitSeconds }) => ({
    id, question, hint, imageUrl, type, timeLimitSeconds
  })))
}
