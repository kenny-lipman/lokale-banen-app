# werk.nl scraper - Fase 1: lijst-scan MVP - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Echte werk.nl-vacatures als lijst-rijen in `job_postings` zetten, gemarkeerd voor latere detail-verrijking.

**Architecture:** Server-side, geen browser. Een sessie-laag bootstrapt de anonieme OAM-sessie + XSRF-token; een search-client pagineert de publieke zoek-API; een mapper/upsert zet elke vacature als minimale rij in `job_postings` (`needs_detail_scrape=true`, `company_id=null`). Detail-verrijking, company-dedup en delisting volgen in Fase 2/3. Template: de bestaande `werkenindekempen`-scraper.

**Tech Stack:** Next.js App Router (route handlers), TypeScript, Zod, Vitest, Supabase (service-role client). Node `fetch` met handmatige cookie-jar (geen extra dependency).

**Scope:** Dit plan levert een werkende, handmatig triggerbare lijst-scan. Buiten scope (Fase 2/3): detail-API, company-dedup, contacts, queue/worker, delisting, cron-registratie.

**Naamgeving:** lib in `apps/admin/lib/scrapers/werk_nl/`, route in `apps/admin/app/api/scrapers/werk-nl/`, tests in `apps/admin/__tests__/scrapers/werk_nl/`. Job source naam: `"Werk.nl"`. Log-prefix: `[werknl]`.

**Hard rules (CLAUDE.md):** geen em-dash (U+2014) in code/comments/commits; `// @auth <KLASSE>` op regel 1 van elke `route.ts`; na de feature `docs/reference/scrapers.md` bijwerken (Task 8).

---

## File Structure

| Bestand | Verantwoordelijkheid |
|---------|----------------------|
| `lib/scrapers/werk_nl/constants.ts` | URL-constanten + JOB_SOURCE_NAME |
| `lib/scrapers/werk_nl/session.ts` | OAM-bootstrap + XSRF; cookie-jar; `werknlFetch` wrapper |
| `lib/scrapers/werk_nl/types.ts` | Zod-schema's search-respons + `SearchItem` type |
| `lib/scrapers/werk_nl/search-client.ts` | `searchPage()` - één zoekpagina ophalen + parsen |
| `lib/scrapers/werk_nl/mappers.ts` | `mapSearchItem()` - SearchItem -> job_postings insert-object |
| `lib/scrapers/werk_nl/upsert.ts` | `upsertListing()` - insert nieuw of refresh bestaand |
| `app/api/scrapers/werk-nl/route.ts` | POST manual lijst-scan orchestratie |
| `__tests__/scrapers/werk_nl/session.test.ts` | bootstrap-flow met gemockte fetch |
| `__tests__/scrapers/werk_nl/search-client.test.ts` | parsing + paginering |
| `__tests__/scrapers/werk_nl/mappers.test.ts` | mapping + null-handling |
| `__tests__/scrapers/werk_nl/upsert.test.ts` | insert- vs refresh-pad |

---

## Task 1: Constanten

**Files:**
- Create: `apps/admin/lib/scrapers/werk_nl/constants.ts`

- [ ] **Step 1: Schrijf de constanten**

```typescript
/**
 * Constanten voor de werk.nl scraper (UWV publieke vacature-API).
 * Endpoints gereverse-engineerd uit de Angular-zoekapp (publiek, geen DigiD).
 */

export const JOB_SOURCE_NAME = "Werk.nl";

/** Publieke vacaturepagina; eerste GET bootstrapt de anonieme OAM-sessie. */
export const BOOTSTRAP_URL =
  "https://www.werk.nl/nl/vacatures/?friendlyurl=%2Fvacatures";

/** GET hierop zet de XSRF-TOKEN + Antiforgery cookies (respons is 404, dat is OK). */
export const XSRF_URL =
  "https://www.werk.nl/werkzoekenden/mijn-werkmap/kia/publiek/zoekenvacatures";

/** POST zoek-API. */
export const SEARCH_URL =
  "https://www.werk.nl/werkzoekenden/mijn-werkmap/kia/publiek/zoekenvacatures/api/search";

/** GET detail-API (Fase 2). `${DETAIL_URL_BASE}/${referenceNumber}`. */
export const DETAIL_URL_BASE =
  "https://www.werk.nl/werkzoekenden/mijn-werkmap/kia/publiek/zoekenvacatures/api/vacature";

export const PAGE_SIZE = 20; // werk.nl levert vast 20 items per pagina
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/lib/scrapers/werk_nl/constants.ts
git commit -m "feat(werk-nl): scraper-constanten (endpoints + source naam)"
```

