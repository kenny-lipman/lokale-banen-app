import type { NextRequest } from 'next/server'

/**
 * Server-to-server dispatch helper voor `/api/sales-leads/[id]/enrich-worker`.
 * Gebruikt door bulk-create én /replay zodat elke run in z'n eigen Vercel
 * function-instance landt (eigen /tmp → geen ETXTBSY-race op de Chromium-
 * binary van `@sparticuz/chromium`).
 *
 * Patroon: fire-and-forget per request, in golfjes van DISPATCH_WAVE_SIZE om
 * Fluid Compute tijd te geven nieuwe warm instances bij te schalen. We wachten
 * alleen tot het HTTP-request is gedispatcht (`AbortSignal.timeout`); de worker
 * zelf draait door in z'n eigen function-instance.
 */

const DISPATCH_WAVE_SIZE = 8
const DISPATCH_TIMEOUT_MS = 10_000

export async function dispatchEnrichmentWorkers(req: NextRequest, runIds: string[]): Promise<void> {
  if (runIds.length === 0) return

  const baseUrl = resolveBaseUrl(req)
  const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRET_KEY
  if (!cronSecret) {
    console.error('[dispatch-worker] CRON_SECRET ontbreekt; workers kunnen niet dispatchen')
    return
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cronSecret}`,
  }

  for (let i = 0; i < runIds.length; i += DISPATCH_WAVE_SIZE) {
    const wave = runIds.slice(i, i + DISPATCH_WAVE_SIZE)
    await Promise.all(
      wave.map(async (runId) => {
        const url = `${baseUrl}/api/sales-leads/${runId}/enrich-worker`
        try {
          await fetch(url, {
            method: 'POST',
            headers,
            body: '{}',
            signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
          })
        } catch (e) {
          const isTimeout = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')
          if (isTimeout) return // request was sent, worker draait door
          console.error('[dispatch-worker] dispatch faalde', runId, e instanceof Error ? e.message : e)
        }
      }),
    )
  }
}

/**
 * Base-URL voor server-to-server fetch. Voorkeur:
 *   1. `NEXT_PUBLIC_APP_URL` (productie-stabiel, geen deployment-protection)
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` (preview/prod fallback)
 *   3. Request `host` header (lokaal/dev)
 *   4. `VERCEL_URL` (deployment-specifiek, kan beschermd zijn)
 */
function resolveBaseUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  const host = req.headers.get('host')
  if (host) {
    const proto = req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}
