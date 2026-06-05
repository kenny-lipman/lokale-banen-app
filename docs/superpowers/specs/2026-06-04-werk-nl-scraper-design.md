# Design: werk.nl scraper

- **Datum:** 2026-06-04
- **Status:** Ter review
- **Branch:** `feat/werk-nl-scraper`
- **Auteur:** Kenny + Claude

## 1. Doel en context

Een nieuwe scrape-bron toevoegen voor werk.nl (UWV), de landelijke vacaturebank. Doel: alle vacatures op werk.nl die we nog niet in onze database hebben binnenhalen en bij wijzigingen actueel houden.

werk.nl is strategisch de sterkste bron die we kunnen toevoegen:
- **Gratis en op eigen infra** (geen Apify-kosten zoals Indeed/LinkedIn).
- **~270.000 vacatures landelijk.**
- **Levert leads kant-en-klaar:** de detail-API geeft direct contactpersoon (naam, e-mail, telefoon) en bedrijfswebsite. Dat is exact de data waar de bestaande enrichment/campaign-machinerie (Apollo, WeTarget, Pipedrive, Instantly) op draait.

De bron plugt in de bestaande pijplijn (`job_sources` -> company-dedup -> `contacts` -> geocoding-cron -> campaigns). We bouwen geen nieuwe machine; we hangen een bron aan een draaiende pijplijn. Referentie-implementatie: de **werkenindekempen**-scraper (modernste template in de codebase).

## 2. Onderzoeksbevindingen (bewezen werkend)

werk.nl heeft geen officiele API, maar de Angular-zoekapp gebruikt een interne **publieke** JSON-API die volledig **server-side, zonder headless browser** benaderbaar is. Live geverifieerd met curl op 2026-06-04. robots.txt staat scrapen toe (enkel `/webpublicaties` disallowed); UWV bevestigt publiekelijk dat scrapen is toegestaan.

**Toegangsketen:**

1. **OAM anonieme sessie bootstrappen** (Oracle Access Manager): `GET https://www.werk.nl/nl/vacatures/?friendlyurl=%2Fvacatures` met cookie-jar en redirects volgen. Levert automatisch `OAMAuthnCookie_www.werk.nl:443` (geen DigiD/credentials nodig).
2. **XSRF-token ophalen:** `GET .../werkzoekenden/mijn-werkmap/kia/publiek/zoekenvacatures` (geeft 404, maar zet `XSRF-TOKEN` + `.AspNetCore.Antiforgery` cookies). De `XSRF-TOKEN`-cookiewaarde gaat mee als `X-XSRF-TOKEN`-header bij de POST.
3. **Zoeken (lijst):** `POST .../publiek/zoekenvacatures/api/search`
   - Body: `{"facets":[],"keywords":"","location":"","currentPage":1,"sort":{"by":1,"direction":1},"includeFirstExpansion":false,"includeSecondExpansion":false}` (body-vorm gereverse-engineerd uit NgRx-bundle `.../apps/zoekenvacatures/main.js`, selector `Wc`; `sort.by=1` = nieuwste).
   - Respons: `items[]` (20/pagina), `facets[]` (counts), `totalResults` (~270.922 landelijk).
   - Lijst-velden per vacature: `key`, `referenceNumber`, `profession`, `vacatureTitle`, `modified`, `organisation`, `workLocationCity`, `workLocationType`, `minHours`, `maxHours`, `contractType`, `studyLevel`, `leerbaan`, `stageplaats`.
4. **Detail per vacature:** `GET .../publiek/zoekenvacatures/api/vacature/{referenceNumber}`
   - Velden: `description`, `expirationDate`, `modifiedDate`, `createdDate`, `proposition` (function code/naam, arbeidsvoorwaarden, workLocation met postcode/stad), `employer` (organizationName, **website**, sector, volledig adres, `referenceNumber`), `contactPerson` (name, department, **phoneNumber**, **email**), `applicationMethods`, `source`.

**Belangrijke eigenschappen:**
- IDs (`referenceNumber`) zijn **niet aaneengesloten oplopend**. Test: 60 opeenvolgende IDs = 0 hits. Een sequentiele ID-walk valt af; de search-API is de enige zinnige bron.
- Een vacature die nog in de search-resultaten staat, is per definitie nog actief (werk.nl toont geen verlopen vacatures publiek). "Niet meer in de lijst" is dus het delisting-signaal.
- De OAM-sessie kan verlopen; sessie-laag moet automatisch opnieuw bootstrappen.

## 3. Scope