---

## Task 2: Sessie-laag (OAM-bootstrap + XSRF)

De kern: Node `fetch` beheert geen cookie-jar. We volgen de redirect-keten handmatig met `redirect: "manual"`, accumuleren `Set-Cookie` headers in een Map, en herhalen tot er geen redirect meer is. Daarna een GET op de XSRF-URL om de `XSRF-TOKEN`-cookie te krijgen. De `werknlFetch`-wrapper stuurt de cookie-header + (bij POST) de `X-XSRF-TOKEN`-header mee.

**Files:**
- Create: `apps/admin/lib/scrapers/werk_nl/session.ts`
- Test: `apps/admin/__tests__/scrapers/werk_nl/session.test.ts`

- [ ] **Step 1: Schrijf de failing test**

```typescript
import { describe, test, expect, vi, afterEach } from "vitest";
import { parseCookies, cookieHeader, type WerknlSession } from "@/lib/scrapers/werk_nl/session";

afterEach(() => vi.restoreAllMocks());

describe("parseCookies", () => {
  test("extraheert naam=waarde uit Set-Cookie strings", () => {
    const jar = new Map<string, string>();
    parseCookies(jar, [
      "OAMAuthnCookie_www.werk.nl:443=abc123; path=/; secure; httponly",
      "XSRF-TOKEN=tok789; path=/; samesite=strict",
    ]);
    expect(jar.get("OAMAuthnCookie_www.werk.nl:443")).toBe("abc123");
    expect(jar.get("XSRF-TOKEN")).toBe("tok789");
  });

  test("expired cookie (max-age=0 / verleden) wordt genegeerd of overschreven", () => {
    const jar = new Map<string, string>([["X", "old"]]);
    parseCookies(jar, ["X=new; path=/"]);
    expect(jar.get("X")).toBe("new");
  });
});

describe("cookieHeader", () => {
  test("bouwt 'k=v; k2=v2' string uit de jar", () => {
    const jar = new Map([["A", "1"], ["B", "2"]]);
    expect(cookieHeader(jar)).toBe("A=1; B=2");
  });
});
```

- [ ] **Step 2: Run de test, verwacht failure**

Run: `cd apps/admin && pnpm vitest run __tests__/scrapers/werk_nl/session.test.ts`
Expected: FAIL met "does not provide an export named 'parseCookies'".

- [ ] **Step 3: Schrijf de implementatie**

```typescript
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
```

- [ ] **Step 4: Run de test, verwacht pass**

Run: `cd apps/admin && pnpm vitest run __tests__/scrapers/werk_nl/session.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/scrapers/werk_nl/session.ts apps/admin/__tests__/scrapers/werk_nl/session.test.ts
git commit -m "feat(werk-nl): sessie-laag met OAM-bootstrap en XSRF-token"
```

---

## Task 3: Types (Zod-schema search-respons)

**Files:**
- Create: `apps/admin/lib/scrapers/werk_nl/types.ts`
- Test: `apps/admin/__tests__/scrapers/werk_nl/search-client.test.ts` (gedeeld met Task 4)

- [ ] **Step 1: Schrijf de implementatie**

