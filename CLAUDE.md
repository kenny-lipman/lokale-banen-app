# Lokale Banen - Claude Code Context

## Project Overview

Lokale Banen is a job posting aggregation platform that scrapes vacancies from multiple sources, enriches company data, and syncs with CRM systems (Pipedrive, Instantly).

## Deployment

- **Production URL**: `https://lokale-banen-app.vercel.app`
- **Platform**: Vercel (Next.js)
- **Database**: Supabase (PostgreSQL)
- **Supabase Project ID**: `wnfhwhvrknvmidmzeclh`

## Cron Jobs (Vercel Cron)

All cron jobs run via **Vercel Cron** (configured in `vercel.json`). Auth via `CRON_SECRET` env var.

**Timezone**: UTC. Convert to Dutch time: Winter (CET) = UTC + 1h, Summer (CEST) = UTC + 2h.

### Active Vercel Cron Jobs

| Job | Schedule (UTC) | NL Time (winter) | Endpoint |
|-----|---------------|-------------------|----------|
| Cleanup Instantly Leads | `0 3 * * *` | 04:00 | `/api/cron/cleanup-instantly-leads` |
| Baanindebuurt Scraper | `0 5 * * *` | 06:00 | `/api/scrapers/baanindebuurt` |
| Werkenindekempen Scraper | `30 5 * * *` | 06:30 (+0-30m jitter) | `/api/scrapers/werkenindekempen` |
| Debanensite Scraper | `0 6 * * *` | 07:00 | `/api/scrapers/debanensite` |
| Refresh Campaign Eligible | `30 6 * * *` | 07:30 | `/api/cron/refresh-campaign-eligible` |
| Campaign Assignment (parallel) | `0 7,13 * * *` | 08:00, 14:00 | `/api/cron/campaign-assignment-parallel` |
| Postcode Backfill | `*/2 * * * *` | Elke 2 min | `/api/cron/postcode-backfill` |
| Refresh Contact Stats | `*/5 * * * *` | Elke 5 min | `/api/cron/refresh-contact-stats` |
| Watchdog | `*/15 * * * *` | Elke 15 min | `/api/cron/watchdog` |
| Auto-archive Old | `30 3 * * *` | 04:30 | `/api/cron/auto-archive-old` |
| Cleanup Reset Tokens | `0 4 * * *` | 05:00 | `/api/cron/cleanup-reset-tokens` |

### Remaining pg_cron Jobs (Supabase)

Only lightweight DB-internal jobs remain in pg_cron:
- `refresh-contact-stats` (job 1) - Direct SQL materialized view refresh (backup, also runs via Vercel Cron)
- `cleanup-cron-job-logs` (job 31) - Deletes logs older than 30 days
- `cleanup-watchdog-alerts` (job 32) - Deletes alerts older than 90 days

### Monitoring

All Vercel Cron endpoints use `withCronMonitoring()` wrapper that logs to `cron_job_logs` table.
The watchdog job checks all jobs every 15 min and sends Slack alerts for overdue jobs.

## Scrapers

### Baanindebuurt.nl
- **Source**: PDF-based job postings from `baanindebuurt.nl/vacatures.php`
- **Method**: Local scraper (no Apify)
- **AI**: Mistral for PDF text parsing
- **Features**:
  - Multi-page pagination with cookie session handling
  - Extracts company data (website, phone, email)
  - Creates contacts with name, email, phone, title
- **API**: `POST /api/scrapers/baanindebuurt`

### Debanensite.nl
- **Source**: HTML job postings from `debanensite.nl/vacatures`
- **Method**: Local scraper (no Apify)
- **AI**: Mistral for extracting contact info, salary, requirements from descriptions
- **Features**:
  - Extracts data from `__NEXT_DATA__` JSON (Elasticsearch format)
  - ~6,700 vacancies across 670 pages
  - Batch-based scraping (configurable pages per run)
  - Creates companies and contacts automatically
- **API**: `POST /api/scrapers/debanensite`
- **Config options**: `maxPagesPerRun`, `startPage`, `mode` (full/incremental)

### Werkenindekempen.nl
- **Source**: `sitemap-wik-vacancies.xml` (dagelijks ververst, ~1.099 actieve vacatures, regio Kempen + Eindhoven e.o.)
- **Method**: Sitemap-driven incremental (geen pagineerde scraping)
- **AI**: Mistral op description voor `contact`/`working_hours_min`/`working_hours_max`/`education_level`/`career_level`/`categories`
- **Anti-detection**: realistic Chrome-fingerprint (3 identity-pool), `preferredRegion: ['fra1','ams1']` (EU-IPs), 30-min start jitter, 2-5s human-delay tussen detail-fetches, session-cookie reuse binnen run, geen identificeerbare LokaleBanen/KempenseBanen strings in headers
- **Features**:
  - JSON-LD JobPosting parse (Zod-validated, strict)
  - 3-laagse company-dedup: `companies.werkenindekempen_id` → `normalized_name` → `hoofddomein` → create
  - Delisted-detection via `job_postings.last_seen_in_sitemap` + 3-dagen grace → `archived_reason='not_in_sitemap'`
  - Geen platform-mapping in scraper zelf — bestaande `fix-job-postings-geocoding` cron mapt city/postcode → `platform_id` (KempenseBanen/HelmondseBanen/EindhovenseBanen)