**In scope:**
- Landelijke lijst-scan van alle ~270k vacatures (incrementeel + initiele backfill).
- Detail-verrijking van alle vacatures (volledige data, voor company-dedup en contacts).
- Company-dedup (3-laags) en contact-aanmaak.
- Delisting (archiveren van verdwenen/verlopen vacatures).

**Out of scope:**
- Mistral/AI-verrijking (werk.nl levert de velden gestructureerd; niet nodig).
- Regio-filtering aan de bron (we halen alles landelijk; platform-mapping gebeurt door de bestaande geocoding-cron).
- Prioritering van de detail-queue op commerciele waarde (bewust FIFO; zie beslissing 4).

## 4. Beslissingen

1. **Snelheid eerste vulling:** 2-5s human-delay per detailcall (werkenindekempen-norm). Lijst-scan is binnen 1-2 dagen compleet; detail-verrijking van 270k druppelt over weken. **Gefaseerd** uitrollen: eerst lijst, dan detail.
2. **Geen Mistral.** De detail-API levert contact, uren, opleiding en functie gestructureerd.
3. **Aparte `werk_nl`-queue** (niet de bestaande `needs_detail_scrape`/career-page-flow hergebruiken). Reden: bounded context, kleinere blast radius, onafhankelijk pauzeren/schalen, eigen observability. Consistent met werkenindekempen (eigen queue per bron-scraper).
4. **Detail-queue = FIFO (oudste eerst), maar alleen nog-actieve vacatures.** Geen detailcalls verspillen aan vacatures die intussen verlopen/gedelist zijn. Een rij wordt alleen geclaimd als hij in de laatste lijst-scan nog gezien is (recente `last_seen`). Verdwijnt een vacature voor z'n beurt, dan wordt hij niet verrijkt maar gearchiveerd.

## 5. Architectuur

### 5.1 Sessie-laag (nieuw, herbruikbaar)
`lib/scrapers/werk_nl/session.ts`: bootstrapt OAM-sessie + XSRF-token, beheert de cookie-jar, en herhaalt de bootstrap bij sessieverloop (detectie via redirect-naar-login of 401/403). Levert een `fetch`-wrapper die de juiste cookies + `X-XSRF-TOKEN`-header meestuurt. Hergebruikt de identity-pool/headers-aanpak van `werkenindekempen/headers.ts`.

### 5.2 Fase 1 - Lijst-scan (orchestrator)
`app/api/scrapers/werk-nl/route.ts` (GET = cron met start-jitter; POST = manual).
- Pagineert de search-API op `sort=nieuwste`.
- Per item: upsert minimale rij in `job_postings` op `(external_vacancy_id=referenceNumber, source_id)`. Basisvelden uit de lijst gevuld.
- Nieuw of gewijzigd (`modified` veranderd) -> markeer voor detail-verrijking (enqueue in `werk_nl_scrape_queue`).
- Ververs `last_seen` per geziene vacature.
- **Incrementeel (dagelijks):** stop zodra N opeenvolgende pagina's enkel bekende, ongewijzigde vacatures bevatten.
- **Initiele backfill:** loop in stappen door alle ~13.500 pagina's, verspreid over meerdere cron-runs via opgeslagen cursor (`currentPage`). `app/api/scrapers/werk-nl/backfill/route.ts` (Bearer `CRON_SECRET`) voor handmatige bulk.

### 5.3 Fase 2 - Detail-verrijking (worker + eigen queue)
`werk_nl_scrape_queue` tabel + `werknl_claim_batch` RPC (kopie van `werkenindekempen_scrape_queue` + `wik_claim_batch`). Eigen cron/worker `app/api/scrapers/werk-nl/worker/route.ts`:
- Claimt batch oudste rijen die nog actief zijn (recente `last_seen`).
- `GET` detail-API per `referenceNumber`, 2-5s delay tussen calls.
- Vult `description`, `proposition`, `applicationMethods`; doet company-dedup (`employer`) en contact-aanmaak (`contactPerson`); slaat `expirationDate` op.
- Bij 404 / verstreken `expirationDate`: archiveer i.p.v. verrijk.
- Zet rij op klaar (`detail_scraped_at`), verwijder uit queue.

### 5.4 Company-dedup (3-laags)
Zoals werkenindekempen, met werk.nl-specifieke laag 1:
1. `companies.werknl_employer_id` (= `employer.referenceNumber`, stabiele bedrijfs-id): nieuwe kolom + partial unique index.
2. `normalized_name`.
3. `hoofddomein` (uit `employer.website`).
4. Geen match -> create. Backfill `werknl_employer_id` bij match via laag 2/3.