```typescript
/**
 * Zod-schema's voor de werk.nl zoek-API respons.
 * Lijst-velden zijn bewust tolerant (nullable) - werk.nl laat velden weg of zet null.
 */

import { z } from "zod";

export const SearchItemSchema = z.object({
  key: z.string(),
  referenceNumber: z.number(),
  profession: z.string().nullable().optional(),
  vacatureTitle: z.string().nullable().optional(),
  modified: z.string().nullable().optional(),
  organisation: z.string().nullable().optional(),
  workLocationCity: z.string().nullable().optional(),
  workLocationType: z.string().nullable().optional(),
  minHours: z.number().nullable().optional(),
  maxHours: z.number().nullable().optional(),
  contractType: z.string().nullable().optional(),
  studyLevel: z.string().nullable().optional(),
  leerbaan: z.boolean().nullable().optional(),
  stageplaats: z.boolean().nullable().optional(),
});
export type SearchItem = z.infer<typeof SearchItemSchema>;

export const SearchResponseSchema = z.object({
  items: z.array(SearchItemSchema).default([]),
  totalResults: z.number().nullable().optional(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

/** Body voor de zoek-API. sort.by=1 = nieuwste, direction=1 = descending. */
export interface SearchRequest {
  facets: never[];
  keywords: string;
  location: string;
  currentPage: number;
  sort: { by: number; direction: number };
  includeFirstExpansion: boolean;
  includeSecondExpansion: boolean;
}

export function buildSearchBody(page: number, keywords = "", location = ""): string {
  const body: SearchRequest = {
    facets: [],
    keywords,
    location,
    currentPage: page,
    sort: { by: 1, direction: 1 },
    includeFirstExpansion: false,
    includeSecondExpansion: false,
  };
  return JSON.stringify(body);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/lib/scrapers/werk_nl/types.ts
git commit -m "feat(werk-nl): Zod-types en zoek-body builder"
```

---

## Task 4: Search-client (één pagina ophalen)

**Files:**
- Create: `apps/admin/lib/scrapers/werk_nl/search-client.ts`
- Test: `apps/admin/__tests__/scrapers/werk_nl/search-client.test.ts`

- [ ] **Step 1: Schrijf de failing test**

```typescript
import { describe, test, expect, vi, afterEach } from "vitest";
import { searchPage } from "@/lib/scrapers/werk_nl/search-client";
import type { WerknlSession } from "@/lib/scrapers/werk_nl/session";

afterEach(() => vi.restoreAllMocks());

const session: WerknlSession = { jar: new Map(), xsrfToken: "t", userAgent: "UA" };

function mockFetchOnce(jsonBody: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      status,
      ok: status >= 200 && status < 300,
      headers: { getSetCookie: () => [] as string[] },
      text: async () => JSON.stringify(jsonBody),
    }))
  );
}

describe("searchPage", () => {
  test("parset items en totalResults", async () => {
    mockFetchOnce({
      totalResults: 285291,
      items: [
        { key: "2001:L:1", referenceNumber: 1, vacatureTitle: "Tester", organisation: "ACME", workLocationCity: "UTRECHT" },
      ],
    });
    const res = await searchPage(session, 1);
    expect(res.total).toBe(285291);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].referenceNumber).toBe(1);
  });

  test("gooit bij HTTP 500", async () => {
    mockFetchOnce({}, 500);
    await expect(searchPage(session, 1)).rejects.toThrow(/HTTP 500/);
  });

  test("ongeldige items worden overgeslagen, geldige behouden", async () => {
    mockFetchOnce({
      totalResults: 2,
      items: [
        { key: "k", referenceNumber: 5, vacatureTitle: "OK" },
        { referenceNumber: "geen-getal" }, // invalid: geen key, ref is string
      ],
    });
    const res = await searchPage(session, 1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].referenceNumber).toBe(5);
  });
});
```

- [ ] **Step 2: Run de test, verwacht failure**

Run: `cd apps/admin && pnpm vitest run __tests__/scrapers/werk_nl/search-client.test.ts`
Expected: FAIL met "does not provide an export named 'searchPage'".

- [ ] **Step 3: Schrijf de implementatie**

```typescript
/**
 * Search-client: haalt één zoekpagina op via de publieke werk.nl zoek-API.
 * Per item los gevalideerd zodat één kapot item de hele pagina niet sloopt.
 */

import { werknlFetch, type WerknlSession } from "./session";
import { SearchItemSchema, buildSearchBody, type SearchItem } from "./types";
import { SEARCH_URL } from "./constants";

export interface SearchPageResult {
  items: SearchItem[];
  total: number;
}

export async function searchPage(
  session: WerknlSession,
  page: number,
  keywords = "",
  location = ""
): Promise<SearchPageResult> {
  const res = await werknlFetch(session, SEARCH_URL, {
    method: "POST",
    body: buildSearchBody(page, keywords, location),
  });
  if (!res.ok) throw new Error(`[werknl] zoek-API HTTP ${res.status} (pagina ${page})`);

  const raw = JSON.parse(await res.text()) as { items?: unknown[]; totalResults?: number };
  const items: SearchItem[] = [];
  for (const it of raw.items ?? []) {
    const parsed = SearchItemSchema.safeParse(it);
    if (parsed.success) items.push(parsed.data);
  }
  return { items, total: raw.totalResults ?? 0 };
}
```