- **API**:
  - `GET /api/scrapers/werkenindekempen` — Vercel Cron (30 min jitter)
  - `POST /api/scrapers/werkenindekempen` — manual, custom config
  - `POST /api/scrapers/werkenindekempen/backfill` — handmatige bulk-run met `Authorization: Bearer $CRON_SECRET`
- **Config options**: `maxUrlsPerRun` (default 200), `delayMinMs`/`delayMaxMs`, `skipAI`, `dryRun`, `skipStartJitter`

### Other Scrapers (Apify-based)
- Indeed
- LinkedIn
- Nationale Vacaturebank

## Environment Variables

Key variables needed:
- `CRON_SECRET` - Vercel Cron authentication (auto-sent as Bearer token)
- `CRON_SECRET_KEY` - Legacy alias (same value as CRON_SECRET)
- `MISTRAL_API_KEY` - For AI parsing in baanindebuurt scraper
- `SUPABASE_SERVICE_ROLE_KEY` - For server-side Supabase operations

## Campaign Assignment Architecture

Campaign assignment uses a **parallel orchestrator + worker** pattern:

- **Orchestrator** (`/api/cron/campaign-assignment-parallel`): Fetches all candidates, groups by platform, triggers a separate worker per platform via HTTP
- **Worker** (`/api/cron/campaign-assignment`): Processes up to 30 contacts for a single platform (hard cap for 300s timeout safety)
- Each worker: Pipedrive search → blocklist check → Mistral AI personalization → Instantly lead creation
- ~500 contacts across ~10-17 platforms in ~5 min wall time (parallel) vs ~160 min (old sequential)
- Batches grouped by `orchestration_id` in `campaign_assignment_batches` table
- Worker endpoint still accepts manual triggers without `platformId` (sequential fallback mode)

## Database Key Tables

- `job_postings` - All scraped vacancies — kolom `last_seen_in_sitemap` (timestamptz) gebruikt door werkenindekempen-scraper voor delisted-detection (3-dagen grace voor archive)
- `companies` - Company records with enrichment data — kolom `werkenindekempen_id` (text, partial unique index) als primaire dedup-key voor werkenindekempen-source, fallback naar `normalized_name`/`hoofddomein`
- `contacts` - Contact persons linked to companies
- `job_sources` - Scraper sources met `kind` veld:
  - `kind='aggregator'` — Indeed, LinkedIn, Baanindebuurt, Debanensite, etc. (default `review_status='approved'`)
  - `kind='company_career_page'` — werken-bij URL per company. Auto-aangemaakt door enrichment-orchestrator (`finalize()`). User keurt goed/af op `/sales/lead-verrijking/[run_id]` of via `/job-postings/scrape-bronnen`. Unieke partial index `(company_id, url) WHERE kind='company_career_page'` — URLs worden gecanonicaliseerd via `lib/utils/url.ts:normalizeUrl()` (lowercase host, strip www., strip trailing slash/query/fragment).

    **Discovery-cascade in `WebsiteService.crawlAndParse`** (V1A.1):
    1. Mistral-prompt veld `career_page_urls` op homepage-markdown → method `html_link`
    2. Sitemap-discovery → method `sitemap`
    3. Subdomain-probe (`careers./werkenbij./jobs./vacatures.{domain}`, parallel HEAD, alleen als 1+2 leeg) → method `subdomain_probe`

    **Confidence-tier in `internal-linking.upsertCareerPageSource`** bepaalt `review_status` automatisch:
    - URL match in `ats-detect.ts` (recruitee/greenhouse/lever/workable/teamtailor/personio) → `'approved'` + `is_external_ats=true` + `ats_type=...`
    - method `html_link` (Mistral heeft echte link gezien) → `'approved'`
    - method `sitemap` of `subdomain_probe` → `'pending'` (vereist user-approval)
  - V1B forward-compat: `next_scrape_at` is gevuld; scheduler picks `kind='company_career_page' AND review_status='approved' AND active=true AND next_scrape_at <= now()`.
