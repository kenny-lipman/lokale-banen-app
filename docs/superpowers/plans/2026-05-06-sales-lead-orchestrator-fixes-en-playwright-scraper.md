# Sales-lead orchestrator: race-fix, UI-spinner & Playwright scraper

**Datum**: 2026-05-06
**Trigger**: hbm-machines.com run liet zien dat (1) KvK-state werd overschreven door race in `setSourceFull`, (2) UI-spinners stonden stil bij `pending`/undefined, (3) website-scraper kwam niet door 403/JS-shells.

## Scope
- **B**: atomic jsonb_set rpc voor enrichments + audit_log
- **C**: spinner ook voor `pending`/undefined tijdens `enriching`
- **D**: sitemap-driven URL-discovery + Playwright-fetcher (Tier 1 ssrf-fetch → Tier 2 Playwright + stealth)

## Out of scope
- Residential proxy (niveau-4) — uitgesteld tot na meting van Tier-2 hit-rate
- ScrapFly/captcha-solver — niet nodig zonder residential
- HBM-class anti-bot sites — accepteren `homepage_blocked` voor nu

## Acceptance criteria
- 4 parallel rpc-calls naar verschillende sources verliezen geen schrijfwerk meer (50/50 succes in stress-test)
- Tijdens `status='enriching'` toont elk source-card een draaiende spinner, ook vóór eerste `running`-write
- Website-scraper extraheert content via sitemap-discovery + Playwright voor JS-rendered sites
- HBM blijft falen, maar met heldere `homepage_blocked` reason i.p.v. timeout

---

## Fase B — Atomic enrichment writes (~1u)

### B-1. Postgres rpc-functions
Apply migration `atomic_enrichment_writes`:

```sql
CREATE OR REPLACE FUNCTION sales_lead_runs_set_source(
  p_run_id uuid,
  p_source text,
  p_value jsonb
) RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE sales_lead_runs
  SET enrichments = jsonb_set(COALESCE(enrichments, '{}'::jsonb), ARRAY[p_source], p_value),
      updated_at = now()
  WHERE id = p_run_id;
$$;

REVOKE ALL ON FUNCTION sales_lead_runs_set_source(uuid, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION sales_lead_runs_set_source(uuid, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION sales_lead_runs_append_audit(
  p_run_id uuid,
  p_entry jsonb
) RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE sales_lead_runs
  SET audit_log = COALESCE(audit_log, '[]'::jsonb) || p_entry,
      updated_at = now()
  WHERE id = p_run_id;
$$;

REVOKE ALL ON FUNCTION sales_lead_runs_append_audit(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION sales_lead_runs_append_audit(uuid, jsonb) TO service_role;
```

→ **Verify**: `mcp__supabase__get_advisors` clean; beide functions in catalog; `service_role` heeft EXECUTE.

### B-2. Service-aanpassing
File: `apps/admin/lib/services/sales-leads/enrichment-orchestrator.service.ts`

- `markRunning(runId, source, startedAt)` → `setSourceFull` callsite vervangen door `supabase.rpc('sales_lead_runs_set_source', { p_run_id: runId, p_source: source, p_value: { status: 'running', started_at: startedAt } })`.
- `completeSource(runId, source, { parsed, raw, startedAt })` → idem; `started_at` komt nu via param i.p.v. uit DB-merge.
- `failSource(runId, source, err, status, startedAt)` → idem.
- `runKvk` / `runMaps` / `runApollo` / `runWebsite` → `const startedAt = new Date().toISOString()` lokaal vóór `markRunning`, doorgeven aan complete/fail.
- `setSourceParsed` (Fase B/C) → ook via rpc, neemt huidige `PerSourceEnrichment` als argument (caller heeft het al in memory).
- `appendAudit` → `supabase.rpc('sales_lead_runs_append_audit', { p_run_id: runId, p_entry: entry })`.
- `getSource` (private helper) verwijderen — niemand roept hem nog aan.
- Comment-block 388-398 weghalen, vervangen door 1 regel: `// Atomic write via sales_lead_runs_set_source rpc — geen lost-update race meer.`

→ **Verify**: `pnpm typecheck` clean op `apps/admin`. Geen `getSource` referenties meer.

