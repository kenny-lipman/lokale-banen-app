# Automatiseringen Hub — Design

**Datum:** 2026-05-06
**Status:** Design (pre-implementation)
**Scope:** Eén project, opdeelbaar in parallel uitvoerbare chunks (zie sectie 11).

## 1. Samenvatting

Bouw een eigen `/automatiseringen` sectie in de admin-dashboard die alle terugkerende code-gestuurde automatiseringen toont met laatste run, business-resultaten, run history en een "Run Now"-knop. Tegelijk migreren we de eerste n8n-flow ("Fix Platform_id Nominatim") naar code, met LocationIQ als geocoder ipv het publieke Nominatim-endpoint.

## 2. Doelen & Niet-doelen

**Doelen**
- Eén centrale plek waar Kenny ziet welke automatiseringen draaien, hoe vaak, en met welke business-output.
- Run-history per automatisering met error-details voor debugging.
- "Run Now"-knop om manueel te triggeren (gebruikt dezelfde handler als de schedule).
- Eerste n8n-migratie compleet: `fix-job-postings-geocoding` met LocationIQ, draait stabiel binnen free tier.
- Architectuur is uitbreidbaar: nieuwe automatiseringen toevoegen = registry-entry + handler + statsExtractor.

**Niet-doelen**
- Niet-gemigreerde n8n-workflows tonen we **niet** in de UI (n8n wordt afgebouwd, geen stub-entries).
- Geen enable/disable toggle vanuit UI in deze iteratie.
- Geen runtime-config (batch-grootte, schedule) bewerken vanuit UI.
- Geen dashboard voor `scripts/*.mjs` (manual scripts op laptop hebben geen log-infra).
- Geen Slack-integratie wijzigen — bestaande watchdog blijft alerts sturen.

## 3. Architectuur

### 3.1 Pagina's & routes

- **Lijst:** `/automatiseringen` — tabel-layout met alle code-automatiseringen.
- **Detail:** `/automatiseringen/[id]` — header + KPI-strip + 30d trend-chart + business stats (laatste run) + run history (50 runs).
- **Sidebar:** nieuw top-level item **"Automatiseringen"** in `apps/admin/components/app-sidebar.tsx`, gepositioneerd vlak boven "Instellingen". Icon: lucide `Workflow`.

`/agents` blijft ongemoeid; automatiseringen vallen niet onder agents.

### 3.2 Drie kerncomponenten

1. **Code registry** (`lib/automations-registry.ts`) — bron van waarheid. Lijst van `AutomationDefinition` objecten met `id`, `displayName`, `description`, `category`, `schedule`, `handlerPath`, `displayStats`. Vervangt op termijn `lib/cron-config.ts`.

2. **Persistence** — nieuwe tabel `automation_runs` (vervangt `cron_job_logs`). Geschreven door `withAutomationMonitoring()` wrapper. UI leest hier uit voor latest-run en stats.

3. **API + UI** — `GET /api/automations` (registry + latest + 7d/30d stats), `GET /api/automations/[id]` (registry-entry + run history), `POST /api/automations/[id]/trigger` (Run Now). UI-pagina's zijn server components die deze endpoints fetchen.

### 3.3 Bestaande infra die we aanraken

| Bestand | Wijziging |
|---|---|
| `lib/cron-config.ts` | Vervangen door `lib/automations-registry.ts` (rijker model). Backward-compat re-export tijdens overgang. |
| `lib/cron-monitor.ts` | `withCronMonitoring` blijft als alias, maar schrijft via nieuwe `withAutomationMonitoring` naar `automation_runs`. |
| `app/api/cron/logs/route.ts` | Behouden (legacy, leest `cron_job_logs`); nieuwe `/api/automations` endpoints staan ernaast. |
| `app/api/cron/watchdog/route.ts` | Aanpassen om `automation_runs` te lezen ipv `cron_job_logs`. |
| `components/CronJobMonitor.tsx` | Blijft op `/settings` als fallback gedurende transitieperiode; niet meer leidend. |
| `components/app-sidebar.tsx` | Nieuw "Automatiseringen" menu-item toevoegen. |
| `vercel.json` | Nieuwe cron-entry voor `/api/cron/fix-job-postings-geocoding`. |

