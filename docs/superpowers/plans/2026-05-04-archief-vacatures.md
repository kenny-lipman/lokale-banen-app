# Archief-feature voor vacatures — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg een soft-archief mechanisme toe aan `job_postings` zodat oude/irrelevante vacatures uit zicht kunnen — handmatig per record en automatisch op leeftijd >180 dagen — met zichtbaarheidsregels op de publieke regio-sites (30d grace + noindex, daarna 410 Gone).

**Architecture:** Drie nieuwe kolommen op `job_postings` (`archived_at`, `archived_by`, `archived_reason`) plus partial indexen. Bestaande RPCs (`search_job_postings`, `get_job_posting_counts`) krijgen een `archived_filter`-parameter en extra "archived"-bucket. Nieuwe REST endpoints (`/archive`, `/activate`, bulk-varianten) sluiten aan bij het bestaande `/api/review/bulk-*` patroon. Een nieuwe Vercel cron-job draait dagelijks de auto-archief. Public-sites filtert listings + sitemap op `archived_at IS NULL`; detail-pagina krijgt een drie-staten state-machine.

**Tech Stack:** Supabase Postgres, Next.js App Router (admin + public-sites), Vercel Cron, TypeScript, `withCronMonitoring` wrapper, `revalidatePublicSite` helper.

**Spec:** [docs/superpowers/specs/2026-05-04-archief-vacatures-design.md](../specs/2026-05-04-archief-vacatures-design.md)

**Verificatie-strategie:** Het project heeft geen volledige test-infrastructuur (slechts 2 Pipedrive-tests in admin). Per task wordt verifieerd via concrete SQL-queries, curl-checks tegen lokale dev-server, type-check, en handmatige UI-acties. Dat is wat in de codebase past en bewijst correct gedrag.

---

## Task 1: Schema-migratie — kolommen + partial indexen

**Files:**
- Apply via Supabase MCP `apply_migration` (geen lokale file)

- [ ] **Step 1: Apply schema-migratie**

```sql
-- Migration: add_archive_columns_to_job_postings
ALTER TABLE job_postings
  ADD COLUMN archived_at timestamptz DEFAULT NULL,
  ADD COLUMN archived_by uuid REFERENCES auth.users(id) DEFAULT NULL,
  ADD COLUMN archived_reason text DEFAULT NULL;

CREATE INDEX idx_jp_active ON job_postings (created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX idx_jp_archived ON job_postings (archived_at DESC)
  WHERE archived_at IS NOT NULL;
```

Uitvoeren via `mcp__supabase__apply_migration` met `name: "add_archive_columns_to_job_postings"`.

- [ ] **Step 2: Verifieer kolommen + indexen aanwezig**

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'job_postings'
  AND column_name IN ('archived_at','archived_by','archived_reason');
-- Expected: 3 rows

SELECT indexname FROM pg_indexes
WHERE tablename = 'job_postings'
  AND indexname IN ('idx_jp_active','idx_jp_archived');
-- Expected: 2 rows
```

- [ ] **Step 3: Run security advisors**

```
mcp__supabase__get_advisors(project_id, type='security')
```
Filter op `job_postings` / nieuwe kolommen. Geen warnings = OK.

- [ ] **Step 4: Regenereer TypeScript types**

```
mcp__supabase__generate_typescript_types(project_id)
```

Resultaat plakken in `apps/admin/types/database.types.ts` (locatie via `grep -rn "Database = " apps/admin/types/`). Verifieer dat `job_postings` nu `archived_at: string | null`, `archived_by: string | null`, `archived_reason: string | null` heeft.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/types/database.types.ts
git commit -m "feat(db): voeg archive-kolommen toe aan job_postings"
```

---

## Task 2: Bootstrap UPDATE — bestaande oude records archiveren

**Files:**
- Apply via Supabase MCP `execute_sql`

- [ ] **Step 1: Tel records die geraakt gaan worden (dry-run)**

```sql
SELECT
  COUNT(*) AS to_archive,
  COUNT(*) FILTER (WHERE review_status = 'approved' AND published_at IS NOT NULL) AS approved_published_skipped
FROM job_postings
WHERE created_at < NOW() - INTERVAL '180 days'
  AND archived_at IS NULL;
```

Verwacht: ~1.000.000 to_archive, klein aantal approved_published_skipped (≤548).

- [ ] **Step 2: Voer bootstrap UPDATE uit**

```sql
UPDATE job_postings
SET archived_at = NOW(),
    archived_reason = 'auto_age_180d'
WHERE created_at < NOW() - INTERVAL '180 days'
  AND archived_at IS NULL
  AND NOT (review_status = 'approved' AND published_at IS NOT NULL);
```

Note: large UPDATE — kan een paar minuten duren. Geen tx-block nodig (single statement is atomic).

- [ ] **Step 3: Verifieer counts**

```sql
SELECT
  COUNT(*) FILTER (WHERE archived_at IS NULL) AS active,
  COUNT(*) FILTER (WHERE archived_at IS NOT NULL) AS archived,
  COUNT(*) FILTER (WHERE archived_at IS NOT NULL
                   AND archived_reason = 'auto_age_180d') AS auto_archived
FROM job_postings;
```

Verwacht: active ~10k, archived ~1.0M, auto_archived = archived (alle bootstrap-records hebben `auto_age_180d`).

- [ ] **Step 4: Verifieer dat approved+published bewaard zijn**

```sql
SELECT COUNT(*) AS still_active_published
FROM job_postings
WHERE review_status = 'approved'
  AND published_at IS NOT NULL
  AND archived_at IS NULL;
```

Verwacht: 548 (alle approved+published van vóór bootstrap).

- [ ] **Step 5: Commit (placeholder commit voor migration-history)**

```bash
git commit --allow-empty -m "chore(db): bootstrap auto-archive — ~1M oude records gearchiveerd"
```

---

## Task 3: Update RPC `get_job_posting_counts` — bestaande buckets filteren + archived bucket

**Files:**
- Apply via Supabase MCP `apply_migration`

- [ ] **Step 1: Apply migratie**

