'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Quiz, CropRect, ScoreResult } from '@/types'
import RemoteBrowser from './RemoteBrowser'
import ResultCard from './ResultCard'

interface Props {
  quiz: Quiz
}

type Phase = 'question' | 'browser' | 'submitting' | 'result'

export default function QuizGame({ quiz }: Props) {
  const [phase, setPhase] = useState<Phase>('question')
  const [sessionId] = useState(() => crypto.randomUUID())
  const [startedAt, setStartedAt] = useState(0)
  const [remaining, setRemaining] = useState(quiz.timeLimitSeconds)
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Timer
  useEffect(() => {
    if (phase !== 'browser') return
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [phase])

  const handleStart = () => {
    setStartedAt(Date.now())
    setRemaining(quiz.timeLimitSeconds)
    setPhase('browser')
  }

  const handleSubmit = useCallback(async (screenshotId: string, screenshotUrl: string, cropRect: CropRect) => {
    setPhase('submitting')
    setSubmitError(null)
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, quizId: quiz.id, screenshotId, screenshotUrl, cropRect, startedAt }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Submit failed')
      }
      const data: ScoreResult = await res.json()
      setResult(data)
      setPhase('result')
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Error')
      setPhase('browser')
    }
  }, [sessionId, quiz.id, startedAt])

  const handleRetry = () => {
    window.location.reload()
  }

  if (phase === 'result' && result) {
    return <ResultCard result={result} onRetry={handleRetry} />
  }

  if (phase === 'question') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-800 text-white flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-xs uppercase tracking-widest text-blue-300 font-bold">
          {quiz.type === 'number' ? '数値を調べろ' : 'これって何？'}
        </div>

        <h1 className="text-2xl font-black text-center leading-tight">{quiz.question}</h1>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={quiz.imageUrl}
          alt="quiz"
          className="w-full max-w-sm rounded-2xl object-cover aspect-video shadow-2xl"
        />

        <p className="text-sm text-blue-200 text-center max-w-xs">{quiz.hint}</p>

        <div className="text-xs text-blue-300">制限時間: {quiz.timeLimitSeconds}秒</div>

        <button
          onClick={handleStart}
          className="mt-2 px-10 py-4 bg-white text-blue-900 rounded-full font-black text-xl shadow-lg"
        >
          調べる
        </button>
      </div>
    )
  }

  // browser or submitting phase
  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-3 py-2 bg-blue-900 text-white text-sm">
        <div className="flex-1 truncate font-bold">{quiz.question}</div>
        <div className={`font-mono font-bold text-lg ${remaining <= 10 ? 'text-red-400 animate-pulse' : ''}`}>
          {remaining}s
        </div>
      </div>

      {phase === 'submitting' ? (
        <div className="flex-1 flex items-center justify-center flex-col gap-3 text-gray-500">
          <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">OCR処理中...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <RemoteBrowser
            sessionId={sessionId}
            quizId={quiz.id}
            startedAt={startedAt}
            onSubmit={handleSubmit}
          />
          {submitError && (
            <div className="fixed bottom-16 left-2 right-2 bg-red-500 text-white text-xs p-2 rounded text-center">
              {submitError}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