## 4. Database

### 4.1 Nieuwe tabel `automation_runs`

```sql
create table automation_runs (
  id                  uuid primary key default gen_random_uuid(),
  automation_id       text not null,
  started_at          timestamptz not null,
  completed_at        timestamptz,
  duration_ms         int,
  status              text not null check (status in ('running','success','error','timeout')),
  http_status         int,
  error_message       text,
  business_stats      jsonb,
  triggered_by        text not null default 'schedule' check (triggered_by in ('schedule','manual')),
  triggered_by_user_id uuid references auth.users(id),
  created_at          timestamptz default now()
);

create index idx_automation_runs_aid_started on automation_runs (automation_id, started_at desc);
create index idx_automation_runs_failed     on automation_runs (started_at desc) where status != 'success';
```

RLS: enable, only authenticated users with admin role can `SELECT`. Service role doet alle inserts.

### 4.2 Schema-rename `job_postings.nominatim_failed` → `geocoding_failed`

Toegevoegd: optioneel `geocoding_failed_reason text` (bv. `'no_match'`, `'missing_postcode'`).

```sql
alter table job_postings rename column nominatim_failed to geocoding_failed;
alter table job_postings add column geocoding_failed_reason text;
```

Codebase `nominatim_failed` references vervangen door `geocoding_failed`.

### 4.3 RPC-functie voor stats

`get_automation_run_stats(since_date timestamptz, filter_automation_id text)` — aggregaties (total/success/error/timeout, avg/max duration) per `automation_id`. Vervangt `get_cron_job_stats`.

### 4.4 Cron_job_logs deprecate-pad

Tabel houden tot watchdog en CronJobMonitor over zijn naar `automation_runs`. Daarna 30 dagen retentie en droppen.

## 5. Code Registry

### 5.1 Type

```ts
// lib/automations-registry.ts

export type AutomationCategory = 'scraper' | 'sync' | 'enrichment' | 'maintenance'

export interface DisplayStat {
  key: string         // matcht business_stats.<key>
  label: string       // Nederlandse label, bv. "verrijkt"
  format?: 'number' | 'percent' | 'duration'
}

export interface AutomationDefinition {
  id: string                     // url-segment + automation_id, bv. 'fix-job-postings-geocoding'
  displayName: string
  description: string
  category: AutomationCategory
  schedule: string               // cron expr in UTC
  expectedIntervalMs: number     // voor watchdog overdue-detection
  handlerPath: string            // bv. '/api/cron/fix-job-postings-geocoding'
  displayStats: DisplayStat[]
  docsLink?: string
}

export const AUTOMATIONS: AutomationDefinition[] = [
  // bestaande cron jobs (overgenomen uit cron-config.ts) +
  // nieuwe entry voor fix-job-postings-geocoding
]
```

### 5.2 Initiële automation-entries (twaalf)

| id | category | schedule UTC | display stats |
|---|---|---|---|
| `fix-job-postings-geocoding` | enrichment | `0 */2 * * *` | processed, enriched, geocoding_failed_no_match, geocoding_failed_no_postcode, platform_matched, queue_remaining, api_calls_used |
| `postcode-backfill` | enrichment | `*/2 * * * *` | processed, enriched, failed |
| `baanindebuurt-scraper` | scraper | `0 5 * * *` | new, updated, skipped, errors |
| `debanensite-scraper` | scraper | `0 6 * * *` | pages_scraped, new, updated, skipped, errors |
| `campaign-assignment-parallel` | sync | `0 7,13 * * *` | platforms_processed, contacts_assigned, campaigns_used, errors |
| `cleanup-instantly-leads` | maintenance | `0 3 * * *` | deleted, kept, errors |
| `daily-campaign-report` | maintenance | `0 8 * * *` | reports_sent, recipients |
| `refresh-campaign-eligible` | maintenance | `30 6 * * *` | rows_refreshed, duration_ms |
| `refresh-contact-stats` | maintenance | `*/5 * * * *` | rows_refreshed, duration_ms |
| `refresh-company-platforms` | maintenance | `0 10 * * *` | rows_refreshed, duration_ms |
| `auto-archive-old` | maintenance | `30 3 * * *` | archived, kept |
| `watchdog` | maintenance | `*/15 * * * *` | jobs_checked, overdue, alerts_sent |

