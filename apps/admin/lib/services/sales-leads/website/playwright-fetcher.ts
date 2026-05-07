import { chromium } from 'playwright-core'
import chromiumBin from '@sparticuz/chromium'
import type { Browser } from 'playwright-core'

const UA_POOL = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
]

export type PlaywrightFetchResult = {
  html: string
  finalUrl: string
  status: number
}

/**
 * Browser-pooler voor één enrichment-run. Roep `init()` éénmaal aan vóór de
 * eerste `fetchPage`, en `dispose()` in finally. Hergebruikt 1 Chromium-instance
 * voor alle URLs binnen één crawlAndParse-call.
 *
 * Geen stealth-plugin in V1: puppeteer-extra-plugin-stealth doet dynamic require
 * op 17 sub-evasion modules wat niet werkt onder Vercel + Webpack/serverExternal.
 * Mitigatie zit in: realistische User-Agent rotation, NL-locale, blokkeren van
 * heavy resources. Voor anti-bot sites (Cloudflare/PerimeterX) accepteren we
 * 'homepage_blocked' tot we residential proxy + manueel-geregistreerde evasions
 * inbouwen (V2).
 */
export class PlaywrightFetcher {
  private browser: Browser | null = null

  async init(): Promise<void> {
    if (this.browser) return
    this.browser = await chromium.launch({
      args: chromiumBin.args,
      executablePath: await chromiumBin.executablePath(),
      headless: true,
    })
  }

  async fetchPage(url: string): Promise<PlaywrightFetchResult> {
    if (!this.browser) throw new Error('PlaywrightFetcher.init() niet aangeroepen')
    const ctx = await this.browser.newContext({
      userAgent: UA_POOL[Math.floor(Math.random() * UA_POOL.length)],
      viewport: { width: 1280, height: 800 },
      locale: 'nl-NL',
      timezoneId: 'Europe/Amsterdam',
    })
    // Block heavy resources voor snelheid + minder bandwidth
    await ctx.route('**/*', (route) => {
      const t = route.request().resourceType()
      if (t === 'image' || t === 'media' || t === 'font') return route.abort()
      return route.continue()
    })
    const page = await ctx.newPage()
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 })
      const status = resp?.status() ?? 0
      // networkidle is best-effort: sommige sites houden analytics-sockets open.
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
      const html = await page.content()
      const finalUrl = page.url()
      return { html, finalUrl, status }
    } finally {
      await ctx.close()
    }
  }

  async dispose(): Promise<void> {
    try {
      await this.browser?.close()
    } finally {
      this.browser = null
    }
  }
}
