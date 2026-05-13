/**
 * Browser-identity pool voor werkenindekempen.nl scraper.
 *
 * 3 plausibele desktop-browser identities. Één per scraper-run gekozen
 * en consistent gebruikt voor de duur van die run (random elke request is juist verdacht).
 *
 * Geen identificeerbare LokaleBanen/KempenseBanen strings in headers.
 */

export interface BrowserIdentity {
  "User-Agent": string;
  "Sec-Ch-Ua"?: string;
  "Sec-Ch-Ua-Platform"?: string;
}

const BROWSER_IDENTITIES: BrowserIdentity[] = [
  {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
    "Sec-Ch-Ua-Platform": '"macOS"',
  },
  {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
    "Sec-Ch-Ua-Platform": '"Windows"',
  },
  {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0",
    // Firefox stuurt geen Sec-Ch-Ua headers — bewust weglaten voor consistency
  },
];

export function pickIdentity(): BrowserIdentity {
  return BROWSER_IDENTITIES[Math.floor(Math.random() * BROWSER_IDENTITIES.length)];
}

export function buildHeaders(
  identity: BrowserIdentity,
  sessionCookie?: string
): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent": identity["User-Agent"],
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "max-age=0",
  };
  if (identity["Sec-Ch-Ua"]) h["Sec-Ch-Ua"] = identity["Sec-Ch-Ua"];
  if (identity["Sec-Ch-Ua-Platform"]) h["Sec-Ch-Ua-Platform"] = identity["Sec-Ch-Ua-Platform"];
  if (sessionCookie) h["Cookie"] = sessionCookie;
  return h;
}