### B-3. Concurrency-test
Nieuwe file: `apps/admin/__tests__/sales-leads/atomic-writes.test.ts`

```ts
// Pseudocode
test('50× 4-parallel set_source verliest geen writes', async () => {
  for (let i = 0; i < 50; i++) {
    const runId = await insertEmptyRun()
    await Promise.all([
      rpc('sales_lead_runs_set_source', { run: runId, source: 'kvk',         value: { status: 'completed' } }),
      rpc('sales_lead_runs_set_source', { run: runId, source: 'google_maps', value: { status: 'completed' } }),
      rpc('sales_lead_runs_set_source', { run: runId, source: 'apollo',      value: { status: 'completed' } }),
      rpc('sales_lead_runs_set_source', { run: runId, source: 'website',     value: { status: 'completed' } }),
    ])
    const enr = await selectEnrichments(runId)
    expect(Object.keys(enr).sort()).toEqual(['apollo','google_maps','kvk','website'])
  }
})
```

→ **Verify**: `pnpm test atomic-writes` → 50/50 groen.

### B-4. Types regeneren + smoke
- `mcp__supabase__generate_typescript_types` → check `Database['public']['Functions']` heeft beide rpc's.
- Staging smoke: nieuwe enrichment op willekeurig domein → na orchestrator-eind heeft `enrichments` alle 4 keys met terminale status.

→ **Verify**: types-file gecommit; staging-run laat alle 4 sources zien.

---

## Fase C — UI loading-state (~15min)

### C-1. Grid-component
File: `apps/admin/components/sales/lead-source-status-grid.tsx`

- Type `Props` uitbreiden: `runStatus: RunStatus`.
- `STATUS_ICONS.pending` aanpassen naar `{ Icon: Loader2, color: 'text-orange-300 animate-spin' }` — geldt nu alleen wanneer `runStatus === 'enriching'`.
- Render-functie: voor `enrichments[src] === undefined` of `status === 'pending'`:
  - bij `runStatus === 'enriching'`: spin, oranje-light
  - bij overige run-statussen (review/failed/syncing/completed/duplicate): statisch grijs
- `summarize()`: 'wachten…' alleen tijdens `enriching`; bij andere statussen 'overgeslagen' of '—'.

### C-2. Page integreren
File: `apps/admin/app/sales/lead-verrijking/[run_id]/page.tsx:248`

```tsx
<LeadSourceStatusGrid enrichments={run.enrichments ?? {}} runStatus={run.status} />
```

### C-3. Verificatie
- Lokaal: nieuwe run starten via UI → spinners draaien direct na page-load, ook vóór eerste `running`-write.
- Open bestaande completed-run → spinners stoppen, terminale icons.
- Open bestaande failed-run (hbm-machines) → kruisjes/grijs niet draaiend.

→ **Verify**: visuele check op 3 statussen.

---

## Fase D — Sitemap-discovery + Playwright-fetcher (~12u)

### D-1. Dependencies & Vercel-config (~30min)
- `pnpm add @sparticuz/chromium playwright-core playwright-extra` in `apps/admin`.
- `playwright-extra-plugin-stealth` is via npm — let op exacte naam: `puppeteer-extra-plugin-stealth` werkt met Playwright via `playwright-extra` adapter.
- `apps/admin/vercel.json` (of `vercel.ts` indien al gemigreerd): voor route `/api/sales-leads/create` memory naar `1024`. Test-route `/api/sales-leads/test/website` idem.
- `next.config.js`: `serverExternalPackages: ['@sparticuz/chromium', 'playwright-core']` zodat ze niet in Webpack-bundle landen.

→ **Verify**:
- `pnpm install` succes
- `pnpm build` succes — bundle-size voor `/api/sales-leads/create` < 250MB unzipped (`du -sh .next/server`)

### D-2. Sitemap-discovery (~3u)
Nieuwe file: `apps/admin/lib/services/sales-leads/website/sitemap-discovery.ts`

Functions:
```ts
export type DiscoveredUrl = {
  url: string
  role: 'home' | 'contact' | 'about' | 'team' | 'careers' | 'company' | 'other'
  priority: number  // 0 = highest
}

export function parseRobotsForSitemaps(robotsText: string): string[]
export function parseSitemapXml(xml: string): { urls: string[]; childSitemaps: string[] }
export function scoreUrl(url: string): { role: DiscoveredUrl['role']; priority: number }
export async function discoverUrls(inputUrl: string): Promise<DiscoveredUrl[]>
```