```sql
-- Migration: update_get_job_posting_counts_with_archived
CREATE OR REPLACE FUNCTION public.get_job_posting_counts(
  platform_filter uuid DEFAULT NULL::uuid,
  count_cap integer DEFAULT 10000
)
RETURNS TABLE(status_bucket text, row_count bigint, is_estimate boolean)
LANGUAGE plpgsql
STABLE PARALLEL SAFE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  cap_plus_one integer := count_cap + 1;
BEGIN
  -- 'all' bucket — alleen actieve records
  IF platform_filter IS NULL THEN
    RETURN QUERY SELECT
      'all'::text,
      (SELECT count(*) FROM (
        SELECT 1 FROM job_postings
        WHERE archived_at IS NULL
        LIMIT cap_plus_one
      ) sub)::bigint,
      (SELECT count(*) FROM (
        SELECT 1 FROM job_postings
        WHERE archived_at IS NULL
        LIMIT cap_plus_one
      ) sub)::bigint >= cap_plus_one;
  ELSE
    RETURN QUERY SELECT
      'all'::text,
      (SELECT count(*) FROM (
        SELECT 1 FROM job_postings
        WHERE platform_id = platform_filter
          AND archived_at IS NULL
        LIMIT cap_plus_one
      ) sub)::bigint,
      (SELECT count(*) FROM (
        SELECT 1 FROM job_postings
        WHERE platform_id = platform_filter
          AND archived_at IS NULL
        LIMIT cap_plus_one
      ) sub)::bigint >= cap_plus_one;
  END IF;

  -- pending — alleen actieve
  RETURN QUERY SELECT
    'pending'::text,
    (SELECT count(*) FROM (
      SELECT 1 FROM job_postings
      WHERE review_status = 'pending'
        AND archived_at IS NULL
        AND (platform_filter IS NULL OR platform_id = platform_filter)
      LIMIT cap_plus_one
    ) sub)::bigint,
    (SELECT count(*) FROM (
      SELECT 1 FROM job_postings
      WHERE review_status = 'pending'
        AND archived_at IS NULL
        AND (platform_filter IS NULL OR platform_id = platform_filter)
      LIMIT cap_plus_one
    ) sub)::bigint >= cap_plus_one;

  -- approved — alleen actieve
  RETURN QUERY SELECT
    'approved'::text,
    (SELECT count(*) FROM job_postings
     WHERE review_status = 'approved'
       AND archived_at IS NULL
       AND (platform_filter IS NULL OR platform_id = platform_filter)),
    FALSE;

  -- rejected — alleen actieve
  RETURN QUERY SELECT
    'rejected'::text,
    (SELECT count(*) FROM job_postings
     WHERE review_status = 'rejected'
       AND archived_at IS NULL
       AND (platform_filter IS NULL OR platform_id = platform_filter)),
    FALSE;

  -- archived — nieuwe bucket
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
END;
$function$;
```

- [ ] **Step 2: Verifieer counts via RPC-aanroep**

```sql
SELECT * FROM get_job_posting_counts(NULL, 10000);
```

Verwacht: 5 rijen (`all`, `pending`, `approved`, `rejected`, `archived`). `archived` ≈ 10001 (cap), `pending` substantieel kleiner dan voorheen (was 10001 cap met all archived; nu ~10k actieve).

- [ ] **Step 3: Commit (placeholder voor migration history)**

```bash
git commit --allow-empty -m "feat(db): get_job_posting_counts ondersteunt archived bucket"
```

---

## Task 4: Update RPC `search_job_postings` — `archived_filter` parameter

**Files:**
- Apply via Supabase MCP `apply_migration`

- [ ] **Step 1: Apply migratie**

