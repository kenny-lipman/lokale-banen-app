# Vacancy-tracking per Lead — Design + Implementatieplan

**Datum**: 2026-05-07
**Auteur**: Claude (kickoff-document, te valideren met Kenny)
**Status**: ontwerp — nog niet goedgekeurd voor execute

## Probleemstelling

Per **lead** (= company) willen we de vacaturepagina's permanent opslaan en periodiek scrapen, zodat we:

1. **Detecteren** wanneer een lead nieuwe vacatures plaatst (= sales-trigger)
2. **Bijhouden** welke vacatures nog open zijn vs. gesloten
3. **Verrijken** lead-data met live vacancy-volume (employee-growth signal)
4. **Voeden** WeTarget-campagnes met aangepaste content per lead

Huidige situatie:
- `WebsiteService.crawlAndParse` extraheert vacancies eenmalig tijdens lead-enrichment
- Resultaat zit in `enrichments.website.parsed.vacancies` — point-in-time snapshot
- Geen scheduling, geen diff, geen tracking

Wat we nodig hebben:
- 1e-class data-model voor career-pages + vacancies per lead
- User-controle over welke URLs gemonitord worden
- Scheduled scraping
- Diff-detectie (nieuw/verdwenen vacatures)
- UI voor browsing + actie

## Scope

### In scope (V1 → V3)

- **V1 (MVP)**: per lead een lijst van career-page URLs opslaan, handmatig + auto-detect, manual scrape-trigger, 1 vacancy-snapshot opslaan
- **V2**: scheduled re-scrape (dagelijks/wekelijks), diff-detectie, "X nieuwe vacatures" notificatie
- **V3**: ATS-specifieke parsers (Greenhouse, Recruitee, Lever, etc.) voor structured data; smart-discovery via patterns leren

### Out of scope

- Indeed/LinkedIn scraping — gebruikt huidige Apify-actors via `job_postings`
- Generieke job-board scraping — daar is `baanindebuurt` / `debanensite` voor
- Cross-lead aggregatie ("welke leads hebben de meeste vacatures?") — kan later
- Pipedrive-sync van vacancy-deltas — ander project

### Relatie tot bestaande tabellen

- **`job_postings`**: bestaande vacancies van scrapers (Indeed, LinkedIn, debanensite). Source-attribution via `job_sources`.
  - **Beslissing nodig**: hergebruiken (nieuwe `job_source: company_career_page`) of separate tabel?
- **`companies`**: lead = company (1-op-1)
- **`contacts`**: not relevant
- **`sales_lead_runs`**: enrichment-historie van een company. Career-page-discovery komt vandaan uit dit proces.

**Mijn voorstel**: separate tabel `tracked_career_pages` + nieuwe rows in `job_postings` met `source='company_career_page'`. Reden:
- Tracking-metadata (last_scraped_at, scrape_status, ATS-type) hoort niet in `job_postings`
- Vacancies zelf zijn vacancies — uniformiteit met andere bronnen voor cross-source filters in UI

## Data-model voorstel

### `tracked_career_pages`

```sql
CREATE TABLE tracked_career_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Discovery + identiteit
  url text NOT NULL,                          -- canonical URL (na redirect)
  url_input text NOT NULL,                     -- URL zoals user/discovery'd input
  source text NOT NULL,                        -- 'sitemap_discovery' | 'manual' | 'lead_enrichment'
  ats_type text,                               -- 'greenhouse'|'recruitee'|'lever'|... | null
  ats_org_slug text,                           -- voor ATS-API calls

  -- Scheduling
  is_active boolean NOT NULL DEFAULT true,     -- false = niet meer scrapen (404, deprecated)
  scrape_interval_hours int NOT NULL DEFAULT 168, -- weekly default
  last_scraped_at timestamptz,
  next_scrape_at timestamptz NOT NULL DEFAULT now(),

  -- Last-scrape result
  last_status text,                            -- 'ok'|'failed'|'no_vacancies'|'blocked'
  last_error text,
  last_vacancy_count int,
  last_diff jsonb,                             -- { added: [...], removed: [...], changed: [...] }

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(company_id, url)
);

CREATE INDEX idx_tracked_career_pages_next_scrape
  ON tracked_career_pages(next_scrape_at)
  WHERE is_active = true;

CREATE INDEX idx_tracked_career_pages_company
  ON tracked_career_pages(company_id);
```

