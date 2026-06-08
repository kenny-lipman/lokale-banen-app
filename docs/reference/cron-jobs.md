# Cron Jobs

> Bij toevoegen/wijzigen van een cron job (schedule, endpoint, verplaatsing tussen Vercel Cron en pg_cron): werk deze doc bij in dezelfde commit en check `vercel.json`.

Alle cron jobs draaien via **Vercel Cron** (geconfigureerd in `vercel.json`). Auth via `CRON_SECRET` env var.

**Timezone**: UTC. Omrekenen naar Nederlandse tijd: Winter (CET) = UTC + 1u, Zomer (CEST) = UTC + 2u.

## Actieve Vercel Cron Jobs

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
| Career-page Detail Scrape | `*/10 * * * *` | Elke 10 min | `/api/cron/career-page-detail-scrape` |
| Werk.nl Lijst-scan (incrementeel) | `0 6 * * *` | 07:00 | `/api/scrapers/werk-nl` (GET) |
| Werk.nl Volledige pass | `*/30 * * * *` | Elke 30 min (self-gating) | `/api/scrapers/werk-nl/full-pass` |
| Werk.nl Detail-worker | `*/6 * * * *` | Elke 6 min | `/api/scrapers/werk-nl/worker` |
| Werk.nl Detail-worker 2 (parallel) | `*/6 * * * *` | Elke 6 min | `/api/scrapers/werk-nl/worker-2` |

**Werk.nl scan-strategie (Fase 3):** de incrementele scan (GET) ontdekt dagelijks nieuwe vacatures en stopt vroeg zodra hij enkel bekende ziet; hij archiveert nooit. De volledige pass is self-gating: hij doet alleen werk als een pass actief is of de vorige > 7 dagen geleden afrondde (anders meteen "niet due"), loopt cursor-gestuurd over ~14.300 pagina's verspreid over runs, en archiveert bij voltooiing alles met `last_seen_in_sitemap < pass_started_at` (ADR 0002, delisting). De worker draint orchestratie-agnostisch de detail-queue en reset vastgelopen `processing`-rijen (reaper). Monitoring loopt via `job_sources.consecutive_failures` (bestaande watchdog).

**Detail-worker parallel (2 instances):** de detail-worker draait als twee aparte cron-routes (`worker` + `worker-2`), beide elke 6 min, beide dezelfde drain-loop uit `lib/scrapers/werk_nl/worker-handler.ts`. De queue claimt via `werknl_claim_batch` met `FOR UPDATE SKIP LOCKED`, dus de twee instances pakken disjuncte rijen (geen dubbel werk). Doel: backlog ~2x sneller draineren. Let op: dit verdubbelt het request-tempo richting werk.nl; bij een spike in `error`-rijen of `archived_reason='not_in_werknl'` terugschalen naar 1 worker.

## Resterende pg_cron Jobs (Supabase)

Alleen lichte DB-interne jobs blijven in pg_cron:
- `refresh-contact-stats` (job 1) - Direct SQL materialized view refresh (backup, draait ook via Vercel Cron)
- `cleanup-cron-job-logs` (job 31) - Verwijdert logs ouder dan 30 dagen
- `cleanup-watchdog-alerts` (job 32) - Verwijdert alerts ouder dan 90 dagen

## Monitoring

Alle Vercel Cron endpoints gebruiken de `withCronMonitoring()` wrapper die naar de `cron_job_logs` tabel logt.
De watchdog job checkt alle jobs elke 15 min en stuurt Slack alerts voor overdue jobs.