- [ ] **Step 4: Run de test, verwacht pass**

Run: `cd apps/admin && pnpm vitest run __tests__/scrapers/werk_nl/search-client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/scrapers/werk_nl/search-client.ts apps/admin/__tests__/scrapers/werk_nl/search-client.test.ts
git commit -m "feat(werk-nl): search-client voor één zoekpagina"
```

---

## Task 5: Mapper (SearchItem -> job_postings rij)

**Files:**
- Create: `apps/admin/lib/scrapers/werk_nl/mappers.ts`
- Test: `apps/admin/__tests__/scrapers/werk_nl/mappers.test.ts`

- [ ] **Step 1: Schrijf de failing test**

```typescript
import { describe, test, expect } from "vitest";
import { mapSearchItem } from "@/lib/scrapers/werk_nl/mappers";
import type { SearchItem } from "@/lib/scrapers/werk_nl/types";

const base: SearchItem = {
  key: "2001:L:123",
  referenceNumber: 123,
  vacatureTitle: "Verpleegkundige gezocht",
  profession: "Verpleegkundige",
  organisation: "Zorg BV",
  workLocationCity: "TERNEUZEN",
  minHours: 24,
  maxHours: 36,
  contractType: "Vast",
  studyLevel: "MBO",
};

describe("mapSearchItem", () => {
  test("mapt kernvelden + zet detail-vlag en pending review", () => {
    const row = mapSearchItem(base, "src-1", "2026-06-05T10:00:00.000Z");
    expect(row.title).toBe("Verpleegkundige gezocht");
    expect(row.external_vacancy_id).toBe("123");
    expect(row.source_id).toBe("src-1");
    expect(row.city).toBe("Terneuzen"); // title-case
    expect(row.url).toBe("https://www.werk.nl/werkzoekenden/mijn-werkmap/kia/publiek/zoekenvacatures/api/vacature/123");
    expect(row.working_hours_min).toBe(24);
    expect(row.working_hours_max).toBe(36);
    expect(row.needs_detail_scrape).toBe(true);
    expect(row.review_status).toBe("pending");
    expect(row.company_id).toBeNull();
  });

  test("valt terug op profession als vacatureTitle ontbreekt", () => {
    const row = mapSearchItem({ ...base, vacatureTitle: null }, "src-1", "2026-06-05T10:00:00.000Z");
    expect(row.title).toBe("Verpleegkundige");
  });

  test("lege city wordt null, niet lege string", () => {
    const row = mapSearchItem({ ...base, workLocationCity: null }, "src-1", "2026-06-05T10:00:00.000Z");
    expect(row.city).toBeNull();
  });
});
```

- [ ] **Step 2: Run de test, verwacht failure**

Run: `cd apps/admin && pnpm vitest run __tests__/scrapers/werk_nl/mappers.test.ts`
Expected: FAIL met "does not provide an export named 'mapSearchItem'".

- [ ] **Step 3: Schrijf de implementatie**

