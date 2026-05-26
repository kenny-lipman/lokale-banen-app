/**
 * Canonicaliseert URLs voor dedupe op (company_id, url) bij career-page-bronnen.
 * Strip www., trailing slash, query, fragment. Behoudt protocol + path.
 *
 * Returned null bij invalide URL — caller moet beslissen of dat een fout is.
 */
export function normalizeUrl(input: string): string | null {
  if (!input || typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    // Probeer met https:// prefix als host-only input
    try {
      url = new URL(`https://${trimmed}`)
    } catch {
      return null
    }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  let path = url.pathname.replace(/\/+$/, '')
  if (path === '') path = '/'

  return `${url.protocol}//${host}${path === '/' ? '' : path}`
}

/**
 * Extracteert "registrable" apex (laatste 2 labels van hostname).
 * `mail.example.com` -> `example.com`, `www.example.nl` -> `example.nl`.
 * Werkt voor `.com`, `.nl`, `.de`. NIET voor multi-label TLDs zoals `.co.uk`
 * - die zijn buiten scope voor NL B2B.
 *
 * Gebruikt door sales-leads voor info@-fallback en career-page-discovery.
 */
export function extractApex(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, '').split('.')
  if (parts.length <= 2) return parts.join('.')
  return parts.slice(-2).join('.')
}
