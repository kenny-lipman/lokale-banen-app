# Archief-feature voor vacatures — Design

**Datum:** 2026-05-04
**Auteur:** Kenny Lipman + Claude (brainstorm)
**Status:** Design — wacht op review voor implementatie

## Doel

Eén archief-mechanisme voor `job_postings` dat zowel handmatige hygiene (oude pending records uit zicht halen) als geautomatiseerde lifecycle (records ouder dan 180 dagen) afdekt. Vergelijkbaar met Picqer's `active`/`inactive`-model voor producten: soft-deactivatie, data blijft staan, een aparte view om gearchiveerde records terug te vinden.

Twee primaire use-cases:

1. **Hygiene voor pending-stapel** — ~1.000.000 oude pending records (Indeed/LinkedIn jul-sep 2025 + andere historie) zijn niet meer reviewbaar. Reviewer moet alleen relevante records zien.
2. **Lifecycle voor approved/gepubliceerde vacatures** — een vacature is vervuld of niet meer relevant. Hij moet uit publicatie op de regio-sites verdwijnen, maar de data blijft (audit + eventueel terugbrengen).

## Niet in scope

- Auto-archive bij verstreken `end_date` (kan in vervolg-iteratie)
- Auto-archive bij scrape-staleness (vacature niet meer terug bij N opeenvolgende runs)
- IndexNow ping bij activeer (instelling nog niet werkend bij eindgebruiker)
- Hard delete — gearchiveerde records blijven oneindig in DB

## Datamodel

```sql
ALTER TABLE job_postings
  ADD COLUMN archived_at timestamptz DEFAULT NULL,
  ADD COLUMN archived_by uuid REFERENCES auth.users(id) DEFAULT NULL,
  ADD COLUMN archived_reason text DEFAULT NULL;

CREATE INDEX idx_jp_active ON job_postings (created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX idx_jp_archived ON job_postings (archived_at DESC)
  WHERE archived_at IS NOT NULL;
```

### Semantiek

| Scenario | `archived_at` | `archived_by` | `archived_reason` |
|---|---|---|---|
| Actief | `NULL` | `NULL` | `NULL` |
| Auto-archief (cron + bootstrap) | `now()` | `NULL` | `'auto_age_180d'` (vaste string, voor debugging/filtering) |
| Manueel zonder reden | `now()` | `<auth.users.id>` | `NULL` |
| Manueel met reden | `now()` | `<auth.users.id>` | vrije tekst, bv. `'Bedrijf failliet'` |

Combinatie `archived_by IS NULL AND archived_at IS NOT NULL` = systeem-archief. Geen aparte `kind`-kolom nodig.

`archived_reason` is **volledig optioneel** voor handmatige archivering. Reviewer mag leeg laten of vrije tekst meegeven.

`review_status` blijft tijdens archivering ongewijzigd: archief is orthogonaal aan review-workflow. Bij Activeer keert de vacature terug naar de tab waar 'ie vandaan kwam.

`published_at` wordt **nooit** aangeraakt door archive of activate. Dat veld blijft een one-shot timestamp ("toen werd dit voor het eerst publiek"). Zichtbaarheid hangt 100% aan `archived_at`.

### Bootstrap (eenmalig, na schema-deploy)

```sql
UPDATE job_postings
SET archived_at = NOW(),
    archived_reason = 'auto_age_180d'
WHERE created_at < NOW() - INTERVAL '180 days'
  AND archived_at IS NULL
  AND NOT (review_status = 'approved' AND published_at IS NOT NULL);
```

Verwacht: ~1.0M records gearchiveerd. De partial index `idx_jp_active` zorgt dat de actieve queries daarna ~10k rows raken in plaats van 1M.

De `NOT (approved+published)`-clause beschermt vacatures die bewust live staan op regio-sites tegen onbedoeld auto-offlinehalen.

## Admin UI

### Tabs in `/job-postings`

```
[ Pending ] [ Approved ] [ Rejected ] [ Alle ] [ Archief ]
```

Standaard filter op alle tabs behalve **Archief**: `archived_at IS NULL`. Archief-tab: `archived_at IS NOT NULL`. Tab-counts gebruiken hetzelfde `10.000+`-cap-patroon als de bestaande tabs.

