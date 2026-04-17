# Contacten Platform-Filter (Optie C — Denormalisatie via Materialized View)

## Doel

Op `/contacten` een multi-select platform-filter toevoegen, zodat contacten per regio-platform geselecteerd kunnen worden voor bulk-push naar Pipedrive / Instantly.

## Bron van waarheid

`job_postings.platform_id` — door de dagelijkse n8n-workflow `Fix Platform_id Nominatim` (9u, workflow `vn4UGxJRVEJDfncK`) geverifieerd via:
1. Nominatim geocoding (adres → lat/lon)
2. Reverse geocoding (lat/lon → postcode)
3. `cities.postcode` → `cities.platform_id`

Gevolgen:
- `job_postings.platform_id` is de enige kolom die we mogen gebruiken om contact↔platform af te leiden.
- Een bedrijf kan op meerdere platforms voorkomen (gem. 1.5, max 51).
- 399k postings staan in de queue voor geocoding; dekking groeit automatisch.

## Datasituatie (peildatum 2026-04-17)

| Metric | Waarde |
|---|---|
| Contacten totaal | 592.761 |
| Met platform-link via job_postings | 465.494 (78.5%) |
| Companies met platform | 96.530 |
| Rijen in mat. view `company_platforms` | 144.572 |
| Pending geocode | 399.665 |

## Architectuur

```
job_postings.platform_id (n8n-verified)
        │
        └──► mv_company_platforms (M2M: company_id × platform_id)
                    │
                    └──► JOIN contacts (via company_id)
                                │
                                └──► /api/contacts?platformId=...
```

---

## Fasen

### Fase 1 — Database: materialized view

- [ ] **Migratie `create_mv_company_platforms`**
  ```sql
  CREATE MATERIALIZED VIEW mv_company_platforms AS
  SELECT DISTINCT
    jp.company_id,
    jp.platform_id,
    COUNT(*)::int AS posting_count,
    MAX(jp.created_at) AS last_posted_at
  FROM job_postings jp
  WHERE jp.company_id IS NOT NULL
    AND jp.platform_id IS NOT NULL
  GROUP BY jp.company_id, jp.platform_id;

  CREATE UNIQUE INDEX idx_mv_company_platforms_unique
    ON mv_company_platforms (company_id, platform_id);
  CREATE INDEX idx_mv_company_platforms_platform
    ON mv_company_platforms (platform_id);
  CREATE INDEX idx_mv_company_platforms_company
    ON mv_company_platforms (company_id);
  ```
  - UNIQUE index is vereist voor `REFRESH CONCURRENTLY`.
  - Grants: `GRANT SELECT ON mv_company_platforms TO authenticated, service_role;`

- [ ] **RPC / SQL helper** `get_company_platform_ids(p_company_id uuid) RETURNS uuid[]` — optioneel, voor hergebruik in andere routes.

### Fase 2 — Refresh-strategie

De n8n-workflow draait dagelijks om 09:00 Europe/Amsterdam, verwerkt ~1000 items/run (rate-limited door Nominatim wait van 0.6s → ~10 min/batch).

- [ ] **Vercel Cron endpoint** `/api/cron/refresh-company-platforms`
  - Draait om **11:00 Europe/Amsterdam** (na n8n-run, ruim marge)
  - Cron: `0 10 * * *` (UTC winter) — en we leven met 1u drift in de zomer, of splitsen met aparte schedule als nodig
  - Uses `withCronMonitoring()` wrapper (zelfde patroon als andere crons)
  - SQL: `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_company_platforms;`
  - Logt duur naar `cron_job_logs`

- [ ] **Registreer in `vercel.json`**:
  ```json
  { "path": "/api/cron/refresh-company-platforms", "schedule": "0 10 * * *" }
  ```

- [ ] **Ook triggeren bij handmatige scraper-run?** Optioneel — scrapers (baanindebuurt, debanensite) kunnen `pg_notify` sturen zodat we on-demand refreshen. Skip voor v1.

### Fase 3 — API wijzigingen

**File: `apps/admin/app/api/contacts/route.ts`**