### `job_postings` extension

Hergebruik bestaande tabel; voeg nieuwe job-source toe:

```sql
INSERT INTO job_sources (name, type) VALUES ('company_career_page', 'website');
```

Per-vacancy unieke key: `(company_id, source, external_id)` waar `external_id` = hash van `(url, title)` of ATS-vacancy-id.

Plus nieuw veld:
```sql
ALTER TABLE job_postings ADD COLUMN tracked_page_id uuid REFERENCES tracked_career_pages(id) ON DELETE SET NULL;
```

### `tracked_career_page_scrapes` (audit-log per scrape)

```sql
CREATE TABLE tracked_career_page_scrapes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES tracked_career_pages(id) ON DELETE CASCADE,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  duration_ms int NOT NULL,
  http_status int,
  fetch_tier int,                              -- 1 (ssrf-fetch) of 2 (Playwright)
  status text NOT NULL,                        -- 'ok'|'failed'|'blocked'|'no_vacancies'
  error text,
  vacancies_found int,
  vacancies_added int,
  vacancies_removed int,
  raw_html_size int,                            -- voor monitoring
  triggered_by text NOT NULL                   -- 'cron'|'manual'|'lead_enrichment'
);
```

## Architectuur

```
┌──────────────────┐       ┌──────────────────┐
│ Lead enrichment  │──┐    │ Manual UI add    │
│ sitemap-discover │  │    │ (textarea + btn) │
└──────────────────┘  │    └──────────────────┘
                      ▼              ▼
              ┌────────────────────────────┐
              │ tracked_career_pages       │
              │ (deduped per company+url)  │
              └────────────────────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
┌───────────────────┐               ┌───────────────────┐
│ Vercel Cron       │               │ Manual scrape btn │
│ /api/cron/        │               │ in UI             │
│ rescrape-careers  │               │                   │
└───────────────────┘               └───────────────────┘
        │                                   │
        └───────────────┬───────────────────┘
                        ▼
              ┌────────────────────────────┐
              │ CareerPageScraperService   │
              │ - tier-fetch (ssrf+pw)     │
              │ - ATS detector             │
              │ - ATS-specific extractor   │
              │ - Mistral fallback         │
              └────────────────────────────┘
                        │
                        ▼
              ┌────────────────────────────┐
              │ job_postings upsert        │
              │ + tracked_career_page_     │
              │   scrapes log              │
              └────────────────────────────┘
                        │
                        ▼
              ┌────────────────────────────┐
              │ Diff-detector              │
              │ → notification queue       │
              └────────────────────────────┘
```

## Modules / Files

### Backend

```
apps/admin/lib/services/career-pages/
├── ats-detector.ts              # Detect Greenhouse/Recruitee/etc. uit URL/HTML
├── ats-extractors/
│   ├── greenhouse.ts            # GET /v1/boards/{slug}/jobs.json
│   ├── recruitee.ts             # GET /api/jobs/{slug}.json
│   ├── lever.ts                 # GET /api/v1/postings/{slug}
│   ├── teamtailor.ts
│   └── workable.ts
├── generic-extractor.ts         # Mistral-based fallback voor onbekende sites
├── career-page-scraper.service.ts # Hoofd orchestrator (per page)
├── career-page-discovery.service.ts # Auto-discover vanuit lead enrichment
├── diff-detector.ts             # Compare oude/nieuwe vacancies
└── types.ts

apps/admin/app/api/career-pages/
├── route.ts                     # GET company, POST add manual
├── [id]/
│   ├── route.ts                 # GET, PATCH (toggle active, change interval), DELETE
│   ├── scrape/route.ts          # POST trigger immediate scrape
│   └── scrapes/route.ts         # GET history
└── ...

apps/admin/app/api/cron/
└── rescrape-careers/route.ts   # Cron: pick next batch waar next_scrape_at <= now
```

