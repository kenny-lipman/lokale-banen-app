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

type RunInfo = {
  id: string
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMING-OUT' | 'TIMED-OUT' | 'ABORTING' | 'ABORTED'
  defaultDatasetId: string
}

function getToken(): string {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new ApifyApiError('no_token', 'APIFY_TOKEN ontbreekt')
  return token
}

async function jsonOrThrow<T>(res: Response, ctx: string): Promise<T> {
  if (res.status === 401 || res.status === 403) {
    throw new ApifyApiError('auth', `Apify ${res.status}`, res.status)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApifyApiError('actor_failed', `Apify ${ctx} ${res.status}: ${body.slice(0, 200)}`, res.status)
  }
  let data: unknown
  try {
    data = await res.json()
  } catch (e) {
    throw new ApifyApiError(
      'actor_failed',
      `Apify ${ctx} response is geen JSON: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
  return data as T
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
 * **WAARSCHUWING**: dit endpoint wacht tot run.status='SUCCEEDED'. Voor sommige
 * actors (zoals compass/crawler-google-places met unieke search-strings) kan dat
 * 5+ minuten duren omdat de actor agressief blijft zoeken naar meer hits dan
 * werkelijk bestaan. Voor zulke gevallen: gebruik `runActorWithPartialResults`
 * die na een wait-window gewoon partial dataset returnt.
 *
 * Apify returnt items direct als top-level JSON-array (geen wrapper).
 * Auth via Bearer-header (URL-token-param vermijden om logging-leaks).
 */
export async function runActorSync<TItem>(opts: RunActorSyncOpts): Promise<TItem[]> {
  const token = getToken()

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 90_000)
  try {
    const url = `${APIFY_BASE}/acts/${opts.actorId}/run-sync-get-dataset-items`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
      throw new ApifyApiError('actor_failed', `Apify ${res.status}: ${body.slice(0, 200)}`, res.status)
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

type RunActorPartialOpts = {
  actorId: string
  input: Record<string, unknown>
  /**
   * Hoelang Apify mag wachten voordat het run-info terugstuurt (zelfs als
   * run nog RUNNING is). Max 60 op Apify zelf — voor langere waits doen
   * we een handmatige polling-loop tot deze waarde.
   */
  waitForFinishSecs?: number
  /**
   * Of we de actor moeten aborten als hij na de wait nog RUNNING is.
   * Default true — voorkomt dat compute units worden verbruikt voor
   * resultaten die we niet meer ophalen.
   */
  abortIfStillRunning?: boolean
}

/**
 * Start een Apify-actor async, wacht tot `waitForFinishSecs` (of korter als
 * sneller klaar), en return wat er op dat moment in de dataset staat.
 *
 * Gebruikt voor actors die niet altijd binnen sync-budget volledig klaar zijn
 * (compass/crawler-google-places met `maxCrawledPlacesPerSearch>1` op unieke
 * queries kan tot 10+ minuten draaien). Met deze pattern krijg je partial
 * resultaten zonder hangen.
 *
 * Returns `{ items, status, runId }`. Caller moet zelf beslissen of partial
 * acceptabel is (`items.length` checken).
 */
export async function runActorWithPartialResults<TItem>(
  opts: RunActorPartialOpts,
): Promise<{ items: TItem[]; status: RunInfo['status']; runId: string }> {
  const token = getToken()
  const waitSecs = Math.min(opts.waitForFinishSecs ?? 60, 60) // Apify cap

  // 1. Start run met waitForFinish — Apify blokkeert max `waitSecs` seconden
  //    en returnt run-info (ook als nog RUNNING).
  const startUrl = `${APIFY_BASE}/acts/${opts.actorId}/runs?waitForFinish=${waitSecs}`
  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(opts.input),
  })
  const startBody = await jsonOrThrow<{ data: RunInfo }>(startRes, 'run start')
  const run = startBody.data

  // 2. Fetch dataset items zoals ze nu zijn (ook bij RUNNING — Apify dataset
  //    is append-only en queryable tijdens run).
  const itemsUrl = `${APIFY_BASE}/datasets/${run.defaultDatasetId}/items?format=json&clean=true`
  const itemsRes = await fetch(itemsUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const items = await jsonOrThrow<TItem[]>(itemsRes, 'dataset items')

  // 3. Als de run nog door zou kunnen gaan: abort om compute units te besparen.
  const stillRunning = run.status === 'RUNNING' || run.status === 'READY'
  if (stillRunning && (opts.abortIfStillRunning ?? true)) {
    // Fire-and-forget abort — we hoeven niet te wachten.
    void fetch(`${APIFY_BASE}/actor-runs/${run.id}/abort`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {
      // Abort-failure is niet kritisch; logs Apify Console
    })
  }

  return {
    items: Array.isArray(items) ? items : [],
    status: run.status,
    runId: run.id,
  }
}