## 6. Monitoring wrapper

### 6.1 `withAutomationMonitoring`

```ts
// lib/automation-monitor.ts

export function withAutomationMonitoring(automationId: string) {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    // 1. Auth via withCronAuth (CRON_SECRET) — geldt voor zowel scheduled
    //    als manual triggers (manual is server-side fetch met dezelfde header)
    // 2. Insert row 'running' bij start (met triggered_by uit X-Automation-Trigger header)
    // 3. Run handler
    // 4. Update row met status, duration, http_status, business_stats (uit response.stats), error_message
    // 5. Return response
  }
}
```

Onderscheid scheduled vs manual: Run Now-endpoint stuurt extra header `X-Automation-Trigger: manual` + `X-Automation-User-Id: <uuid>` mee. Wrapper leest die headers en zet `triggered_by` + `triggered_by_user_id` op de row. Bij scheduled runs (zonder headers): default `'schedule'` + `null`.

Conventie: handler retourneert `NextResponse.json({ success: true, stats: { ... }, message?: '...' })`. Wrapper extraheert `stats` → `business_stats` kolom.

### 6.2 Backward-compat

`withCronMonitoring(jobName, path)` blijft bestaan en delegeert naar `withAutomationMonitoring(jobName)` zodat geen bestaande handler aangepast hoeft tijdens transitie.

## 7. UI

### 7.1 Lijstpagina `/automatiseringen` (server component)

Layout (top-down):
1. **Header:** titel "Automatiseringen", subtitle "X actief · laatste 7 dagen", "Vernieuwen" knop.
2. **KPI-strip:** 4 cards (Totaal · OK · Warnings · Errors) gebaseerd op latest-run-status van elke automation.
3. **Tabel** met kolommen: Naam (met description), Schedule (cron expr), Laatste run (relative time), Resultaat (samenvattende stats inline, eerste 2-3 keys uit `displayStats`), Status (badge), Acties ("Run Now" + klik voor detail).
4. **Footer:** kleine "Search by LocationIQ.com" attribution-link (vereiste van free tier).

Sortable per kolom (client-side). Geen filter/tab-bar in v1.

### 7.2 Detailpagina `/automatiseringen/[id]` (server component)

Layout:
1. **Breadcrumb + header:** naam + status badge + categorie badge + schedule (`code`) + handler-path. Run Now-knop rechts.
2. **KPI-strip (4):** Vorige run · Volgende run (afgeleid van schedule) · Success rate (7d) · Avg duur (7d).
3. **Trend-grafiek 30d** (1.6fr) + **Business stats laatste run** (1fr) — side-by-side. Trend toont een primaire metric per run (configurable per automation, default = `business_stats.processed` of `enriched`) als lijngrafiek + status-dots.
4. **Run history** — tabel: Tijd, Trigger (`schedule`/`manual` + user), Duur, Stats (samenvatting uit `business_stats`), Status. Klik = expand-row met `error_message` + volledige `business_stats` JSON.

### 7.3 Run Now-flow