### Frontend

```
apps/admin/app/bedrijven/[id]/career-pages/page.tsx
apps/admin/components/career-pages/
├── career-page-list.tsx          # List per company met status badges
├── add-page-form.tsx             # Manual URL add
├── scrape-history-modal.tsx
└── vacancy-diff-display.tsx
```

## Discovery-strategieën

### Auto (tijdens lead-enrichment)

Bij elke `sales_lead_runs` met succesvolle website-source:
- `discoverUrls()` returnt URLs met `role: 'careers'`
- Voor elke careers-URL: insert in `tracked_career_pages` als nog niet bestaat
- `source = 'lead_enrichment'`, `ats_type` via `ats-detector.ts`

### Manual

- UI in lead-detail page: "Career pages" tab/sectie
- Plak URL → backend valideert + classificeert (ATS-detect) → insert
- Bulk: textarea, 1 URL per regel

### ATS-detector heuristieken

```ts
// URL-based
greenhouse.io/embed/job_board?for={slug}
boards.greenhouse.io/{slug}
{slug}.recruitee.com
jobs.lever.co/{slug}
careers.{slug}.com (ambigu — DOM-check nodig)
careers.workable.com/{slug}
{slug}.teamtailor.com

// HTML-based (na fetch)
<meta name="generator" content="Greenhouse">
data-mount-point="board" + greenhouse-fingerprints
window.__GREENHOUSE_DATA__
```

## Scrape-strategieën

### Per ATS-type

| ATS | Methode | Snel? | Robuust? |
|---|---|---|---|
| **Greenhouse** | `GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs` | < 1s | ja, JSON API |
| **Recruitee** | `GET https://{slug}.recruitee.com/api/offers/` | < 1s | ja, JSON |
| **Lever** | `GET https://api.lever.co/v0/postings/{slug}` | < 1s | ja, JSON |
| **Workable** | OAuth API of HTML parsing | medium | mixed |
| **Teamtailor** | API of HTML | medium | medium |
| **Personio** | HTML parsing | medium | medium |
| **Generic HTML** | tiered-fetch + Mistral | langzaam | medium |

ATS API's zijn **drastisch** beter dan HTML scraping:
- 10-100× sneller
- Structured data, geen regex-fouten
- Stabiel over re-deploys
- Vaak gratis, geen rate-limits

### Generic-fallback (Mistral)

Wanneer geen ATS-match: huidige `WebsiteService` flow (tiered-fetch → markdown → Mistral). Maar Mistral-prompt versterken voor pure-vacancy-extractie:
- Strict JSON-array format
- Vraag specifieke velden: title, location, employment_type, posted_date, url
- Lower temp (0.0)

## Diff-detectie

Per scrape:
1. Fetch alle vacancies uit ATS / generic
2. Hash elke vacancy: `sha256(title + location)` als external_id
3. Lookup huidige open vacancies in `job_postings` voor `tracked_page_id`
4. Compute diff:
   - **Added**: in nieuwe set, niet in oude → INSERT
   - **Removed**: in oude set, niet in nieuwe → UPDATE `closed_at`
   - **Changed**: zelfde hash maar andere description → UPDATE
5. Store diff-summary in `tracked_career_page_scrapes.last_diff` + `tracked_career_pages.last_diff` (latest)

## Scheduling

### Vercel Cron

```json
// vercel.json
{ "path": "/api/cron/rescrape-careers", "schedule": "0 */4 * * *" }
```

Elke 4 uur. Cron-handler:
1. Pak alle `tracked_career_pages` waar `is_active=true AND next_scrape_at <= now()`
2. Limit per run (bv. 50)
3. Sort by `last_scraped_at ASC NULLS FIRST` (oudste eerst)
4. Per page: enqueue async scrape via Inngest of fire-and-forget waitUntil
5. Update `next_scrape_at = now() + interval scrape_interval_hours` direct (voorkomt double-scrape)

### Per-page interval

Default 7 dagen. UI laat user instellen:
- High-priority leads: 24u
- Normaal: 7d
- Archief: 30d

### Throttling per domain

