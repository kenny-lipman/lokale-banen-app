/**
 * Polite HTTP-fetcher voor werkenindekempen.nl.
 *
 * Features:
 * - Realistic browser-fingerprint (zie headers.ts)
 * - Session-cookie hergebruik binnen één scraper-run (lijkt op één user-session)
 * - If-Modified-Since support (server kan 304 returnen → bandbreedte besparing)
 * - 429/503 → RateLimitError (scraper stopt direct, geen retry-storm)
 * - Human-delay helper met jitter + occasional "read-time burst"
 */

import { buildHeaders, pickIdentity, type BrowserIdentity } from "./headers";

export class RateLimitError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export interface FetchSession {
  identity: BrowserIdentity;
  cookie?: string;
}

export function newSession(): FetchSession {
  return { identity: pickIdentity() };
}

export interface FetchResult {
  status: number;
  html: string | null;
  lastModified: string | null;
}

export async function fetchPolite(
  url: string,
  session: FetchSession,
  opts: { ifModifiedSince?: string; isFirstRequest?: boolean } = {}
): Promise<FetchResult> {
  const headers = buildHeaders(session.identity, session.cookie);
  if (opts.ifModifiedSince) headers["If-Modified-Since"] = opts.ifModifiedSince;

  const res = await fetch(url, { headers, redirect: "follow" });

  // Session-cookie capturen bij eerste request van een run
  if (opts.isFirstRequest) {
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const phpSess = setCookie.match(/PHPSESSID=[^;]+/)?.[0];
      if (phpSess) session.cookie = phpSess;
    }
  }

  if (res.status === 304) {
    return { status: 304, html: null, lastModified: res.headers.get("last-modified") };
  }
  if (res.status === 429 || res.status === 503) {
    throw new RateLimitError(
      res.status,
      `Rate-limited by source (${res.status}) — pausing scraper`
    );
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} bij ${url}`);
  }

  return {
    status: res.status,
    html: await res.text(),
    lastModified: res.headers.get("last-modified"),
  };
}

/**
 * Human-like delay tussen requests.
 *
 * Default: 2-5s uniform random, met 15% kans op extra 5-15s "leestijd-burst".
 * Spreidt 20-30 detail-fetches over ~2 min totale runtime.
 */
export async function humanDelay(
  minMs: number,
  maxMs: number,
  burstChance: number
): Promise<void> {
  let ms = minMs + Math.random() * (maxMs - minMs);
  if (Math.random() < burstChance) {
    ms += 5_000 + Math.random() * 10_000;
  }
  await new Promise((r) => setTimeout(r, ms));
}
