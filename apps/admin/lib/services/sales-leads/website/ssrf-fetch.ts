import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_BODY_BYTES = 5 * 1024 * 1024 // 5 MB
const TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 5

const PRIVATE_IP_REGEXES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\./,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fe80:/i,
]

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0'])

export class SsrfBlockedError extends Error {
  constructor(reason: string) {
    super(`SSRF blocked: ${reason}`)
    this.name = 'SsrfBlockedError'
  }
}

export class FetchSizeExceededError extends Error {
  constructor(public bytes: number) {
    super(`Body > ${MAX_BODY_BYTES} bytes (was ${bytes})`)
    this.name = 'FetchSizeExceededError'
  }
}

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_REGEXES.some((r) => r.test(ip))
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    throw new SsrfBlockedError(`hostname=${hostname}`)
  }
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new SsrfBlockedError(`private-ip=${hostname}`)
    return
  }
  let resolved: Array<{ address: string; family: number }>
  try {
    resolved = await lookup(hostname, { all: true })
  } catch {
    throw new SsrfBlockedError(`dns-fail: ${hostname}`)
  }
  for (const r of resolved) {
    if (isPrivateIp(r.address)) throw new SsrfBlockedError(`private-ip-resolved=${r.address}`)
  }
}

export type SafeFetchResult = {
  status: number
  url: string
  contentType: string
  body: string
  bytes: number
}

/**
 * Public-only fetch met:
 * - DNS resolve + private-IP block
 * - Manual redirect-handling (max 5)
 * - 15s totale timeout
 * - 5 MB body-cap (streaming check)
 * - User-Agent identificatie
 */
export async function safeFetch(
  rawUrl: string,
  opts: { method?: 'GET' | 'HEAD'; headers?: Record<string, string> } = {},
): Promise<SafeFetchResult> {
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    let url = new URL(rawUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new SsrfBlockedError(`protocol=${url.protocol}`)
    }
    let redirects = 0
    let res: Response
    while (true) {
      await assertPublicHost(url.hostname)
      res = await fetch(url.toString(), {
        method: opts.method ?? 'GET',
        headers: {
          'User-Agent': 'LokaleBanenSalesLeadBot/1.0 (+https://lokale-banen-app.vercel.app)',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...(opts.headers ?? {}),
        },
        redirect: 'manual',
        signal: ctrl.signal,
      })
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (!loc) break
        if (++redirects > MAX_REDIRECTS) throw new SsrfBlockedError('redirect-loop')
        url = new URL(loc, url)
        continue
      }
      break
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (opts.method === 'HEAD') {
      return { status: res.status, url: url.toString(), contentType, body: '', bytes: 0 }
    }

    const reader = res.body?.getReader()
    if (!reader) {
      const text = await res.text()
      const bytes = new TextEncoder().encode(text).byteLength
      if (bytes > MAX_BODY_BYTES) throw new FetchSizeExceededError(bytes)
      return { status: res.status, url: url.toString(), contentType, body: text, bytes }
    }
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new FetchSizeExceededError(total)
      }
      chunks.push(value)
    }
    const merged = new Uint8Array(total)
    let off = 0
    for (const c of chunks) {
      merged.set(c, off)
      off += c.byteLength
    }
    const body = new TextDecoder('utf-8').decode(merged)
    return { status: res.status, url: url.toString(), contentType, body, bytes: total }
  } finally {
    clearTimeout(timeout)
  }
}
