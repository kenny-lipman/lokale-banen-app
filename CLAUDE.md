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
| Debanensite Scraper | `0 6 * * *` | 07:00 | `/api/scrapers/debanensite` |
| Refresh Campaign Eligible | `30 6 * * *` | 07:30 | `/api/cron/refresh-campaign-eligible` |
| Campaign Assignment | `0 7,13,19 * * *` | 08:00, 14:00, 20:00 | `/api/cron/campaign-assignment` |
| Postcode Backfill | `*/2 * * * *` | Elke 2 min | `/api/cron/postcode-backfill` |
| Refresh Contact Stats | `*/5 * * * *` | Elke 5 min | `/api/cron/refresh-contact-stats` |
| Watchdog | `*/15 * * * *` | Elke 15 min | `/api/cron/watchdog` |

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

## Database Key Tables

- `job_postings` - All scraped vacancies
- `companies` - Company records with enrichment data
- `contacts` - Contact persons linked to companies
- `job_sources` - Scraper sources (Indeed, LinkedIn, Baan in de Buurt, etc.)