Logica `discoverUrls`:
1. `ssrfFetch(${origin}/robots.txt)` → `parseRobotsForSitemaps`
2. Voor elk gevonden sitemap-URL: fetch + `parseSitemapXml`. Recursief voor child-sitemaps tot diepte 2.
3. Fallback: `${origin}/sitemap.xml` en `${origin}/sitemap_index.xml` direct proberen.
4. Soft-cap op 500 unique URLs.
5. Score elke URL → sorteer op priority asc → return top 12.

Keyword-mapping (regex match in path, NL+EN):
- `contact` → role=contact, priority=0
- `over[-_]?ons|about[-_]?us|about` → role=about, priority=1
- `team|medewerkers|people` → role=team, priority=2
- `werken[-_]?bij|carrieres?|careers|jobs|vacatures` → role=careers, priority=3
- `bedrijf|company|organisatie` → role=company, priority=4
- alles anders → role=other, priority=10

Tests: `apps/admin/__tests__/sales-leads/sitemap-discovery.test.ts` met fixtures voor:
- Plain sitemap.xml (5 URLs)
- Sitemap-index met 2 children
- robots.txt + 1 sitemap-line
- Site zonder sitemap → empty array

→ **Verify**: `pnpm test sitemap-discovery` groen; scoring kiest contact/about boven /products/X.

### D-3. Playwright-fetcher (~4u)
Nieuwe file: `apps/admin/lib/services/sales-leads/website/playwright-fetcher.ts`

```ts
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import chromiumBin from '@sparticuz/chromium'
import type { Browser } from 'playwright-core'

const UA_POOL = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
]

export class PlaywrightFetcher {
  private browser: Browser | null = null

  async init(): Promise<void> {
    if (this.browser) return
    chromium.use(StealthPlugin())
    this.browser = await chromium.launch({
      args: chromiumBin.args,
      executablePath: await chromiumBin.executablePath(),
      headless: true,
    }) as unknown as Browser
  }

  async fetchPage(url: string): Promise<{ html: string; finalUrl: string; status: number }> {
    if (!this.browser) throw new Error('PlaywrightFetcher.init() niet aangeroepen')
    const ctx = await this.browser.newContext({
      userAgent: UA_POOL[Math.floor(Math.random() * UA_POOL.length)],
      viewport: { width: 1280, height: 800 },
      locale: 'nl-NL',
      timezoneId: 'Europe/Amsterdam',
    })
    await ctx.route('**/*', (route) => {
      const t = route.request().resourceType()
      if (t === 'image' || t === 'media' || t === 'font') return route.abort()
      return route.continue()
    })
    const page = await ctx.newPage()
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      const status = resp?.status() ?? 0
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
      const html = await page.content()
      const finalUrl = page.url()
      return { html, finalUrl, status }
    } finally {
      await ctx.close()
    }
  }

  async dispose(): Promise<void> {
    await this.browser?.close()
    this.browser = null
  }
}
```

Test-script `scripts/test-playwright-fetcher.mjs`:
```bash
node scripts/test-playwright-fetcher.mjs https://wetarget.nl
```
→ Print HTML body-length + first 200 chars.

→ **Verify**:
- Lokaal: script returnt HTML met `<body>` content > 1000 chars op wetarget.nl
- Op Vercel-preview: zelfde route via `/api/sales-leads/test/website` werkt

### D-4. Tiered-fetch + content-heuristieken (~1.5u)
Nieuwe file: `apps/admin/lib/services/sales-leads/website/tiered-fetch.ts`