### 5.5 Delisting
- Wekelijkse volledige lijst-scan (alleen search, geen detailcalls = ~13.500 goedkope calls) ververst `last_seen` voor alle nog-bestaande vacatures.
- Vacatures met `last_seen` ouder dan 3 dagen (grace) -> `archived_reason='not_in_werknl'`.
- Aanvullend signaal: `expirationDate` uit detail -> archiveren zodra verstreken.

### 5.6 Platform-mapping
Geen logica in de scraper. De bestaande `fix-job-postings-geocoding` cron mapt stad/postcode -> `platform_id`.

## 6. Database-wijzigingen

- `companies.werknl_employer_id` (text, partial unique index): dedup-laag 1.
- `werk_nl_scrape_queue` tabel (kopie werkenindekempen-structuur) + `werknl_claim_batch` RPC.
- `job_postings`: hergebruik bestaande `external_vacancy_id`, `source_id`, `last_seen_in_sitemap` (als generieke "laatst gezien in bron"), `archived_reason`. Geen nieuwe kolommen verwacht; planner verifieert.
- `job_sources`: nieuwe rij "Werk.nl", `kind='aggregator'`.
- Na migraties: `get_advisors` + TypeScript types regenereren.

## 7. API-routes (met `// @auth` marker op regel 1)

| Route | Methode | Doel | Auth |
|-------|---------|------|------|
| `/api/scrapers/werk-nl` | GET | Cron orchestrator lijst-scan (jitter) | SECRET |
| `/api/scrapers/werk-nl` | POST | Manual lijst-scan, custom config | SECRET |
| `/api/scrapers/werk-nl/backfill` | POST | Handmatige bulk-backfill | Bearer CRON_SECRET |
| `/api/scrapers/werk-nl/worker` | GET/POST | Detail-verrijking (claim + enrich) | SECRET |

Cron-registratie in `apps/admin/vercel.json` (orchestrator dagelijks + worker frequent), met `maxDuration` per functie. Worker re-chained zichzelf zolang er queue-werk en tijd is.

## 8. Lib-structuur (`apps/admin/lib/scrapers/werk_nl/`)

`session.ts` (OAM+XSRF), `headers.ts` (identity-pool), `search-client.ts` (search-API + paginering), `detail-client.ts` (detail-API), `types.ts` (Zod-schema's lijst + detail), `mappers.ts` (API -> job_postings/companies/contacts), `dedup.ts` (3-laags), `queue.ts` (enqueue/claim/finalize), `delisted.ts` (last_seen + archive). Shared helpers uit `lib/scrapers/shared/` hergebruiken.

## 9. Risico's

- **Ongedocumenteerde API.** werk.nl kan search-API/OAM-flow wijzigen -> scraper breekt. Mitigatie: geisoleerde sessie-laag, monitoring via bestaande `job_sources.consecutive_failures`, gedocumenteerde body-shape.
- **Veel intermediair-vacatures** (uitzenders/doorplaatsers als "organisation"). Voor lead-gen: soms uitzendbureau i.p.v. eindwerkgever. Cross-source dedup met bestaande bronnen (Indeed etc.) wordt belangrijker.
- **Load op overheidssite.** 270k+ calls -> nette rate-limiting verplicht (2-5s delay, EU-region, gefaseerd). Niet als DoS overkomen.

## 10. Testplan (Vitest, `apps/admin/__tests__/scrapers/werk_nl/`)

- `session.test.ts`: bootstrap-flow met gemockte redirect-keten + XSRF-extractie.
- `mappers.test.ts`: lijst- en detail-respons -> job_postings/company/contact velden.
- `dedup.test.ts`: 3-laags (laag 1/2/3 hit + create), backfill `werknl_employer_id`.
- `delisted.test.ts`: last_seen-grace + archive op `expirationDate`.
- `.live-mini-run.test.ts` (skip-by-default): kleine echte run tegen werk.nl ter validatie.

## 11. Referentie-implementatie

`apps/admin/lib/scrapers/werkenindekempen/*` + `apps/admin/app/api/scrapers/werkenindekempen/*` + migraties `20260515111204_werkenindekempen_scrape_queue.sql` en `20260515111400_wik_claim_batch_rpc.sql`. werk.nl = copy-adapt: vervang sitemap -> search-API en JSON-LD-detail -> detail-API.

## 12. Doc-onderhoud

Bij implementatie `docs/reference/scrapers.md` (nieuwe bron) en `docs/reference/database.md` (queue-tabel, `werknl_employer_id`) bijwerken in dezelfde commit (CLAUDE.md hard rule).
