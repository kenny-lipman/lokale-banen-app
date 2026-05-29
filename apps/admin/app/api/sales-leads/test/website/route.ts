// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { WebsiteService, WebsiteServiceError } from '@/lib/services/sales-leads/website.service'
import { discoverUrls } from '@/lib/services/sales-leads/website/sitemap-discovery'
import { tieredFetch } from '@/lib/services/sales-leads/website/tiered-fetch'
import { PlaywrightFetcher } from '@/lib/services/sales-leads/website/playwright-fetcher'
import { safeFetch, SsrfBlockedError } from '@/lib/services/sales-leads/website/ssrf-fetch'

export const maxDuration = 300
export const runtime = 'nodejs'

async function handler(req: NextRequest, _auth: AuthResult) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') ?? 'crawl' // 'health' | 'fetch' | 'discover' | 'tier' | 'crawl'
  const url = searchParams.get('url')
  const scrape = searchParams.get('scrape') !== 'false'

  const svc = new WebsiteService()
  const t0 = Date.now()
  try {
    if (mode === 'health') return NextResponse.json(await svc.health())

    if (mode === 'fetch' && url) {
      const r = await safeFetch(url)
      return NextResponse.json({
        duration_ms: Date.now() - t0,
        status: r.status,
        url: r.url,
        bytes: r.bytes,
        contentType: r.contentType,
        bodyPreview: r.body.slice(0, 500),
      })
    }

    if (mode === 'discover' && url) {
      const discovered = await discoverUrls(url)
      return NextResponse.json({ duration_ms: Date.now() - t0, discovered })
    }

    if (mode === 'tier' && url) {
      const playwright = new PlaywrightFetcher()
      try {
        await playwright.init()
        const r = await tieredFetch(url, playwright)
        return NextResponse.json({
          duration_ms: Date.now() - t0,
          tier: r.tier,
          status: r.status,
          finalUrl: r.finalUrl,
          blocked: r.blocked,
          html_length: r.html.length,
          bodyPreview: r.html.slice(0, 500),
        })
      } finally {
        await playwright.dispose()
      }
    }

    if (url) {
      const normalized = await svc.crawlAndParse(url, scrape)
      return NextResponse.json({
        duration_ms: Date.now() - t0,
        normalized,
        meta: {
          pages_count: normalized.pages_crawled?.length ?? 0,
          contacts_count: normalized.contacts?.length ?? 0,
          vacancies_count: normalized.vacancies?.length ?? 0,
        },
      })
    }

    return NextResponse.json(
      {
        error:
          'Gebruik ?url=... met optioneel ?mode=health|fetch|discover|tier|crawl &scrape=true|false',
      },
      { status: 400 },
    )
  } catch (e) {
    if (e instanceof SsrfBlockedError) {
      return NextResponse.json({ error: e.message, reason: 'ssrf' }, { status: 400 })
    }
    if (e instanceof WebsiteServiceError) {
      return NextResponse.json({ error: e.message, reason: e.reason }, { status: 500 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export const GET = withAuth(handler)