- Knop POST `/api/automations/[id]/trigger`.
- Endpoint check: bestaande Supabase-session (admin user). Insert `automation_runs` row met `status='running'`, `triggered_by='manual'`, `triggered_by_user_id=<user>`. Daarna server-side `fetch(handlerPath, { headers: { Authorization: 'Bearer '+CRON_SECRET } })`.
- Response wordt ge-await en wrapper update dezelfde row. UI polled `/api/automations/[id]` totdat de `running` row verdwenen is (of toont "draait nog").
- Concurrency-lock: bij bestaande `running`-row voor zelfde automation_id waar `started_at > now() - interval '6 minutes'` (= 300s timeout + 60s buffer) → reject met 409 "Automatisering loopt al". Oudere `running` rows worden als orphan beschouwd (handler crashte zonder update) en geen lock.

## 8. API endpoints

### 8.1 `GET /api/automations`

Auth: `withAuth` (admin session). Query param `days` (default 7).

Response:
```ts
{
  success: true,
  automations: Array<{
    ...AutomationDefinition,
    latestRun: AutomationRun | null,
    stats: { totalRuns, successCount, errorCount, timeoutCount, avgDurationMs, maxDurationMs, successRate } | null
  }>,
  timestamp: string
}
```

### 8.2 `GET /api/automations/[id]`

Auth: idem. Query param `days` (default 30 voor trend).

Response: registry-entry + 50 meest recente runs (full row) + per-day trend (`processed`/`enriched` per run).

### 8.3 `POST /api/automations/[id]/trigger`

Auth: admin session. Body: leeg.

Response (200): `{ success: true, runId: uuid, status: 'running' }`. UI polled `GET /api/automations/[id]` voor afronding.

Failure-modes: 409 als al running, 401 als geen admin, 404 als id onbekend.

## 9. Migratie n8n → code: `fix-job-postings-geocoding`

### 9.1 Endpoint en codestructuur

```
app/api/cron/fix-job-postings-geocoding/route.ts          ← thin handler, gewikkeld in withAutomationMonitoring
lib/automations/fix-job-postings-geocoding/
  index.ts                  ← run() main loop
  locationiq-client.ts      ← search() met retry/backoff
  platform-lookup.ts        ← postcode → cities.platform_id
  queue.ts                  ← queue-fetch query
  budget-check.ts           ← daily API-call budget guard
  types.ts
```

### 9.2 LocationIQ usage

- **Endpoint:** `GET https://eu1.locationiq.com/v1/search?q={city}&format=json&addressdetails=1&countrycodes=nl&limit=1&key={KEY}`
- **Eén call per item** — search met `addressdetails=1` retourneert direct `{ lat, lon, address: { postcode, city, country_code, state, road } }`. Reverse-call van n8n vervalt.
- **Auth:** `LOCATIONIQ_API_KEY` env var (Vercel + `.env.local`).
- **Free tier limits:** 5000 calls/dag, 60 req/min sustained, 2 req/sec piek.

### 9.3 Schedule en throughput

- **Cron:** `0 */2 * * *` (UTC) → 12 runs/dag.
- **Per run cap:** 290 items. Met 1.0s spacing tussen calls = 290s runtime, binnen 300s timeout.
- **Per run calls:** 290 (1 call/item).
- **Per dag calls:** 12 × 290 = 3480 (ruim onder 5000-cap; buffer voor retries en handmatige Run Now).
- **Per dag items verwerkt:** 3480.

### 9.4 Queue query

```sql
select id, location, zipcode, country, street, city, latitude, longitude
from job_postings
where location is not null
  and location != ''
  and location != 'The Randstad, Netherlands'
  and geocoding_failed is null
  and (zipcode is null or zipcode = '' or latitude is null or longitude is null)
order by created_at desc        -- NIEUW: recent eerst (was: ook DESC in n8n, behouden)
limit 290;
```

Initiële queue: ~152.500 items. Recent eerst werken impliceert nieuwe job_postings krijgen voorrang boven oude backlog.

### 9.5 Per-item flow

