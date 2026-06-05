/**
 * Sessie-laag voor de werk.nl scraper.
 *
 * werk.nl zit achter Oracle Access Manager (OAM). Een naive fetch wordt
 * geredirect naar login.werk.nl. We bootstrappen daarom een ANONIEME OAM-sessie
 * (geen DigiD nodig): volg de redirect-keten met een eigen cookie-jar, en haal
 * daarna het XSRF-token op. Node fetch beheert geen cookies, dus dat doen we hier zelf.
 */

import { pickIdentity, buildHeaders } from "@/lib/scrapers/werkenindekempen/headers";
import { BOOTSTRAP_URL, XSRF_URL } from "./constants";

export interface WerknlSession {
  jar: Map<string, string>;
  xsrfToken: string;
  userAgent: string;
}

/** Voeg Set-Cookie strings toe aan de jar (laatste waarde wint). */
export function parseCookies(jar: Map<string, string>, setCookies: string[]): void {
  for (const sc of setCookies) {
    const first = sc.split(";")[0];
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    if (name) jar.set(name, value);
  }
}

/** Bouw de Cookie-request-header uit de jar. */
export function cookieHeader(jar: Map<string, string>): string {
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/** Volg redirects handmatig, accumuleer cookies. Max 10 hops. */
async function followWithJar(
  startUrl: string,
  jar: Map<string, string>,
  userAgent: string
): Promise<Response> {
  let url = startUrl;
  let res: Response | undefined;
  for (let hop = 0; hop < 10; hop++) {
    const headers = buildHeaders({ "User-Agent": userAgent }, cookieHeader(jar) || undefined);
    res = await fetch(url, { headers, redirect: "manual" });
    parseCookies(jar, res.headers.getSetCookie());
    const status = res.status;
    if (status >= 300 && status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      url = new URL(loc, url).toString();
      continue;
    }
    break;
  }
  if (!res) throw new Error("[werknl] followWithJar: geen response");
  return res;
}

/** Bootstrap een anonieme OAM-sessie + XSRF-token. */
export async function bootstrapSession(): Promise<WerknlSession> {
  const jar = new Map<string, string>();
  const userAgent = pickIdentity()["User-Agent"];

  // 1. OAM-keten doorlopen (zet OAMAuthnCookie).
  await followWithJar(BOOTSTRAP_URL, jar, userAgent);
  if (!Array.from(jar.keys()).some((k) => k.startsWith("OAMAuthnCookie"))) {
    throw new Error("[werknl] OAM-bootstrap leverde geen OAMAuthnCookie");
  }

  // 2. XSRF-token ophalen (respons is 404, maar zet XSRF-TOKEN cookie).
  await followWithJar(XSRF_URL, jar, userAgent);
  const xsrfToken = jar.get("XSRF-TOKEN");
  if (!xsrfToken) throw new Error("[werknl] geen XSRF-TOKEN na bootstrap");

  return { jar, xsrfToken, userAgent };
}

/** Fetch met sessie-cookies + (bij POST) X-XSRF-TOKEN header. */
export async function werknlFetch(
  session: WerknlSession,
  url: string,
  init: { method?: "GET" | "POST"; body?: string } = {}
): Promise<Response> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {
    "User-Agent": session.userAgent,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
    Cookie: cookieHeader(session.jar),
    Origin: "https://www.werk.nl",
    Referer: BOOTSTRAP_URL,
  };
  if (method === "POST") {
    headers["Content-Type"] = "application/json";
    headers["X-XSRF-TOKEN"] = session.xsrfToken;
  }
  const res = await fetch(url, { method, headers, body: init.body, redirect: "follow" });
  parseCookies(session.jar, res.headers.getSetCookie());
  return res;
}
