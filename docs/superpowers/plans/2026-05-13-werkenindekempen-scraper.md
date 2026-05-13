# Werkenindekempen.nl Scraper — Daily incremental met JSON-LD + Mistral

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daily scrape van werkenindekempen.nl (regio Kempen + Eindhoven, ~1.099 actieve vacatures, 10–30 nieuwe/dag) die JSON-LD JobPosting in detail-pagina's parseert, Mistral inzet voor contact/working_hours/education uit description, en records koppelt aan bestaande `companies` (3-laagse dedup) en `platforms` (KempenseBanen/HelmondseBanen/EindhovenseBanen via geocoding-cron). Aansluiting op `/automatiseringen` via registry-pattern. Concurrent-context: neutrale Chrome-fingerprint, EU-region, geen identificeerbare contactinfo.

**Architecture:** Sitemap-driven incremental — fetch `sitemap-wik-vacancies.xml`, diff op `lastmod > last_scraped_at`, voor elke fresh URL: GET detail (polite headers + session-cookie hergebruikt binnen run) → parse JSON-LD (Zod-validated) → Mistral extraction op description (strict schema) → 3-laagse company-dedup (`werkenindekempen_id` → `normalized_name` → `hoofddomein`) → upsert `companies`/`job_postings`/`contacts`. Na elke run: delisted-detection via `last_seen_in_sitemap` timestamp + 3-runs grace. Stats naar `cron_job_logs.business_stats`, UI rendert automatisch via registry-entry.

**Tech Stack:** Next.js 16 App Router (`nodejs` runtime, `preferredRegion: ['fra1','ams1']`), TypeScript, Supabase (`createServiceRoleClient`), bestaande `lib/scrapers/shared/*` helpers, `@mistralai/mistralai`, Zod voor schema-validatie, Vitest voor unit tests.

---

## File Structure

