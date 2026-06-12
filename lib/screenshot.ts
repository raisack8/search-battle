import sharp from 'sharp'
import type { CropRect } from '@/types'

// Crop a screenshot buffer by a ratio-based CropRect
export async function cropScreenshot(buffer: Buffer, crop: CropRect): Promise<Buffer> {
  const meta = await sharp(buffer).metadata()
  const w = meta.width ?? 390
  const h = meta.height ?? 844

  const left = Math.round(crop.x * w)
  const top = Math.round(crop.y * h)
  const width = Math.max(1, Math.round(crop.w * w))
  const height = Math.max(1, Math.round(crop.h * h))

  return sharp(buffer)
    .extract({ left, top, width, height })
    .webp({ quality: 90 })
    .toBuffer()
}

// Store screenshot: Vercel Blob in production, /tmp in dev
export async function storeScreenshot(
  id: string,
  buffer: Buffer,
): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`screenshots/${id}.webp`, buffer, {
      access: 'public',
      contentType: 'image/webp',
    })
    return blob.url
  }

  // Local dev fallback: write to /tmp and return a data URL
  const fs = await import('fs/promises')
  const path = `/tmp/${id}.webp`
  await fs.writeFile(path, buffer)
  return `data:image/webp;base64,${buffer.toString('base64')}`
}

export async function readScreenshot(id: string, url: string): Promise<Buffer> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const res = await fetch(url)
    return Buffer.from(await res.arrayBuffer())
  }
  const fs = await import('fs/promises')
  return fs.readFile(`/tmp/${id}.webp`)
}