```ts
export type FetchResult = {
  html: string
  finalUrl: string
  tier: 1 | 2
  status: number
  blocked: boolean  // true = ook tier 2 kwam er niet door
}

export async function tieredFetch(
  url: string,
  playwright: PlaywrightFetcher,
): Promise<FetchResult> {
  // Tier 1
  try {
    const r1 = await ssrfFetch(url)
    if (looksUseful(r1.html, r1.status)) {
      return { html: r1.html, finalUrl: r1.finalUrl, tier: 1, status: r1.status, blocked: false }
    }
  } catch { /* val door */ }

  // Tier 2
  const r2 = await playwright.fetchPage(url)
  return {
    html: r2.html,
    finalUrl: r2.finalUrl,
    tier: 2,
    status: r2.status,
    blocked: r2.status >= 400 || isCloudflareChallenge(r2.html) || r2.html.length < 500,
  }
}

export function looksUseful(html: string, status: number): boolean {
  if (status < 200 || status >= 400) return false
  if (html.length < 500) return false
  if (looksLikeJsShell(html)) return false
  return true
}

export function looksLikeJsShell(html: string): boolean {
  // App-shell heuristic: <body> bevat alleen <div id="root"> / <div id="app"> en geen text
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (!bodyMatch) return false
  const body = bodyMatch[1]
  const stripped = body.replace(/<[^>]+>/g, '').trim()
  return stripped.length < 100 && /<div[^>]+id=["'](root|app|__next)["']/i.test(body)
}

export function isCloudflareChallenge(html: string): boolean {
  return /cloudflare|cf-browser-verification|cf-chl|__cf_chl|just a moment/i.test(html.slice(0, 5000))
}
```

Tests: `apps/admin/__tests__/sales-leads/tiered-fetch.test.ts`
- Fixture: useful HTML → `looksUseful=true`
- Fixture: empty body + `<div id="root">` → `looksLikeJsShell=true`
- Fixture: Cloudflare challenge HTML → `isCloudflareChallenge=true`

→ **Verify**: `pnpm test tiered-fetch` groen.

### D-5. WebsiteService herschrijven (~2u)
File: `apps/admin/lib/services/sales-leads/website.service.ts`

```ts
async crawlAndParse(inputUrl: string, scrapeVacancies: boolean): Promise<NormalizedFields> {
  const playwright = new PlaywrightFetcher()
  try {
    await playwright.init()

    const discovered = await discoverUrls(inputUrl)
    const targets: DiscoveredUrl[] = discovered.length > 0
      ? discovered.slice(0, 6)
      : [{ url: inputUrl, role: 'home', priority: 0 }]

    type Fetched = {
      url: string
      role: DiscoveredUrl['role']
      tier: 1 | 2
      blocked: boolean
      markdown: string
    }
    const fetched: Fetched[] = []
    for (const t of targets) {
      try {
        const r = await tieredFetch(t.url, playwright)
        if (r.blocked) {
          fetched.push({ url: t.url, role: t.role, tier: r.tier, blocked: true, markdown: '' })
          continue
        }
        fetched.push({
          url: r.finalUrl,
          role: t.role,
          tier: r.tier,
          blocked: false,
          markdown: htmlToMarkdown(r.html),
        })
      } catch (e) {
        // individuele URL-fout: log + door
        fetched.push({ url: t.url, role: t.role, tier: 2, blocked: true, markdown: '' })
      }
    }

    const usable = fetched.filter((f) => !f.blocked && f.markdown.length > 200)
    if (usable.length === 0) {
      const allBlocked = fetched.length > 0 && fetched.every((f) => f.blocked)
      throw new WebsiteServiceError(
        allBlocked ? 'homepage_blocked' : 'no_html',
        allBlocked
          ? `Anti-bot blokkeert alle ${fetched.length} pagina's van ${inputUrl}`
          : 'Geen bruikbare content gevonden',
      )
    }

    const parsed = await this.mistral.extractWebsite({
      pages: usable.map((p) => ({ url: p.url, role: p.role, markdown: p.markdown })),
      scrapeVacancies,
    })
    parsed.pages_crawled = usable.map((p) => p.url)
    parsed.source = 'website'
    return parsed
  } finally {
    await playwright.dispose()
  }
}
```

`WebsiteServiceError` reasons-type uitbreiden met `'homepage_blocked'`.

`career-page-discovery.ts` archiveren: hernoem naar `_deprecated_career-page-discovery.ts` of verwijder als geen callers buiten website.service.

`page-discovery.ts` bewaren: huidige link-crawl op homepage kan in `discoverUrls` als laatste fallback geïntegreerd (als sitemap leeg en robots.txt leeg).

→ **Verify**:
- `pnpm typecheck` clean
- Geen referenties naar `career-page-discovery` buiten archief

### D-6. Test-endpoint update (~30min)
File: `apps/admin/app/api/sales-leads/test/website/route.ts`

Response uitbreiden:
```json
{
  "discovered_urls": [{ "url": "...", "role": "contact", "priority": 0 }],
  "fetches": [{ "url": "...", "tier": 1, "status": 200, "blocked": false, "markdown_chars": 4321 }],
  "parsed": { ... }
}
```

→ **Verify**: GET `/api/sales-leads/test/website?url=https://wetarget.nl` toont per-page tier + blocked-flag.