**Nieuw:**
- `apps/admin/lib/scrapers/werkenindekempen/types.ts` — Zod-schemas (JobPostingLD, MistralResult), ScraperConfig, ScrapeResult, EMPTY_STATS
- `apps/admin/lib/scrapers/werkenindekempen/headers.ts` — Browser-identity pool (Chrome macOS/Windows + Firefox macOS), `buildHeaders()`, `pickIdentity()`
- `apps/admin/lib/scrapers/werkenindekempen/fetch-polite.ts` — `fetchPolite()` met `If-Modified-Since`, session-cookie hergebruik, 429/503 → `RateLimitError`, human-delay
- `apps/admin/lib/scrapers/werkenindekempen/normalizers.ts` — `normalizeCity`, `normalizeRegion` (NB→Noord-Brabant), `normalizeCountry`, `normalizeEmploymentType`, `parseSalary`, `normalizePostalCode`, `parsePublishedAt` (Europe/Amsterdam tz-safe)
- `apps/admin/lib/scrapers/werkenindekempen/sitemap-parser.ts` — `fetchSitemap()`, `diffFresh(allUrls, lastSeenMap)` returns URLs met `lastmod > last_scraped_at`
- `apps/admin/lib/scrapers/werkenindekempen/detail-parser.ts` — `parseDetailHtml(html)` → `JobPostingLD` (Zod-parse, throws op invalid)
- `apps/admin/lib/scrapers/werkenindekempen/ai-parser.ts` — `extractFromDescription(plainText)` → `MistralResult` via Mistral met strict JSON-output, regex-double-check op email/phone, domain-match-check
- `apps/admin/lib/scrapers/werkenindekempen/dedup.ts` — `findOrCreateCompanyThreeLayer()` (werkenindekempen_id → normalized_name → hoofddomein → create)
- `apps/admin/lib/scrapers/werkenindekempen/scraper.ts` — orchestrator: sitemap-fetch → fresh-diff → per URL: fetchPolite + parseDetailHtml + extractFromDescription + dedup + upsert, returns `ScraperStats`
- `apps/admin/lib/scrapers/werkenindekempen/delisted.ts` — `markDelisted(supabase, sourceId, currentSitemapUrls)` na elke run
- `apps/admin/app/api/scrapers/werkenindekempen/route.ts` — GET (cron) + POST (manual met config), `withCronMonitoring('werkenindekempen-scraper', ...)`, `preferredRegion`
- `apps/admin/app/api/scrapers/werkenindekempen/backfill/route.ts` — separate backfill route (max 200 URLs/run), niet in vercel cron
- `apps/admin/__tests__/scrapers/werkenindekempen/normalizers.test.ts` — 15+ edge-cases (city: 's-Hertogenbosch, HELMOND; salary: HOUR/YEAR/MONTH; employmentType variants)
- `apps/admin/__tests__/scrapers/werkenindekempen/detail-parser.test.ts` — fixture-based: 3 sample HTML files, Zod-validation pass + fail cases
- `apps/admin/__tests__/scrapers/werkenindekempen/dedup.test.ts` — 4 scenarios (layer 1/2/3 hits + new)
- `apps/admin/__tests__/scrapers/werkenindekempen/registry.test.ts` — stats-keys consistency (registry.displayStats ⊆ EMPTY_STATS keys)
- `apps/admin/__tests__/scrapers/werkenindekempen/fixtures/*.html` — 3 sample detail-pagina's (rich/sparse/edge-case)

**Wijzigen:**
- `apps/admin/lib/automations-registry.ts` — `AUTOMATIONS[]` toevoegen: `werkenindekempen-scraper` entry (na debanensite-scraper)
- `apps/admin/vercel.json` — `crons[]` + `functions{}` entries voor `/api/scrapers/werkenindekempen`
- `CLAUDE.md` — sectie "## Scrapers" uitbreiden met "Werken in de Kempen" (3e scraper-block, identiek format als debanensite)

**Verwijderen:** geen.

---

## Open vragen (vóór executie beantwoorden door Kenny)

Geen blokkers — alle hoofdkeuzes zijn besloten:

1. ✅ Nieuwe kolom `companies.werkenindekempen_id` toevoegen
2. ✅ Daily cron i.p.v. one-shot backfill
3. ✅ Mistral op alle descriptions
4. ✅ Platform-mapping via bestaande geocoding-cron (geen nieuw platform)
5. ✅ Delisted-detection met `last_seen_in_sitemap` + 3-runs grace
6. ✅ Concurrent-context: neutrale Chrome-fingerprint, geen identificeerbare contactinfo

Twee kleine open items die executor zelf kan beslissen:

- **A**: Initial backfill (1.099 URLs) via daily cron over 5-6 dagen (`maxUrlsPerRun=200`, `consecutiveSkipLimit=50`) **óf** manual via `/backfill` route in 1 nacht. → Aanbeveling executor: **via daily cron** (`maxUrlsPerRun=200`), `/backfill` route alleen als veilighedsnet voor re-runs.
- **B**: Sample-fixture-pagina's voor tests — executor maakt 3 fixtures door huidige sitemap-URLs te fetchen (rich/sparse/edge-case) en HTML te bewaren in `__tests__/.../fixtures/`. Niet committen als persoonsgegevens in HTML staan.

---

## Pre-flight: Verifieer Kempen-postcodes in `postcode_platform_lookup`

Vóór Task 1 even SQL-check:

```sql
SELECT postcode, regio_platform, distance
FROM postcode_platform_lookup
WHERE postcode LIKE '550%' OR postcode LIKE '551%' OR postcode LIKE '552%'
ORDER BY postcode;
```

Verwacht: postcodes 5500-5529 mappen naar `KempenseBanen` of `EindhovenseBanen`. Als leeg → 1 seed-INSERT vóór de scraper voor de eerste keer draait, anders blijven nieuwe vacatures op `platform_id=null` staan.

---

## Task 0 — Migration: `companies.werkenindekempen_id` + `job_postings.last_seen_in_sitemap`

**Files:**
- Apply via `mcp__supabase__apply_migration`

**Doel:** Twee kolommen toevoegen, idempotent en reversible.

- [ ] **Step 1: Schrijf migration**

```sql
-- migration: add_werkenindekempen_columns

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS werkenindekempen_id text;

CREATE UNIQUE INDEX IF NOT EXISTS companies_werkenindekempen_id_uniq
  ON companies (werkenindekempen_id)
  WHERE werkenindekempen_id IS NOT NULL;

ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS last_seen_in_sitemap timestamp with time zone;

CREATE INDEX IF NOT EXISTS job_postings_last_seen_in_sitemap_idx
  ON job_postings (last_seen_in_sitemap)
  WHERE last_seen_in_sitemap IS NOT NULL;

COMMENT ON COLUMN companies.werkenindekempen_id IS
  'Stable werkgever-key uit werkenindekempen.nl URL (c{id} segment). Primair voor 3-laagse company-dedup.';
COMMENT ON COLUMN job_postings.last_seen_in_sitemap IS
  'Laatst gezien in bron-sitemap (per scraper-run geüpdate). Delisted-detection: archive als < now() - 3 runs.';
```

- [ ] **Step 2: Verifieer + `get_advisors`**

Na apply: check via `list_tables` dat kolommen er zijn + run `get_advisors(type=security)` voor RLS-impact (er is geen, want ALTER bestaande tabel).

**Acceptance:**
- `companies.werkenindekempen_id` bestaat, partial unique index actief
- `job_postings.last_seen_in_sitemap` bestaat
- `get_advisors` toont geen nieuwe kritieke advisories

---

## Task 1 — Types & Zod-schemas

**Files:**
- Create: `apps/admin/lib/scrapers/werkenindekempen/types.ts`

**Doel:** Alle types op één plek. Zod-schemas zijn de single source of truth voor validatie.

- [ ] **Step 1: JobPostingLD schema (strict)**

```ts
import { z } from 'zod';

export const AddressSchema = z.object({
  '@type': z.literal('PostalAddress').optional(),
  streetAddress: z.string().optional(),
  postalCode: z.string().optional(),
  addressLocality: z.string().min(1),
  addressRegion: z.string().max(20).optional(),
  addressCountry: z.string().optional(),
});

export const HiringOrgSchema = z.object({
  '@type': z.literal('Organization').optional(),
  name: z.string().min(1),
  sameAs: z.string().url().optional(),
  logo: z.string().url().optional(),
});

export const BaseSalarySchema = z.object({
  '@type': z.literal('MonetaryAmount').optional(),
  currency: z.string().optional(),
  value: z.object({
    '@type': z.literal('QuantitativeValue').optional(),
    value: z.union([z.string(), z.number()]).optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    unitText: z.enum(['HOUR','WEEK','MONTH','YEAR']).optional(),
  }).optional(),
  unitText: z.enum(['HOUR','WEEK','MONTH','YEAR']).optional(),
}).optional();

export const JobPostingLDSchema = z.object({
  '@type': z.literal('JobPosting'),
  title: z.string().min(2),
  datePosted: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'datePosted must be ISO-date'),
  validThrough: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  // employmentType komt als string array JSON of als array zelf
  employmentType: z.union([z.string(), z.array(z.string())]).optional(),
  description: z.string().optional().default(''),
  hiringOrganization: HiringOrgSchema,
  jobLocation: z.object({
    '@type': z.literal('Place').optional(),
    address: AddressSchema,
  }),
  baseSalary: BaseSalarySchema,
  occupationalCategory: z.string().optional(),
});
export type JobPostingLD = z.infer<typeof JobPostingLDSchema>;
```

- [ ] **Step 2: MistralResult schema (strict)**

```ts
export const EducationLevelEnum = z.enum(['MBO','HBO','WO','VMBO','HAVO','VWO','PhD','Geen','Onbekend']);
export const CareerLevelEnum = z.enum(['Junior','Medior','Senior','Lead','Manager','Director','Stage','Onbekend']);

export const MistralResultSchema = z.object({
  contact: z.object({
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    email: z.string().email().nullable(),
    phone: z.string().nullable(),       // genormaliseerd naar +31… of 0…
    title: z.string().nullable(),
  }).nullable(),
  working_hours_min: z.number().int().min(1).max(80).nullable(),
  working_hours_max: z.number().int().min(1).max(80).nullable(),
  education_level: EducationLevelEnum.nullable(),
  career_level: CareerLevelEnum.nullable(),
  categories: z.array(z.string()).max(3).default([]),
});
export type MistralResult = z.infer<typeof MistralResultSchema>;
```

- [ ] **Step 3: ScraperStats + ScraperConfig + ScrapeResult**

```ts
export interface ScraperStats {
  sitemap_total: number;
  fresh: number;
  new: number;
  updated: number;
  skipped: number;
  errors: number;
  companies_created: number;
  companies_matched: number;     // alle 3 dedup-lagen samen
  contacts_created: number;
  mistral_calls: number;
  delisted: number;              // jobs gearchiveerd door delisted-detection
  validation_failures: number;   // Zod-fails op JSON-LD
  duration_ms?: number;
}
export const EMPTY_STATS: ScraperStats = {
  sitemap_total: 0, fresh: 0, new: 0, updated: 0, skipped: 0, errors: 0,
  companies_created: 0, companies_matched: 0, contacts_created: 0,
  mistral_calls: 0, delisted: 0, validation_failures: 0,
};

export interface ScraperConfig {
  maxUrlsPerRun: number;        // default 200 (initial backfill), steady state alle fresh
  delayMinMs: number;           // 2000
  delayMaxMs: number;           // 5000
  readTimeBurstChance: number;  // 0.15
  timeoutMs: number;            // 280_000 (Vercel 300s - 20s buffer)
  skipAI: boolean;              // default false; true voor sanity-checks
  dryRun: boolean;              // default false; true → geen DB writes
}
export const DEFAULT_CONFIG: ScraperConfig = {
  maxUrlsPerRun: 200, delayMinMs: 2000, delayMaxMs: 5000,
  readTimeBurstChance: 0.15, timeoutMs: 280_000, skipAI: false, dryRun: false,
};
```

**Acceptance:**
- `JobPostingLDSchema.parse()` op een echte werkenindekempen-JSON-LD slaagt
- `MistralResultSchema.parse()` op een lege response (alle nulls) slaagt
- Type-check (`tsc --noEmit`) groen

---

## Task 2 — Browser-identity + polite fetch

**Files:**
- Create: `apps/admin/lib/scrapers/werkenindekempen/headers.ts`
- Create: `apps/admin/lib/scrapers/werkenindekempen/fetch-polite.ts`

**Doel:** Realistic browser-fingerprint zonder identificeerbare LokaleBanen-string. Session-cookie hergebruik binnen één scraper-run.

- [ ] **Step 1: `headers.ts`**

```ts
const BROWSER_IDENTITIES = [
  {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
    'Sec-Ch-Ua-Platform': '"macOS"',
  },
  {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
    'Sec-Ch-Ua-Platform': '"Windows"',
  },
  {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0',
  },
];

export type BrowserIdentity = typeof BROWSER_IDENTITIES[number];

export function pickIdentity(): BrowserIdentity {
  return BROWSER_IDENTITIES[Math.floor(Math.random() * BROWSER_IDENTITIES.length)];
}

export function buildHeaders(identity: BrowserIdentity, sessionCookie?: string): HeadersInit {
  const h: Record<string, string> = {
    ...identity,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
  };
  if (sessionCookie) h['Cookie'] = sessionCookie;
  return h;
}
```

- [ ] **Step 2: `fetch-polite.ts` met session + human-delay**

```ts
import { buildHeaders, pickIdentity, type BrowserIdentity } from './headers';

export class RateLimitError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface FetchSession {
  identity: BrowserIdentity;
  cookie?: string;
}

export function newSession(): FetchSession {
  return { identity: pickIdentity() };
}

export async function fetchPolite(
  url: string,
  session: FetchSession,
  opts: { ifModifiedSince?: string; isFirstRequest?: boolean } = {}
): Promise<{ status: number; html: string | null; lastModified: string | null }> {
  const headers = buildHeaders(session.identity, session.cookie);
  if (opts.ifModifiedSince) (headers as Record<string,string>)['If-Modified-Since'] = opts.ifModifiedSince;

  const res = await fetch(url, { headers, redirect: 'follow' });

  // Session-cookie capturen bij eerste request
  if (opts.isFirstRequest) {
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const phpSess = setCookie.match(/PHPSESSID=[^;]+/)?.[0];
      if (phpSess) session.cookie = phpSess;
    }
  }

  if (res.status === 304) return { status: 304, html: null, lastModified: res.headers.get('last-modified') };
  if (res.status === 429 || res.status === 503) {
    throw new RateLimitError(res.status, `Rate-limited by source (${res.status}) — pausing scraper`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} bij ${url}`);

  return { status: res.status, html: await res.text(), lastModified: res.headers.get('last-modified') };
}

