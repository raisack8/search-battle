import Tesseract from 'tesseract.js'

export async function ocrImage(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (Tesseract as any).recognize(buffer, 'jpn+eng', {
    cachePath: '/tmp',
    logger: () => {},
  })
  return result.data.text
}
