'use client'

import { useState, useRef } from 'react'
import type { BrowserResponse, CropRect } from '@/types'
import CropSelector from './CropSelector'

interface Props {
  sessionId: string
  quizId: string
  startedAt: number
  onSubmit: (screenshotId: string, screenshotUrl: string, cropRect: CropRect) => void
}

export default function RemoteBrowser({ sessionId, quizId, startedAt, onSubmit }: Props) {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<BrowserResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCrop, setShowCrop] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const callBrowser = async (body: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ...body }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Error')
      }
      const data: BrowserResponse = await res.json()
      setState(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    callBrowser({ action: 'search', query: query.trim() })
  }

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!state || loading) return
    const rect = e.currentTarget.getBoundingClientRect()
    const scaleX = 390 / rect.width   // viewport width is 390px
    const scaleY = 844 / rect.height
    callBrowser({
      action: 'click',
      currentUrl: state.currentUrl,
      scrollY: state.scrollY,
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    })
  }

  const handleScroll = (dir: 1 | -1) => {
    if (!state) return
    callBrowser({ action: 'scroll', currentUrl: state.currentUrl, scrollY: state.scrollY, deltaY: dir * 400 })
  }

  const handleCropConfirm = (crop: CropRect) => {
    setShowCrop(false)
    if (!state) return
    onSubmit(state.screenshotId, state.screenshotUrl, crop)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 p-2 bg-gray-100 border-b">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="検索キーワードを入力..."
          className="flex-1 border rounded px-3 py-2 text-sm"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-3 py-2 bg-blue-500 text-white rounded text-sm disabled:opacity-40"
        >
          検索
        </button>
      </form>

      {/* URL bar */}
      {state && (
        <div className="px-3 py-1 bg-gray-50 border-b text-xs text-gray-500 truncate">
          {state.currentUrl}
        </div>
      )}

      {/* Browser viewport */}
      <div className="relative flex-1 overflow-hidden bg-white">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">ページを読み込み中...</p>
            </div>
          </div>
        )}

        {!state && !loading && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            検索して調べてみよう
          </div>
        )}

        {state && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={state.screenshotUrl}
            alt="browser"
            className="w-full cursor-pointer"
            onClick={handleImageClick}
            draggable={false}
          />
        )}

        {error && (
          <div className="absolute bottom-2 left-2 right-2 bg-red-100 text-red-600 text-xs p-2 rounded">
            {error}
          </div>
        )}
      </div>

      {/* Scroll + confirm controls */}
      {state && (
        <div className="flex items-center gap-2 p-2 bg-gray-50 border-t">
          <button onClick={() => handleScroll(-1)} disabled={loading} className="px-3 py-1 text-lg border rounded disabled:opacity-30">↑</button>
          <button onClick={() => handleScroll(1)} disabled={loading} className="px-3 py-1 text-lg border rounded disabled:opacity-30">↓</button>
          <div className="flex-1" />
          <button
            onClick={() => setShowCrop(true)}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded font-bold text-sm disabled:opacity-30"
          >
            証拠を選ぶ
          </button>
        </div>
      )}

      {/* Crop overlay */}
      {showCrop && state && (
        <CropSelector
          imageSrc={state.screenshotUrl}
          onConfirm={handleCropConfirm}
          onCancel={() => setShowCrop(false)}
        />
      )}
    </div>
  )
}