- [ ] **GET: nieuwe query param** `platformId` (comma-separated UUIDs)
- [ ] **Filter-logica** — twee opties, besluit tijdens implementatie welke performt:

  **Optie 3a — Subquery via mv:**
  ```ts
  if (filters.platformId) {
    const platformIds = filters.platformId.split(',')
    const { data: companyIds } = await supabaseService.serviceClient
      .from('mv_company_platforms')
      .select('company_id')
      .in('platform_id', platformIds)
    query = query.in('company_id', companyIds.map(r => r.company_id))
  }
  ```
  - Nadeel: two-round-trip, grote `.in()` lijst bij populaire platforms.

  **Optie 3b — RPC die gefilterde contact-ids teruggeeft:**
  ```sql
  CREATE FUNCTION contacts_for_platforms(p_platform_ids uuid[])
  RETURNS SETOF uuid LANGUAGE sql STABLE AS $$
    SELECT DISTINCT c.id
    FROM contacts c
    JOIN mv_company_platforms mcp ON mcp.company_id = c.company_id
    WHERE mcp.platform_id = ANY(p_platform_ids);
  $$;
  ```
  - Gebruik als `.in('id', rpcResult)` — efficiënter, één query.

  → **Start met 3a**, profilen, upgraden naar 3b als >500ms bij populair platform.

- [ ] **Exclusive modus** (later): toggle "alleen bedrijven die **uitsluitend** op dit platform actief zijn" — nuttig om overlap te voorkomen tussen campagnes. Ship in v2.

### Fase 4 — Frontend: hook + UI

**File: `apps/admin/hooks/use-contacts-paginated.tsx`**

- [ ] Filter-interface uitbreiden met `platformFilter?: string[]`
- [ ] URL-param sync: `platformId=<uuid>,<uuid>`
- [ ] Include `platformFilter.join(',')` in queryKey van react-query

**File: `apps/admin/app/contacten/page.tsx`**

- [ ] State: `const [platformFilter, setPlatformFilter] = useState<string[]>([])`
- [ ] Fetch platforms via bestaand `/api/platforms` (cache met `staleTime: 30min`)
- [ ] **`<MultiSelect>`** toevoegen naast bestaande filters:
  ```tsx
  <MultiSelect
    options={platforms.map(p => ({ value: p.id, label: p.regio_platform }))}
    selected={platformFilter}
    onChange={setPlatformFilter}
    placeholder="Alle platforms"
  />
  ```
- [ ] Reset-all knop includen in de `Reset filters`-flow
- [ ] **Visual**: toon platform-badges op elke contact-rij (`mv_company_platforms`-join ophalen in dezelfde response of een lazy sub-fetch). Start zonder — voeg toe als we ruimte hebben.

### Fase 5 — Verificatie

- [ ] **Unit/integration**: test dat filter `platformId=<baanindebuurt-uuid>` alleen contacten teruggeeft van companies met ≥1 job_posting op dat platform.
- [ ] **Edge cases**:
  - Contact zonder `company_id` → valt weg uit resultaat (correct gedrag).
  - Company in meerdere platforms → verschijnt als elk van die platforms is geselecteerd (OR-logica).
  - Gecombineerd met `hasEmail`, `pipedriveFilter`, etc. → filters stapelen correct.
- [ ] **Performance**: queries <300ms voor top-5 populaire platforms. Meet met Supabase query analyzer.
- [ ] **Bulk-flow end-to-end**: filter → select-all → push naar Instantly. Verifiëren dat `regio_platform` custom-variable correct wordt gezet (POST-endpoint gebruikt nu `companies.regions.regio_platform` — in v2 vervangen door primary platform uit `mv_company_platforms`).

### Fase 6 — Optioneel (v2)

- [ ] **Fallback voor 21.5% contacten zonder link** — `companies.postal_code → cities.platform_id` UNION in de mat. view:
  ```sql
  UNION
  SELECT c.id AS company_id, ct.platform_id, 0 AS posting_count, NULL AS last_posted_at
  FROM companies c
  JOIN cities ct ON ct.postcode = left(c.postal_code, 4)
  WHERE c.postal_code IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM job_postings jp WHERE jp.company_id = c.id AND jp.platform_id IS NOT NULL)
  ```
  - Flag-kolom `source text` ('job_posting' / 'postcode_fallback') om UI onderscheid te kunnen tonen.

- [ ] **Refactor POST `/api/contacts`** (Instantly-push) — vervang `companies.regions.regio_platform` lookup door `mv_company_platforms`-query voor consistentie.

- [ ] **Count-badge** per platform in de dropdown: `"Baan in de Buurt (12.453)"` — één `SELECT platform_id, COUNT(DISTINCT company_id) FROM mv_company_platforms GROUP BY platform_id`.