Max 1 concurrent scrape per company-domain (voorkomt block).

## UI/UX

### In `companies/[id]` detail

Nieuw tab "Vacatures":
- **Career-pages sectie**:
  - Lijst van pages met: URL, ATS-type, last_scraped, last_vacancy_count, status-badge
  - Knop "Toevoegen" → modal met URL-input
  - Per row: "Scrape nu", "Toggle actief", "Geschiedenis", "Verwijderen"
- **Vacatures sectie**:
  - Lijst van actieve vacancies (open) per page
  - Filter: alleen open / inclusief gesloten
  - Sorteer: nieuwste eerst, titel, locatie

### In `sales/lead-verrijking/[run_id]` detail

Nieuw blok "Career-pages gevonden" (alleen na succesvolle website-source):
- Toon discovered URLs met role='careers'
- "Voeg toe als tracked page" knop per URL
- Default: alle career-URLs auto-toegevoegd → user kan ontkoppelen

## Notifications

V2-feature. Drie triggers:
1. **Nieuwe vacancies**: 1+ added in laatste scrape
2. **Vacancy-volume change**: > 25% jump vs. last week
3. **Page kapot**: 3 opeenvolgende failures

Output:
- Slack-message naar #sales channel met lead-link
- Optioneel: email digest dagelijks
- Optioneel: Pipedrive-note op deal

## Phasing

### V1 — MVP (geschat ~2 dagen)
- DB-migrations (`tracked_career_pages` + scrape-log + job_postings extension)
- `CareerPageScraperService` met **alleen** generic-extractor (Mistral)
- `ats-detector.ts` (alleen URL-pattern, geen API-calls)
- API: GET/POST/DELETE career-pages, POST manual scrape
- Cron job (4u interval)
- Diff-detection (added/removed)
- UI: simple list in company-detail tab + add-form
- Auto-import vanuit lead-enrichment (career-URLs uit sitemap-discovery)

### V2 — ATS-extractors (~2-3 dagen)
- Greenhouse extractor (highest-impact, populair in NL B2B)
- Recruitee extractor (zeer populair NL)
- Lever extractor (US, minder NL)
- ATS-detector uitgebreid met HTML-fingerprints
- Notifications via Slack

### V3 — Smart features
- Vacancy-volume trends per lead (chart)
- Cross-lead insights ("welke sectoren groeien?")
- Pipedrive-deal note auto-generation bij nieuwe vacancies
- Workable, Teamtailor, Personio extractors

## Constraints

- Free Apify-tier dekt huidige volume; bij V2-scale (50 leads × wekelijks = 200 scrapes/week) groei naar Starter
- Vercel function maxDuration 300s — generic Mistral-extract kan tot 60s, ATS-API < 1s. Per-page genoeg budget.
- Mistral-credits niet onbeperkt — caching per scrape op markdown-hash
- Niet alle leads zullen career-pages hebben → hoge percentage `no_vacancies` is OK (niet failure)

## Open keuzes / vragen

1. **Vacancies in `job_postings`** of nieuwe tabel `tracked_vacancies`?
   - Aanbeveling: hergebruiken voor uniforme UI, maar vraagt aanpassing aan bestaande Indeed/LinkedIn flows die wellicht assumpties hebben over `source`-veld.
2. **Cron-interval default**: 7d, 3d, of 1d?
   - Aanbeveling: 7d default, configureerbaar 1d-30d. NL B2B publishes vacancies vrijwel nooit dagelijks.
3. **Mistral kosten** vs **ATS-API gratis**:
   - V1 Mistral-only is duur op schaal. Begin met V2 ATS-extractors als volume > 100 pages?
4. **Diff-storage**: `last_diff` blob op page, of full audit per scrape?
   - Aanbeveling: beide. `last_diff` voor UI quick-view, audit voor compliance.
5. **Inngest** of **Vercel waitUntil** voor scrape-execution?
   - 50 pages × 60s wost-case = 3000s wall-time. Past niet in 1 cron-invocation.
   - Inngest met steps is hier echt een goede fit, ander dan voor de enrichment-flow.
