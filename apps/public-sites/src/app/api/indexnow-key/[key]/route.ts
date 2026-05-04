import { NextResponse } from 'next/server'
import { getIndexnowKeyForHost } from '@/lib/tenant'

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
 * `indexnow_key` is via column-level GRANT niet leesbaar voor de anon-rol;
 * deze handler gebruikt daarom service-role via `getIndexnowKeyForHost`.
 * De handler retourneert pas iets als de meegegeven `key` exact matcht met
 * de in de DB opgeslagen waarde — er kan dus niets uitgelokt worden door
 * een willekeurige UUID te raden.
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

  const storedKey = await getIndexnowKeyForHost(hostname)

  if (!storedKey || storedKey !== key) {
    return new NextResponse('Not Found', { status: 404 })
  }

  return new NextResponse(storedKey, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Let edge/CDN cache this cheaply — the key is static per tenant.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
