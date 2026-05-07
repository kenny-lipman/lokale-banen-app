const APIFY_BASE = 'https://api.apify.com/v2'

export class ApifyApiError extends Error {
  constructor(
    public reason:
      | 'no_token'
      | 'auth'
      | 'timeout'
      | 'actor_failed'
      | 'no_results'
      | 'unknown',
    message: string,
    public httpStatus?: number,
  ) {
    super(message)
    this.name = 'ApifyApiError'
  }
}

type RunActorSyncOpts = {
  /** `username~actorname` (bv. 'compass~crawler-google-places') of 17-char ID. */
  actorId: string
  input: Record<string, unknown>
  /** Lokale fetch-timeout. Apify's hard cap is 5 min; lager houden voorkomt opgehangen Functions. */
  timeoutMs?: number
}

/**
 * Run een Apify-actor synchronously en return de dataset-items als JSON-array.
 * Endpoint: POST /v2/acts/{actorId}/run-sync-get-dataset-items
 *
 * Apify returnt items direct als top-level JSON-array (geen wrapper).
 * Auth via Bearer-header (URL-token-param vermijden om logging-leaks).
 */
export async function runActorSync<TItem>(opts: RunActorSyncOpts): Promise<TItem[]> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new ApifyApiError('no_token', 'APIFY_TOKEN ontbreekt')

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 90_000)
  try {
    const url = `${APIFY_BASE}/acts/${opts.actorId}/run-sync-get-dataset-items`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(opts.input),
      signal: ctrl.signal,
    })
    if (res.status === 401 || res.status === 403) {
      throw new ApifyApiError('auth', `Apify ${res.status}`, res.status)
    }
    if (res.status === 408 || res.status === 504) {
      throw new ApifyApiError('timeout', `Apify timeout ${res.status}`, res.status)
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new ApifyApiError(
        'actor_failed',
        `Apify ${res.status}: ${body.slice(0, 200)}`,
        res.status,
      )
    }
    let data: unknown
    try {
      data = await res.json()
    } catch (e) {
      throw new ApifyApiError(
        'actor_failed',
        `Apify response is geen JSON: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
    if (!Array.isArray(data)) {
      throw new ApifyApiError('actor_failed', 'Apify response is geen array')
    }
    return data as TItem[]
  } catch (e) {
    if (e instanceof ApifyApiError) throw e
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ApifyApiError('timeout', `Lokale fetch-timeout na ${opts.timeoutMs ?? 90_000}ms`)
    }
    throw new ApifyApiError('unknown', e instanceof Error ? e.message : String(e))
  } finally {
    clearTimeout(timeout)
  }
}
