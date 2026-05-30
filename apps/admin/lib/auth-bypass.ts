/**
 * Bypass-lijst voor de fail-closed middleware.
 *
 * De middleware vereist een geldige sessie voor elke /api/*-route, BEHALVE de
 * routes hieronder. Die hebben geen sessie (cron met CRON_SECRET, webhooks met
 * signature, publieke endpoints) en verifieren zichzelf in-route via hun eigen
 * wrapper (withCronAuth / withWebhookSecurity) of zijn bewust publiek.
 *
 * Dit is GEEN tweede bron van waarheid voor de auth-klasse: de route bepaalt
 * zijn klasse via `// @auth <KLASSE>`. Deze lijst bevat exact de niet-SESSION/
 * niet-ADMIN routes. De coverage-test (auth-coverage.test.ts) dwingt af dat ze
 * synchroon blijven, zodat een nieuwe cron/webhook niet stil door de mand valt.
 *
 * Zie DECISIONS.md (2026-05-29 - Auth-seam) en PROGRESS.md.
 */

// startsWith-match (trailing slash voorkomt dat /api/webhook ook /api/webhooks vangt).
const BYPASS_PREFIXES = [
  '/api/auth/reset/', // PUBLIC: custom reset-flow
  '/api/cron/', // SECRET: Vercel Cron (CRON_SECRET)
  '/api/scrapers/', // SECRET: Vercel Cron + manual backfill
  '/api/webhook/', // SIGNATURE: apify-results, n8n-apify-complete (enkelvoud!)
]

// Exact-match (geen prefix, want buren hebben een andere klasse).
const BYPASS_EXACT = new Set([
  '/api/health', // PUBLIC: uptime-check
  '/api/instantly/webhook', // SIGNATURE (buur /webhook/setup is ADMIN)
  '/api/instantly/backfill-queue/process', // SECRET: queue-worker
  '/api/mailerlite/webhook', // SIGNATURE
  '/api/mailerlite/backfill', // SECRET (validateSecretAuth)
  '/api/mailerlite/setup', // SECRET (validateSecretAuth)
  '/api/webhooks/apollo-result', // SIGNATURE (buur /webhooks/apollo is ADMIN)
])

// Dynamische worker: /api/sales-leads/<id>/enrich-worker (SECRET).
const BYPASS_PATTERNS = [/^\/api\/sales-leads\/[^/]+\/enrich-worker$/]

// Dashboard-routes (SESSION) die TOEVALLIG onder een bypass-prefix vallen maar
// wel een sessie vereisen. Gaat vóor de prefixes. De coverage-test bewaakt dit.
const NEVER_BYPASS = new Set([
  '/api/cron/logs', // toont cron-logs in de admin-UI
])

/**
 * True als deze /api/*-route zonder sessie door de middleware mag (self-verifying
 * in-route). False = sessie vereist.
 */
export function isApiAuthBypassed(pathname: string): boolean {
  if (NEVER_BYPASS.has(pathname)) return false
  if (BYPASS_EXACT.has(pathname)) return true
  if (BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) return true
  if (BYPASS_PATTERNS.some((re) => re.test(pathname))) return true
  return false
}
