import { safeFetch, SsrfBlockedError, FetchSizeExceededError } from './ssrf-fetch'
import type { PlaywrightFetcher } from './playwright-fetcher'

export type FetchTier = 1 | 2

export type TieredFetchResult = {
  html: string
  finalUrl: string
  tier: FetchTier
  status: number
  /** True wanneer ook Tier 2 geen bruikbare content opleverde (anti-bot/empty/cf-challenge). */
  blocked: boolean
}

/**
 * Eerst lichte ssrf-fetch, daarna Playwright-escalatie als Tier-1 geen bruikbare
 * content oplevert. `blocked` flag op resultaat geeft aan of zelfs Tier 2 het
 * niet heeft kunnen afhandelen — caller mag dan deze URL skippen voor Mistral.
 *
 * Playwright wordt lazy gestart: `playwright.init()` wordt pas door fetchPage zelf
 * aangeroepen wanneer Tier-2 nodig is. Voor Shopify/WordPress/SSR-sites blijft
 * Chromium dus uit, wat per-domain enkele seconden en honderden MB bespaart.
 */
export async function tieredFetch(
  url: string,
  playwright: PlaywrightFetcher,
): Promise<TieredFetchResult> {
  // Tier 1
  try {
    const r1 = await safeFetch(url)
    if (looksUseful(r1.body, r1.status)) {
      return {
        html: r1.body,
        finalUrl: r1.url,
        tier: 1,
        status: r1.status,
        blocked: false,
      }
    }
  } catch (e) {
    // SSRF-protectie en size-limits MOETEN doorslaan naar de caller — Playwright
    // heeft geen eigen SSRF-check, dus zonder deze re-throw kan een private IP
    // (192.168.x, 169.254.169.254 metadata-endpoint) alsnog worden bereikt via
    // Tier-2. Andere fetch-errors (timeout, DNS-fail) → escaleren naar Tier 2.
    if (e instanceof SsrfBlockedError || e instanceof FetchSizeExceededError) throw e
  }

  // Tier 2
  const r2 = await playwright.fetchPage(url)
  const blocked = r2.status >= 400 || isCloudflareChallenge(r2.html) || r2.html.length < 500
  return {
    html: r2.html,
    finalUrl: r2.finalUrl,
    tier: 2,
    status: r2.status,
    blocked,
  }
}

/**
 * Tier-1 success-check: HTTP 2xx + voldoende body + niet alleen JS-shell.
 *
 * Easy-mode short-circuit: detecteren we Shopify/WordPress/duidelijke SSR-markers
 * dan accepteren we Tier-1 direct, ook als andere heuristics zouden twijfelen.
 * Bespaart onnodige Playwright-escalatie voor het overgrote deel van NL B2B sites.
 */
export function looksUseful(html: string, status: number): boolean {
  if (status < 200 || status >= 400) return false
  if (!html || html.length < 500) return false
  if (isCloudflareChallenge(html)) return false
  if (isEasyModeSite(html)) return true
  if (looksLikeJsShell(html)) return false
  return true
}

/**
 * Detecteert sites die per definitie volwaardige SSR HTML retourneren, zodat
 * Tier-2 (Playwright) overgeslagen kan worden.
 *
 * - Shopify: `shopify-checkout-api-token` meta-tag of `cdn.shopify.com` asset-url
 * - WordPress: `wp-content/` of `wp-includes/` paths, of `<meta name="generator" content="WordPress`
 * - Wix / Squarespace: vergelijkbare generator-meta
 *
 * Detectie is opzettelijk lo-fi (regex op de eerste 30KB): cheap, geen DOM-parse.
 */
export function isEasyModeSite(html: string): boolean {
  const head = html.slice(0, 30_000)
  return (
    /shopify-checkout-api-token|cdn\.shopify\.com|\/cdn\/shop\//i.test(head) ||
    /wp-content\/|wp-includes\/|<meta[^>]+name=["']generator["'][^>]+content=["']WordPress/i.test(head) ||
    /<meta[^>]+name=["']generator["'][^>]+content=["'](?:Wix\.com|Squarespace|Webflow|Drupal|Joomla|Magento|Ghost)/i.test(head)
  )
}

/**
 * App-shell heuristic: <body> bevat alleen een mount-div (#root/#app/#__next) en
 * weinig text — typisch React/Vue/Angular SSR-zonder-prerender. Tier-1 ssrf-fetch
 * krijgt dan de pre-hydration HTML; Tier-2 Playwright moet renderen.
 */
export function looksLikeJsShell(html: string): boolean {
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  if (!bodyMatch) return false
  const body = bodyMatch[1]
  const stripped = body.replace(/<[^>]+>/g, '').trim()
  if (stripped.length >= 200) return false
  return /<div\b[^>]*\bid=["'](?:root|app|__next|__nuxt|q-app)["']/i.test(body)
}

/**
 * Cloudflare challenge / "Just a moment…" interstitial. Inclusief Cloudflare
 * Bot-Fight-Mode IUAM, Turnstile en Universal Browser Verification varianten.
 */
export function isCloudflareChallenge(html: string): boolean {
  const head = html.slice(0, 6000)
  return /(?:cf-browser-verification|cf-chl|__cf_chl|cf_chl_jschl|just a moment|attention required[^<\n]{0,20}cloudflare|cloudflare ray id)/i.test(
    head,
  )
}
