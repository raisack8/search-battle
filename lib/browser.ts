import puppeteer, { type Browser, type Page } from 'puppeteer-core'

const CHROMIUM_REMOTE_EXEC_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar'

// Block private IP ranges to prevent SSRF
const BLOCKED_URL_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/169\.254\./,
  /^https?:\/\/::1/,
]

export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    return !BLOCKED_URL_PATTERNS.some((p) => p.test(url))
  } catch {
    return false
  }
}

export async function launchBrowser(): Promise<Browser> {
  let executablePath: string
  let args: string[]

  if (process.env.CHROME_EXECUTABLE_PATH) {
    // Local dev: point to system Chrome
    executablePath = process.env.CHROME_EXECUTABLE_PATH
    args = ['--no-sandbox', '--disable-setuid-sandbox']
  } else {
    // Vercel production: download Chromium at runtime
    const chromium = await import('@sparticuz/chromium-min')
    executablePath = await chromium.default.executablePath(CHROMIUM_REMOTE_EXEC_URL)
    args = chromium.default.args
  }

  return puppeteer.launch({
    executablePath,
    args,
    headless: true,
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
  })
}

export async function takeBrowserScreenshot(
  url: string,
  scrollY: number,
  clickX?: number,
  clickY?: number,
): Promise<{ screenshot: Buffer; currentUrl: string; scrollY: number; pageText: string }> {
  const browser = await launchBrowser()
  try {
    const page: Page = await browser.newPage()

    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    )
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8' })

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

    if (scrollY > 0) {
      await page.evaluate((y) => window.scrollTo(0, y), scrollY)
    }

    if (clickX !== undefined && clickY !== undefined) {
      await page.mouse.click(clickX, clickY)
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {})
    }

    await new Promise((r) => setTimeout(r, 800))

    const currentScrollY = await page.evaluate(() => window.scrollY)
    const currentUrl = page.url()
    const pageText = await page.evaluate(() => document.body?.innerText ?? '')
    const screenshot = await page.screenshot({ type: 'webp', quality: 80 }) as Buffer

    return { screenshot, currentUrl, scrollY: currentScrollY, pageText }
  } finally {
    await browser.close()
  }
}