export async function humanDelay(minMs: number, maxMs: number, burstChance: number): Promise<void> {
  let ms = minMs + Math.random() * (maxMs - minMs);
  if (Math.random() < burstChance) ms += 5_000 + Math.random() * 10_000;
  await new Promise(r => setTimeout(r, ms));
}
```

**Acceptance:**
- `pickIdentity()` returnt één van 3 identities, niet altijd dezelfde
- `buildHeaders()` zonder sessionCookie heeft geen `Cookie` header
- `fetchPolite()` op `https://www.werkenindekempen.nl/sitemap-wik-vacancies.xml` returnt 200 + HTML
- Tweede `fetchPolite()` met opgevangen session-cookie stuurt die mee
- Throw `RateLimitError` op gemockte 429-response

---

## Task 3 — Normalizers (zwaar getest)

**Files:**
- Create: `apps/admin/lib/scrapers/werkenindekempen/normalizers.ts`
- Create: `apps/admin/__tests__/scrapers/werkenindekempen/normalizers.test.ts`

**Doel:** Alle transform-logica deterministisch, één plek, fully unit-tested.

- [ ] **Step 1: Implementatie**

```ts
const REGION_MAP: Record<string, string> = {
  'DR': 'Drenthe', 'FL': 'Flevoland', 'FR': 'Friesland',
  'GE': 'Gelderland', 'GR': 'Groningen', 'LI': 'Limburg',
  'NB': 'Noord-Brabant', 'NH': 'Noord-Holland', 'OV': 'Overijssel',
  'UT': 'Utrecht', 'ZE': 'Zeeland', 'ZH': 'Zuid-Holland',
};

export function normalizeCity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  // 's-Hertogenbosch quirk
  if (lower.startsWith("'s-") || lower.startsWith('s-')) {
    return "'s-" + lower.slice(lower.indexOf('-') + 1).replace(/\b\w/g, c => c.toUpperCase());
  }
  return lower.replace(/\b\w/g, c => c.toUpperCase());
}

export function normalizeRegion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const up = raw.toUpperCase().trim();
  return REGION_MAP[up] ?? raw;  // onbekend → laat onveranderd, niet null
}

export function normalizeCountry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const up = raw.toUpperCase().trim();
  if (up === 'NL' || up === 'NLD') return 'Netherlands';
  return raw;
}

export function normalizeEmploymentType(raw: string | string[] | undefined): {
  types: string[];
  label: string | null;
} {
  let types: string[] = [];
  if (typeof raw === 'string') {
    try { types = JSON.parse(raw); }
    catch { types = [raw]; }
  } else if (Array.isArray(raw)) {
    types = raw;
  }
  types = types.map(t => t.toUpperCase().trim()).filter(Boolean);
  const hasFull = types.includes('FULL_TIME');
  const hasPart = types.includes('PART_TIME');
  let label: string | null = null;
  if (hasFull && hasPart) label = 'Fulltime/Parttime';
  else if (hasFull) label = 'Fulltime';
  else if (hasPart) label = 'Parttime';
  else if (types.length) label = types.join('/');
  return { types, label };
}

export function parseSalary(baseSalary: any): {
  min: number | null; max: number | null; period: string | null; currency: string; displayLabel: string | null;
} {
  const empty = { min: null, max: null, period: null, currency: 'EUR', displayLabel: null };
  if (!baseSalary?.value) return empty;
  const v = baseSalary.value;
  const currency = baseSalary.currency ?? 'EUR';
  const unit = v.unitText ?? baseSalary.unitText ?? null;

  let min: number | null = null, max: number | null = null;
  if (typeof v.minValue === 'number') { min = v.minValue; max = v.maxValue ?? null; }
  else if (typeof v.value === 'string' && v.value.includes('-')) {
    const [a, b] = v.value.split('-').map((s: string) => parseFloat(s.trim()));
    if (isFinite(a)) min = a;
    if (isFinite(b)) max = b;
  } else if (v.value != null) {
    const n = parseFloat(String(v.value));
    if (isFinite(n)) min = n;
  }

  if (min == null) return empty;
  const fmt = (n: number) => n.toLocaleString('nl-NL', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const periodMap: Record<string, string> = { MONTH: 'per maand', YEAR: 'per jaar', HOUR: 'per uur', WEEK: 'per week' };
  const periodLabel = unit ? periodMap[unit] ?? unit.toLowerCase() : '';
  const displayLabel = max != null
    ? `${fmt(min)} - ${fmt(max)}${periodLabel ? ' ' + periodLabel : ''}`
    : `${fmt(min)}${periodLabel ? ' ' + periodLabel : ''}`;
  return { min, max, period: unit, currency, displayLabel };
}

export function normalizePostalCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, '').toUpperCase();
  if (/^\d{4}[A-Z]{2}$/.test(clean)) return `${clean.slice(0,4)} ${clean.slice(4)}`;
  return raw;  // onverwacht formaat → onveranderd
}

/** Parse ISO-date als Europe/Amsterdam midnight; returnt ISO-string met +02:00/+01:00 offset */
export function parsePublishedAt(isoDate: string): string {
  // 2026-05-12 → 2026-05-12T00:00:00+02:00 (zomertijd) of +01:00 (wintertijd)
  // We laten Postgres de timezone-arithmetic doen door expliciet 'Europe/Amsterdam' te suggereren
  // via een ISO-string met de juiste offset. JS Intl voor offset-bepaling.
  const date = new Date(isoDate.slice(0, 10) + 'T00:00:00Z');  // tentatieve UTC
  const offsetFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam', timeZoneName: 'shortOffset',
  });
  const parts = offsetFmt.formatToParts(date);
  const tzName = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+02:00';
  const m = tzName.match(/GMT([+-]\d+)/);
  const hours = m ? parseInt(m[1], 10) : 2;
  const sign = hours >= 0 ? '+' : '-';
  const hh = String(Math.abs(hours)).padStart(2, '0');
  return `${isoDate.slice(0,10)}T00:00:00${sign}${hh}:00`;
}

/** URL-segment parse: /vacatures/{slug}-{job_id}-{unix_ts}-c{company_id} */
export function parseUrlSegments(url: string): { slug: string; jobId: string; unixTs: number; companyExtId: string } | null {
  const m = url.match(/\/vacatures\/(.+?)-(\d+)-(\d+)-c(\d+)$/);
  if (!m) return null;
  return { slug: m[1], jobId: m[2], unixTs: parseInt(m[3], 10), companyExtId: m[4] };
}
```

