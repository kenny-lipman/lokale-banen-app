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