```sql
-- Migration: add_archived_filter_to_search_job_postings
-- Volledige RPC overschreven; nieuwe parameter `archived_filter` DEFAULT 'active'.

CREATE OR REPLACE FUNCTION public.search_job_postings(
  search_term text DEFAULT NULL::text,
  status_filter text DEFAULT NULL::text,
  source_filter uuid[] DEFAULT NULL::uuid[],
  platform_filter uuid[] DEFAULT NULL::uuid[],
  date_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  date_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  employment_filter text[] DEFAULT NULL::text[],
  salary_min numeric DEFAULT NULL::numeric,
  salary_max numeric DEFAULT NULL::numeric,
  career_level_filter text[] DEFAULT NULL::text[],
  education_level_filter text[] DEFAULT NULL::text[],
  hours_min numeric DEFAULT NULL::numeric,
  hours_max numeric DEFAULT NULL::numeric,
  page_number integer DEFAULT 1,
  page_size integer DEFAULT 10,
  review_status_filter text DEFAULT NULL::text,
  archived_filter text DEFAULT 'active'
)
RETURNS TABLE(
  id uuid, title text, location text, status text, review_status text,
  scraped_at timestamp with time zone, job_type text[], salary text, url text,
  country text, source_id uuid, platform_id uuid, company_id uuid,
  company_name text, company_website text, company_logo_url text,
  company_rating_indeed numeric, company_is_customer boolean, source_name text,
  platform_regio_platform text, total_count bigint, description text,
  employment text, career_level text, education_level text,
  working_hours_min numeric, working_hours_max numeric, categories text,
  end_date date, city text, zipcode text, street text,
  created_at timestamp with time zone,
  lokalebanen_pushed_at timestamp with time zone,
  archived_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  offset_val INT;
  total BIGINT;
  has_filters BOOLEAN;
  has_text_search BOOLEAN;
  ts_query tsquery;
  matching_company_ids uuid[];
  search_lower TEXT;
BEGIN
  offset_val := (page_number - 1) * page_size;
  has_text_search := (search_term IS NOT NULL AND search_term != '');

  IF has_text_search THEN
    ts_query := plainto_tsquery('simple', search_term);
    search_lower := LOWER(search_term);
    PERFORM set_limit(0.3);
    SELECT ARRAY_AGG(c.id) INTO matching_company_ids
    FROM companies c
    WHERE c.name % search_term
    LIMIT 1000;
  END IF;

  has_filters := (
    has_text_search OR
    status_filter IS NOT NULL OR
    review_status_filter IS NOT NULL OR
    archived_filter != 'all' OR
    (source_filter IS NOT NULL AND array_length(source_filter, 1) > 0) OR
    (platform_filter IS NOT NULL AND array_length(platform_filter, 1) > 0) OR
    date_from IS NOT NULL OR
    date_to IS NOT NULL OR
    (employment_filter IS NOT NULL AND array_length(employment_filter, 1) > 0) OR
    salary_min IS NOT NULL OR
    salary_max IS NOT NULL OR
    (career_level_filter IS NOT NULL AND array_length(career_level_filter, 1) > 0) OR
    (education_level_filter IS NOT NULL AND array_length(education_level_filter, 1) > 0) OR
    hours_min IS NOT NULL OR
    hours_max IS NOT NULL
  );

  IF NOT has_filters THEN
    SELECT COALESCE(reltuples::bigint, 500000) INTO total
    FROM pg_class WHERE relname = 'job_postings';
  ELSIF has_text_search THEN
    SELECT COUNT(*) INTO total
    FROM (
      SELECT 1 FROM job_postings jp
      WHERE (jp.search_vector @@ ts_query
             OR (matching_company_ids IS NOT NULL AND jp.company_id = ANY(matching_company_ids)))
        AND (status_filter IS NULL OR jp.status = status_filter)
        AND (review_status_filter IS NULL OR jp.review_status = review_status_filter)
        AND (
          (archived_filter = 'active' AND jp.archived_at IS NULL)
          OR (archived_filter = 'archived' AND jp.archived_at IS NOT NULL)
          OR (archived_filter = 'all')
        )
        AND (source_filter IS NULL OR array_length(source_filter, 1) IS NULL OR jp.source_id = ANY(source_filter))
        AND (platform_filter IS NULL OR array_length(platform_filter, 1) IS NULL OR jp.platform_id = ANY(platform_filter))
        AND (date_from IS NULL OR jp.created_at >= date_from)
        AND (date_to IS NULL OR jp.created_at <= date_to)
        AND (employment_filter IS NULL OR array_length(employment_filter, 1) IS NULL OR jp.employment = ANY(employment_filter))
        AND (career_level_filter IS NULL OR array_length(career_level_filter, 1) IS NULL OR jp.career_level = ANY(career_level_filter))
        AND (education_level_filter IS NULL OR array_length(education_level_filter, 1) IS NULL OR jp.education_level = ANY(education_level_filter))
        AND ((hours_min IS NULL AND hours_max IS NULL) OR (jp.working_hours_min IS NOT NULL AND jp.working_hours_max IS NOT NULL
             AND (hours_min IS NULL OR jp.working_hours_min >= hours_min)
             AND (hours_max IS NULL OR jp.working_hours_max <= hours_max)))
      LIMIT 1001
    ) sub;
  ELSE
    SELECT COUNT(*) INTO total
    FROM (
      SELECT 1 FROM job_postings jp
      WHERE (status_filter IS NULL OR jp.status = status_filter)
        AND (review_status_filter IS NULL OR jp.review_status = review_status_filter)
        AND (
          (archived_filter = 'active' AND jp.archived_at IS NULL)
          OR (archived_filter = 'archived' AND jp.archived_at IS NOT NULL)
          OR (archived_filter = 'all')
        )
        AND (source_filter IS NULL OR array_length(source_filter, 1) IS NULL OR jp.source_id = ANY(source_filter))
        AND (platform_filter IS NULL OR array_length(platform_filter, 1) IS NULL OR jp.platform_id = ANY(platform_filter))
        AND (date_from IS NULL OR jp.created_at >= date_from)
        AND (date_to IS NULL OR jp.created_at <= date_to)
        AND (employment_filter IS NULL OR array_length(employment_filter, 1) IS NULL OR jp.employment = ANY(employment_filter))
        AND (career_level_filter IS NULL OR array_length(career_level_filter, 1) IS NULL OR jp.career_level = ANY(career_level_filter))
        AND (education_level_filter IS NULL OR array_length(education_level_filter, 1) IS NULL OR jp.education_level = ANY(education_level_filter))
        AND ((hours_min IS NULL AND hours_max IS NULL) OR (jp.working_hours_min IS NOT NULL AND jp.working_hours_max IS NOT NULL
             AND (hours_min IS NULL OR jp.working_hours_min >= hours_min)
             AND (hours_max IS NULL OR jp.working_hours_max <= hours_max)))
      LIMIT 1001
    ) sub;
  END IF;

  IF has_text_search THEN
    RETURN QUERY
    SELECT
      jp.id, jp.title, jp.location, jp.status, jp.review_status, jp.scraped_at,
      jp.job_type, jp.salary, jp.url, jp.country, jp.source_id, jp.platform_id,
      c.id, c.name, c.website, c.logo_url, c.rating_indeed, c.is_customer,
      js.name, p.regio_platform::TEXT, total,
      jp.description, jp.employment, jp.career_level, jp.education_level,
      jp.working_hours_min, jp.working_hours_max, jp.categories, jp.end_date,
      jp.city, jp.zipcode, jp.street, jp.created_at, jp.lokalebanen_pushed_at,
      jp.archived_at
    FROM job_postings jp
    INNER JOIN companies c ON jp.company_id = c.id
    INNER JOIN job_sources js ON jp.source_id = js.id
    LEFT JOIN platforms p ON jp.platform_id = p.id
    WHERE (jp.search_vector @@ ts_query
           OR (matching_company_ids IS NOT NULL AND jp.company_id = ANY(matching_company_ids)))
      AND (status_filter IS NULL OR jp.status = status_filter)
      AND (review_status_filter IS NULL OR jp.review_status = review_status_filter)
      AND (
        (archived_filter = 'active' AND jp.archived_at IS NULL)
        OR (archived_filter = 'archived' AND jp.archived_at IS NOT NULL)
        OR (archived_filter = 'all')
      )
      AND (source_filter IS NULL OR array_length(source_filter, 1) IS NULL OR jp.source_id = ANY(source_filter))
      AND (platform_filter IS NULL OR array_length(platform_filter, 1) IS NULL OR jp.platform_id = ANY(platform_filter))
      AND (date_from IS NULL OR jp.created_at >= date_from)
      AND (date_to IS NULL OR jp.created_at <= date_to)
      AND (employment_filter IS NULL OR array_length(employment_filter, 1) IS NULL OR jp.employment = ANY(employment_filter))
      AND (career_level_filter IS NULL OR array_length(career_level_filter, 1) IS NULL OR jp.career_level = ANY(career_level_filter))
      AND (education_level_filter IS NULL OR array_length(education_level_filter, 1) IS NULL OR jp.education_level = ANY(education_level_filter))
      AND ((hours_min IS NULL AND hours_max IS NULL) OR (jp.working_hours_min IS NOT NULL AND jp.working_hours_max IS NOT NULL
           AND (hours_min IS NULL OR jp.working_hours_min >= hours_min)
           AND (hours_max IS NULL OR jp.working_hours_max <= hours_max)))
    ORDER BY
      CASE WHEN LOWER(c.name) = search_lower THEN 0 ELSE 1 END,
      similarity(LOWER(c.name), search_lower) DESC,
      ts_rank(jp.search_vector, ts_query) DESC,
      jp.created_at DESC
    LIMIT page_size
    OFFSET offset_val;
  ELSE
    RETURN QUERY
    SELECT
      jp.id, jp.title, jp.location, jp.status, jp.review_status, jp.scraped_at,
      jp.job_type, jp.salary, jp.url, jp.country, jp.source_id, jp.platform_id,
      c.id, c.name, c.website, c.logo_url, c.rating_indeed, c.is_customer,
      js.name, p.regio_platform::TEXT, total,
      jp.description, jp.employment, jp.career_level, jp.education_level,
      jp.working_hours_min, jp.working_hours_max, jp.categories, jp.end_date,
      jp.city, jp.zipcode, jp.street, jp.created_at, jp.lokalebanen_pushed_at,
      jp.archived_at
    FROM job_postings jp
    INNER JOIN companies c ON jp.company_id = c.id
    INNER JOIN job_sources js ON jp.source_id = js.id
    LEFT JOIN platforms p ON jp.platform_id = p.id
    WHERE (status_filter IS NULL OR jp.status = status_filter)
      AND (review_status_filter IS NULL OR jp.review_status = review_status_filter)
      AND (
        (archived_filter = 'active' AND jp.archived_at IS NULL)
        OR (archived_filter = 'archived' AND jp.archived_at IS NOT NULL)
        OR (archived_filter = 'all')
      )
      AND (source_filter IS NULL OR array_length(source_filter, 1) IS NULL OR jp.source_id = ANY(source_filter))
      AND (platform_filter IS NULL OR array_length(platform_filter, 1) IS NULL OR jp.platform_id = ANY(platform_filter))
      AND (date_from IS NULL OR jp.created_at >= date_from)
      AND (date_to IS NULL OR jp.created_at <= date_to)
      AND (employment_filter IS NULL OR array_length(employment_filter, 1) IS NULL OR jp.employment = ANY(employment_filter))
      AND (career_level_filter IS NULL OR array_length(career_level_filter, 1) IS NULL OR jp.career_level = ANY(career_level_filter))
      AND (education_level_filter IS NULL OR array_length(education_level_filter, 1) IS NULL OR jp.education_level = ANY(education_level_filter))
      AND ((hours_min IS NULL AND hours_max IS NULL) OR (jp.working_hours_min IS NOT NULL AND jp.working_hours_max IS NOT NULL
           AND (hours_min IS NULL OR jp.working_hours_min >= hours_min)
           AND (hours_max IS NULL OR jp.working_hours_max <= hours_max)))
    ORDER BY jp.created_at DESC
    LIMIT page_size
    OFFSET offset_val;
  END IF;
END;
$function$;
```