```typescript
/**
 * Mapt een werk.nl SearchItem naar een minimale job_postings insert-rij.
 * company_id blijft null (dedup gebeurt in Fase 2 via de detail-API).
 */

import type { SearchItem } from "./types";
import { DETAIL_URL_BASE } from "./constants";

export interface JobPostingRow {
  title: string;
  external_vacancy_id: string;
  source_id: string;
  company_id: null;
  url: string;
  city: string | null;
  employment: string | null;
  working_hours_min: number | null;
  working_hours_max: number | null;
  status: string;
  review_status: string;
  needs_detail_scrape: true;
  last_seen_in_sitemap: string;
  scraped_at: string;
}

/** Title-case een UWV-stad ("TERNEUZEN" -> "Terneuzen", "MAASTRICHT-AIRPORT" -> "Maastricht-Airport"). */
function titleCaseCity(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  return s
    .toLowerCase()
    .replace(/(^|[\s-])([a-zà-ÿ])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function mapSearchItem(item: SearchItem, sourceId: string, nowIso: string): JobPostingRow {
  const title = (item.vacatureTitle || item.profession || "").trim() || "Onbekende vacature";
  return {
    title,
    external_vacancy_id: String(item.referenceNumber),
    source_id: sourceId,
    company_id: null,
    url: `${DETAIL_URL_BASE}/${item.referenceNumber}`,
    city: titleCaseCity(item.workLocationCity),
    employment: item.contractType?.trim() || null,
    working_hours_min: item.minHours ?? null,
    working_hours_max: item.maxHours ?? null,
    status: "new",
    review_status: "pending",
    needs_detail_scrape: true,
    last_seen_in_sitemap: nowIso,
    scraped_at: nowIso,
  };
}
```

- [ ] **Step 4: Run de test, verwacht pass**

Run: `cd apps/admin && pnpm vitest run __tests__/scrapers/werk_nl/mappers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/scrapers/werk_nl/mappers.ts apps/admin/__tests__/scrapers/werk_nl/mappers.test.ts
git commit -m "feat(werk-nl): mapper SearchItem naar job_postings rij"
```

---

## Task 6: Upsert (insert nieuw of refresh bestaand)

**Files:**
- Create: `apps/admin/lib/scrapers/werk_nl/upsert.ts`
- Test: `apps/admin/__tests__/scrapers/werk_nl/upsert.test.ts`

- [ ] **Step 1: Schrijf de failing test**

```typescript
import { describe, test, expect, vi } from "vitest";
import { upsertListing } from "@/lib/scrapers/werk_nl/upsert";
import type { SearchItem } from "@/lib/scrapers/werk_nl/types";

const item: SearchItem = { key: "k", referenceNumber: 123, vacatureTitle: "Test", workLocationCity: "UTRECHT" };

/** Mock supabase: lookup geeft `existing` terug, insert/update geregistreerd via spies. */
function mockClient(existing: { id: string } | null) {
  const insertSpy = vi.fn();
  const updateSpy = vi.fn();
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
      }),
      insert: (payload: Record<string, unknown>) => {
        insertSpy(payload);
        return Promise.resolve({ error: null });
      },
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          updateSpy(patch);
          return { error: null };
        },
      }),
    }),
    _spies: { insertSpy, updateSpy },
  };
  return client;
}

describe("upsertListing", () => {
  test("nieuw item -> insert", async () => {
    const client = mockClient(null);
    const r = await upsertListing(client as any, item, "src-1", "2026-06-05T10:00:00.000Z");
    expect(r).toBe("new");
    expect(client._spies.insertSpy).toHaveBeenCalledOnce();
    expect(client._spies.updateSpy).not.toHaveBeenCalled();
  });

  test("bestaand item -> alleen last_seen + needs_detail refresh, geen insert", async () => {
    const client = mockClient({ id: "jp-9" });
    const r = await upsertListing(client as any, item, "src-1", "2026-06-05T10:00:00.000Z");
    expect(r).toBe("seen");
    expect(client._spies.insertSpy).not.toHaveBeenCalled();
    expect(client._spies.updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ last_seen_in_sitemap: "2026-06-05T10:00:00.000Z" })
    );
  });
});
```

- [ ] **Step 2: Run de test, verwacht failure**

Run: `cd apps/admin && pnpm vitest run __tests__/scrapers/werk_nl/upsert.test.ts`
Expected: FAIL met "does not provide an export named 'upsertListing'".

- [ ] **Step 3: Schrijf de implementatie**