- [ ] **Step 2: Tests (15+ cases)**

```ts
import { describe, test, expect } from 'vitest';
import * as N from '@/lib/scrapers/werkenindekempen/normalizers';

describe('normalizeCity', () => {
  test('uppercase → titlecase', () => expect(N.normalizeCity('HELMOND')).toBe('Helmond'));
  test('lowercase → titlecase', () => expect(N.normalizeCity('eindhoven')).toBe('Eindhoven'));
  test("'s-Hertogenbosch", () => expect(N.normalizeCity('s-Hertogenbosch')).toBe("'s-Hertogenbosch"));
  test('null', () => expect(N.normalizeCity(null)).toBe(null));
});

describe('normalizeRegion', () => {
  test('NB → Noord-Brabant', () => expect(N.normalizeRegion('NB')).toBe('Noord-Brabant'));
  test('unknown → passthrough', () => expect(N.normalizeRegion('XX')).toBe('XX'));
});

describe('normalizeEmploymentType', () => {
  test('JSON-string array', () => expect(N.normalizeEmploymentType('["FULL_TIME","PART_TIME"]'))
    .toEqual({ types: ['FULL_TIME','PART_TIME'], label: 'Fulltime/Parttime' }));
  test('plain array', () => expect(N.normalizeEmploymentType(['FULL_TIME']))
    .toEqual({ types: ['FULL_TIME'], label: 'Fulltime' }));
  test('undefined', () => expect(N.normalizeEmploymentType(undefined))
    .toEqual({ types: [], label: null }));
});

describe('parseSalary', () => {
  test('range MONTH', () => {
    const r = N.parseSalary({ currency: 'EUR', value: { value: '2580.00 - 4000.00', unitText: 'MONTH' } });
    expect(r.min).toBe(2580); expect(r.max).toBe(4000); expect(r.period).toBe('MONTH');
  });
  test('single HOUR', () => {
    const r = N.parseSalary({ value: { value: '12.50', unitText: 'HOUR' } });
    expect(r.min).toBe(12.5); expect(r.max).toBe(null);
  });
  test('minValue/maxValue numeric', () => {
    const r = N.parseSalary({ value: { minValue: 3000, maxValue: 4500, unitText: 'MONTH' } });
    expect(r.min).toBe(3000); expect(r.max).toBe(4500);
  });
  test('empty', () => expect(N.parseSalary({}).min).toBe(null));
});

describe('parsePublishedAt', () => {
  test('zomer → +02:00', () => expect(N.parsePublishedAt('2026-07-15')).toContain('+02:00'));
  test('winter → +01:00', () => expect(N.parsePublishedAt('2026-12-15')).toContain('+01:00'));
});

describe('parseUrlSegments', () => {
  test('valid URL', () => {
    const r = N.parseUrlSegments('https://www.werkenindekempen.nl/vacatures/plaatwerker-27265-1778619733-c1913');
    expect(r).toEqual({ slug: 'plaatwerker', jobId: '27265', unixTs: 1778619733, companyExtId: '1913' });
  });
  test('invalid URL', () => expect(N.parseUrlSegments('https://example.com/foo')).toBe(null));
});
```

**Acceptance:**
- `pnpm vitest run apps/admin/__tests__/scrapers/werkenindekempen/normalizers.test.ts` → alle tests groen
- Coverage ≥ 90% op `normalizers.ts`

---

## Task 4 — Sitemap-parser + delisted-detection helpers

**Files:**
- Create: `apps/admin/lib/scrapers/werkenindekempen/sitemap-parser.ts`
- Create: `apps/admin/lib/scrapers/werkenindekempen/delisted.ts`

**Doel:** Sitemap-fetch + fresh-diff + delisted-archivering. Pure functies waar mogelijk.

- [ ] **Step 1: `sitemap-parser.ts`**

```ts
const SITEMAP_URL = 'https://www.werkenindekempen.nl/sitemap-wik-vacancies.xml';
const DETAIL_URL_RE = /^https:\/\/www\.werkenindekempen\.nl\/vacatures\/[a-z0-9-]+-\d+-\d+-c\d+$/;

export interface SitemapEntry { url: string; lastmod: string; }

export function parseSitemap(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const re = /<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (DETAIL_URL_RE.test(m[1])) entries.push({ url: m[1], lastmod: m[2] });
  }
  return entries;
}

/** Return URLs waarvan lastmod > lastSeenInDb (of die niet in DB voorkomen) */
export function diffFresh(
  all: SitemapEntry[],
  lastSeenMap: Map<string, string>  // url → ISO lastmod uit DB
): SitemapEntry[] {
  return all.filter(e => {
    const prev = lastSeenMap.get(e.url);
    return !prev || e.lastmod > prev;
  });
}
```

- [ ] **Step 2: `delisted.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Update last_seen_in_sitemap voor alle URLs die nog in de sitemap staan.
 * Archive vacatures die > 3 dagen niet meer gezien zijn.
 */
export async function refreshSitemapPresence(
  supabase: SupabaseClient,
  sourceId: string,
  currentUrls: string[]
): Promise<{ touched: number; archived: number }> {
  const now = new Date().toISOString();

  // Batch-update last_seen_in_sitemap voor alle current URLs
  // (in chunks van 500 om query-size te beperken)
  let touched = 0;
  for (let i = 0; i < currentUrls.length; i += 500) {
    const chunk = currentUrls.slice(i, i + 500);
    const { error, count } = await supabase
      .from('job_postings')
      .update({ last_seen_in_sitemap: now }, { count: 'exact' })
      .eq('source_id', sourceId)
      .in('url', chunk);
    if (error) throw new Error(`Update last_seen failed: ${error.message}`);
    touched += count ?? 0;
  }

  // Archive: source=wik AND not archived AND last_seen < now - 3 days
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { error: archError, count } = await supabase
    .from('job_postings')
    .update(
      { archived_at: now, archived_reason: 'not_in_sitemap' },
      { count: 'exact' }
    )
    .eq('source_id', sourceId)
    .is('archived_at', null)
    .lt('last_seen_in_sitemap', threeDaysAgo);
  if (archError) throw new Error(`Archive delisted failed: ${archError.message}`);

  return { touched, archived: count ?? 0 };
}
```

**Acceptance:**
- `parseSitemap()` op de echte sitemap-XML returnt ≥ 1.000 entries, alle URLs matchen DETAIL_URL_RE
- `diffFresh()` met lege Map returnt alle entries; met volledige Map returnt 0
- `refreshSitemapPresence()` integration-test (tegen test-DB): 3 URLs gemarkeerd, 1 URL niet in sitemap + last_seen oud → wordt gearchiveerd

---

## Task 5 — Detail-parser (JSON-LD + Zod-validatie)

**Files:**
- Create: `apps/admin/lib/scrapers/werkenindekempen/detail-parser.ts`
- Create: `apps/admin/__tests__/scrapers/werkenindekempen/detail-parser.test.ts`
- Create: `apps/admin/__tests__/scrapers/werkenindekempen/fixtures/{rich,sparse,invalid}.html`

**Doel:** HTML → JobPostingLD via JSON-LD-script-tag. Faalt luid op invalid input.

- [ ] **Step 1: Implementatie**