### Acties per tab

**Pending / Approved / Rejected / Alle:**
- Bestaande Approve / Reject knoppen blijven
- **Nieuwe knop "Archiveer"** (rij-actie + bulk-actie via bestaande bulk-action-bar)
- Bij klik: dialog met optionele text-area voor reden. Bevestig → `archived_at=now()`, `archived_by=<huidige user>`, `archived_reason=<ingevuld of NULL>`

**Archief-tab:**
- Bestaande review-acties verdwijnen
- **Nieuwe knop "Activeer"** (rij-actie + bulk-actie)
- Bij klik: directe activering zonder dialog → `archived_at=NULL`, `archived_by=NULL`, `archived_reason=NULL`. De vacature gaat terug naar de tab waar 'ie vandaan kwam.

### Drawer (job-posting detail-paneel)

Voor gearchiveerde vacatures: badge **"Gearchiveerd"** boven de titel + datum + (indien aanwezig) `archived_by` naam + reden.

## Effect op publieke regio-sites

Alleen relevant voor **approved + gepubliceerde** vacatures (`review_status = 'approved' AND published_at IS NOT NULL`).

### State-machine

```
ACTIEF                    ARCHIEF (grace)              ARCHIEF (gone)
                          0–30 dagen na                >30 dagen na
                          archived_at                  archived_at
─────────────────────────────────────────────────────────────────────────
/vacatures listings:      ❌ niet zichtbaar            ❌ niet zichtbaar
/vacature/<slug> detail:  ✅ 200 OK                    ❌ 410 Gone
                          + <meta name=noindex>
                          + "Vacature afgelopen"-bordje
sitemap.xml:              ❌ niet meer in              ❌ niet meer in
```

**Detail-pagina** drie staten:
1. Actief (`archived_at IS NULL`) → 200 OK, normaal
2. Grace period (`archived_at >= now() - interval '30 days'`) → 200 OK met afgelopen-bordje + `<meta name="robots" content="noindex">`
3. Permanent weg (`archived_at < now() - interval '30 days'`) → **410 Gone** response, geen content

De 30-dagen grace begint opnieuw bij elke archivering. Als iemand een vacature die 60 dagen gearchiveerd was activeert en daarna opnieuw archiveert, krijgt 'ie weer 30 nieuwe dagen grace.

### Cache-invalidation

Bij archiveren én activeren van een approved+published vacature triggert dezelfde revalidatie als bij review-acties:

```ts
revalidateTag(`platform:${platform_id}`)
revalidateTag(`jobs:${platform_id}`)
revalidateTag(`sitemap:${platform_id}`)
revalidateTag(`job:${slug}`)
```

Bestaande revalidate-helper hergebruiken.

### Activeer-gedrag (per scenario)

| Eerdere staat | Resultaat na Activeer |
|---|---|
| Pending, gearchiveerd | Terug in pending tab. Niet publiek. Reviewer moet alsnog approven. |
| Approved, niet gepubliceerd | Terug, kan nog gepubliceerd worden via bestaande flow. |
| Approved + published, gearchiveerd <30d | Direct weer in listings, sitemap, detail = 200 OK. |
| Approved + published, gearchiveerd >30d (was 410 Gone) | Direct weer in listings, sitemap, detail = 200 OK. `published_at` blijft de oorspronkelijke datum. Google moet hercrawlen — duurt natuurlijke tijd. |

## Backend

### RPC-aanpassingen

**`get_job_posting_counts`** — bestaande buckets (`pending`, `approved`, `rejected`, `all`) krijgen extra `AND archived_at IS NULL`. Nieuwe bucket toegevoegd:

```sql
RETURN QUERY SELECT
  'archived'::text,
  (SELECT count(*) FROM (
    SELECT 1 FROM job_postings
    WHERE archived_at IS NOT NULL
      AND (platform_filter IS NULL OR platform_id = platform_filter)
    LIMIT cap_plus_one
  ) sub)::bigint,
  (SELECT count(*) FROM (
    SELECT 1 FROM job_postings
    WHERE archived_at IS NOT NULL
      AND (platform_filter IS NULL OR platform_id = platform_filter)
    LIMIT cap_plus_one
  ) sub)::bigint >= cap_plus_one;
```