```typescript
/**
 * Upsert van één lijst-vacature in job_postings.
 * - Nieuw (external_vacancy_id + source_id niet gevonden) -> insert minimale rij.
 * - Bestaand -> alleen last_seen verversen en needs_detail_scrape opnieuw zetten
 *   (zodat gewijzigde vacatures opnieuw verrijkt worden in Fase 2).
 */

import type { SupabaseClient } from "@/lib/scrapers/shared";
import { mapSearchItem } from "./mappers";
import type { SearchItem } from "./types";

export type UpsertOutcome = "new" | "seen";

export async function upsertListing(
  supabase: SupabaseClient,
  item: SearchItem,
  sourceId: string,
  nowIso: string
): Promise<UpsertOutcome> {
  const externalId = String(item.referenceNumber);

  const { data: existing } = await supabase
    .from("job_postings")
    .select("id")
    .eq("external_vacancy_id", externalId)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("job_postings")
      .update({ last_seen_in_sitemap: nowIso, needs_detail_scrape: true })
      .eq("id", (existing as { id: string }).id);
    if (error) throw new Error(`[werknl] update faalde: ${error.message}`);
    return "seen";
  }

  const row = mapSearchItem(item, sourceId, nowIso);
  const { error } = await supabase.from("job_postings").insert(row);
  if (error) throw new Error(`[werknl] insert faalde: ${error.message}`);
  return "new";
}
```

- [ ] **Step 4: Run de test, verwacht pass**

Run: `cd apps/admin && pnpm vitest run __tests__/scrapers/werk_nl/upsert.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/scrapers/werk_nl/upsert.ts apps/admin/__tests__/scrapers/werk_nl/upsert.test.ts
git commit -m "feat(werk-nl): upsert lijst-vacature in job_postings"
```

---

## Task 7: API-route (POST manual lijst-scan)

**Files:**
- Create: `apps/admin/app/api/scrapers/werk-nl/route.ts`

- [ ] **Step 1: Schrijf de route**

Let op: `// @auth SECRET` MOET op regel 1 (Vitest auth-gate). Patroon `withCronAuth` + `createSupabaseClient` + `getOrCreateJobSource` + `updateJobSourceStatus` zoals werkenindekempen.

```typescript
// @auth SECRET
/**
 * werk.nl scraper - Fase 1 lijst-scan (manual trigger).
 *
 * POST /api/scrapers/werk-nl  body: { maxPages?: number, keywords?: string, location?: string }
 *
 * Bootstrapt een anonieme OAM-sessie, pagineert de publieke zoek-API op nieuwste,
 * en upsert elke vacature als minimale job_postings rij (needs_detail_scrape=true).
 * Detail-verrijging, dedup en delisting volgen in Fase 2/3.
 */

import { NextRequest, NextResponse } from "next/server";
import { withCronAuth } from "@/lib/auth-middleware";
import {
  createSupabaseClient,
  getOrCreateJobSource,
  updateJobSourceStatus,
} from "@/lib/scrapers/shared";
import { bootstrapSession } from "@/lib/scrapers/werk_nl/session";
import { searchPage } from "@/lib/scrapers/werk_nl/search-client";
import { upsertListing } from "@/lib/scrapers/werk_nl/upsert";
import { JOB_SOURCE_NAME, PAGE_SIZE } from "@/lib/scrapers/werk_nl/constants";

export const runtime = "nodejs";
export const preferredRegion = ["fra1", "ams1"];
export const maxDuration = 300;

const DEFAULT_MAX_PAGES = 5;

async function postHandler(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let body: { maxPages?: number; keywords?: string; location?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* lege body is toegestaan */
  }
  const maxPages = Math.max(1, Math.min(body.maxPages ?? DEFAULT_MAX_PAGES, 1000));
  const keywords = body.keywords ?? "";
  const location = body.location ?? "";

  const supabase = createSupabaseClient();
  const sourceId = await getOrCreateJobSource(supabase, JOB_SOURCE_NAME);

  let newCount = 0;
  let seenCount = 0;
  let total = 0;
  try {
    const session = await bootstrapSession();
    const nowIso = new Date().toISOString();

    for (let page = 1; page <= maxPages; page++) {
      const { items, total: t } = await searchPage(session, page, keywords, location);
      total = t;
      if (items.length === 0) break;
      for (const item of items) {
        const outcome = await upsertListing(supabase, item, sourceId, nowIso);
        if (outcome === "new") newCount++;
        else seenCount++;
      }
      // politeness tussen pagina's
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));
    }

    await updateJobSourceStatus(supabase, sourceId, {
      success: true,
      count: newCount,
    });

    console.log(
      `[werknl] lijst-scan klaar: pages<=${maxPages} new=${newCount} seen=${seenCount} total=${total}`
    );
    return NextResponse.json({
      success: true,
      stats: {
        pages_scanned: Math.min(maxPages, Math.ceil(total / PAGE_SIZE) || maxPages),
        new: newCount,
        seen: seenCount,
        total_available: total,
      },
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    await updateJobSourceStatus(supabase, sourceId, {
      success: false,
      earlyExitReason: "fatal",
      count: newCount,
    });
    console.error("[werknl] lijst-scan fataal:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        stats: { new: newCount, seen: seenCount },
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

export const POST = withCronAuth(postHandler);
```

