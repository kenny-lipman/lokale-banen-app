# Lokale Banen - Claude Code Context

## Project Overview

Lokale Banen is a job posting aggregation platform that scrapes vacancies from multiple sources, enriches company data, and syncs with CRM systems (Pipedrive, Instantly).

## Deployment

- **Production URL**: `https://lokale-banen-app.vercel.app`
- **Platform**: Vercel (Next.js)
- **Database**: Supabase (PostgreSQL)
- **Supabase Project ID**: `wnfhwhvrknvmidmzeclh`

## Cron Jobs (Supabase pg_cron)

All cron jobs use **UTC timezone**. Convert to Dutch time:
- **Winter (CET)**: UTC + 1 hour
- **Summer (CEST)**: UTC + 2 hours

**Production API base URL for cron jobs**: `https://lokale-banen-app.vercel.app`

### Active Cron Jobs

| Job | Schedule (UTC) | NL Time | Endpoint |
|-----|---------------|---------|----------|
| Daily Automation | `0 4 * * *` | 05:00 | `/api/cron/trigger-automation` |
| Baanindebuurt Scraper | `0 5 * * *` | 06:00 | `/api/scrapers/baanindebuurt` |
| Debanensite Scraper | `0 6 * * *` | 07:00 | `/api/scrapers/debanensite` |

### Creating New Cron Jobs

```sql
SELECT cron.schedule(
  'job-name',
  '0 5 * * *',  -- 05:00 UTC = 06:00 NL winter time
  $$
  SELECT net.http_post(
    url := 'https://lokale-banen-app.vercel.app/api/your-endpoint',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || '${CRON_SECRET_KEY}'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

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
- `CRON_SECRET_KEY` - For authenticating cron job requests
- `MISTRAL_API_KEY` - For AI parsing in baanindebuurt scraper
- `SUPABASE_SERVICE_ROLE_KEY` - For server-side Supabase operations

## Database Key Tables

- `job_postings` - All scraped vacancies
- `companies` - Company records with enrichment data
- `contacts` - Contact persons linked to companies
- `job_sources` - Scraper sources (Indeed, LinkedIn, Baan in de Buurt, etc.)
