import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { WebsiteService, WebsiteServiceError } from '@/lib/services/sales-leads/website.service'
import { discoverCareerPage } from '@/lib/services/sales-leads/website/career-page-discovery'
import { discoverInfoPages } from '@/lib/services/sales-leads/website/page-discovery'
import { safeFetch, SsrfBlockedError } from '@/lib/services/sales-leads/website/ssrf-fetch'

async function handler(req: NextRequest, _auth: AuthResult) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') ?? 'crawl' // 'health' | 'fetch' | 'pages' | 'career' | 'crawl'
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
    if (mode === 'pages' && url) {
      const pages = await discoverInfoPages(url)
      return NextResponse.json({ duration_ms: Date.now() - t0, pages })
    }
    if (mode === 'career' && url) {
      const home = await safeFetch(url)
      const career = await discoverCareerPage(home.url, home.body)
      return NextResponse.json({ duration_ms: Date.now() - t0, career })
    }
    if (url) {
      const n = await svc.crawlAndParse(url, scrape)
      return NextResponse.json({ duration_ms: Date.now() - t0, normalized: n })
    }
    return NextResponse.json(
      { error: 'Gebruik ?url=... met optioneel ?mode=health|fetch|pages|career|crawl &scrape=true|false' },
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

export const GET = withAdminAuth(handler)