- [ ] **Step 2: Type-check + auth-gate + lint**

Run: `cd apps/admin && pnpm vitest run __tests__/auth && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: auth-coverage gate groen (route heeft `// @auth SECRET`), geen type-errors in de nieuwe files.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/api/scrapers/werk-nl/route.ts
git commit -m "feat(werk-nl): POST lijst-scan route (manual trigger)"
```

---

## Task 8: Live verificatie + docs

**Files:**
- Modify: `docs/reference/scrapers.md`
- Verify: lokale dev-run tegen de echte werk.nl API

- [ ] **Step 1: Start dev-server en draai een kleine echte scan**

Run (twee terminals, vanuit repo-root):
```bash
pnpm dev:admin
```
```bash
curl -s -X POST http://localhost:3000/api/scrapers/werk-nl \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"maxPages":2}' | python3 -m json.tool
```
Expected: `{"success": true, "stats": {"new": >0, "total_available": ~285000, ...}}`.

- [ ] **Step 2: Bevestig rijen in de database**

Run (via Supabase MCP `execute_sql` of psql):
```sql
select count(*) as n, count(*) filter (where needs_detail_scrape) as te_verrijken
from job_postings jp
join job_sources js on js.id = jp.source_id
where js.name = 'Werk.nl';
```
Expected: `n` > 0, `te_verrijken` = `n` (alle nieuw, nog te verrijken). Toon dit resultaat aan de gebruiker.

- [ ] **Step 3: Werk scrapers-doc bij**

Voeg in `docs/reference/scrapers.md` een sectie `## Werk.nl` toe met: bron (publieke OAM-gated zoek-API, geen DigiD), method (server-side, geen browser/Apify), endpoints (search + detail), Fase-1 scope (lijst-scan), en dat detail/dedup/delisting in latere fasen komen. Geen em-dash gebruiken.

- [ ] **Step 4: Commit**

```bash
git add docs/reference/scrapers.md
git commit -m "docs(werk-nl): documenteer werk.nl bron (Fase 1 lijst-scan)"
```

---

## Vervolg (aparte plannen, na Fase 1)

- **Fase 2 - Detail-verrijking + dedup:** eigen `werk_nl_scrape_queue` + `werknl_claim_batch` RPC, worker-route, detail-client, 3-laags company-dedup (`werknl_employer_id` = `employer.referenceNumber`), contact-aanmaak, `expirationDate` opslaan, nieuwe DB-kolom `companies.werknl_employer_id`. FIFO maar alleen nog-actieve (recente `last_seen`) rijen; verlopen/404 -> archiveren.
- **Fase 3 - Delisting + cron + monitoring:** dagelijkse incrementele lijst-scan (stop bij bekend), wekelijkse volledige re-scan voor `last_seen`, archiveren na 3 dagen grace, cron-registratie in `vercel.json`, watchdog.

## Self-Review notities

- Spec-coverage Fase 1: sessie-laag (5.1), lijst-scan + `needs_detail_scrape` (5.2), `job_sources` registratie, geen-Mistral. Gedekt door Task 2-8.
- Dedup/detail/delisting bewust uitgesteld naar Fase 2/3 (zie scope).
- Types consistent: `WerknlSession`, `SearchItem`, `JobPostingRow`, `werknlFetch`, `bootstrapSession`, `searchPage`, `mapSearchItem`, `upsertListing` overal gelijk gebruikt.
- `company_id` nullable bevestigd in schema; alleen `title` is NOT NULL zonder default.
