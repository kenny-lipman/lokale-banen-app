# Robuuste counts en listings — /job-postings, /companies, /contacts

**Datum**: 2026-05-05
**Scope**: Verhelpen van timeouts, foutieve counts en lege resultaten op admin-pages bij schaal (1M+ pending vacatures, 196k companies, 595k contacts).

## Context

Productie-cijfers nu:
- `job_postings`: 1.017.830 totaal (1.017.279 pending · 170.303 archived · 551 approved · 0 rejected)
- `companies`: 196.612
- `contacts`: 595.953

Er zijn drie acute klachten en twee onderliggende structuurproblemen.

### Acute klachten (fase A)

1. **"1.001 vacatures" badge** op /job-postings is een hard cap, geen telling.
   `search_job_postings` doet `SELECT count(*) FROM (… LIMIT 1001) sub` → max return 1001.
2. **"Geen vacatures gevonden"** op pending tab + date_to filter, terwijl er 1M pending records zijn.
   Vermoedelijk RPC error/timeout die silent afgevangen wordt.
3. **Archief tab → statement timeout**.
   `search_job_postings` met `archived_filter='archived'` joint over 170k rows op companies+job_sources+platforms.

### Structuurproblemen (fase B)

4. **Companies counts** doen 5 parallelle `getCompanies()`-calls met `count: 'exact'` per qualification_status.
5. **Contacts list** gebruikt `select(..., { count: 'exact' })` + `companies!inner` + datum/zoekfilters → timeout.

## Aanpak — drie principes

1. **Cap-pattern voor expensive counts**: tel via `SELECT count(*) FROM (… LIMIT cap+1) sub` en geef `is_capped` flag terug. UI rendert "10.000+" als capped, exacte count anders.
2. **Splits "data" van "count"**: counts via dedicated RPC met partial indexes; data via thin RPC met index-scan vóór joins.
3. **Errors zichtbaar maken**: RPC errors moeten in de UI tonen, niet silent → "Geen resultaten".

---

## Fase A — Acute bugs (één migratie + frontend)

### A1. `search_job_postings` count cap → 10001

**File**: nieuwe migratie `supabase/migrations/<ts>_search_job_postings_robust_counts.sql`

**Wijziging**: `LIMIT 1001` → `LIMIT 10001` in beide count subquery branches; functie krijgt extra return-kolom `is_capped boolean`.

**Return shape**: `total_count bigint` blijft, nieuwe `is_capped boolean`. Alle rows in resultaat zetten dezelfde waarde voor de count + flag.

```sql
-- pseudo, toon alleen relevante delta
SELECT count(*) INTO total
FROM (SELECT 1 FROM job_postings jp WHERE … LIMIT 10001) sub;
-- in RETURN QUERY:
SELECT …, total, (total >= 10001) AS is_capped, …
```

**Reden cap=10000**: matches `get_job_posting_counts` (10001 → "10.000+"). Onder die drempel: exacte count.

**Risico**: query LIMIT 10001 i.p.v. 1001 → factor 10 zwaarder voor pending (1M+ rows). Maar partial index `idx_jp_pending_created_at` dekt dat (≤8s in worst case op pending count). Indien archived_at filter relevant: `idx_jp_active` / `idx_jp_archived`.

### A2. UI count rendering

**Files**:
- `apps/admin/hooks/use-job-postings-cache.tsx` — extract `is_capped` uit eerste row, expose via `formattedResult.is_capped`.
- `apps/admin/components/ui/table-filters.tsx` lines 488–504 — pas Badge logic aan: toon `"10.000+"` als capped, anders exacte count. "Gebruik filters" hint alleen als capped.
- `apps/admin/components/job-postings-table.tsx` — geef `is_capped` door aan `TableFilters`.

```tsx
{isCapped
  ? "10.000+ vacatures"
  : `${totalCount.toLocaleString('nl-NL')} vacatures`}
{isCapped && <Badge>Gebruik filters om resultaten te beperken</Badge>}
```

Pagination component: blijft echte (capped) count gebruiken — bij capped is paginering "1–10 van 10.000+" (acceptabel; user filtert).

### A3. Archief listing performance

Onderzoek `EXPLAIN` van archief tab query. Als planner joins eerst doet, herschrijf met expliciete CTE:

```sql
WITH page AS (
  SELECT * FROM job_postings jp
  WHERE jp.archived_at IS NOT NULL
    AND (...filters...)
  ORDER BY jp.created_at DESC
  LIMIT page_size OFFSET offset_val
)
SELECT page.*, c.name, … FROM page
LEFT JOIN companies c ON page.company_id = c.id
LEFT JOIN job_sources js ON page.source_id = js.id
LEFT JOIN platforms p ON page.platform_id = p.id;
```