```ts
import { JobPostingLDSchema, type JobPostingLD } from './types';

const JSON_LD_RE = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

export class JobPostingValidationError extends Error {
  constructor(public url: string, public zodIssues: unknown) {
    super(`Invalid JSON-LD at ${url}`);
  }
}

export function parseDetailHtml(html: string, url: string): JobPostingLD {
  const blocks = Array.from(html.matchAll(JSON_LD_RE));
  let candidate: unknown = null;
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const jp = items.find((x: any) => x?.['@type'] === 'JobPosting');
      if (jp) { candidate = jp; break; }
    } catch { /* skip malformed block */ }
  }
  if (!candidate) {
    throw new JobPostingValidationError(url, 'no JobPosting JSON-LD found');
  }
  const result = JobPostingLDSchema.safeParse(candidate);
  if (!result.success) {
    throw new JobPostingValidationError(url, result.error.issues);
  }
  return result.data;
}

export function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 2: Fixtures**

Executor: gebruik test-script `scripts/test-werkenindekempen.mjs <url>` om 3 sample HTML files op te halen en op te slaan in `__tests__/.../fixtures/`. Selecteer:
- `rich.html` — vacature met volledig adres + baseSalary + alle velden gevuld (bv. Van Laarhoven IT)
- `sparse.html` — alleen verplichte velden (geen salary, geen street_address)
- `invalid.html` — handmatig aanpassen: verwijder `hiringOrganization.name` → moet ValidationError geven

- [ ] **Step 3: Tests**

```ts
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseDetailHtml, JobPostingValidationError } from '@/lib/scrapers/werkenindekempen/detail-parser';

const fix = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8');

test('rich fixture: alle velden gevuld', () => {
  const jp = parseDetailHtml(fix('rich.html'), 'https://example/test');
  expect(jp.title).toBeTruthy();
  expect(jp.hiringOrganization.name).toBeTruthy();
  expect(jp.jobLocation.address.addressLocality).toBeTruthy();
  expect(jp.baseSalary?.value).toBeTruthy();
});

test('sparse: optionele velden missen, geen error', () => {
  const jp = parseDetailHtml(fix('sparse.html'), 'https://example/test');
  expect(jp.baseSalary).toBeUndefined();
});

test('invalid: throws ValidationError', () => {
  expect(() => parseDetailHtml(fix('invalid.html'), 'https://example/x'))
    .toThrow(JobPostingValidationError);
});
```

**Acceptance:**
- 3 fixtures bestaan, geen persoonsgegevens in invalid/sparse
- Tests groen
- Run `parseDetailHtml` op 10 live URLs via test-script → 0 validation failures, anders aanpassen of fixture toevoegen

---

## Task 6 — Mistral AI parser

**Files:**
- Create: `apps/admin/lib/scrapers/werkenindekempen/ai-parser.ts`

**Doel:** Mistral-call met strict JSON-output, regex-double-check, domain-match-check op email.

- [ ] **Step 1: Implementatie**

```ts
import { Mistral } from '@mistralai/mistralai';
import { MistralResultSchema, type MistralResult } from './types';

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });
const MODEL = 'mistral-small-latest';

const SYSTEM_PROMPT = `Je extract gestructureerde data uit Nederlandse vacaturetekst.
Returnt UITSLUITEND geldige JSON volgens dit schema:
{
  "contact": { "first_name": string|null, "last_name": string|null, "email": string|null, "phone": string|null, "title": string|null } | null,
  "working_hours_min": number|null,
  "working_hours_max": number|null,
  "education_level": "MBO"|"HBO"|"WO"|"VMBO"|"HAVO"|"VWO"|"PhD"|"Geen"|"Onbekend"|null,
  "career_level": "Junior"|"Medior"|"Senior"|"Lead"|"Manager"|"Director"|"Stage"|"Onbekend"|null,
  "categories": string[]
}

Regels:
- contact: alleen invullen als een SPECIFIEKE persoon genoemd wordt (naam + functie/rol). Geen generieke "info@" of HR-afdeling.
- email/phone: alleen als ze LETTERLIJK in de tekst staan. Niet gokken.
- phone: Nederlands format. +31 of 0... prefix. Strip spaces/dashes.
- working_hours: integer uren/week. Range "32-40" → min=32, max=40. Enkel "40 uur" → min=40, max=null.
- education_level: hoogste eis. "MBO niveau 3 of 4" → MBO. Onbekend als niets genoemd.
- career_level: leiderschapsniveau, niet jaren ervaring.
- categories: max 3 brede sector-tags zoals "Techniek", "Productie", "Zorg". Lowercase niet, niet specifiek zoals "CNC-draaier".`;

export async function extractFromDescription(
  plainText: string,
  companyDomain: string | null
): Promise<MistralResult> {
  const truncated = plainText.slice(0, 8000);  // safety cap
  let response;
  try {
    response = await client.chat.complete({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: truncated },
      ],
      responseFormat: { type: 'json_object' },
      temperature: 0.1,
    });
  } catch (err) {
    // Mistral down → return empty result, scraper continueert
    console.error('Mistral call failed:', err);
    return emptyMistralResult();
  }

  const raw = response.choices?.[0]?.message?.content;
  if (typeof raw !== 'string') return emptyMistralResult();

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return emptyMistralResult(); }

  const result = MistralResultSchema.safeParse(parsed);
  if (!result.success) {
    console.warn('Mistral output failed Zod-validation:', result.error.issues);
    return emptyMistralResult();
  }

  // Double-check + cleanup
  let mr = result.data;
  if (mr.contact) {
    // Email regex double-check
    if (mr.contact.email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(mr.contact.email)) {
      mr.contact.email = null;
    }
    // Phone regex double-check
    if (mr.contact.phone) {
      const cleaned = mr.contact.phone.replace(/[\s\-()]/g, '');
      if (!/^(\+31|0)\d{8,10}$/.test(cleaned)) mr.contact.phone = null;
      else mr.contact.phone = cleaned;
    }
    // Domain-match check op email
    if (mr.contact.email && companyDomain) {
      const emailDomain = mr.contact.email.split('@')[1]?.toLowerCase() ?? '';
      const cleanCompanyDomain = companyDomain.replace(/^https?:\/\/(www\.)?/, '').split('/')[0].toLowerCase();
      // Acceptabel: exact match of subdomain match
      if (emailDomain !== cleanCompanyDomain && !emailDomain.endsWith('.' + cleanCompanyDomain)) {
        // Flag voor lage confidence; we houden email maar verlagen priority elders
        // (geen null — kan legitiem extern recruiter-domein zijn)
      }
    }
    // Empty contact (alleen first_name null) → contact zelf null
    const c = mr.contact;
    if (!c.first_name && !c.last_name && !c.email && !c.phone && !c.title) {
      mr = { ...mr, contact: null };
    }
  }
  return mr;
}