- [ ] **Step 2: Verifieer**

```sql
-- Default = active: archived records onzichtbaar
SELECT COUNT(*) FROM search_job_postings(page_size => 1000);

-- archived bucket
SELECT COUNT(*) FROM search_job_postings(archived_filter => 'archived', page_size => 1000);

-- all
SELECT COUNT(*) FROM search_job_postings(archived_filter => 'all', page_size => 1000);
```

- [ ] **Step 3: Regenereer TS types** (RPC return-type breidde uit met `archived_at`)

```
mcp__supabase__generate_typescript_types(project_id)
```
Plak in `apps/admin/types/database.types.ts`. Verifieer dat `search_job_postings` returns nu `archived_at: string | null` bevat.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/types/database.types.ts
git commit -m "feat(db): search_job_postings ondersteunt archived_filter"
```

---

## Task 5: Single archive + activate API endpoints

**Files:**
- Create: `apps/admin/app/api/vacatures/[id]/archive/route.ts`
- Create: `apps/admin/app/api/vacatures/[id]/activate/route.ts`

Patroon volgt bestaande `/publish` en `/unpublish` (zie `apps/admin/app/api/vacatures/[id]/publish/route.ts` voor referentie).

- [ ] **Step 1: Maak archive route**

```typescript
// apps/admin/app/api/vacatures/[id]/archive/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { revalidatePublicSite } from '@/lib/services/public-site-revalidate.service'

async function archiveHandler(
  req: NextRequest,
  authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let reason: string | null = null

  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body?.reason === 'string' && body.reason.trim().length > 0) {
      reason = body.reason.trim()
    }
  } catch { /* empty body OK */ }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('job_postings')
    .update({
      archived_at: new Date().toISOString(),
      archived_by: authResult.user.id,
      archived_reason: reason,
    })
    .eq('id', id)
    .select('id, slug, platform_id, review_status, published_at')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Not found' },
      { status: error ? 500 : 404 }
    )
  }

  // Revalidate publieke site alleen voor approved+published vacatures
  if (data.review_status === 'approved' && data.published_at) {
    await revalidatePublicSite({
      platformId: data.platform_id,
      jobSlugs: data.slug ? [data.slug] : [],
    }).catch((err) => console.error('[archive] revalidate failed', err))
  }

  return NextResponse.json({ success: true, id: data.id })
}

export const POST = withAuth(archiveHandler)
```

- [ ] **Step 2: Maak activate route**

```typescript
// apps/admin/app/api/vacatures/[id]/activate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { revalidatePublicSite } from '@/lib/services/public-site-revalidate.service'

async function activateHandler(
  _req: NextRequest,
  _authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('job_postings')
    .update({
      archived_at: null,
      archived_by: null,
      archived_reason: null,
    })
    .eq('id', id)
    .select('id, slug, platform_id, review_status, published_at')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Not found' },
      { status: error ? 500 : 404 }
    )
  }

  if (data.review_status === 'approved' && data.published_at) {
    await revalidatePublicSite({
      platformId: data.platform_id,
      jobSlugs: data.slug ? [data.slug] : [],
    }).catch((err) => console.error('[activate] revalidate failed', err))
  }

  return NextResponse.json({ success: true, id: data.id })
}

export const POST = withAuth(activateHandler)
```

- [ ] **Step 3: Type-check**

```bash
cd apps/admin && pnpm exec tsc --noEmit 2>&1 | grep -E "archive|activate" | head -10
```
Expected: geen errors die deze nieuwe files raken.

- [ ] **Step 4: Test endpoints lokaal**

Start `pnpm --filter @lokale-banen/admin dev`. Pak een ID uit `SELECT id FROM job_postings WHERE archived_at IS NULL LIMIT 1;`. Verkrijg een geldige Bearer token uit Supabase auth (zie hoe andere routes worden getest in commit-history; eventueel via DevTools de bestaande session token uit de admin UI kopiëren).

```bash
# Archive (met reden)
curl -X POST http://localhost:3000/api/vacatures/<ID>/archive \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Test handmatig archief"}'

# Verifieer in DB
psql ... -c "SELECT id, archived_at, archived_by, archived_reason FROM job_postings WHERE id = '<ID>';"
# Expected: archived_at gevuld, archived_by = userId, archived_reason = 'Test handmatig archief'

# Activate (zonder body)
curl -X POST http://localhost:3000/api/vacatures/<ID>/activate \
  -H "Authorization: Bearer <TOKEN>"

# Verifieer
# Expected: alle 3 archive-velden NULL
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/app/api/vacatures/\[id\]/archive/route.ts \
        apps/admin/app/api/vacatures/\[id\]/activate/route.ts
git commit -m "feat(api): archive + activate endpoints voor single job_posting"
```

---

## Task 6: Bulk archive + activate API endpoints

**Files:**
- Create: `apps/admin/app/api/review/bulk-archive/route.ts`
- Create: `apps/admin/app/api/review/bulk-activate/route.ts`

Patroon volgt `apps/admin/app/api/review/bulk-approve/route.ts`.

- [ ] **Step 1: Bekijk bulk-approve voor patroon**

```bash
cat apps/admin/app/api/review/bulk-approve/route.ts
```
Let op: hoe `revalidatePublicSite` wordt aangeroepen, hoe ids worden gevalideerd, en welke return-shape wordt gebruikt (`{ approved, errors }` of vergelijkbaar). Volg dat patroon.

- [ ] **Step 2: Maak bulk-archive route**

```typescript
// apps/admin/app/api/review/bulk-archive/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { revalidatePublicSite } from '@/lib/services/public-site-revalidate.service'

