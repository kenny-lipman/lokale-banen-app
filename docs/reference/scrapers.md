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
- **Fase 1 (huidig) - lijst-scan**: elke vacature wordt als minimale rij in `job_postings` gezet met `company_id=null`, `review_status='pending'`. Per `external_vacancy_id` + `source_id`: nieuw -> insert (+ enqueue in `werk_nl_scrape_queue`), bestaand -> alleen `last_seen_in_sitemap` verversen. Geen Mistral, geen company-dedup in deze stap.
- **Geocoding/platform-mapping**: de lijst-scan zet `location = city` (net als werkenindekempen). Dat is nodig omdat de `fix-job-postings-geocoding` cron alleen rijen met `location is not null` oppakt; zo krijgen werk.nl-vacatures een `platform_id` (regio-jobboard).
- **Bewust geen `needs_detail_scrape`**: die boolean is eigendom van de career-page-detail-scrape flow (een bron-blinde cron die elke rij met die vlag oppakt en de generieke career-page-extractor erop draait). werk.nl is een eigen bounded context; de detail-backlog komt in Fase 2 als aparte `werk_nl_scrape_queue`, niet via die gedeelde vlag.
- **Fase 2 - detail-verrijking (worker + eigen queue)**: de worker claimt batches (atomic via RPC `werknl_claim_batch`, `FOR UPDATE SKIP LOCKED`), haalt de detail-API op (2-5s delay), en mapt de payload naar `job_postings`-detailvelden (`description`, `salary`, `working_hours_*`, `education_level`, `expires_at`, `acquisition_not_appreciated`). Company-dedup 3-laags: `werknl_employer_id` (= `employer.referenceNumber`) -> `normalized_name` -> `hoofddomein` -> create, met backfill van `werknl_employer_id` bij cross-source match. Contact uit `contactPerson`. Geen Mistral. Bij 404 of verstreken `expirationDate` -> archiveren (`archived_reason='not_in_werknl'` resp. `'expired'`).
- **Bemiddelaar-detectie**: werk.nl heeft geen schoon signaal (`isByEmployerDirectly` staat ook op `true` voor een zelf-plaatsend uitzendbureau). Heuristiek op `organizationName`/`website` (uitzend/detach/payroll/werving/...), vastgelegd als `companies.is_bemiddelaar` (bronoverstijgend). Zie CONTEXT.md.
- **API**:
  - `POST /api/scrapers/werk-nl` - manual lijst-scan met `Authorization: Bearer $CRON_SECRET`. Body: `{ maxPages?, keywords?, location? }` (default `maxPages=5`). Geeft `orchestration_id` terug.
  - `POST/GET /api/scrapers/werk-nl/worker` - detail-verrijking. Body: `{ orchestrationId, batchSize?, maxBatches? }`.
- **Fase 3 - delisting + cron**: drie cron-routes. (1) Incrementele lijst-scan (`GET /api/scrapers/werk-nl`, dagelijks): stopt na N opeenvolgende volledig-bekende pagina's; archiveert nooit. (2) Volledige pass (`/api/scrapers/werk-nl/full-pass`, elke 30 min, self-gating): cursor-gestuurd over alle ~14.300 pagina's verspreid over runs (state in `werk_nl_scan_state`); bij voltooiing archiveert de sweep alles met `last_seen_in_sitemap < pass_started_at` (`archived_reason='not_in_werknl'`, ADR 0002). Een nieuwe pass start automatisch > 7 dagen na de vorige. (3) Detail-worker (elke 6 min, twee parallelle instances `worker` + `worker-2` die dezelfde `worker-handler` delen): drained orchestratie-agnostisch de queue en reset vastgelopen `processing`-rijen (reaper). Parallel is veilig doordat `werknl_claim_batch` met `FOR UPDATE SKIP LOCKED` disjuncte rijen claimt. `expirationDate` blijft het snelle per-vacature vervalsignaal (archiveer-op-verlopen in de worker).
- **Code**: `lib/scrapers/werk_nl/` (constants, session, types, search-client, mappers, upsert, detail-types, detail-client, detail-mapper, dedup, queue, process-one, worker-handler, incremental, scan-state, delisted). Job source naam: `Werk.nl`. Log-prefix: `[werknl]`. Crons + `maxDuration` in `apps/admin/vercel.json`; zie `docs/reference/cron-jobs.md`.

## Overige scrapers (Apify-based)
- Indeed
- LinkedIn
- Nationale Vacaturebank