- `campaign_assignment_batches` - Campaign assignment run tracking (with `orchestration_id` for parallel grouping)
- `campaign_assignment_logs` - Per-contact processing logs
- `wetarget_leads_staging` - Staging table for WeTarget campaign leads (sector-based)
- `profiles` - Read-only mirror van `auth.users` (id, email, full_name, role) — gesynced via DB-trigger `sync_profile_role`
- `password_reset_tokens` - Custom 15-min reset tokens (hash-only opslag, RLS aan zonder policies)

## Authentication & User Management

**Session management — cookie-based via `@supabase/ssr` + Next middleware:**
- Browser-client (`apps/admin/lib/supabase.ts`) gebruikt `createBrowserClient` → schrijft `sb-*` cookies
- `apps/admin/middleware.ts` verfrist cookies op elke request en redirect naar `/login` bij ontbrekende session
- Public paths in middleware: `/login`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/api/auth/reset/*`, `/api/cron/*`, `/api/scrapers/*`
- Plain `fetch()` werkt voor alle same-origin client→/api/* calls (geen `authFetch` helper meer)

**Role-system — `app_metadata.role` is single source of truth:**
- Bron: `auth.users.raw_app_meta_data->>'role'` ('admin' of 'member'), alleen via service-role schrijfbaar
- Mirror: `profiles.role` automatisch gesynced via DB-trigger `sync_profile_role`
- Server check: `lib/auth-middleware.ts:resolveRole`
- Client check: `auth-provider.tsx` `isAdmin = user?.app_metadata?.role === 'admin'`
- API routes: `withAuth` (alle ingelogde users) of `withAdminAuth` (admin-only)

**Users CRUD — admin-only (`/admin/gebruikers` UI):**
- `GET /api/admin/users` — list
- `POST /api/admin/users` — create (email + password + role, `email_confirm: true`)
- `PATCH /api/admin/users/[id]/role`
- `POST /api/admin/users/[id]/disable` — `ban_duration: '87600h'` + global signOut
- `POST /api/admin/users/[id]/enable`
- `POST /api/admin/users/[id]/force-logout` — `auth.admin.signOut(id, 'global')`
- `DELETE /api/admin/users/[id]` — hard delete
- Anti-lockout: admin kan eigen account niet disablen of deleten

**Custom password reset — eigen 15-min tokens (geen Supabase magic links):**
- `POST /api/auth/reset/request` — rate-limited 5/uur per IP + 3/uur per email; **altijd 200** (geen email enumeration); stuurt Resend mail vanaf `noreply@cas.works`
- `POST /api/auth/reset/validate` — page-load check (valid|missing|invalid|used|expired)
- `POST /api/auth/reset/confirm` — `updateUserById(password)` + markeer token used + global signOut
- Tokens: SHA-256 hash-only opslag, partial unique index → max 1 actieve token per user
- Pages: `/forgot-password` (email request) + `/reset-password?token=...` (password set)
- Cleanup-cron `cleanup-reset-tokens` deletet rijen waar `expires_at < now() - 7d`

## WeTarget Campaigns (Sector-based)

WeTarget is a jobmarketing bureau (vacature-ads, employer branding). Unlike the regular platform-based campaigns, WeTarget campaigns are **sector-based**.

### Campaigns
| Sector | Campaign ID | Senders |
|--------|------------|---------|
| Logistiek | `f5422a62-0dff-493d-b6d2-fac4eef133a1` | bart@, lois@we-targetonline.com |
| Transport | `df8d72a9-2472-400c-ba4b-332c59bf67ec` | bart@, lois@we-targetonline.com |
| Techniek | `a3664d52-7f83-4927-a088-493dddaf36d3` | bart@, lois@we-targetonline.com |

### Lead Selection Criteria
- Match job_postings.title to sector-specific function names (ILIKE patterns)
- **Exclude Zuid-Holland**: state + postcode ranges 2160-3399 and 4100-4299
- 1 contact per company, personal emails only (no info@, hr@, etc.)
- Exclude "Afdeling Personeelszaken" placeholder contacts
- Prioritize recent job postings

### Scripts (in `scripts/`)
- `generate-wetarget-excel.mjs` - Export staging leads to Excel (3 worksheets per sector)
- `push-wetarget-instantly.mjs` - Push staging leads to Instantly campaigns (1 by 1 via POST /api/v2/leads)
- `enrich-wetarget-leads.mjs` - AI personalization via Mistral + update Instantly leads
- `fix-wetarget-titles.mjs` - Batch normalize job titles via Mistral + update Instantly (batches of 15 unique titles)

### Instantly API Notes
- Create lead: `POST /api/v2/leads` (single lead)
- List leads: `POST /api/v2/leads/list` (not GET /leads)
- Update lead: `PATCH /api/v2/leads/{id}`
- Auth: `Bearer ${INSTANTLY_API_KEY}`
- `jobTitle` is a core variable (set at creation), custom variables are in `payload`
