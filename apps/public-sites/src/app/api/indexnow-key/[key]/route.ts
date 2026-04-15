import { NextResponse } from 'next/server'
import { getTenantByHost } from '@/lib/tenant'

/**
 * IndexNow key-file handler.
 *
 * IndexNow protocol requires each domain to host its own unique key at:
 *   https://{host}/{key}.txt
 *
 * The key file content MUST be the key itself (plain text, UTF-8).
 *
 * Routing: `next.config.ts` rewrites `/{uuid}.txt` → `/api/indexnow-key/{uuid}`.
 * The rewrite source is UUID-strict, so robots.txt / sitemap.xml / any other
 * non-UUID *.txt path never reaches this handler.
 *
 * Tenant resolution uses the `Host` header so that the same handler serves
 * per-tenant keys (every regio has its own `platforms.indexnow_key`).
 *
 * Caching: `getTenantByHost` is tagged `platform:host:{host}` and survives
 * until a platform config change revalidates that tag.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  const host = req.headers.get('host')

  if (!host) {
    return new NextResponse('Not Found', { status: 404 })
  }

  // Strip port (localhost:3001 etc.) so cache-key matches tenant resolution.
  const hostname = host.split(':')[0]

  const tenant = await getTenantByHost(hostname)

  if (!tenant || !tenant.indexnow_key || tenant.indexnow_key !== key) {
    return new NextResponse('Not Found', { status: 404 })
  }

  return new NextResponse(tenant.indexnow_key, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Let edge/CDN cache this cheaply — the key is static per tenant.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