### D-7. Acceptance smoke (~1u)
Run via test-endpoint en monitor logs op staging:

| Site | Verwachte tier | Verwacht resultaat |
|---|---|---|
| wetarget.nl | tier-1 | `parsed.contacts.length ≥ 1` |
| debanensite.nl | tier-1 | `parsed.vacancies.length ≥ 5` |
| Een React-SPA (kies één — bv. een SaaS-site) | tier-2 op homepage | `parsed.company_name` aanwezig |
| hbm-machines.com | tier-2 → blocked | error reason `homepage_blocked` |

→ **Verify**: alle 4 sites → expected outcome, gedocumenteerd in commit-message.

### D-8. Productie-monitoring (~30min)
- Vercel logs eerste 10 productie-runs nakijken: peak-memory, latency per tier, OOM-kills.
- Audit-log queries:
  ```sql
  SELECT
    elem->>'source' AS src,
    elem->>'status' AS status,
    avg((elem->>'duration_ms')::int) AS avg_ms
  FROM sales_lead_runs, jsonb_array_elements(audit_log) elem
  WHERE created_at > now() - interval '24h'
    AND elem->>'source' = 'website'
  GROUP BY 1, 2;
  ```
- Tier-2 hit-rate berekenen: aantal Playwright-calls / aantal totale website-fetches.

→ **Verify**: 0 OOM-kills in 24u; tier-2 latency < 10s p95.

---

## Volgorde & dependencies

1. **Fase B** — geen blockers, geen frontend-deps. Eerst.
2. **Fase C** — geen blockers. Parallel met B mogelijk.
3. **Fase D-1** (deps + vercel-config) — eerste step, kan los van B/C.
4. **Fase D-2** (sitemap-discovery) — pure logic, parallel met D-3.
5. **Fase D-3** (playwright-fetcher) — parallel met D-2.
6. **Fase D-4** (tiered-fetch) — depends op D-3.
7. **Fase D-5** (website.service rewrite) — depends op D-2 + D-4.
8. **Fase D-6** (test-endpoint) — depends op D-5.
9. **Fase D-7** + **D-8** (verificatie + monitoring) — laatste stap.

## Risico's

- **Bundle-size**: @sparticuz/chromium ~50MB. Andere deps in `/api/sales-leads/create` route mogen samen niet > 200MB. Check tijdens D-1.
- **Browser-leak**: vergeten `dispose()` → memory groeit per request. `try/finally` strict; review tijdens D-5.
- **Cold-start tijd**: eerste Playwright-launch ~2s. Bij Fluid Compute warm-instance hergebruikt. Monitor in D-8.
- **Playwright op Vercel Functions** (niet Sandbox/Edge): vereist `runtime: 'nodejs'` (al gezet) en geen Webpack-bundling van chromium (D-1 stap).
- **Mistral-prompt-shape**: extractWebsite-prompt verwacht specifieke pages-array shape. Check `prompts/website-extraction.v1.ts` of nieuwe `role`-veld compatibel is, anders prompt aanvullen.

## Rollback-plan

- **B**: rpc's behouden, callsites terugdraaien naar oude `setSourceFull`. Migratie hoeft niet weg.
- **C**: revert single-file diff.
- **D**: revert `website.service.ts` naar oude crawlAndParse + `career-page-discovery.ts` herstellen. Playwright-fetcher mag blijven staan zonder caller.

## Toekomstig werk (niet nu)

- Residential proxy als Tier 3 fallback (niveau-4 — Smartproxy/BrightData) wanneer Tier 2 hit-rate op anti-bot sites te laag blijkt
- Captcha-solver (2Captcha) voor Cloudflare Turnstile sites
- Audit-dashboard met per-tier hit-rate-grafieken
- Sitemap-cache in `cache.ts` met 7d TTL voor herhaalde domain-runs