function emptyMistralResult(): MistralResult {
  return {
    contact: null,
    working_hours_min: null,
    working_hours_max: null,
    education_level: null,
    career_level: null,
    categories: [],
  };
}
```

**Acceptance:**
- Mistral-call op een echte description met contact-info in de tekst → returnt contact met email + phone
- Description zonder contact → contact = null
- Generic "info@bedrijf.nl" zonder personspecifieke context → wordt door system-prompt afgewezen of door domain-check verlaagd
- Bij Mistral API-failure → returnt empty result, geen throw

---

## Task 7 — Dedup (3-laag)

**Files:**
- Create: `apps/admin/lib/scrapers/werkenindekempen/dedup.ts`
- Create: `apps/admin/__tests__/scrapers/werkenindekempen/dedup.test.ts`

**Doel:** Drie-laagse company-matching met fallback naar create. Backfill `werkenindekempen_id` op match-via-laag-2-of-3.

- [ ] **Step 1: Implementatie**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateNormalizedName } from '@/lib/scrapers/shared/utils';

export interface CompanyInput {
  werkenindekempen_id: string;        // 'c1913'
  name: string;
  website: string | null;
  logo_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  street_address: string | null;
  postal_code: string | null;
  location: string | null;
}

export interface DedupResult {
  id: string;
  matchedLayer: 'werkenindekempen_id' | 'normalized_name' | 'hoofddomein' | 'new';
  conflict?: string;
}

function extractHoofddomein(website: string | null): string | null {
  if (!website) return null;
  try {
    const url = new URL(website);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch { return null; }
}

export async function findOrCreateCompanyThreeLayer(
  supabase: SupabaseClient,
  input: CompanyInput,
  sourceId: string
): Promise<DedupResult> {
  const normalized = generateNormalizedName(input.name);
  const hoofddomein = extractHoofddomein(input.website);

  // LAAG 1: werkenindekempen_id
  const { data: l1 } = await supabase.from('companies')
    .select('id').eq('werkenindekempen_id', input.werkenindekempen_id)
    .maybeSingle();
  if (l1?.id) return { id: l1.id, matchedLayer: 'werkenindekempen_id' };

  // LAAG 2: normalized_name
  const { data: l2 } = await supabase.from('companies')
    .select('id, werkenindekempen_id').eq('normalized_name', normalized).maybeSingle();
  if (l2?.id) {
    if (!l2.werkenindekempen_id) {
      // Backfill — kan conflict geven als andere rij dezelfde werkenindekempen_id heeft
      const { error } = await supabase.from('companies')
        .update({ werkenindekempen_id: input.werkenindekempen_id })
        .eq('id', l2.id);
      if (error) return { id: l2.id, matchedLayer: 'normalized_name', conflict: error.message };
    }
    return { id: l2.id, matchedLayer: 'normalized_name' };
  }

  // LAAG 3: hoofddomein
  if (hoofddomein) {
    const { data: l3 } = await supabase.from('companies')
      .select('id, werkenindekempen_id').eq('hoofddomein', hoofddomein).maybeSingle();
    if (l3?.id) {
      if (!l3.werkenindekempen_id) {
        const { error } = await supabase.from('companies')
          .update({ werkenindekempen_id: input.werkenindekempen_id })
          .eq('id', l3.id);
        if (error) return { id: l3.id, matchedLayer: 'hoofddomein', conflict: error.message };
      }
      return { id: l3.id, matchedLayer: 'hoofddomein' };
    }
  }

  // LAAG 4: CREATE
  const { data: created, error } = await supabase.from('companies').insert({
    name: input.name,
    normalized_name: normalized,
    werkenindekempen_id: input.werkenindekempen_id,
    website: input.website,
    logo_url: input.logo_url,
    logo_source: input.logo_url ? 'werkenindekempen' : null,
    city: input.city,
    state: input.state,
    country: input.country,
    street_address: input.street_address,
    postal_code: input.postal_code,
    location: input.location,
    hoofddomein,
    source: sourceId,
    status: 'Prospect',
    enrichment_status: 'pending',
    qualification_status: 'pending',
  }).select('id').single();

  if (error || !created) throw new Error(`Create company failed: ${error?.message}`);
  return { id: created.id, matchedLayer: 'new' };
}
```

- [ ] **Step 2: Tests (4 scenarios)**

Integration-style via test-DB of mocked Supabase client:
1. Bestaande rij met `werkenindekempen_id='c100'` → layer 1 hit
2. Bestaande rij met `normalized_name='aae'`, geen wik_id → layer 2 hit + backfill
3. Bestaande rij met `hoofddomein='vanlaarhovenict.nl'` → layer 3 hit + backfill
4. Geen match → create + nieuwe rij heeft wik_id

**Acceptance:**
- Alle 4 scenarios groen
- Bij conflict op backfill (Layer 2/3): `DedupResult.conflict` wordt gezet, geen throw

---

## Task 8 — Main orchestrator (scraper.ts)

**Files:**
- Create: `apps/admin/lib/scrapers/werkenindekempen/scraper.ts`

**Doel:** Sitemap → fresh-diff → per URL: fetchPolite + parseDetail + Mistral + dedup + upsert. Tracks alle stats, respecteert timeout.

- [ ] **Step 1: Implementatie (skeleton, executor vult details)**