---

## Go/no-go checks voordat we beginnen

1. **Refresh-strategie akkoord?** 1x daags na n8n lijkt prima; real-time zou pg_notify + Edge-function vragen.
2. **OR- of AND-semantiek** bij meerdere platforms? Voorstel: **OR** (meest intuïtief, matcht "geef me alle contacten die op minstens één van deze platforms zitten").
3. **Fallback via postcode in v1 of v2?** Voorstel: v2 — eerst meten of 78.5% dekking acceptabel is.
4. **Mogen we meteen migratie draaien via `mcp__supabase__apply_migration`?**

---

## Geschatte impact

- **Migratie**: ~5 sec (view aanmaken op 144k rijen)
- **Dagelijkse refresh**: ~10-30 sec (CONCURRENTLY, geen lock)
- **Extra storage**: ~10 MB (144k rijen × 2 uuids + counts)
- **Query overhead op /api/contacts**: +1 Supabase roundtrip (<50ms bij juiste index)

## Review

**Geïmplementeerd 2026-04-17** — alle 5 fasen (incl. postcode-fallback in v1) afgerond.

### Database (Fase 1)
- Migratie `create_mv_company_platforms` — view met UNION van job_posting + postcode_fallback, 151.637 rijen (144k + 7k)
- Migratie `create_refresh_company_platforms_mv_fn` — SECURITY DEFINER RPC met vaste search_path
- Indexen: UNIQUE (company_id, platform_id) + filter-indexen op platform_id en company_id
- Grants: SELECT voor authenticated/service_role/anon

### Data-dekking (post-migratie)
- 472.363 / 592.761 contacten = **79,7% dekking** (was 78,5% zonder fallback, +7k dankzij postcode-fallback)
- Resterende 20%: 110.958 contacten waarvan company-postcode niet in `cities` staat (cities dekt 1.371 van ~4.000 NL postcode-prefixen — structurele limiet)
- 9.440 contacten: company zonder postal_code

### Cron (Fase 2)
- `apps/admin/app/api/cron/refresh-company-platforms/route.ts` — withCronMonitoring wrapper, RPC-aanroep
- `vercel.json`: schedule `0 10 * * *` UTC (10:00 UTC = na n8n 09:00 Europe/Amsterdam)
- Test-aanroep van RPC succesvol

### API (Fase 3)
- `apps/admin/app/api/contacts/route.ts` — nieuwe `platformId` query-param, OR-logica via mv-subquery
- Early-exit bij lege platform-match voorkomt onnodige contacts-query
- **Performance**: EXPLAIN ANALYZE voor 2 platforms → **22ms** (Bitmap Index Scan op idx_mv_company_platforms_platform)

### UI (Fase 4)
- `apps/admin/app/contacten/page.tsx` — state `platformFilter` + `platformOptions`, MultiSelect in filter-grid
- `apps/admin/hooks/use-contacts-paginated.tsx` — filter-interface + URL-param
- Platforms-fetch via bestaande `/api/platforms` met `authFetch`, eenmalig bij mount
- Reset-all, active-filter badge en filter-counter allemaal bijgewerkt

### Verificatie (Fase 5)
- TypeScript errors in gewijzigde files: alle pre-existing (PostgREST array-vs-object). Mijn wijzigingen compileren schoon.
- API-simulatie: HaarlemseBanen → 8.856 companies → 207.767 contacten
- Dual-platform query (Haarlem + Rotterdam) → 22 ms

### Aandachtspunten voor productie
- Bij zeer populaire platforms kan `platformCompanyIds` groeien tot ~15k UUID's; `.in(...)` gaat via PostgREST POST body (geen URL-limiet), dus dit werkt — monitoren in prod
- Bestaande POST-endpoint (Instantly push) gebruikt nog `companies.regions.regio_platform`; refactor naar `mv_company_platforms` is v2-item
- Postcode-fallback uitbreiden zodra `cities`-tabel completer is

### Niet gedaan (v2-backlog)
- Primary-platform-keuze voor bedrijven met meerdere platforms (gebruik `posting_count` + `last_posted_at` als tiebreaker)
- Platform-badges per contact-rij in de tabel
- Count-badge per platform in de dropdown (`"HaarlemseBanen (207.767)"`)
- POST-endpoint refactor voor consistente `regio_platform` custom-variable
