export type QuizType = 'what' | 'number'

export interface Quiz {
  id: string
  type: QuizType
  question: string
  hint: string
  imageUrl: string
  answerText?: string
  answerAliases?: string[]
  answerNumber?: number
  answerUnit?: string
  timeLimitSeconds: number
}

export interface BrowserAction {
  sessionId: string
  action: 'navigate' | 'search' | 'click' | 'scroll'
  url?: string
  query?: string
  x?: number
  y?: number
  deltaY?: number
  currentUrl?: string
  scrollY?: number
}

export interface BrowserResponse {
  screenshotId: string
  screenshotUrl: string
  currentUrl: string
  scrollY: number
}

export interface CropRect {
  x: number  // 0-1 (ratio)
  y: number
  w: number
  h: number
}

export interface SubmitRequest {
  sessionId: string
  quizId: string
  screenshotId: string
  cropRect: CropRect
  startedAt: number  // unix ms (client-sent, server recalculates)
}

export interface ScoreResult {
  ocrText: string
  similarity: number
  isCorrect: boolean
  baseScore: number
  timeBonus: number
  totalScore: number
  timeToAnswer: number  // seconds
  answerFound: string   // matched portion
}