```ts
import { createSupabaseClient, getOrCreateJobSource, generateContentHash } from '@/lib/scrapers/shared';
import { fetchPolite, newSession, humanDelay, RateLimitError } from './fetch-polite';
import { parseSitemap, diffFresh } from './sitemap-parser';
import { parseDetailHtml, stripHtml, JobPostingValidationError } from './detail-parser';
import { extractFromDescription } from './ai-parser';
import { findOrCreateCompanyThreeLayer } from './dedup';
import { refreshSitemapPresence } from './delisted';
import * as N from './normalizers';
import { EMPTY_STATS, DEFAULT_CONFIG, type ScraperConfig, type ScraperStats } from './types';

const SITEMAP_URL = 'https://www.werkenindekempen.nl/sitemap-wik-vacancies.xml';
const JOB_SOURCE_NAME = 'Werken in de Kempen';

export async function scrapeWerkenindekempen(
  cfgPartial: Partial<ScraperConfig> = {}
): Promise<ScraperStats & { earlyExitReason?: string }> {
  const cfg: ScraperConfig = { ...DEFAULT_CONFIG, ...cfgPartial };
  const stats: ScraperStats = { ...EMPTY_STATS };
  const startTime = Date.now();
  const supabase = createSupabaseClient();
  const sourceId = await getOrCreateJobSource(supabase, JOB_SOURCE_NAME);
  const session = newSession();

  // 1) Fetch sitemap
  const sitemapRes = await fetchPolite(SITEMAP_URL, session, { isFirstRequest: true });
  if (!sitemapRes.html) throw new Error('Empty sitemap response');
  const allEntries = parseSitemap(sitemapRes.html);
  stats.sitemap_total = allEntries.length;

  // 2) Diff tegen DB (last_seen_in_sitemap is een proxy voor lastmod)
  // We trekken laatste lastmod per URL uit een aparte lookup
  // (eenvoudige aanpak: pak alle source=wik URLs met last_seen + url uit DB)
  const { data: dbUrls } = await supabase.from('job_postings')
    .select('url, last_seen_in_sitemap')
    .eq('source_id', sourceId)
    .not('url', 'is', null);
  const lastSeenMap = new Map<string, string>(
    (dbUrls ?? []).map((r: any) => [r.url, r.last_seen_in_sitemap ?? ''])
  );
  const fresh = diffFresh(allEntries, lastSeenMap).slice(0, cfg.maxUrlsPerRun);
  stats.fresh = fresh.length;

  // 3) Process elke fresh URL
  for (const entry of fresh) {
    if (Date.now() - startTime > cfg.timeoutMs - 20_000) {
      return { ...stats, earlyExitReason: 'timeout', duration_ms: Date.now() - startTime };
    }

    try {
      await humanDelay(cfg.delayMinMs, cfg.delayMaxMs, cfg.readTimeBurstChance);
      const res = await fetchPolite(entry.url, session);
      if (!res.html) { stats.skipped++; continue; }

      const jp = parseDetailHtml(res.html, entry.url);
      const seg = N.parseUrlSegments(entry.url);
      if (!seg) { stats.validation_failures++; continue; }

      const city = N.normalizeCity(jp.jobLocation.address.addressLocality);
      const region = N.normalizeRegion(jp.jobLocation.address.addressRegion);
      const country = N.normalizeCountry(jp.jobLocation.address.addressCountry);
      const employment = N.normalizeEmploymentType(jp.employmentType);
      const salary = N.parseSalary(jp.baseSalary);
      const postalCode = N.normalizePostalCode(jp.jobLocation.address.postalCode);
      const publishedAt = N.parsePublishedAt(jp.datePosted);

      // 3a) Mistral op description (skip if cfg.skipAI)
      const plain = stripHtml(jp.description ?? '');
      const ai = cfg.skipAI
        ? { contact: null, working_hours_min: null, working_hours_max: null, education_level: null, career_level: null, categories: [] }
        : (stats.mistral_calls++, await extractFromDescription(plain, jp.hiringOrganization.sameAs ?? null));

      // 3b) Company dedup
      if (cfg.dryRun) { stats.new++; continue; }
      const dedup = await findOrCreateCompanyThreeLayer(supabase, {
        werkenindekempen_id: `c${seg.companyExtId}`,
        name: jp.hiringOrganization.name,
        website: jp.hiringOrganization.sameAs ?? null,
        logo_url: jp.hiringOrganization.logo ?? null,
        city,
        state: region,
        country,
        street_address: jp.jobLocation.address.streetAddress ?? null,
        postal_code: postalCode,
        location: city,
      }, sourceId);
      if (dedup.matchedLayer === 'new') stats.companies_created++;
      else stats.companies_matched++;

      // 3c) Job posting upsert
      const contentHash = generateContentHash(jp.title, jp.hiringOrganization.name, city ?? '', entry.url);
      const { data: existing } = await supabase.from('job_postings')
        .select('id, content_hash').eq('external_vacancy_id', seg.jobId).eq('source_id', sourceId).maybeSingle();

      if (existing) {
        if (existing.content_hash !== contentHash) {
          await supabase.from('job_postings').update({
            // alle nieuwe velden
            title: jp.title, description: jp.description, salary: salary.displayLabel,
            employment: employment.label, job_type: employment.types,
            content_hash: contentHash, last_seen_in_sitemap: new Date().toISOString(),
            education_level: ai.education_level, career_level: ai.career_level,
            working_hours_min: ai.working_hours_min, working_hours_max: ai.working_hours_max,
            categories: ai.categories.join(', ') || null,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id);
          stats.updated++;
        } else {
          stats.skipped++;
        }
      } else {
        await supabase.from('job_postings').insert({
          title: jp.title,
          company_id: dedup.id,
          source_id: sourceId,
          external_vacancy_id: seg.jobId,
          url: entry.url,
          description: jp.description,
          city, state: region, country, zipcode: postalCode,
          street: jp.jobLocation.address.streetAddress ?? null,
          job_type: employment.types,
          employment: employment.label,
          salary: salary.displayLabel,
          published_at: publishedAt,
          created_at: publishedAt,
          end_date: jp.validThrough ? jp.validThrough.slice(0,10) : null,
          scraped_at: new Date().toISOString(),
          content_hash: contentHash,
          last_seen_in_sitemap: new Date().toISOString(),
          status: 'new',
          review_status: 'pending',
          education_level: ai.education_level,
          career_level: ai.career_level,
          working_hours_min: ai.working_hours_min,
          working_hours_max: ai.working_hours_max,
          categories: ai.categories.join(', ') || null,
        });
        stats.new++;

        // 3d) Contact (alleen bij echte hit)
        if (ai.contact && (ai.contact.email || ai.contact.phone)) {
          await supabase.from('contacts').insert({
            company_id: dedup.id,
            first_name: ai.contact.first_name,
            last_name: ai.contact.last_name,
            name: [ai.contact.first_name, ai.contact.last_name].filter(Boolean).join(' ') || null,
            email: ai.contact.email,
            phone: ai.contact.phone,
            title: ai.contact.title,
            source: 'werkenindekempen.nl',
            status: 'new',
            qualification_status: 'pending',
            contact_priority: 5,
          });
          stats.contacts_created++;
        }
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        return { ...stats, earlyExitReason: 'rate_limited', duration_ms: Date.now() - startTime };
      }
      if (err instanceof JobPostingValidationError) {
        stats.validation_failures++;
        continue;
      }
      stats.errors++;
      console.error(`Error processing ${entry.url}:`, err);
    }
  }

  // 4) Delisted-detection
  if (!cfg.dryRun) {
    const allUrls = allEntries.map(e => e.url);
    const { archived } = await refreshSitemapPresence(supabase, sourceId, allUrls);
    stats.delisted = archived;
  }

  stats.duration_ms = Date.now() - startTime;
  return stats;
}
```

**Acceptance:**
- Op een `dryRun: true, maxUrlsPerRun: 5` invoke → stats getoond, 0 DB-writes
- Op echte run met `maxUrlsPerRun: 3, skipAI: true` → 3 nieuwe vacatures in DB met juiste `source_id`, `external_vacancy_id`, `last_seen_in_sitemap`
- Bij RateLimitError simulatie → early exit met `earlyExitReason: 'rate_limited'`
- Geen orphan rows (geen `job_posting.company_id` zonder bestaande `companies.id`)

---

## Task 9 — API route + monitoring + registry

**Files:**
- Create: `apps/admin/app/api/scrapers/werkenindekempen/route.ts`
- Create: `apps/admin/app/api/scrapers/werkenindekempen/backfill/route.ts`
- Wijzig: `apps/admin/lib/automations-registry.ts`
- Wijzig: `apps/admin/vercel.json`

**Doel:** Cron-route + manual route + registry-entry zodat /automatiseringen UI werkt.

- [ ] **Step 1: `route.ts` (cron + manual)**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { withCronMonitoring } from '@/lib/cron-monitor';
import { scrapeWerkenindekempen } from '@/lib/scrapers/werkenindekempen/scraper';

export const runtime = 'nodejs';
export const preferredRegion = ['fra1', 'ams1'];
export const maxDuration = 300;

const DEFAULT_CONFIG = {
  maxUrlsPerRun: 200,
  delayMinMs: 2000,
  delayMaxMs: 5000,
  readTimeBurstChance: 0.15,
  timeoutMs: 280_000,
  skipAI: false,
  dryRun: false,
};

