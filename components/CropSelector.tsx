'use client'

import { useRef, useState, useCallback } from 'react'
import type { CropRect } from '@/types'

interface Props {
  imageSrc: string
  onConfirm: (crop: CropRect) => void
  onCancel: () => void
}

interface DragState {
  startX: number
  startY: number
  endX: number
  endY: number
  dragging: boolean
}

export default function CropSelector({ imageSrc, onConfirm, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState>({ startX: 0, startY: 0, endX: 0, endY: 0, dragging: false })

  const getRelative = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const { x, y } = getRelative(e.clientX, e.clientY)
    setDrag({ startX: x, startY: y, endX: x, endY: y, dragging: true })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.dragging) return
    const { x, y } = getRelative(e.clientX, e.clientY)
    setDrag((d) => ({ ...d, endX: x, endY: y }))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const { x, y } = getRelative(e.clientX, e.clientY)
    setDrag((d) => ({ ...d, endX: x, endY: y, dragging: false }))
  }

  const cropRect = (): CropRect => ({
    x: Math.min(drag.startX, drag.endX),
    y: Math.min(drag.startY, drag.endY),
    w: Math.abs(drag.endX - drag.startX),
    h: Math.abs(drag.endY - drag.startY),
  })

  const rect = cropRect()
  const hasSelection = rect.w > 0.02 && rect.h > 0.02

  const selectionStyle = {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 bg-black text-white text-sm">
        <button onClick={onCancel} className="px-3 py-1 rounded border border-white/40">キャンセル</button>
        <span className="text-xs opacity-70">答えが写っている部分をドラッグで選択</span>
        <button
          onClick={() => hasSelection && onConfirm(rect)}
          disabled={!hasSelection}
          className="px-3 py-1 rounded bg-blue-500 disabled:opacity-30 font-bold"
        >
          OK
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 select-none cursor-crosshair overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Screenshot */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc} alt="screenshot" className="w-full h-full object-contain pointer-events-none" draggable={false} />

        {/* Dim overlay */}
        <div className="absolute inset-0 bg-black/50 pointer-events-none" />

        {/* Selection cutout */}
        {hasSelection && (
          <div
            className="absolute border-2 border-blue-400 pointer-events-none"
            style={{ ...selectionStyle, boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)', background: 'transparent' }}
          />
        )}
      </div>
    </div>
  )
}