`idx_jp_archived (archived_at DESC) WHERE archived_at IS NOT NULL` ondersteunt dit direct.

**Test**: archief tab moet binnen 2s renderen (was timeout).

### A4. pending+date_to verifiëren

Direct testen via RPC-call met `review_status_filter='pending', date_to='2026-02-01T23:59:59Z', archived_filter='active'`. Als A1+A3 gedaan zijn, zou dit moeten werken.

**Frontend bug-mogelijkheid** (`use-job-postings-cache.tsx` line 83):
```ts
throw new Error(error.message || 'Database error')
```
→ wordt opgevangen in catch, `setError(...)`. UI toont fout-banner. Maar als `data?.length === 0` zonder error → "Geen vacatures gevonden". Verifiëren of beide paden goed worden gerenderd. Mogelijk ontbrekend: error-banner above table.

---

## Fase B — Structuur (companies + contacts)

### B1. Companies counts RPC

**File**: nieuwe migratie `<ts>_get_company_counts.sql`

```sql
CREATE FUNCTION get_company_counts(...)
RETURNS TABLE(qualification_status text, row_count bigint, is_capped boolean)
LANGUAGE plpgsql STABLE PARALLEL SAFE AS $$
DECLARE cap_plus_one integer := 10001;
BEGIN
  RETURN QUERY
  SELECT s.status,
         (SELECT count(*) FROM (
            SELECT 1 FROM companies c
            WHERE c.qualification_status = s.status
              AND (...zelfde filters als list...)
            LIMIT cap_plus_one
          ) sub)::bigint,
         (...)::bigint >= cap_plus_one
  FROM unnest(ARRAY['pending','qualified','review','disqualified','enriched']) AS s(status);
END $$;
```

**Files frontend**:
- `apps/admin/lib/supabase-service.ts` lines 2304–2352 — vervang `getCompanyCountsByQualificationStatus()` body door één RPC-call.
- `apps/admin/components/companies-tab-container.tsx` — geen wijziging in interface nodig.

**Indexen check**: bestaat `idx_companies_qualification_status`? Zo niet, partial indexes per status overwegen (low cardinality, kleine tabellen).

### B2. Contacts list/count cap-pattern

**File**: `apps/admin/app/api/contacts/route.ts`

**Optie 1 (minimaal)**: Vervang `count: 'exact'` door `count: 'estimated'`. Dit hint Postgres om planner-stats te gebruiken bij grote sets. Geeft snel maar onnauwkeurig. UI toont "≈X" als estimated.

**Optie 2 (consistent met fase A)**: Aparte RPC `get_contact_counts(...)` met cap-pattern + indexen op meest-gebruikte filter combo's. List query houdt `count: null` (geen count) en pagination gebruikt RPC-resultaat.

**Voorkeur**: Optie 2 — consistent en eerlijk.

**Inner join verwijderen**: `companies!inner` alleen als company-filter actief. Dat is al zo (`needsCompanyJoin`). Check of de andere filters (status, pipedrive, instantly) niet implicit een join forceren.

---

## Volgorde + commits

```
A1+A3  → 1 migratie (search_job_postings rewrite)        → commit "perf(job-postings): cap counts at 10k + CTE-first listing"
A2     → 3 frontend files                                → commit "fix(job-postings): toon 10.000+ ipv hard cap 1.001"
A4     → verifiëren in browser (geen code unless bug)    → mogelijk error-banner toevoegen

B1     → 1 migratie + supabase-service.ts                → commit "perf(companies): single-call counts RPC met cap"
B2     → 1 migratie + /api/contacts/route.ts             → commit "perf(contacts): cap-pattern voor counts"
```

Tussen A en B: handmatig valideren in productie (Vercel preview deploy) voordat B begint.

## Verificatie per stap

- **A1**: `EXPLAIN ANALYZE` archived count + pending count beide < 2s.
- **A2**: Browser test `/job-postings?status=pending` → badge toont "10.000+", niet "1.001".
- **A3**: Archief tab opent < 3s zonder timeout.
- **A4**: Pending + date_to filter retourneert resultaten of toont errorbanner.
- **B1**: /companies tab-counts laden in < 1s (was 5x parallelle volledige scan).
- **B2**: /contacten met search+date filter laadt zonder timeout.

## Open vragen voor user

Geen blokkerend; tijdens implementatie kort meldend:
- B2 voorkeur (Optie 1 estimated vs Optie 2 RPC)? **Default: Optie 2.**
- "10.000+" copy goed? Of liever "10k+" / "meer dan 10.000"?
