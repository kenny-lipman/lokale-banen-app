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
 * Browser-pooler voor één enrichment-run. `init()` is idempotent en concurrency-safe:
 * de eerste call start Chromium, parallelle calls wachten op dezelfde init-promise.
 *
 * `init()` wordt door tiered-fetch alleen aangeroepen wanneer Tier-1 onvoldoende
 * blijkt — bij Shopify/WordPress/normale SSR-sites blijft Chromium dus volledig uit.
 *
 * Dynamic imports van `@sparticuz/chromium` en `playwright-core`: deze worden pas
 * geladen wanneer init() draait, niet bij module-load. Scheelt cold-start CPU voor
 * routes die WebsiteService importeren maar nooit Tier-2 raken.
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
  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    if (this.browser) return
    if (!this.initPromise) {
      this.initPromise = this.doInit().catch((e) => {
        this.initPromise = null
        throw e
      })
    }
    return this.initPromise
  }

  /**
   * Werkelijke browser-launch. Retry-loop rond `chromium.launch()` vangt
   * `spawn ETXTBSY` op: Linux weigert het Chromium-binary uit /tmp uit te
   * voeren wanneer een ander proces op dezelfde warm function-instance net
   * bezig is met het uitpakken (race in `@sparticuz/chromium`). Backoff
   * 250ms → 1s → 3s lost dit in praktijk altijd op binnen 1-2 attempts.
   */
  private async doInit(): Promise<void> {
    const [{ chromium }, chromiumBin] = await Promise.all([
      import('playwright-core'),
      import('@sparticuz/chromium').then((m) => m.default),
    ])

    const executablePath = await chromiumBin.executablePath()
    const backoffsMs = [0, 250, 1000, 3000]
    let lastError: unknown

    for (const delay of backoffsMs) {
      if (delay > 0) await sleep(delay)
      try {
        this.browser = await chromium.launch({
          args: chromiumBin.args,
          executablePath,
          headless: true,
        })
        return
      } catch (e) {
        lastError = e
        if (!isEtxtbsy(e)) throw e
      }
    }
    throw lastError ?? new Error('chromium.launch faalde na retries')
  }

  async fetchPage(url: string): Promise<PlaywrightFetchResult> {
    await this.init()
    if (!this.browser) throw new Error('PlaywrightFetcher: browser niet beschikbaar na init')
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
      this.initPromise = null
    }
  }
}

function isEtxtbsy(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const msg = 'message' in e && typeof e.message === 'string' ? e.message : ''
  const code = 'code' in e && typeof (e as { code: unknown }).code === 'string' ? (e as { code: string }).code : ''
  return code === 'ETXTBSY' || /ETXTBSY/i.test(msg)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
