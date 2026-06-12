'use client'

import type { ScoreResult } from '@/types'

interface Props {
  result: ScoreResult
  onRetry: () => void
}

export default function ResultCard({ result, onRetry }: Props) {
  const { similarity, isCorrect, baseScore, timeBonus, totalScore, timeToAnswer, ocrText, answerFound } = result
  const pct = Math.round(similarity * 100)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col items-center justify-center p-6 gap-6">

      {/* Result badge */}
      <div className={`text-5xl font-black ${isCorrect ? 'text-yellow-400' : 'text-gray-400'}`}>
        {isCorrect ? '正解！' : '不正解'}
      </div>

      {/* Similarity meter */}
      <div className="w-full max-w-sm">
        <div className="flex justify-between text-sm mb-1">
          <span>一致率</span>
          <span className="font-bold">{pct}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all duration-1000 ${pct >= 85 ? 'bg-green-400' : pct >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {answerFound && (
          <p className="text-xs text-gray-400 mt-1 text-center">
            OCR で見つかった文字列:「{answerFound}」
          </p>
        )}
      </div>

      {/* Score breakdown */}
      <div className="w-full max-w-sm bg-white/10 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-300">一致率スコア</span>
          <span>{baseScore}pt</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-300">時間ボーナス</span>
          <span>+{timeBonus}pt</span>
        </div>
        <div className="border-t border-white/20 pt-2 flex justify-between font-bold text-lg">
          <span>合計</span>
          <span className="text-yellow-400">{totalScore}pt</span>
        </div>
        <div className="text-xs text-gray-400 text-right">回答時間: {timeToAnswer}秒</div>
      </div>

      {/* OCR raw text */}
      {ocrText && (
        <details className="w-full max-w-sm">
          <summary className="text-xs text-gray-500 cursor-pointer">OCRテキストを表示</summary>
          <pre className="text-xs text-gray-400 mt-2 bg-black/30 p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap">
            {ocrText}
          </pre>
        </details>
      )}

      <button
        onClick={onRetry}
        className="mt-4 px-8 py-3 bg-blue-500 rounded-full font-bold text-lg"
      >
        もう一回
      </button>
    </div>
  )
}
