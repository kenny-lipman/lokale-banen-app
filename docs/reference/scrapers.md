# Scrapers

> Bij significante wijziging aan een scraper (bron, methode, dedup-logica, config): werk deze doc bij in dezelfde commit.

Lokale Banen scrapet vacatures uit meerdere bronnen. Een deel draait lokaal (geen Apify), een deel via Apify.

## Baanindebuurt.nl
- **Source**: PDF-based job postings van `baanindebuurt.nl/vacatures.php`
- **Method**: Local scraper (geen Apify)
- **AI**: Mistral voor PDF text parsing
- **Features**:
  - Multi-page pagination met cookie session handling
  - Extraheert company data (website, phone, email)
  - Maakt contacts met name, email, phone, title
- **API**: `POST /api/scrapers/baanindebuurt`

## Debanensite.nl
- **Source**: HTML job postings van `debanensite.nl/vacatures`
- **Method**: Local scraper (geen Apify)
- **AI**: Mistral voor extractie van contact info, salary, requirements uit descriptions
- **Features**:
  - Extraheert data uit `__NEXT_DATA__` JSON (Elasticsearch format)
  - ~6.700 vacatures over 670 pagina's
  - Batch-based scraping (configureerbaar pages per run)
  - Maakt companies en contacts automatisch
- **API**: `POST /api/scrapers/debanensite`
- **Config options**: `maxPagesPerRun`, `startPage`, `mode` (full/incremental)

## Werkenindekempen.nl
- **Source**: `sitemap-wik-vacancies.xml` (dagelijks ververst, ~1.099 actieve vacatures, regio Kempen + Eindhoven e.o.)
- **Method**: Sitemap-driven incremental (geen pagineerde scraping)
- **AI**: Mistral op description voor `contact`/`working_hours_min`/`working_hours_max`/`education_level`/`career_level`/`categories`
- **Anti-detection**: realistic Chrome-fingerprint (3 identity-pool), `preferredRegion: ['fra1','ams1']` (EU-IPs), 30-min start jitter, 2-5s human-delay tussen detail-fetches, session-cookie reuse binnen run, geen identificeerbare LokaleBanen/KempenseBanen strings in headers
- **Features**:
  - JSON-LD JobPosting parse (Zod-validated, strict)
  - 3-laagse company-dedup: `companies.werkenindekempen_id` -> `normalized_name` -> `hoofddomein` -> create
  - Delisted-detection via `job_postings.last_seen_in_sitemap` + 3-dagen grace -> `archived_reason='not_in_sitemap'`
  - Geen platform-mapping in scraper zelf. Bestaande `fix-job-postings-geocoding` cron mapt city/postcode -> `platform_id` (KempenseBanen/HelmondseBanen/EindhovenseBanen)
- **API**:
  - `GET /api/scrapers/werkenindekempen` - Vercel Cron (30 min jitter)
  - `POST /api/scrapers/werkenindekempen` - manual, custom config
  - `POST /api/scrapers/werkenindekempen/backfill` - handmatige bulk-run met `Authorization: Bearer $CRON_SECRET`
- **Config options**: `maxUrlsPerRun` (default 200), `delayMinMs`/`delayMaxMs`, `skipAI`, `dryRun`, `skipStartJitter`

## Werk.nl
- **Source**: publieke UWV vacature-zoek-API (`werk.nl`, ~286.000 actieve vacatures, landelijk). Geen DigiD nodig; wel OAM-gated (Oracle Access Manager).
- **Method**: server-side, geen browser en geen Apify. Een sessie-laag bootstrapt een anonieme OAM-sessie (volgt de redirect-keten met een eigen cookie-jar), haalt een XSRF-token op, en POST daarna op de zoek-API. Node `fetch` met handmatige cookie-jar, geen extra dependency.
- **Endpoints**:
  - Bootstrap (GET): `https://www.werk.nl/nl/vacatures/?friendlyurl=%2Fvacatures` (zet `OAMAuthnCookie`)
  - XSRF (GET): `.../kia/publiek/zoekenvacatures` (404-respons, maar zet `XSRF-TOKEN` cookie)
  - Search (POST): `.../kia/publiek/zoekenvacatures/api/search` (gepagineerd, 20 items per pagina, sort op nieuwste)
  - Detail (GET): `.../kia/publiek/zoekenvacatures/api/vacature/{referenceNumber}` (Fase 2)
- **Anti-detection**: realistic Chrome-fingerprint (gedeelde identity-pool met werkenindekempen), `preferredRegion: ['fra1','ams1']` (EU-IPs), 0,8-1,5s human-delay tussen pagina's, session-cookie reuse binnen run.
- **Fase 1 (huidig) - lijst-scan**: elke vacature wordt als minimale rij in `job_postings` gezet met `needs_detail_scrape=true`, `company_id=null`, `review_status='pending'`. Per `external_vacancy_id` + `source_id`: nieuw -> insert, bestaand -> alleen `last_seen_in_sitemap` + `needs_detail_scrape` verversen. Geen Mistral, geen company-dedup.
- **API**:
  - `POST /api/scrapers/werk-nl` - manual lijst-scan met `Authorization: Bearer $CRON_SECRET`. Body: `{ maxPages?, keywords?, location? }` (default `maxPages=5`).
- **Code**: `lib/scrapers/werk_nl/` (constants, session, types, search-client, mappers, upsert). Job source naam: `Werk.nl`. Log-prefix: `[werknl]`.
- **Later (Fase 2/3)**: detail-verrijking via de detail-API (queue + worker), 3-laags company-dedup op `werknl_employer_id`, contacten, delisting + cron-registratie + watchdog.

## Overige scrapers (Apify-based)
- Indeed
- LinkedIn
- Nationale Vacaturebank