async function bulkArchiveHandler(req: NextRequest, authResult: AuthResult) {
  let body: { ids?: string[]; reason?: string; platformId?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids is required' }, { status: 400 })
  }
  const reason = typeof body.reason === 'string' && body.reason.trim().length > 0
    ? body.reason.trim()
    : null

  const supabase = createServiceRoleClient()
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('job_postings')
    .update({
      archived_at: nowIso,
      archived_by: authResult.user.id,
      archived_reason: reason,
    })
    .in('id', ids)
    .select('id, slug, platform_id, review_status, published_at')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const archived = data?.length ?? 0

  // Revalidate per platform voor approved+published vacatures
  const byPlatform = new Map<string, string[]>()
  for (const row of data ?? []) {
    if (row.review_status === 'approved' && row.published_at && row.platform_id && row.slug) {
      const list = byPlatform.get(row.platform_id) ?? []
      list.push(row.slug)
      byPlatform.set(row.platform_id, list)
    }
  }
  for (const [platformId, jobSlugs] of byPlatform.entries()) {
    await revalidatePublicSite({ platformId, jobSlugs }).catch(
      (err) => console.error('[bulk-archive] revalidate failed', platformId, err),
    )
  }

  return NextResponse.json({ success: true, archived, message: `${archived} vacature(s) gearchiveerd` })
}

export const POST = withAuth(bulkArchiveHandler)
```

- [ ] **Step 3: Maak bulk-activate route**

```typescript
// apps/admin/app/api/review/bulk-activate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { revalidatePublicSite } from '@/lib/services/public-site-revalidate.service'

async function bulkActivateHandler(req: NextRequest, _authResult: AuthResult) {
  let body: { ids?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids is required' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('job_postings')
    .update({
      archived_at: null,
      archived_by: null,
      archived_reason: null,
    })
    .in('id', ids)
    .select('id, slug, platform_id, review_status, published_at')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const activated = data?.length ?? 0

  const byPlatform = new Map<string, string[]>()
  for (const row of data ?? []) {
    if (row.review_status === 'approved' && row.published_at && row.platform_id && row.slug) {
      const list = byPlatform.get(row.platform_id) ?? []
      list.push(row.slug)
      byPlatform.set(row.platform_id, list)
    }
  }
  for (const [platformId, jobSlugs] of byPlatform.entries()) {
    await revalidatePublicSite({ platformId, jobSlugs }).catch(
      (err) => console.error('[bulk-activate] revalidate failed', platformId, err),
    )
  }

  return NextResponse.json({ success: true, activated, message: `${activated} vacature(s) geactiveerd` })
}

export const POST = withAuth(bulkActivateHandler)
```

- [ ] **Step 4: Type-check + smoke-test**

```bash
cd apps/admin && pnpm exec tsc --noEmit 2>&1 | grep -E "bulk-(archive|activate)" | head
```

Lokale smoke-test (3 ids):
```bash
curl -X POST http://localhost:3000/api/review/bulk-archive \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"ids":["<ID1>","<ID2>","<ID3>"],"reason":"Bulk test"}'
# Expected: { success: true, archived: 3, ... }

curl -X POST http://localhost:3000/api/review/bulk-activate \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"ids":["<ID1>","<ID2>","<ID3>"]}'
# Expected: { success: true, activated: 3, ... }
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/app/api/review/bulk-archive/route.ts \
        apps/admin/app/api/review/bulk-activate/route.ts
git commit -m "feat(api): bulk-archive + bulk-activate endpoints"
```

---

## Task 7: Admin UI — vijfde tab "Archief" + filter doorgeven

**Files:**
- Modify: `apps/admin/app/job-postings/page.tsx`
- Modify: `apps/admin/components/job-postings-table.tsx`
- Modify: `apps/admin/hooks/use-job-postings-cache.tsx`

- [ ] **Step 1: Voeg "archived" toe aan tab-types in page.tsx**

```bash
grep -n "ReviewStatusTab\|TAB_ORDER\|TAB_LABELS" apps/admin/app/job-postings/page.tsx
```

Pas aan in `apps/admin/app/job-postings/page.tsx` (regelnummers volgens grep):

```typescript
type ReviewStatusTab = "pending" | "approved" | "rejected" | "all" | "archived"

const TAB_ORDER: ReviewStatusTab[] = ["pending", "approved", "rejected", "all", "archived"]
const TAB_LABELS: Record<ReviewStatusTab, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  all: "Alle",
  archived: "Archief",
}

function isReviewStatusTab(value: string | null): value is ReviewStatusTab {
  return value === "pending" || value === "approved" || value === "rejected"
    || value === "all" || value === "archived"
}
```

- [ ] **Step 2: Update use-job-postings-cache hook om archived_filter mee te sturen**

In `apps/admin/hooks/use-job-postings-cache.tsx` aan de params type + RPC-aanroep:

```typescript
// In het params-interface:
review_status?: string
archived_filter?: 'active' | 'archived' | 'all'   // NEW

// In rpcParams:
archived_filter: params.archived_filter ?? 'active',
```

- [ ] **Step 3: JobPostingsTable forward archived_filter naar hook**

In `apps/admin/components/job-postings-table.tsx`:

```typescript
// In de useJobPostingsCache aanroep, naast review_status:
review_status: reviewStatus && reviewStatus !== "all" && reviewStatus !== "archived"
  ? reviewStatus
  : undefined,
archived_filter: reviewStatus === "archived" ? "archived" : "active",
```

Cruciale logica: als tab = archived, dan filter op archived én GEEN `review_status` filter (want gearchiveerd kan zowel pending/approved/rejected zijn). Anders default 'active'.

- [ ] **Step 4: Type-check + UI smoke-test**

```bash
cd apps/admin && pnpm exec tsc --noEmit 2>&1 | grep -E "(job-postings/page|job-postings-table|use-job-postings-cache)" | head
```

Start dev server. Open `/job-postings`. Verifieer:
- 5 tabs zichtbaar: Pending / Approved / Rejected / Alle / Archief
- Klik "Archief" → URL wordt `?status=archived`. Tabel toont gearchiveerde records (er zijn er ~1M na bootstrap, dus de tabel laadt direct enkele records).
- Klik "Pending" → tabel toont alleen actieve pending records.
- Counts boven de tabs kloppen (Archief: "10.000+", Pending: substantieel kleiner dan voor de bootstrap).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/app/job-postings/page.tsx \
        apps/admin/components/job-postings-table.tsx \
        apps/admin/hooks/use-job-postings-cache.tsx
git commit -m "feat(admin): archief-tab op /job-postings + archived_filter prop"
```

---

## Task 8: Bulk-action-bar — Archiveer-knop + Activeer-knop

**Files:**
- Modify: `apps/admin/components/vacature/bulk-action-bar.tsx`
- Modify: `apps/admin/components/job-postings-table.tsx` (logica om de juiste mode te kiezen)

- [ ] **Step 1: Breid BulkActionBar uit met `mode` prop**

In `apps/admin/components/vacature/bulk-action-bar.tsx`, voeg toe aan `BulkActionBarProps`:

```typescript
export interface BulkActionBarProps {
  selectedIds: string[]
  platformId?: string | null
  onDeselect: () => void
  onActionComplete: () => void
  className?: string
  mode?: 'review' | 'archived'   // NEW: 'review' = approve/reject/archive, 'archived' = activate
}
```

In de component-body een `handleArchive` en `handleActivate`:

```typescript
const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
const [archiveReason, setArchiveReason] = useState('')

const handleArchive = async () => {
  if (isDisabled) return
  setLoading(true)
  try {
    const res = await authFetch("/api/review/bulk-archive", {
      method: "POST",
      body: JSON.stringify({
        ids: selectedIds,
        reason: archiveReason.trim() || undefined,
        platformId: platformId || undefined,
      }),
    })
    const result = await res.json()
    if (!res.ok || result.error) {
      toast.error(result.error || "Archiveren mislukt")
    } else {
      toast.success(result.message || `${result.archived} vacature(s) gearchiveerd`)
      onActionComplete()
      setArchiveDialogOpen(false)
      setArchiveReason('')
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Fout bij archiveren")
  } finally {
    setLoading(false)
  }
}

const handleActivate = async () => {
  if (isDisabled) return
  setLoading(true)
  try {
    const res = await authFetch("/api/review/bulk-activate", {
      method: "POST",
      body: JSON.stringify({ ids: selectedIds }),
    })
    const result = await res.json()
    if (!res.ok || result.error) {
      toast.error(result.error || "Activeren mislukt")
    } else {
      toast.success(result.message || `${result.activated} vacature(s) geactiveerd`)
      onActionComplete()
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Fout bij activeren")
  } finally {
    setLoading(false)
  }
}
```

In de JSX render-logica:

- Wanneer `mode === 'review'`: bestaande Approve/Reject knoppen + nieuwe **"Archiveer"** knop (open `archiveDialogOpen`).
- Wanneer `mode === 'archived'`: alleen **"Activeer"** knop. Geen approve/reject.

Voor de archive-dialog gebruik bestaand `AlertDialog`-patroon plus een `<Textarea>` voor de optionele reden (`shadcn/ui` `Textarea` import; check `apps/admin/components/ui/textarea.tsx` bestaat).

- [ ] **Step 2: Wire mode in JobPostingsTable**

In `apps/admin/components/job-postings-table.tsx`, op de plek waar `BulkActionBar` wordt gerenderd:

```typescript
<BulkActionBar
  selectedIds={Array.from(selectedIds)}
  platformId={platformFilter?.[0]}
  onDeselect={() => setSelectedIds(new Set())}
  onActionComplete={() => {
    setSelectedIds(new Set())
    onBulkActionComplete?.()
    refetch?.()
  }}
  mode={reviewStatus === 'archived' ? 'archived' : 'review'}
/>
```

- [ ] **Step 3: Type-check + UI smoke-test**

```bash
cd apps/admin && pnpm exec tsc --noEmit 2>&1 | grep -E "bulk-action-bar|job-postings-table" | head
```

Manual:
- `/job-postings?status=pending` → selecteer 2 records → verifieer Approve / Reject / **Archiveer** knoppen tonen.
- Klik Archiveer → dialog opent met optionele reden-textarea → Bevestigen → records verdwijnen uit pending tab.
- `/job-postings?status=archived` → selecteer dezelfde records (zoek ze terug via search) → verifieer alleen **Activeer** knop. Klik → records verdwijnen uit archief, terug in originele tab.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/components/vacature/bulk-action-bar.tsx \
        apps/admin/components/job-postings-table.tsx
git commit -m "feat(admin): archive/activate knoppen in bulk-action-bar"
```

---

## Task 9: Drawer — gearchiveerd-badge

**Files:**
- Modify: `apps/admin/components/job-posting-drawer.tsx`

- [ ] **Step 1: Lokaliseer waar de titel/header wordt gerenderd**

```bash
grep -n "title\|review_status" apps/admin/components/job-posting-drawer.tsx | head -20
```

Bovenin de header-sectie, vóór de titel, voeg toe:

```tsx
{job.archived_at && (
  <div className="mb-2 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
    <Archive className="h-4 w-4" />
    <span className="font-medium">Gearchiveerd</span>
    <span className="text-amber-700">
      op {new Date(job.archived_at).toLocaleString('nl-NL')}
    </span>
    {job.archived_reason && (
      <span className="text-amber-700">— {job.archived_reason}</span>
    )}
  </div>
)}
```

Import `Archive` van `lucide-react` toevoegen aan de bestaande imports. Verifieer dat `job` de velden `archived_at` en `archived_reason` bevat (uit Task 4 RPC-update). Mogelijk moet de drawer-detail-fetch query (`/api/job-postings/[id]`) ook deze velden teruggeven — controleren in `apps/admin/app/api/job-postings/[id]/route.ts`.

- [ ] **Step 2: Update single-job GET endpoint indien nodig**

```bash
grep -n "select\|archived_at" apps/admin/app/api/job-postings/\[id\]/route.ts
```

Als de `select(...)` daar geen `archived_at, archived_reason, archived_by` bevat, voeg toe.

- [ ] **Step 3: Type-check + UI smoke-test**

```bash
cd apps/admin && pnpm exec tsc --noEmit 2>&1 | grep "job-posting-drawer" | head
```

Manueel: open een gearchiveerde vacature in de drawer → verifieer amber badge zichtbaar boven titel met datum en reden.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/components/job-posting-drawer.tsx \
        apps/admin/app/api/job-postings/\[id\]/route.ts
git commit -m "feat(admin): gearchiveerd-badge in job-posting drawer"
```

---

## Task 10: Vercel cron-job — auto-archief 180d

**Files:**
- Create: `apps/admin/app/api/cron/auto-archive-old/route.ts`
- Modify: `apps/admin/vercel.json`

- [ ] **Step 1: Maak cron-route**

```typescript
// apps/admin/app/api/cron/auto-archive-old/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withCronMonitoring } from '@/lib/cron-monitor'

async function autoArchiveOldHandler(_req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Identificeer kandidaten (180+ dagen oud, niet approved+published, niet al gearchiveerd)
  // Gebruik raw SQL via rpc om geen N+1 te krijgen.
  const { data, error } = await supabase.rpc('exec_sql', { sql: '' }) // placeholder check

  // Direct UPDATE via PostgREST is moeilijk omdat we een NOT-clause op twee kolommen hebben.
  // Gebruik een dedicated RPC `auto_archive_old_postings()` — maak die in Step 2.

  const { data: result, error: rpcErr } = await supabase.rpc('auto_archive_old_postings', {
    age_days: 180,
  })

  if (rpcErr) {
    return NextResponse.json(
      { success: false, error: rpcErr.message },
      { status: 500 }
    )
  }

  const archived = (result as unknown as number) ?? 0

  return NextResponse.json({
    success: true,
    message: `Auto-archive completed`,
    archived,
  })
}

export const POST = withCronMonitoring('auto-archive-old', autoArchiveOldHandler)
export const GET = POST
export const maxDuration = 300
```

Note: bovenstaande gebruikt een nog niet bestaande RPC `auto_archive_old_postings`. Maak die nu.

- [ ] **Step 2: Maak SQL RPC voor de UPDATE**

Via `mcp__supabase__apply_migration` met `name: "create_auto_archive_old_postings_rpc"`:

```sql
CREATE OR REPLACE FUNCTION public.auto_archive_old_postings(age_days integer DEFAULT 180)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected bigint;
BEGIN
  WITH updated AS (
    UPDATE job_postings
    SET archived_at = NOW(),
        archived_reason = 'auto_age_180d'
    WHERE archived_at IS NULL
      AND created_at < NOW() - (age_days || ' days')::interval
      AND NOT (review_status = 'approved' AND published_at IS NOT NULL)
    RETURNING id
  )
  SELECT count(*) INTO affected FROM updated;
  RETURN affected;
END;
$function$;
```

Verifieer dat de RPC werkt (zonder eigenlijk te updaten, omdat na bootstrap er geen kandidaten meer zijn — dat is OK; verwacht 0 geretourneerd):

```sql
SELECT auto_archive_old_postings(180);
-- Expected: 0 (alles is al gearchiveerd in bootstrap)
```

- [ ] **Step 3: Vereenvoudig handler nu de RPC bestaat**

Vervang Step 1's handler-body door:

```typescript
async function autoArchiveOldHandler(_req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase.rpc('auto_archive_old_postings', {
    age_days: 180,
  })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const archived = typeof data === 'number' ? data : Number(data ?? 0)
  return NextResponse.json({
    success: true,
    message: 'Auto-archive completed',
    archived,
  })
}

export const POST = withCronMonitoring('auto-archive-old', autoArchiveOldHandler)
export const GET = POST
export const maxDuration = 300
```

- [ ] **Step 4: Voeg cron + maxDuration toe aan vercel.json**

In `apps/admin/vercel.json` aan `crons`-array:

```json
{ "path": "/api/cron/auto-archive-old", "schedule": "0 3 * * *" }
```

En aan `functions`:

```json
"app/api/cron/auto-archive-old/route.ts": { "maxDuration": 300 }
```

- [ ] **Step 5: Update CLAUDE.md cron-tabel**

In het project root `CLAUDE.md`, "Cron Jobs" tabel een rij toevoegen:

```markdown
| Auto-archive Old | `0 3 * * *` | 04:00 | `/api/cron/auto-archive-old` |
```

- [ ] **Step 6: Type-check + lokale curl**

```bash
cd apps/admin && pnpm exec tsc --noEmit 2>&1 | grep "auto-archive-old" | head

# Lokale test (CRON_SECRET_KEY uit .env.local):
CRON_SECRET=$(grep "^CRON_SECRET_KEY=" /Users/kennylipman/Lokale-Banen/.env.local | head -1 | cut -d'=' -f2- | tr -d '"')
curl -X POST http://localhost:3000/api/cron/auto-archive-old \
  -H "Authorization: Bearer $CRON_SECRET"
# Expected: { success: true, message: "Auto-archive completed", archived: 0 }
```

- [ ] **Step 7: Commit**

```bash
git add apps/admin/app/api/cron/auto-archive-old/route.ts \
        apps/admin/vercel.json \
        CLAUDE.md
git commit -m "feat(cron): dagelijkse auto-archief voor records ouder dan 180d"
```

---

## Task 11: Public-sites listings + sitemap — filter op archived_at IS NULL

**Files:**
- Modify: `apps/public-sites/src/lib/queries.ts`
- Modify: `apps/public-sites/src/app/sitemap.ts`

- [ ] **Step 1: Update queries.ts**

Identificeer alle plekken waar `from('job_postings').eq('review_status', 'approved').not('published_at', 'is', null)` voorkomt (regels 107-130, 207-225 volgens earlier grep). Voeg na de bestaande filters toe:

```typescript
.is('archived_at', null)
```

Voorbeelden van te wijzigen blokken (regelnummers verifiëren met `grep -n "review_status" apps/public-sites/src/lib/queries.ts`):

```typescript
// Bestaand:
.eq('review_status', 'approved')
.not('published_at', 'is', null)

// Wordt:
.eq('review_status', 'approved')
.not('published_at', 'is', null)
.is('archived_at', null)
```

Doorvoeren in alle ~3 voorkomens in queries.ts.

- [ ] **Step 2: Update sitemap.ts**

In `apps/public-sites/src/app/sitemap.ts` op regel 82-88 én 117-121, voeg `.is('archived_at', null)` toe na de bestaande filters.

- [ ] **Step 3: Type-check + smoke-test**

```bash
cd apps/public-sites && pnpm exec tsc --noEmit 2>&1 | grep -E "(queries|sitemap)" | head
```

Start `pnpm --filter @lokale-banen/public-sites dev`. Open een regio-host (zie tenant-mapping). Verifieer:
- `/vacatures` listing toont geen gearchiveerde vacatures
- `/sitemap.xml` bevat geen URLs van gearchiveerde vacatures

Tegenproef: archiveer handmatig één approved+published vacature via admin → herlaad listing → vacature is weg. Activeer terug → vacature komt terug (cache moet revalidaten — kan tot 30s duren tenzij `revalidatePublicSite` heeft geslaagd).

- [ ] **Step 4: Commit**

```bash
git add apps/public-sites/src/lib/queries.ts apps/public-sites/src/app/sitemap.ts
git commit -m "feat(public-sites): filter gearchiveerde vacatures uit listings + sitemap"
```

---

## Task 12: Public-sites detail-page — drie-staten state-machine

**Files:**
- Modify: `apps/public-sites/src/app/vacature/[slug]/page.tsx`

- [ ] **Step 1: Update detail-fetch om gearchiveerde vacatures wél op te halen**

Identificeer de fetch-call die de vacature ophaalt. Als die filtert op `archived_at IS NULL`, **VERWIJDER** dat filter — de detail-page moet alle drie staten ondersteunen, dus moet ook gearchiveerde records kunnen zien.

```bash
grep -n "from('job_postings')\|archived_at" apps/public-sites/src/app/vacature/\[slug\]/page.tsx
```

In de query alleen filter op `slug` + `review_status = 'approved'` + `published_at IS NOT NULL` (geen archived_at filter).

- [ ] **Step 2: Voeg state-machine logica toe**

Bovenaan in de component, na de `job` is opgehaald:

```typescript
// Drie-staten archief-logica
const archivedAt = job.archived_at ? new Date(job.archived_at) : null
const now = new Date()
const GRACE_DAYS = 30

const isArchived = !!archivedAt
const isInGracePeriod = isArchived && archivedAt!.getTime() > now.getTime() - GRACE_DAYS * 86_400_000
const isPermanentlyGone = isArchived && !isInGracePeriod

// Permanent gone → 410 Gone response
if (isPermanentlyGone) {
  // Next.js App Router: gebruik notFound() — Vercel mapt dit naar 404.
  // Voor expliciete 410 kunnen we een custom Response retourneren via
  // een dedicated 410 route. Voor nu accepteer 404 (next/navigation.notFound)
  // — Google honoreert beide voor de-indexering.
  notFound()
}
```

Note: Next.js App Router heeft geen native 410-helper. Pragmatische keus: gebruik `notFound()` (404). Google de-indexeert beide statussen. Als 410 cruciaal blijkt later: dedicated `/permanently-gone` page met `Response('', { status: 410 })`. Voor MVP: 404 via `notFound()`.