6. **WeTarget-integratie**: vacancy-data in Instantly campaign-templates? Buiten scope V1, wel goed om vroeg te designen voor data-shape.
7. **Hoofd-domein vs sub-domein**: `recruitee.com/o/company` is een tracked_career_page van company X, maar de domain is recruitee. URL canonicalization regels nodig.

## Risico's

- **Detection-arms-race**: ATS-providers passen UI aan → generic Mistral-extractor breekt
  - Mitigatie: ATS-extractors gebruiken APIs, niet HTML
- **Cookie/auth-walls**: sommige ATS verbergt jobs achter auth (zelden)
  - Acceptabel, mark `last_status='blocked'`
- **Spam-prevention**: 50 leads × 4 cron-runs/dag = veel calls per company
  - Throttle 1 scrape per company per 24h hardcap
- **Stale data**: cron faalt 1 week, vacancies lopen scheef
  - Watchdog cron monitort `next_scrape_at` overdue > 48h, alert via Slack

## Acceptance criteria V1

- Een lead heeft minstens 1 tracked_career_page na succesvolle enrichment (voor sites met sitemap-careers-URL)
- User kan via UI een custom URL toevoegen, page-status wordt direct gescrapet
- Cron loopt elke 4u en scrapet pages waar `next_scrape_at <= now()`
- Generic Mistral-extractor levert vacancies naar `job_postings` met `source='company_career_page'`
- UI toont per company een lijst van pages + huidige open vacancies
- Diff-detectie werkt: na 2e scrape zien we `last_diff = {added: [...], removed: [...]}` in DB

## Eerstvolgende kickoff-stappen

1. **Beslissen op data-model**: `job_postings` reuse vs. separate
2. **Beslissen op scheduling**: Vercel cron alone vs. Inngest erbij
3. **Discuss ATS-priorisering**: V1 generic-only of V2 direct met Greenhouse+Recruitee?
4. **DB-migratie schrijven** + advisor-check
5. **Brainstorm-skill in nieuwe sessie** voor UX-flow detail

---

# V1A — Finale plan (2026-05-07, akkoord Kenny)

**Scope-shift na alignment**: V1 = alléén werken-bij URLs als scrape-bronnen beheren met approval-flow.
Geen Mistral-scraper, geen Inngest, geen vacancies. Wel forward-compat naar V1B.

## Beslissingen

| Vraag | Keuze |
|---|---|
| Data-model | Hergebruik `job_sources` (kolommen bestaan al: `kind`, `company_id`, `url`, `discovery_method`, `ats_type`, `scrape_frequency`, `last_scraped_at`, etc.) |
| Vacancies opslaan | Nee — V1 is alleen bronnen-management |
| Scheduler | Niet in V1. Inngest komt in V1B |
| ATS-extractors | Niet in V1. Mistral-only generic-extractor in V1B |
| Auto-creation timing | Bij `sales_lead_runs.status='completed'`, ongeacht Pipedrive-sync resultaat |
| Approval-flow | Ja — nieuwe kolom `review_status` (`pending`/`approved`/`rejected`). Default `pending` voor career-pages |
| Per-company UI | Sectie binnen bestaande `CompanyDrawer` (`/companies` drawer). Geen nieuwe page, geen sub-route, geen tab-rebuild |
| Permissions | Elke ingelogde user mag approve/reject (`withAuth`, niet `withAdminAuth`) |

## Mockup

`docs/superpowers/mockups/2026-05-07-werkenbij-bronnen.html` — 4 secties:
1. Lead-verrijking detail: approval-blok + geparsede sitemap
2. Scrape-bronnen pagina: tabs + filters + tabel
3. CompanyDrawer-sectie
4. Add/edit modals

## Finale plan-stappen