async function runWithConfig(cfg: typeof DEFAULT_CONFIG) {
  const startTime = Date.now();
  try {
    // Jitter aan begin: 0-30 min random delay
    if (cfg.maxUrlsPerRun > 0) {
      await new Promise(r => setTimeout(r, Math.random() * 30 * 60 * 1000));
    }
    const stats = await scrapeWerkenindekempen(cfg);
    return NextResponse.json({
      success: true,
      message: 'Werkenindekempen scraping completed',
      stats,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

async function getHandler(_req: NextRequest) { return runWithConfig(DEFAULT_CONFIG); }
async function postHandler(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return runWithConfig({ ...DEFAULT_CONFIG, ...body });
}

const monitored = withCronMonitoring('werkenindekempen-scraper', '/api/scrapers/werkenindekempen');
export const GET = monitored(getHandler);
export const POST = monitored(postHandler);
```

- [ ] **Step 2: `backfill/route.ts`** (geen registry, geen cron — alleen manual veiligheidsnet)

Variant met `maxUrlsPerRun: 200` default, geen jitter, POST-only.

- [ ] **Step 3: Registry-entry**

```ts
{
  id: 'werkenindekempen-scraper',
  displayName: 'Werkenindekempen scraper',
  description: 'Vacatures scrapen van werkenindekempen.nl (sitemap-driven, JSON-LD + Mistral)',
  category: 'scraper',
  schedule: '30 5 * * *',
  expectedIntervalMs: 24 * HOUR,
  handlerPath: '/api/scrapers/werkenindekempen',
  displayStats: [
    { key: 'sitemap_total', label: 'in sitemap' },
    { key: 'fresh', label: 'fresh' },
    { key: 'new', label: 'nieuw' },
    { key: 'updated', label: 'updates' },
    { key: 'skipped', label: 'overgeslagen' },
    { key: 'errors', label: 'errors' },
    { key: 'companies_created', label: 'companies +' },
    { key: 'companies_matched', label: 'companies dedup' },
    { key: 'contacts_created', label: 'contacts +' },
    { key: 'mistral_calls', label: 'mistral' },
    { key: 'delisted', label: 'gearchiveerd' },
    { key: 'validation_failures', label: 'invalid JSON-LD' },
  ],
  primaryStatKey: 'new',
},
```

- [ ] **Step 4: `vercel.json`**

```json
"crons": [
  ...
  { "path": "/api/scrapers/werkenindekempen", "schedule": "30 5 * * *" }
],
"functions": {
  ...
  "app/api/scrapers/werkenindekempen/route.ts": { "maxDuration": 300 },
  "app/api/scrapers/werkenindekempen/backfill/route.ts": { "maxDuration": 300 }
}
```

- [ ] **Step 5: Registry consistency-test**

```ts
import { AUTOMATIONS } from '@/lib/automations-registry';
import { EMPTY_STATS } from '@/lib/scrapers/werkenindekempen/types';

test('registry stats-keys exist in scraper output', () => {
  const reg = AUTOMATIONS.find(a => a.id === 'werkenindekempen-scraper')!;
  const producedKeys = Object.keys(EMPTY_STATS);
  for (const ds of reg.displayStats) {
    expect(producedKeys).toContain(ds.key);
  }
});
```

**Acceptance:**
- Registry-entry compileert
- `vercel.json` valideert (no schema-errors)
- Consistency-test groen
- Manual POST naar `/api/scrapers/werkenindekempen` met `{dryRun: true, maxUrlsPerRun: 5, skipAI: true}` returnt 200 + stats

---

## Task 10 — Live dry-run + initial echte run

**Doel:** Eindvalidatie tegen prod-DB vóór cron actief gemaakt wordt.

- [ ] **Step 1: Dry-run 20 URLs**

`POST /api/scrapers/werkenindekempen` met body `{ dryRun: true, maxUrlsPerRun: 20, skipAI: false }` (via curl of admin UI). Verifieer:
- `stats.validation_failures === 0` (anders fixture toevoegen)
- `stats.mistral_calls === 20`
- Geen DB-writes (check `select count from job_postings where source_id = wik` → ongewijzigd)

- [ ] **Step 2: Echte mini-run 5 URLs**

`POST` met `{ maxUrlsPerRun: 5 }`. Verifieer:
- 5 nieuwe rijen in `job_postings`, alle met `source_id = wik`, `last_seen_in_sitemap = now()`
- `companies` heeft potentieel 5 nieuwe rijen of matches op bestaande
- `cron_job_logs` heeft 1 nieuwe rij met `business_stats` jsonb
- `/automatiseringen` UI toont nieuwe rij voor "Werkenindekempen scraper" met juiste cijfers

- [ ] **Step 3: Volledige eerste run via "Nu uitvoeren"**

Trigger via `/automatiseringen/werkenindekempen-scraper`. Verwacht: 200 nieuwe vacatures, ~5 min run-time, geen errors.

- [ ] **Step 4: Cron activeren**

`vercel.json` change deployen → cron staat live → volgende 07:30 NL voert eerste auto-run uit.

- [ ] **Step 5: 7 dagen monitoring**

Daily checken via /automatiseringen of:
- Steady-state: `fresh` zakt van ~200 naar ~20-30
- Geen errors / rate-limits
- `delisted` stabiel < 5/dag
- `mistral_calls` blijft binnen budget

**Acceptance:**
- 7 dagen lang dagelijkse successful run zonder handmatige interventie
- ~1.099 vacatures in DB met `source_id = wik`
- Geen Slack-alerts van watchdog

---

## Task 11 — Documentatie + CLAUDE.md

**Files:**
- Wijzig: `CLAUDE.md`

**Doel:** Volgende sessies + andere agents weten dat de scraper bestaat.

- [ ] Update `## Scrapers` sectie met "### Werkenindekempen.nl" block, identiek format als Debanensite (Source/Method/AI/Features/API/Config).
- [ ] Update `### Active Vercel Cron Jobs` tabel met regel `Werkenindekempen Scraper | 30 5 * * * | 07:30 | /api/scrapers/werkenindekempen`.
- [ ] Update `## Database Key Tables` met `companies.werkenindekempen_id` en `job_postings.last_seen_in_sitemap` mention.

---

## Verification checklist (vóór merge naar main)

- [ ] Migration toegepast op prod, `get_advisors` clean
- [ ] Alle unit tests groen (`pnpm vitest run apps/admin/__tests__/scrapers/werkenindekempen/`)
- [ ] `tsc --noEmit` groen
- [ ] Dry-run op 20 URLs: 0 validation failures, 0 errors
- [ ] Echte mini-run op 5 URLs: alle records correct (manual SQL-check)
- [ ] /automatiseringen UI toont nieuwe scraper met correct stats
- [ ] "Nu uitvoeren"-knop werkt
- [ ] Watchdog detecteert de nieuwe automation
- [ ] CLAUDE.md geüpdated
- [ ] Cron actief in `vercel.json`
- [ ] Geen identificeerbare strings (LokaleBanen/KempenseBanen/contact-emails) in scraper-headers of HTTP-requests

---

## Risico's & mitigaties (samenvatting uit voorgesprek)

| # | Risico | Mitigatie | Status |
|---|--------|-----------|--------|
| R1 | Initial run timeout (1.099 URLs > 300s) | `maxUrlsPerRun: 200` + 5-6 dagen rollup naar steady state | In plan via DEFAULT_CONFIG |
| R2 | Platform-mapping | Geen nieuw platform, `platform_id=null` bij insert, geocoding-cron mapt | In plan via Pre-flight check |
| R3 | Delisted-detectie | `last_seen_in_sitemap` + 3 dagen grace | In plan via Task 4 + 0 |
| R4 | Mistral hallucinated emails | Regex + domain-match-check | In plan via Task 6 |
| R5 | Microsite-URL als `sameAs` | Acceptabel, WebsiteService refined later | Geaccepteerd risico |
| R6 | Untested edge-cases | Live dry-run op 20 URLs vóór go-live | In plan via Task 10 |
| R7 | Site-breakage = stille rot | Zod-validation fail loud, validation_failures stat, Slack alert | In plan via Task 5 |
| R8 | Dedup-collision (2 bestaande companies) | `DedupResult.conflict` field, geen throw, manual merge later | In plan via Task 7 |
| R13 | Database-recht bij doorpublicatie | Out-of-scope nu; bij Public Sites: paraphrase + filter regio | Niet in deze fase |
| R-detect | Concurrent-context detectie | Chrome-fingerprint, EU-region, jitter, no identifiable strings | In plan via Task 2 + 9 |

---

## Out of scope (volgende fases)

- WebsiteService-enrichment voor company phone/contact uit homepage
- Apollo-enrichment van nieuwe companies
- Pipedrive-sync van Werken-in-de-Kempen leads (volgt regulier sales-lead flow)
- Display van deze vacatures op publieke KempenseBanen/HelmondseBanen/EindhovenseBanen jobboards (Public Sites project, met paraphrasing)
- Aanpak voor andere regionale jobboards (Werken in Brabant, Werken in Limburg, etc.) — sjabloon hergebruiken