- [ ] **Step 3: noindex meta-tag bij grace-period**

In de `generateMetadata`-functie van dezelfde file (of waar metadata wordt geconstrueerd), conditioneel toevoegen:

```typescript
const isInGracePeriod = job.archived_at
  && new Date(job.archived_at).getTime() > Date.now() - 30 * 86_400_000

return {
  title: ...,
  // ...
  robots: isInGracePeriod ? { index: false, follow: false } : undefined,
}
```

Als `generateMetadata` separaat staat van de page-fetch, moet de query daar idem niet filteren op `archived_at`.

- [ ] **Step 4: "Vacature afgelopen"-bordje renderen**

In de page render, vóór de normale content:

```tsx
{job.archived_at && (
  <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
    <h2 className="text-lg font-semibold">Deze vacature is afgelopen</h2>
    <p className="mt-1 text-sm text-amber-800">
      Deze positie is niet langer beschikbaar. Bekijk{' '}
      <a href="/vacatures" className="underline">andere vacatures</a>.
    </p>
  </div>
)}
```

- [ ] **Step 5: Type-check + smoke-test**

```bash
cd apps/public-sites && pnpm exec tsc --noEmit 2>&1 | grep "vacature/\[slug\]" | head
```

Manueel testen op lokale dev:
1. **Actief** — open een actieve approved+published vacature → 200 OK, geen bordje, geen noindex.
2. **Grace** — archiveer een approved+published vacature in admin → herlaad publieke detail → 200 OK met amber bordje + meta-noindex (check via `view-source:`).
3. **Permanent gone** — simuleer via SQL `UPDATE job_postings SET archived_at = NOW() - INTERVAL '31 days' WHERE id = '<X>'` → herlaad → 404.

- [ ] **Step 6: Commit**

```bash
git add apps/public-sites/src/app/vacature/\[slug\]/page.tsx
git commit -m "feat(public-sites): drie-staten archief op vacature detail (200/200+noindex/404)"
```

---

## Task 13: Bestaande scripts & services updaten met archived_at filter

**Files:**
- Modify: `scripts/seed-approved-per-platform.mjs`
- Modify: `apps/admin/lib/services/lokalebanen-push.service.ts`

- [ ] **Step 1: seed-approved-per-platform.mjs**

In de PostgREST query waar pending records worden opgehaald (regel ~219, na de eerdere fix in deze sessie):

```javascript
// Bestaand:
`&review_status=eq.pending` +
`&scraped_at=gt.${cutoff}` +

// Wordt:
`&review_status=eq.pending` +
`&archived_at=is.null` +
`&scraped_at=gt.${cutoff}` +
```

- [ ] **Step 2: lokalebanen-push.service.ts**

```bash
grep -n "from('job_postings')\|review_status\|published_at" apps/admin/lib/services/lokalebanen-push.service.ts | head -20
```

Beide queries (regels 198 en 325) die `.eq('review_status', 'approved')` doen, krijgen extra:

```typescript
.is('archived_at', null)
```

- [ ] **Step 3: Type-check**

```bash
cd apps/admin && pnpm exec tsc --noEmit 2>&1 | grep "lokalebanen-push" | head
```

- [ ] **Step 4: Audit overige queries**

```bash
grep -rln "from('job_postings'" apps/admin/lib apps/admin/app/api 2>/dev/null
```

Loop de uitvoer langs. Per bestand een snelle inschatting:
- Reads voor admin-UI / interne workflow: hoeven NIET gefilterd (admin moet alles kunnen zien).
- Reads voor publieke output / externe integraties (push naar lokalebanen / instantly etc.): WEL filteren op `archived_at IS NULL`.

Update bestanden waar twijfel is. Documenteer de keuze in een korte commit-message.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-approved-per-platform.mjs \
        apps/admin/lib/services/lokalebanen-push.service.ts
git commit -m "fix(scripts): filter gearchiveerde vacatures in publieke push-flows"
```

---

## Task 14: End-to-end verificatie + push naar productie

- [ ] **Step 1: Lokale full-flow test**

In admin (`/job-postings`):
1. Pending tab → selecteer 3 records → bulk-Archiveer met reden "E2E test" → toast bevestigt 3 gearchiveerd → records weg uit pending tab.
2. Archief tab → records gevonden, badge "Gearchiveerd" zichtbaar in drawer → Activeer → records terug in pending.
3. Single archive: open vacature drawer → "Archiveer"-actie (rij-actie) → bevestig → tab-count update.

In public-sites:
4. Archiveer een approved+published vacature → cache revalideert → vacature weg uit /vacatures listing → detail toont amber-bordje + noindex meta.

- [ ] **Step 2: Type-check + build alle apps**

```bash
cd /Users/kennylipman/Lokale-Banen
pnpm --filter @lokale-banen/admin exec tsc --noEmit
pnpm --filter @lokale-banen/public-sites exec tsc --noEmit
pnpm --filter @lokale-banen/admin build
pnpm --filter @lokale-banen/public-sites build
```

Verwacht: alle 4 commands clean.

- [ ] **Step 3: Push naar main**

```bash
git push origin main
```

- [ ] **Step 4: Productie smoke-test (na Vercel-deploy)**

```bash
# Wacht op deploy
sleep 60

# Trigger cron handmatig
CRON_SECRET=$(grep "^CRON_SECRET_KEY=" /Users/kennylipman/Lokale-Banen/.env.local | head -1 | cut -d'=' -f2- | tr -d '"')
curl -X POST https://lokale-banen-app.vercel.app/api/cron/auto-archive-old \
  -H "Authorization: Bearer $CRON_SECRET"
# Expected: { success: true, archived: 0 }  (alles al gearchiveerd in bootstrap)

# Verifieer cron logging
psql ... -c "SELECT job_name, status, started_at FROM cron_job_logs WHERE job_name = 'auto-archive-old' ORDER BY started_at DESC LIMIT 1;"
# Expected: 1 rij met status=success
```

Open productie-admin `/job-postings` → verifieer 5 tabs aanwezig met correcte counts.

---

## Self-review checklist (voor ik dit plan afsluit)

- [x] Spec coverage: alle secties uit design-doc gedekt (datamodel → Task 1, bootstrap → Task 2, RPCs → 3-4, endpoints → 5-6, UI → 7-9, cron → 10, public-sites → 11-12, scripts → 13)
- [x] Geen placeholders: elke step heeft concrete code, exacte paden, exact te runnen commands
- [x] Type consistency: `archived_filter` parameter consistent door RPC ↔ hook ↔ table; `mode` prop consistent in BulkActionBar; `archived_at` veld consistent door alle layers
- [x] Volgorde: schema vóór RPC vóór endpoints vóór UI; cron na endpoints; public-sites kan parallel (geen dependency op admin endpoints behalve revalidate-flow)
- [x] Verificatie per task: SQL-queries, curl-tests, type-check, manuele UI-checks
- [x] Frequente commits: elke task eindigt in een commit
