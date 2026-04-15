/**
 * IndexNow submit helper.
 *
 * IndexNow (https://www.indexnow.org) is a protocol backed by Bing/Yandex/Seznam/
 * Naver that lets us ping search engines instantly when content changes, rather
 * than waiting for natural crawl cycles.
 *
 * Flow:
 *   1. Admin publishes/approves/unpublishes a vacature.
 *   2. After `revalidatePublicSite()` finishes, we call `submitToIndexNow`
 *      with the full URL-list (vacature detail + index + sitemap).
 *   3. api.indexnow.org validates the `key` against the public-sites-hosted
 *      `{host}/{key}.txt` and then pushes the URLs into their index pipeline.
 *
 * Best-effort: this helper NEVER throws. A failed ping must not break the
 * admin write path.
 */

export interface IndexNowSubmit {
  /** Bare host (no protocol). e.g. "utrechtsebanen.vercel.app" or "westlandsebanen.nl" */
  host: string
  /** The platform's indexnow_key (UUID). Must match what's served at /{key}.txt */
  key: string
  /** Full URLs (with protocol) to ping. Max 10_000 per call per IndexNow spec. */
  urlList: string[]
}

export interface IndexNowResult {
  ok: boolean
  status?: number
  error?: string
  /** Echoed back for easier log-grepping */
  host?: string
  submitted?: number
}

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
const MAX_URLS_PER_REQUEST = 10_000

export async function submitToIndexNow({
  host,
  key,
  urlList,
}: IndexNowSubmit): Promise<IndexNowResult> {
  if (!host || !key || urlList.length === 0) {
    return { ok: false, error: 'missing params', host, submitted: 0 }
  }

  // De-dup + strip empty
  const urls = Array.from(new Set(urlList.filter(Boolean))).slice(
    0,
    MAX_URLS_PER_REQUEST
  )

  if (urls.length === 0) {
    return { ok: false, error: 'empty urlList after de-dup', host, submitted: 0 }
  }

  const body = {
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList: urls,
  }

  try {
    // Short timeout — never block the admin response on a slow 3rd-party.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    // IndexNow response codes:
    //   200 — URLs received and validated
    //   202 — URLs received; validation pending (key-file not yet fetched)
    //   400 — Bad request
    //   403 — Key not valid (key-file missing / mismatch)
    //   422 — URLs not valid (wrong host / malformed)
    //   429 — Too many requests
    if (res.ok || res.status === 202) {
      return { ok: true, status: res.status, host, submitted: urls.length }
    }

    const errText = await res.text().catch(() => '')
    console.warn(
      `[IndexNow] non-OK status=${res.status} host=${host} submitted=${urls.length} body=${errText.slice(0, 200)}`
    )
    return { ok: false, status: res.status, host, submitted: urls.length }
  } catch (err) {
    console.warn('[IndexNow] fetch error', { host, err: String(err) })
    return { ok: false, error: String(err), host, submitted: urls.length }
  }
}

/**
 * Helper: derive the public host for a platform record.
 * Prefers `domain` (live .nl) over `preview_domain` (.vercel.app).
 * Returns null if neither is set.
 */
export function resolvePlatformHost(platform: {
  domain: string | null
  preview_domain: string | null
}): string | null {
  return platform.domain || platform.preview_domain || null
}

/**
 * Helper: build the standard URL-list we ping on publish/approve.
 * The sitemap is included so search engines re-fetch the whole list.
 */
export function buildVacatureUrlList(
  host: string,
  jobSlugs: string[]
): string[] {
  const base = `https://${host}`
  const urls = new Set<string>()
  for (const slug of jobSlugs) {
    if (slug) urls.add(`${base}/vacature/${slug}`)
  }
  urls.add(`${base}/vacatures`)
  urls.add(`${base}/sitemap.xml`)
  return Array.from(urls)
}