| # | Stap | Verify |
|---|------|--------|
| 1 | **Migratie**: voeg toe aan `job_sources`: `review_status text NOT NULL DEFAULT 'approved' CHECK (review_status IN ('pending','approved','rejected'))`, `next_scrape_at timestamptz NOT NULL DEFAULT now()`, `approved_at timestamptz`, `approved_by uuid REFERENCES auth.users(id)`, `rejected_at timestamptz`, `rejected_by uuid REFERENCES auth.users(id)`, `rejected_reason text`. Default voor nieuwe career-page rijen wordt `'pending'` via insert-trigger of in service-laag. Unique partial index `(company_id, url_canonical) WHERE kind='company_career_page'`. Backfill bestaande rows: aggregators krijgen `approved`. Check + aanvul RLS-policies. | `get_advisors`, `mcp__supabase__generate_typescript_types` |
| 2 | **`normalizeUrl()` utility** in `apps/admin/lib/utils/url.ts`: lowercase host, strip `www.`, strip trailing slash, strip query/fragment | unit-aanroep |
| 3 | **Master-record uitbreiden**: `pages_crawled` items krijgen `role`-veld; nieuw veld `career_page_candidates: Array<{url, method, role}>` met **alle** discovered careers-URLs (niet alleen gefetched). Wijzig `website.service.ts` + `types.ts` | trigger 1 test-enrichment, check master-record JSON |
| 4 | **Career-page upsert verplaatsen** van `pipedrive-sync.service.ts` naar `enrichment-orchestrator.service.ts` (op `status='completed'`). Itereert over `career_page_candidates`. Upsert-logica: skip URLs die al `rejected` zijn voor company; nieuwe URLs → `review_status='pending'`. Verwijder oude code uit pipedrive-sync. | run met bekende careers-URL → ≥1 row met `review_status='pending'` |
| 5 | **Service-module** `apps/admin/lib/services/career-page-sources/source.service.ts`: `list()` (paginated + filters), `getById()`, `create()` (manual), `update()`, `delete()`, `approve()`, `reject()`. Zod-schemas | type-check |
| 6 | **API-routes** onder `/api/job-sources/career-pages/`: `GET /` (list), `POST /` (manual add), `GET /[id]`, `PATCH /[id]` (frequency, active, ats_type), `DELETE /[id]`, `POST /[id]/approve`, `POST /[id]/reject`. Gebruik `withAuth` | curl |
| 7 | **Scrape-bronnen UI** (`app/job-postings/scrape-bronnen/page.tsx`): vervang placeholder. Tabs (Aggregators / Werken-bij). Filters (search, status, frequency, active). Tabel met edit/delete per rij. Bulk-acties. Manual-add `Dialog` (hergebruik `Combobox` voor company-picker, `searchCompanies` patroon uit `vacatures/nieuw`). Edit `Dialog`. Delete `AlertDialog`. Skeleton loading | browser |
| 8 | **Lead-verrijking blokken**: nieuwe componenten in `components/sales/`: `lead-career-page-suggestions.tsx` (approval-cards, bulk-approve, undo-toast) + `lead-sitemap-pages.tsx` (sitemap-tabel, collapse/expand). Renderen op `/sales/lead-verrijking/[run_id]/page.tsx`. Empty state = niets tonen. Hergebruik `Card`, `Badge`, `useToast` | browser test met run-completed |
| 9 | **CompanyDrawer-sectie**: nieuwe sectie "Werken-bij bronnen" tussen Vacatures en Notities in `components/company-drawer.tsx`. Lijst van bronnen met toggle-active, edit-knop, delete. Manual-add knop opent `Dialog`. | browser |
| 10 | **CLAUDE.md update**: documenteer `review_status`, service-locatie, URL-canonicalization regel | grep |

## Open: minor

- ATS-type dropdown in edit-modal: verbergen tot V2 (geen functionele impact)
- Activity-log integratie voor approve/reject events: niet nu, data-shape compatibel houden
- Audit-log tabel voor scrapes: niet nu (V1B)

## Forward-compat naar V1B (Inngest scraper)

Wat in V1A nu al klaar moet zijn zodat V1B alleen scraper-logic toevoegt:
- `next_scrape_at` kolom + index
- Approval-flow (scraper picks alleen `review_status='approved' AND active=true`)
- API-route-structuur (`/api/job-sources/career-pages/[id]/scrape` + `/scrapes` later passen erin)
- UI-tabel kolommen `last_scraped_at`/`last_scrape_status` al getoond met "—" placeholder