**`search_job_postings`** — nieuwe parameter `archived_filter text DEFAULT 'active'`. Waarden: `'active'` (default), `'archived'`, `'all'`. Toegevoegd aan beide WHERE-clauses (text-search-pad én default-pad) én aan de count-subquery's:

```sql
AND (
  (archived_filter = 'active' AND jp.archived_at IS NULL)
  OR (archived_filter = 'archived' AND jp.archived_at IS NOT NULL)
  OR (archived_filter = 'all')
)
```

Frontend (`use-job-postings-cache`) stuurt het filter mee op basis van actieve tab.

### API endpoints

```
POST /api/job-postings/{id}/archive
  body: { reason?: string }
  effect:
    UPDATE job_postings
    SET archived_at=now(),
        archived_by=<authUser.id>,
        archived_reason=<reason or NULL>
    WHERE id=$1;
  cache: revalidate als (review_status='approved' AND published_at IS NOT NULL)

POST /api/job-postings/{id}/activate
  body: {}
  effect:
    UPDATE job_postings
    SET archived_at=NULL,
        archived_by=NULL,
        archived_reason=NULL
    WHERE id=$1;
  cache: revalidate als (review_status='approved' AND published_at IS NOT NULL)
```

Bulk-varianten op `/api/job-postings/bulk-archive` en `bulk-activate` met `{ ids: string[], reason?: string }`. Sluit aan bij de bestaande bulk-action-bar in `JobPostingsTable`.

### Vercel cron — auto-archive 180d

Nieuwe route `app/api/cron/auto-archive-old/route.ts`:

```sql
UPDATE job_postings
SET archived_at = NOW(),
    archived_reason = 'auto_age_180d'
WHERE archived_at IS NULL
  AND created_at < NOW() - INTERVAL '180 days'
  AND NOT (review_status = 'approved' AND published_at IS NOT NULL);
```

Belangrijk: approved+gepubliceerde vacatures NIET auto-archiveren. Een vacature die je 6 maanden geleden goedkeurde en publiceerde is bewust live; cron mag die niet stilletjes offline halen door tijdsverloop.

`vercel.json` entry:

```json
{ "path": "/api/cron/auto-archive-old", "schedule": "0 3 * * *" }
```

03:00 UTC = 04:00 NL winter, vóór de scrapers (05:00/06:00 UTC). Wrapper: bestaande `withCronMonitoring()`.

### Public-sites query-aanpassingen

Alle queries in `apps/public-sites/` die `job_postings` lezen krijgen `archived_at IS NULL` filter:

- `/vacatures` listings
- `/sitemap.xml`

Detail-route `/vacature/[slug]` krijgt drie-state-logica (zie public-sites sectie). Concrete code-paden tijdens implementatie te identificeren.

### Bestaande scripts/queries die filter nodig hebben

Na schema-wijziging één-voor-één auditen en updaten:

- `scripts/seed-approved-per-platform.mjs` — `&archived_at=is.null` toevoegen
- `apps/admin/lib/services/lokalebanen-push.service.ts` — twee queries op approved jobs filteren op `archived_at IS NULL`
- Andere RPC's en services die `job_postings` lezen — auditen tijdens implementatie

## Implementatie-volgorde

1. Schema-migratie (kolommen + indexen)
2. Bootstrap-UPDATE
3. RPC-updates (`get_job_posting_counts`, `search_job_postings`)
4. API endpoints (archive, activate, bulk-archive, bulk-activate)
5. Admin UI (tabs, acties, drawer-badge)
6. Cron-route + `vercel.json` entry
7. Public-sites query-updates + detail-state-machine
8. Audit van resterende scripts/services voor filter

## Open vragen / aannames

- Aanname: `auth.users` is de tabel waar admin-users uit komen. Tijdens implementatie verifiëren of het een andere tabel/kolom is.
- Aanname: alle bestaande `revalidateTag`-aanroepen in admin gebruiken dezelfde tag-namen als hierboven. Tijdens implementatie verifiëren.
- 410 Gone-response van Next.js detail-route: te implementeren via `notFound()` met custom status of expliciete `Response`-object met status 410.
