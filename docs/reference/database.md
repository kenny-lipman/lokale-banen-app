# Database (Supabase)

> Bij schema-wijzigingen (nieuwe tabel, kolom, index met betekenis voor de app): werk deze doc bij in dezelfde commit.

- **Supabase Project ID**: `wnfhwhvrknvmidmzeclh`
- Tabellen + kolommen: `snake_case`
- Na schema changes: `apply_migration` -> `get_advisors` -> regenerate TypeScript types via `mcp__supabase__generate_typescript_types`

## Key Tables

- `job_postings` - Alle gescrapete vacatures. Kolom `last_seen_in_sitemap` (timestamptz) gebruikt door werkenindekempen-scraper voor delisted-detection (3-dagen grace voor archive). Kolommen `needs_detail_scrape` (boolean, default false) + `detail_scraped_at` (timestamptz): queue-marker voor de career-page detail-verrijking. Career-page-vacatures worden bij run-completion (`finalize()` -> `upsertJobPostingsFromRun`) aangemaakt. De detailvelden (salary/description/job_type/working_hours/education_level/career_level/categories) worden waar mogelijk al **inline** gevuld door de website-stap (`WebsiteService.crawlAndParse`, eerste ~15 vacatures, gedeelde extractor `vacancy-detail/extract.ts`). Die rijen krijgen `needs_detail_scrape=false`. De overflow (boven de inline-cap) en mislukkingen krijgen `needs_detail_scrape=true` en worden door de cron `career-page-detail-scrape` opgepakt (claimt -> vlag uit, verrijkt, zet `detail_scraped_at`). Smalle partial index `idx_job_postings_needs_detail_scrape (created_at) WHERE needs_detail_scrape` houdt de queue los van alle andere scraper-rijen.
- `companies` - Company records met enrichment data. Kolom `werkenindekempen_id` (text, partial unique index) als primaire dedup-key voor werkenindekempen-source, fallback naar `normalized_name`/`hoofddomein`.
- `contacts` - Contact persons gelinkt aan companies.
- `job_sources` - Scraper sources met `kind` veld:
  - `kind='aggregator'` - Indeed, LinkedIn, Baanindebuurt, Debanensite, etc. (default `review_status='approved'`)
  - `kind='company_career_page'` - werken-bij URL per company. Auto-aangemaakt door enrichment-orchestrator (`finalize()`). User keurt goed/af op `/sales/lead-verrijking/[run_id]` of via `/job-postings/scrape-bronnen`. Unieke partial index `(company_id, url) WHERE kind='company_career_page'`. URLs worden gecanonicaliseerd via `lib/utils/url.ts:normalizeUrl()` (lowercase host, strip www., strip trailing slash/query/fragment).

    **Discovery-cascade in `WebsiteService.crawlAndParse`** (V1A.1):
    1. Mistral-prompt veld `career_page_urls` op homepage-markdown -> method `html_link`
    2. Sitemap-discovery -> method `sitemap`
    3. Subdomain-probe (`careers./werkenbij./jobs./vacatures.{domain}`, parallel HEAD, alleen als 1+2 leeg) -> method `subdomain_probe`

    **Confidence-tier in `internal-linking.upsertCareerPageSource`** bepaalt `review_status` automatisch:
    - URL match in `ats-detect.ts` (recruitee/greenhouse/lever/workable/teamtailor/personio) -> `'approved'` + `is_external_ats=true` + `ats_type=...`
    - method `html_link` (Mistral heeft echte link gezien) -> `'approved'`
    - method `sitemap` of `subdomain_probe` -> `'pending'` (vereist user-approval)
  - V1B forward-compat: `next_scrape_at` is gevuld. Scheduler picks `kind='company_career_page' AND review_status='approved' AND active=true AND next_scrape_at <= now()`.
- `campaign_assignment_batches` - Campaign assignment run tracking (met `orchestration_id` voor parallel grouping)
- `campaign_assignment_logs` - Per-contact processing logs
- `wetarget_leads_staging` - Staging table voor WeTarget campaign leads (sector-based)
- `profiles` - Read-only mirror van `auth.users` (id, email, full_name, role), gesynced via DB-trigger `sync_profile_role`
- `password_reset_tokens` - Custom 15-min reset tokens (hash-only opslag, RLS aan zonder policies)