1. **Search call** met `q=city` (city uit `location` of `city` veld; n8n's parsing-logica voor JSON-locations is **niet** onderdeel van deze migratie — zie sectie 9.7).
2. **Result handling:**
   - `lat`+`lon`+`address.postcode` aanwezig → ga door naar 3.
   - `lat`+`lon` aanwezig, `postcode` missing → `geocoding_failed=true, geocoding_failed_reason='missing_postcode'`. Skip naar volgend item.
   - Geen results / leeg → `geocoding_failed=true, geocoding_failed_reason='no_match'`. Skip naar volgend item.
3. **Postcode-prefix** = eerste 4 cijfers van `address.postcode`.
4. **Platform lookup:** `select platform_id from cities where postcode = $1 limit 1`. Mag null teruggeven (geen match) — dat is OK, `platform_id` blijft dan null.
5. **Update:** `update job_postings set street=address.road, zipcode=address.postcode, latitude, longitude, city=address.city, country=address.country_code, state=address.state, platform_id=<lookup> where id=$1`.
6. **Wait 1.0s.**

### 9.6 Failure-handling

- LocationIQ HTTP 429: 1 retry na 2.0s extra wait, dan skip met `error_message="rate_limit_429"` in log; budget-check zorgt verder dat we niet over budget gaan.
- LocationIQ HTTP 5xx: 1 retry na 2.0s, dan skip.
- LocationIQ 401/403: stop hele run direct, terugmelden in `business_stats.error="auth_failed"`.
- DB-error op update: log `error_message`, ga door met volgend item (single-item failures stoppen run niet).
- Timeout-bewaking: bij `Date.now() - startedAt > 270_000` → break loop, zet `business_stats.stopped_early = true`.

### 9.7 Buiten scope

- De n8n `manualTrigger`-flow (parse JSON-string locations via SQL) is **niet** onderdeel van deze migratie. Indien nog nodig: aparte automatisering of one-shot SQL-script later.

### 9.8 Business stats (consequent vullen)

```ts
{
  processed: number,                   // items uit queue gepakt
  enriched: number,                    // succesvol geüpdatet met lat+lng+postcode
  geocoding_failed_no_match: number,   // LocationIQ gaf niets terug
  geocoding_failed_no_postcode: number,// lat/lng wel, postcode niet
  platform_matched: number,            // platform_id gevonden in cities-tabel
  queue_remaining: number,             // SELECT COUNT na de run — voor UI-progress
  api_calls_used: number,              // exact aantal LocationIQ calls (incl. retries)
  stopped_early: boolean
}
```

### 9.9 Daily budget guard

In `budget-check.ts`: bij elke run-start, query `SELECT SUM((business_stats->>'api_calls_used')::int) FROM automation_runs WHERE automation_id='fix-job-postings-geocoding' AND started_at > date_trunc('day', now())`. Als ≥4500 → exit met `business_stats.skipped_reason='daily_budget_reached'`. Voorkomt dat manual triggers de scheduled runs van budget beroven.

### 9.10 Attribution

Footer van `/automatiseringen` (lijst en detail): kleine link "Search by LocationIQ.com" → `https://locationiq.com`. Vereiste voor commercial use op free tier.

## 10. Risk register & open vragen

| Risico | Mitigatie |
|---|---|
| LocationIQ search retourneert geen postcode voor sommige NL-cities | Stat `geocoding_failed_no_postcode` zichtbaar in dashboard. Bij >10% falen evalueren we reverse-fallback in v2. |
| Free tier dekt queue niet (152k items, ~44 dagen bij 3480/dag) | Inflow ~500-1500/dag. Bij netto-positief ratio: paid tier overwegen. Stat `queue_remaining` zichtbaar in detail-pagina. |
| Vercel cron `*/2 * * * *` (postcode-backfill) lijkt frequent — race-condition met fix-job-postings-geocoding op zelfde tabel | postcode-backfill werkt op `companies`, fix-job-postings-geocoding op `job_postings`. Geen conflict. |
| Migratie van `nominatim_failed` kolom raakt bestaande code | Grep voor alle references nodig in implementatie-fase. Dual-name behouden tijdens transitie? Beslissen in plan. |
| Rename `cron_job_logs` → `automation_runs` raakt bestaande dashboards/queries | Watchdog en CronJobMonitor moeten gemigreerd, daarna oude tabel archiveren. |
| Manual JSON-location parser uit n8n is niet meegenomen | Aparte beslissing wanneer (en of) die nog gemigreerd moet worden. |

## 11. Implementation chunks (parallel-safe split)

Het project kan in deze chunks parallel worden uitgevoerd door verschillende agents. Tussen `[ ]` staat de afhankelijkheid.

| Chunk | Werk | Afhankelijkheid |
|---|---|---|
| **A. DB schema** | Migration: `automation_runs` tabel + indexes + RLS. Migration: `job_postings.nominatim_failed` rename + `geocoding_failed_reason` kolom. Nieuwe RPC `get_automation_run_stats`. | — |
| **B. Registry & monitoring lib** | `lib/automations-registry.ts` met types + 12 entries. `lib/automation-monitor.ts` (`withAutomationMonitoring`). `withCronMonitoring` als alias. | A (voor schrijven naar nieuwe tabel) |
| **C. API endpoints** | `GET /api/automations`, `GET /api/automations/[id]`, `POST /api/automations/[id]/trigger`. | A, B |
| **D. UI lijstpagina** | `/automatiseringen/page.tsx` (server component) + tabel + KPI-strip + sidebar-entry + footer attribution. | C |
| **E. UI detailpagina** | `/automatiseringen/[id]/page.tsx` + KPI-strip + trend-chart + run history + Run Now-knop met polling. | C |
| **F. LocationIQ migratie** | `app/api/cron/fix-job-postings-geocoding/route.ts` + `lib/automations/fix-job-postings-geocoding/*`. Nieuwe vercel.json cron-entry. Env var `LOCATIONIQ_API_KEY` documenteren. References van `nominatim_failed` updaten naar `geocoding_failed`. | A |
| **G. Watchdog & CronJobMonitor migratie** | `app/api/cron/watchdog/route.ts` over naar `automation_runs`. `components/CronJobMonitor.tsx` markeren als deprecated of verbouwen om `automation_runs` te lezen. | A, B |
| **H. Verificatie & E2E** | Run één scheduled cycle van fix-job-postings-geocoding op preview, controleer monitoring. UI-screenshot regression. Watchdog-alert handmatig triggeren. | Alles boven |

Aanbevolen volgorde: **A → B parallel met F (alleen schema-deel) → C → D + E parallel → G → H**. F kan vrijwel direct na A starten; alleen de monitoring-wrapper-call wacht op B.

## 12. Implementatiedetails die in PLAN.md horen

- Exacte SQL voor migrations. **Beslissing:** `cron_job_logs` data wordt **niet** ge-backfilled naar `automation_runs`. Watchdog/CronJobMonitor blijven `cron_job_logs` raadplegen tot ze gemigreerd zijn (chunk G); daarna 30d retentie en droppen.
- Exacte `displayStats` config per automatisering (sectie 5.2 is initieel, kan tijdens implementatie verfijnd).
- Lucide icon-keuze + sidebar-positie definitief (voorstel: `Workflow`-icon, vlak boven "Instellingen").
- Trend-chart library: bij voorkeur lichte native SVG (zoals huidige mockup). Recharts/Tremor alleen als de complexiteit dat rechtvaardigt — checken of recharts al in `apps/admin/package.json` staat.
- Polling interval voor Run Now-feedback (default 2s, timeout 6 min = lock-window).
- Test-strategie: unit voor `locationiq-client` (mocked HTTP), integration voor queue + platform-lookup (Supabase preview branch), handmatige UI-walkthrough na deploy.

---

**Volgende stap na review:** invoke `superpowers:writing-plans` om PLAN.md op te stellen die deze chunks taakgewijs uitwerkt.
