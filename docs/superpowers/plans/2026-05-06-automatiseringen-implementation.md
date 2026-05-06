# Automatiseringen Hub — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bouw een `/automatiseringen` admin-sectie die alle code-gestuurde cron jobs toont (lijst + detail), en migreer de eerste n8n-flow ("Fix Platform_id Nominatim") naar code met LocationIQ als geocoder.

**Architecture:** Code-only registry (`lib/automations-registry.ts`) is bron van waarheid. Nieuwe `automation_runs` tabel vervangt `cron_job_logs`. `withAutomationMonitoring()` wrapper logt elke run (scheduled én manual). UI is server components op Next.js App Router.

**Tech Stack:** Next.js 15 (App Router) + React 19, Supabase (Postgres) via service-role client, Vitest voor unit tests, recharts (al geïnstalleerd) voor trend-graph, Vercel Cron, LocationIQ EU endpoint.

**Reference design spec:** `docs/superpowers/specs/2026-05-06-automatiseringen-design.md`

---

## File Structure

| File | Verantwoordelijkheid | Chunk |
|---|---|---|
| `supabase/migrations/<ts>_create_automation_runs.sql` | Tabel + indexes + RLS | A |
| `supabase/migrations/<ts>_rename_nominatim_failed.sql` | Rename `nominatim_failed` → `geocoding_failed` + nieuwe `geocoding_failed_reason` | A |
| `supabase/migrations/<ts>_get_automation_run_stats_rpc.sql` | RPC voor aggregaties | A |
| `apps/admin/lib/automations-registry.ts` | Type-defs + 12 entries (bron van waarheid) | B |
| `apps/admin/lib/automation-monitor.ts` | `withAutomationMonitoring` wrapper | B |
| `apps/admin/lib/cron-monitor.ts` | (modify) `withCronMonitoring` als alias | B |
| `apps/admin/lib/cron-config.ts` | (modify) re-export uit registry tijdens transitie | B |
| `apps/admin/app/api/automations/route.ts` | `GET /api/automations` | C |
| `apps/admin/app/api/automations/[id]/route.ts` | `GET /api/automations/[id]` | C |
| `apps/admin/app/api/automations/[id]/trigger/route.ts` | `POST .../trigger` (Run Now) | C |
| `apps/admin/app/automatiseringen/page.tsx` | Lijstpagina (server component) | D |
| `apps/admin/app/automatiseringen/automations-table.tsx` | Tabel-component (client) | D |
| `apps/admin/app/automatiseringen/[id]/page.tsx` | Detailpagina (server component) | E |
| `apps/admin/app/automatiseringen/[id]/run-now-button.tsx` | Run Now + polling (client) | E |
| `apps/admin/app/automatiseringen/[id]/trend-chart.tsx` | Recharts trend-grafiek (client) | E |
| `apps/admin/app/automatiseringen/[id]/run-history-table.tsx` | Run history tabel (client) | E |
| `apps/admin/components/app-sidebar.tsx` | (modify) "Automatiseringen" item toevoegen | D |
| `apps/admin/app/api/cron/fix-job-postings-geocoding/route.ts` | Thin handler | F |
| `apps/admin/lib/automations/fix-job-postings-geocoding/index.ts` | `run()` main loop | F |
| `apps/admin/lib/automations/fix-job-postings-geocoding/locationiq-client.ts` | Search + retry | F |
| `apps/admin/lib/automations/fix-job-postings-geocoding/platform-lookup.ts` | postcode → platform_id | F |
| `apps/admin/lib/automations/fix-job-postings-geocoding/queue.ts` | Queue-fetch query | F |
| `apps/admin/lib/automations/fix-job-postings-geocoding/budget-check.ts` | Daily budget guard | F |
| `apps/admin/lib/automations/fix-job-postings-geocoding/types.ts` | Types | F |
| `apps/admin/__tests__/locationiq-client.test.ts` | Unit | F |
| `apps/admin/__tests__/platform-lookup.test.ts` | Unit | F |
| `apps/admin/vercel.json` | (modify) Cron-entry + maxDuration | F |
| `apps/admin/app/api/cron/watchdog/route.ts` | (modify) leest `automation_runs` | G |
| `apps/admin/components/CronJobMonitor.tsx` | (modify) reads `automation_runs` of mark deprecated | G |

---

## Chunk A — Database Schema

### Task A1: Migration — `automation_runs` tabel

**Files:**
- Create: `supabase/migrations/20260506000001_create_automation_runs.sql`

- [ ] **Step 1: Schrijf migration**

```sql
-- supabase/migrations/20260506000001_create_automation_runs.sql

create table automation_runs (
  id                  uuid primary key default gen_random_uuid(),
  automation_id       text not null,
  started_at          timestamptz not null,
  completed_at        timestamptz,
  duration_ms         integer,
  status              text not null check (status in ('running','success','error','timeout')),
  http_status         integer,
  error_message       text,
  business_stats      jsonb,
  triggered_by        text not null default 'schedule' check (triggered_by in ('schedule','manual')),
  triggered_by_user_id uuid references auth.users(id),
  created_at          timestamptz not null default now()
);

create index idx_automation_runs_aid_started on automation_runs (automation_id, started_at desc);
create index idx_automation_runs_failed     on automation_runs (started_at desc) where status != 'success';

-- RLS: alleen admins via authenticated session lezen, service-role schrijft
alter table automation_runs enable row level security;

create policy "automation_runs admin read"
  on automation_runs for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    or coalesce((auth.jwt() ->> 'email') = any (string_to_array(coalesce(current_setting('app.admin_emails', true), ''), ',')), false)
  );

-- Geen INSERT/UPDATE/DELETE policy → alleen service-role kan schrijven (bypassed RLS).
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Gebruik `mcp__supabase__apply_migration` met name `create_automation_runs` en bovenstaande SQL.

- [ ] **Step 3: Verify**

```sql
-- Run via mcp__supabase__execute_sql:
select count(*) from automation_runs;
-- Verwacht: 0 rijen, geen error.

select indexname from pg_indexes where tablename='automation_runs';
-- Verwacht: idx_automation_runs_aid_started, idx_automation_runs_failed (en de PK).
```

- [ ] **Step 4: Run advisors**

Gebruik `mcp__supabase__get_advisors` met type `security`. Verwachting: geen kritieke issues op de nieuwe tabel.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260506000001_create_automation_runs.sql
git commit -m "feat(db): create automation_runs table replacing cron_job_logs"
```

---

### Task A2: Migration — rename `nominatim_failed` → `geocoding_failed`

**Files:**
- Create: `supabase/migrations/20260506000002_rename_nominatim_failed.sql`

- [ ] **Step 1: Vind alle code-references**

Run: `grep -rn "nominatim_failed" /Users/kennylipman/Lokale-Banen --include="*.ts" --include="*.tsx" --include="*.sql"`

Noteer alle gevonden bestanden. Verwacht: minimaal de n8n JSON (kunnen we negeren) en eventueel database.types.ts (regenereren in stap 5).

- [ ] **Step 2: Schrijf migration**

```sql
-- supabase/migrations/20260506000002_rename_nominatim_failed.sql

alter table job_postings rename column nominatim_failed to geocoding_failed;
alter table job_postings add column geocoding_failed_reason text;
```

- [ ] **Step 3: Apply migration**

Gebruik `mcp__supabase__apply_migration` met name `rename_nominatim_failed`.

- [ ] **Step 4: Verify**

```sql
select column_name from information_schema.columns
where table_name='job_postings' and column_name in ('geocoding_failed','geocoding_failed_reason','nominatim_failed');
-- Verwacht: geocoding_failed, geocoding_failed_reason. NIET nominatim_failed.

select count(*) filter (where geocoding_failed = true) from job_postings;
-- Verwacht: 190 (was de count van nominatim_failed=true).
```

- [ ] **Step 5: Regenerate TypeScript types**

Gebruik `mcp__supabase__generate_typescript_types`. Vervang `apps/admin/types/database.types.ts` met de output. Run `npm run type-check` in `apps/admin` om te valideren.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260506000002_rename_nominatim_failed.sql apps/admin/types/database.types.ts
git commit -m "feat(db): rename nominatim_failed to geocoding_failed + add reason column"
```

---

### Task A3: RPC `get_automation_run_stats`

**Files:**
- Create: `supabase/migrations/20260506000003_get_automation_run_stats_rpc.sql`

- [ ] **Step 1: Schrijf migration**

```sql
-- supabase/migrations/20260506000003_get_automation_run_stats_rpc.sql

create or replace function get_automation_run_stats(
  since_date timestamptz,
  filter_automation_id text default ''
)
returns table (
  automation_id text,
  total_runs bigint,
  success_count bigint,
  error_count bigint,
  timeout_count bigint,
  avg_duration_ms numeric,
  max_duration_ms integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    automation_id,
    count(*) as total_runs,
    count(*) filter (where status = 'success') as success_count,
    count(*) filter (where status = 'error') as error_count,
    count(*) filter (where status = 'timeout') as timeout_count,
    coalesce(avg(duration_ms), 0) as avg_duration_ms,
    coalesce(max(duration_ms), 0) as max_duration_ms
  from automation_runs
  where started_at >= since_date
    and (filter_automation_id = '' or automation_id = filter_automation_id)
  group by automation_id;
$$;

grant execute on function get_automation_run_stats(timestamptz, text) to authenticated;
```

- [ ] **Step 2: Apply migration**

Via `mcp__supabase__apply_migration` met name `get_automation_run_stats_rpc`.

- [ ] **Step 3: Verify**

```sql
select * from get_automation_run_stats(now() - interval '7 days', '');
-- Verwacht: lege resultaten (nog geen runs), geen error.
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260506000003_get_automation_run_stats_rpc.sql
git commit -m "feat(db): add get_automation_run_stats RPC"
```

---

## Chunk B — Registry & Monitoring Lib

### Task B1: Registry types + 12 entries

**Files:**
- Create: `apps/admin/lib/automations-registry.ts`

- [ ] **Step 1: Schrijf registry**

```ts
// apps/admin/lib/automations-registry.ts

export type AutomationCategory = 'scraper' | 'sync' | 'enrichment' | 'maintenance'

export interface DisplayStat {
  key: string
  label: string
  format?: 'number' | 'percent' | 'duration'
}

export interface AutomationDefinition {
  id: string
  displayName: string
  description: string
  category: AutomationCategory
  schedule: string                // cron expr in UTC
  expectedIntervalMs: number
  handlerPath: string
  displayStats: DisplayStat[]
  primaryStatKey?: string         // welke key in business_stats voor trend-grafiek (default: eerste in displayStats)
  docsLink?: string
}

const HOUR = 3_600_000
const MINUTE = 60_000

export const AUTOMATIONS: AutomationDefinition[] = [
  {
    id: 'fix-job-postings-geocoding',
    displayName: 'Geocoding job_postings',
    description: 'Verrijkt job_postings met postcode, lat/lng en platform_id via LocationIQ',
    category: 'enrichment',
    schedule: '0 */2 * * *',
    expectedIntervalMs: 2 * HOUR,
    handlerPath: '/api/cron/fix-job-postings-geocoding',
    displayStats: [
      { key: 'enriched', label: 'verrijkt' },
      { key: 'geocoding_failed_no_match', label: 'geen match' },
      { key: 'geocoding_failed_no_postcode', label: 'geen postcode' },
      { key: 'platform_matched', label: 'platform' },
      { key: 'queue_remaining', label: 'queue' },
    ],
    primaryStatKey: 'enriched',
  },
  {
    id: 'postcode-backfill',
    displayName: 'Postcode backfill (companies)',
    description: 'Geocoding voor company-postcodes',
    category: 'enrichment',
    schedule: '*/2 * * * *',
    expectedIntervalMs: 2 * MINUTE,
    handlerPath: '/api/cron/postcode-backfill',
    displayStats: [
      { key: 'processed', label: 'verwerkt' },
      { key: 'enriched', label: 'verrijkt' },
      { key: 'failed', label: 'gefaald' },
    ],
    primaryStatKey: 'enriched',
  },
  {
    id: 'baanindebuurt-scraper',
    displayName: 'Baanindebuurt scraper',
    description: 'Vacatures scrapen van baanindebuurt.nl',
    category: 'scraper',
    schedule: '0 5 * * *',
    expectedIntervalMs: 24 * HOUR,
    handlerPath: '/api/scrapers/baanindebuurt',
    displayStats: [
      { key: 'new', label: 'nieuw' },
      { key: 'updated', label: 'update' },
      { key: 'skipped', label: 'overgeslagen' },
      { key: 'errors', label: 'errors' },
    ],
    primaryStatKey: 'new',
  },
  {
    id: 'debanensite-scraper',
    displayName: 'Debanensite scraper',
    description: 'Vacatures scrapen van debanensite.nl',
    category: 'scraper',
    schedule: '0 6 * * *',
    expectedIntervalMs: 24 * HOUR,
    handlerPath: '/api/scrapers/debanensite',
    displayStats: [
      { key: 'pages_scraped', label: "pagina's" },
      { key: 'new', label: 'nieuw' },
      { key: 'updated', label: 'update' },
      { key: 'errors', label: 'errors' },
    ],
    primaryStatKey: 'new',
  },
  {
    id: 'campaign-assignment-parallel',
    displayName: 'Campaign assignment',
    description: 'Verdeelt contacts over Instantly campagnes',
    category: 'sync',
    schedule: '0 7,13 * * *',
    expectedIntervalMs: 6 * HOUR,
    handlerPath: '/api/cron/campaign-assignment-parallel',
    displayStats: [
      { key: 'platforms_processed', label: 'platforms' },
      { key: 'contacts_assigned', label: 'contacts' },
      { key: 'campaigns_used', label: 'campagnes' },
      { key: 'errors', label: 'errors' },
    ],
    primaryStatKey: 'contacts_assigned',
  },
  {
    id: 'cleanup-instantly-leads',
    displayName: 'Instantly cleanup',
    description: 'Verwijdert completed leads uit Instantly na 10 dagen',
    category: 'maintenance',
    schedule: '0 3 * * *',
    expectedIntervalMs: 24 * HOUR,
    handlerPath: '/api/cron/cleanup-instantly-leads',
    displayStats: [
      { key: 'deleted', label: 'verwijderd' },
      { key: 'kept', label: 'behouden' },
      { key: 'errors', label: 'errors' },
    ],
    primaryStatKey: 'deleted',
  },
  {
    id: 'daily-campaign-report',
    displayName: 'Daily campaign report',
    description: 'Verstuurt dagelijks Instantly performance-rapport',
    category: 'maintenance',
    schedule: '0 8 * * *',
    expectedIntervalMs: 24 * HOUR,
    handlerPath: '/api/cron/daily-campaign-report',
    displayStats: [
      { key: 'reports_sent', label: 'rapporten' },
      { key: 'recipients', label: 'recipients' },
    ],
    primaryStatKey: 'reports_sent',
  },
  {
    id: 'refresh-campaign-eligible',
    displayName: 'Refresh campaign eligible',
    description: 'Vernieuwt campaign-eligible materialized view',
    category: 'maintenance',
    schedule: '30 6 * * *',
    expectedIntervalMs: 24 * HOUR,
    handlerPath: '/api/cron/refresh-campaign-eligible',
    displayStats: [
      { key: 'rows_refreshed', label: 'rijen' },
      { key: 'duration_ms', label: 'duur', format: 'duration' },
    ],
    primaryStatKey: 'rows_refreshed',
  },
  {
    id: 'refresh-contact-stats',
    displayName: 'Refresh contact stats',
    description: 'Vernieuwt contact_stats materialized view',
    category: 'maintenance',
    schedule: '*/5 * * * *',
    expectedIntervalMs: 5 * MINUTE,
    handlerPath: '/api/cron/refresh-contact-stats',
    displayStats: [
      { key: 'rows_refreshed', label: 'rijen' },
      { key: 'duration_ms', label: 'duur', format: 'duration' },
    ],
    primaryStatKey: 'rows_refreshed',
  },
  {
    id: 'refresh-company-platforms',
    displayName: 'Refresh company platforms',
    description: 'Vernieuwt company_platforms materialized view',
    category: 'maintenance',
    schedule: '0 10 * * *',
    expectedIntervalMs: 24 * HOUR,
    handlerPath: '/api/cron/refresh-company-platforms',
    displayStats: [
      { key: 'rows_refreshed', label: 'rijen' },
      { key: 'duration_ms', label: 'duur', format: 'duration' },
    ],
    primaryStatKey: 'rows_refreshed',
  },
  {
    id: 'auto-archive-old',
    displayName: 'Auto-archive old',
    description: 'Archiveert oude vacatures',
    category: 'maintenance',
    schedule: '30 3 * * *',
    expectedIntervalMs: 24 * HOUR,
    handlerPath: '/api/cron/auto-archive-old',
    displayStats: [
      { key: 'archived', label: 'gearchiveerd' },
      { key: 'kept', label: 'behouden' },
    ],
    primaryStatKey: 'archived',
  },
  {
    id: 'watchdog',
    displayName: 'Watchdog',
    description: 'Monitort alle automatiseringen en stuurt Slack-alerts',
    category: 'maintenance',
    schedule: '*/15 * * * *',
    expectedIntervalMs: 15 * MINUTE,
    handlerPath: '/api/cron/watchdog',
    displayStats: [
      { key: 'jobs_checked', label: 'jobs gecheckt' },
      { key: 'overdue', label: 'overdue' },
      { key: 'alerts_sent', label: 'alerts' },
    ],
    primaryStatKey: 'jobs_checked',
  },
]

export function getAutomation(id: string): AutomationDefinition | undefined {
  return AUTOMATIONS.find(a => a.id === id)
}

/** Een job is overdue als hij langer dan 3× expectedIntervalMs niet gedraaid heeft */
export const OVERDUE_MULTIPLIER = 3

export function isOverdue(automation: AutomationDefinition, lastRunStartedAt: string | null): boolean {
  if (!lastRunStartedAt) return false
  const elapsed = Date.now() - new Date(lastRunStartedAt).getTime()
  return elapsed > automation.expectedIntervalMs * OVERDUE_MULTIPLIER
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/admin && npm run type-check
```

Expected: geen errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/lib/automations-registry.ts
git commit -m "feat(automations): add registry with 12 automation definitions"
```

---

### Task B2: `withAutomationMonitoring` wrapper

**Files:**
- Create: `apps/admin/lib/automation-monitor.ts`

- [ ] **Step 1: Schrijf wrapper**

```ts
// apps/admin/lib/automation-monitor.ts

import { NextRequest, NextResponse } from 'next/server'
import { withCronAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

const TIMEOUT_THRESHOLD_MS = 290_000

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface InsertRunParams {
  automationId: string
  startedAt: Date
  triggeredBy: 'schedule' | 'manual'
  triggeredByUserId: string | null
}

async function insertRunningRow(p: InsertRunParams): Promise<string | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('automation_runs')
    .insert({
      automation_id: p.automationId,
      started_at: p.startedAt.toISOString(),
      status: 'running',
      triggered_by: p.triggeredBy,
      triggered_by_user_id: p.triggeredByUserId,
    })
    .select('id')
    .single()
  if (error) {
    console.error(`[automation-monitor] Insert running failed for ${p.automationId}:`, error.message)
    return null
  }
  return data.id
}

interface UpdateRunParams {
  runId: string
  status: 'success' | 'error' | 'timeout'
  durationMs: number
  httpStatus?: number
  errorMessage?: string
  businessStats?: Record<string, unknown>
  completedAt: Date
}

async function updateRunRow(p: UpdateRunParams) {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('automation_runs')
    .update({
      completed_at: p.completedAt.toISOString(),
      duration_ms: p.durationMs,
      status: p.status,
      http_status: p.httpStatus ?? null,
      error_message: p.errorMessage ?? null,
      business_stats: p.businessStats ?? null,
    })
    .eq('id', p.runId)
  if (error) {
    console.error(`[automation-monitor] Update run ${p.runId} failed:`, error.message)
  }
}

/**
 * Wrapt een handler met:
 * - withCronAuth (CRON_SECRET) — geldt voor zowel scheduled als manual triggers
 * - Insert 'running' row → run handler → update row met resultaat
 * - Trigger-source via headers: X-Automation-Trigger (manual/schedule), X-Automation-User-Id
 */
export function withAutomationMonitoring(automationId: string) {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    const monitored = async (req: NextRequest): Promise<NextResponse> => {
      const startedAt = new Date()
      const startTime = Date.now()
      const triggeredBy = (req.headers.get('x-automation-trigger') === 'manual')
        ? 'manual' as const
        : 'schedule' as const
      const triggeredByUserId = req.headers.get('x-automation-user-id')

      const runId = await insertRunningRow({ automationId, startedAt, triggeredBy, triggeredByUserId })

      try {
        const response = await handler(req)
        const durationMs = Date.now() - startTime

        let businessStats: Record<string, unknown> | undefined
        let errorMessage: string | undefined
        try {
          const cloned = response.clone()
          const body = await cloned.json()
          const { stats, message, success, error: bodyError } = body as Record<string, unknown>
          if (stats && typeof stats === 'object') {
            businessStats = stats as Record<string, unknown>
          }
          if (!success || bodyError) {
            errorMessage = (bodyError ?? message ?? 'Unknown error') as string
          }
        } catch {
          // Response may not be JSON
        }

        const status: 'success' | 'error' | 'timeout' =
          durationMs >= TIMEOUT_THRESHOLD_MS ? 'timeout'
          : (response.status >= 400 || errorMessage) ? 'error'
          : 'success'

        if (runId) {
          await updateRunRow({
            runId, status, durationMs,
            httpStatus: response.status,
            errorMessage, businessStats,
            completedAt: new Date(),
          })
        }
        return response
      } catch (err) {
        const durationMs = Date.now() - startTime
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        if (runId) {
          await updateRunRow({
            runId,
            status: durationMs >= TIMEOUT_THRESHOLD_MS ? 'timeout' : 'error',
            durationMs,
            httpStatus: 500,
            errorMessage,
            completedAt: new Date(),
          })
        }
        throw err
      }
    }

    return withCronAuth(monitored)
  }
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/admin && npm run type-check
```

Expected: geen errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/lib/automation-monitor.ts
git commit -m "feat(automations): add withAutomationMonitoring wrapper"
```

---

### Task B3: `withCronMonitoring` als alias

**Files:**
- Modify: `apps/admin/lib/cron-monitor.ts`

- [ ] **Step 1: Lees huidige inhoud**

Read: `apps/admin/lib/cron-monitor.ts` — bevat de oude wrapper die naar `cron_job_logs` schrijft.

- [ ] **Step 2: Vervang inhoud**

```ts
// apps/admin/lib/cron-monitor.ts

import { withAutomationMonitoring } from '@/lib/automation-monitor'

// Backward-compat re-exports — bestaande handlers gebruiken deze namen.
export { CRON_JOBS_CONFIG, EXPECTED_INTERVAL_MS, OVERDUE_MULTIPLIER, ALERT_COOLDOWN_HOURS } from '@/lib/cron-config'

/**
 * @deprecated Gebruik `withAutomationMonitoring(automationId)` direct.
 * Tweede argument `path` wordt genegeerd — handlerPath staat in de registry.
 */
export function withCronMonitoring(jobName: string, _path: string) {
  return withAutomationMonitoring(jobName)
}
```

- [ ] **Step 3: Type-check**

```bash
cd apps/admin && npm run type-check
```

Verwacht: misschien errors in `lib/cron-config.ts` referenties — die fixen we in B4.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/lib/cron-monitor.ts
git commit -m "refactor(automations): redirect withCronMonitoring to new wrapper"
```

---

### Task B4: `cron-config.ts` als compat-bridge

**Files:**
- Modify: `apps/admin/lib/cron-config.ts`

- [ ] **Step 1: Lees huidige inhoud**

Read het bestaande bestand. Het exporteert `CRON_JOBS_CONFIG`, `EXPECTED_INTERVAL_MS`, `OVERDUE_MULTIPLIER`, `ALERT_COOLDOWN_HOURS`.

- [ ] **Step 2: Vervang inhoud**

```ts
// apps/admin/lib/cron-config.ts
//
// Compat-laag — bestaande consumers (CronJobMonitor, watchdog tot migratie)
// blijven werken. Bron van waarheid: lib/automations-registry.ts

import { AUTOMATIONS, type AutomationDefinition } from '@/lib/automations-registry'

export const CRON_JOBS_CONFIG: Record<string, { path: string; schedule: string; description: string }> =
  Object.fromEntries(
    AUTOMATIONS.map((a: AutomationDefinition) => [
      a.id,
      { path: a.handlerPath, schedule: a.schedule, description: a.description },
    ])
  )

export const EXPECTED_INTERVAL_MS: Record<string, number> =
  Object.fromEntries(AUTOMATIONS.map((a) => [a.id, a.expectedIntervalMs]))

export const OVERDUE_MULTIPLIER = 3
export const ALERT_COOLDOWN_HOURS = 4
```

- [ ] **Step 3: Type-check**

```bash
cd apps/admin && npm run type-check
```

Expected: clean.

- [ ] **Step 4: Build-check**

```bash
cd apps/admin && npm run build
```

Expected: clean (de bestaande CronJobMonitor en watchdog gebruiken deze exports nog).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/cron-config.ts
git commit -m "refactor(automations): cron-config.ts derives from registry"
```

---

## Chunk C — API Endpoints

### Task C1: `GET /api/automations`

**Files:**
- Create: `apps/admin/app/api/automations/route.ts`

- [ ] **Step 1: Schrijf endpoint**

```ts
// apps/admin/app/api/automations/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { AUTOMATIONS } from '@/lib/automations-registry'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function listHandler(request: NextRequest, _auth: AuthResult) {
  try {
    const { searchParams } = request.nextUrl
    const rawDays = parseInt(searchParams.get('days') || '7', 10)
    const days = Math.max(1, Math.min(Number.isNaN(rawDays) ? 7 : rawDays, 30))

    const supabase = getServiceClient()
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceISO = since.toISOString()

    // Stats per automation via RPC
    const { data: statsRows } = await supabase.rpc('get_automation_run_stats', {
      since_date: sinceISO,
      filter_automation_id: '',
    })

    const statsByAutomation: Record<string, {
      totalRuns: number; successCount: number; errorCount: number; timeoutCount: number;
      avgDurationMs: number; maxDurationMs: number; successRate: number
    }> = {}
    for (const row of statsRows ?? []) {
      const total = Number(row.total_runs)
      statsByAutomation[row.automation_id] = {
        totalRuns: total,
        successCount: Number(row.success_count),
        errorCount: Number(row.error_count),
        timeoutCount: Number(row.timeout_count),
        avgDurationMs: Math.round(Number(row.avg_duration_ms)),
        maxDurationMs: Number(row.max_duration_ms),
        successRate: total > 0 ? Math.round((Number(row.success_count) / total) * 100) : 0,
      }
    }

    // Latest run per automation: pak laatste 200 runs en dedup
    const { data: recentRuns } = await supabase
      .from('automation_runs')
      .select('*')
      .order('automation_id')
      .order('started_at', { ascending: false })
      .limit(200)

    const latestByAutomation: Record<string, NonNullable<typeof recentRuns>[number]> = {}
    for (const run of recentRuns ?? []) {
      if (!latestByAutomation[run.automation_id]) {
        latestByAutomation[run.automation_id] = run
      }
    }

    const automations = AUTOMATIONS.map((a) => ({
      ...a,
      latestRun: latestByAutomation[a.id] ?? null,
      stats: statsByAutomation[a.id] ?? null,
    }))

    return NextResponse.json({
      success: true,
      days,
      automations,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching automations:', errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

export const GET = withAuth(listHandler)
```

- [ ] **Step 2: Type-check**

```bash
cd apps/admin && npm run type-check
```

- [ ] **Step 3: Smoke-test**

Start dev server: `npm run dev`. Login als admin. In andere shell:

```bash
curl -H "Cookie: <copy van browser>" http://localhost:3000/api/automations | head -50
```

Verwacht: `{"success":true,"automations":[...12 entries with latestRun=null, stats=null],"days":7}`.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/api/automations/route.ts
git commit -m "feat(api): GET /api/automations returns registry + stats"
```

---

### Task C2: `GET /api/automations/[id]`

**Files:**
- Create: `apps/admin/app/api/automations/[id]/route.ts`

- [ ] **Step 1: Schrijf endpoint**

```ts
// apps/admin/app/api/automations/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { getAutomation } from '@/lib/automations-registry'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function detailHandler(
  request: NextRequest,
  _auth: AuthResult,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const automation = getAutomation(id)
    if (!automation) {
      return NextResponse.json({ success: false, error: 'Automation not found' }, { status: 404 })
    }

    const { searchParams } = request.nextUrl
    const rawDays = parseInt(searchParams.get('days') || '30', 10)
    const days = Math.max(1, Math.min(Number.isNaN(rawDays) ? 30 : rawDays, 90))

    const supabase = getServiceClient()
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceISO = since.toISOString()

    // Stats
    const { data: statsRows } = await supabase.rpc('get_automation_run_stats', {
      since_date: sinceISO,
      filter_automation_id: id,
    })
    const row = statsRows?.[0]
    const stats = row ? {
      totalRuns: Number(row.total_runs),
      successCount: Number(row.success_count),
      errorCount: Number(row.error_count),
      timeoutCount: Number(row.timeout_count),
      avgDurationMs: Math.round(Number(row.avg_duration_ms)),
      maxDurationMs: Number(row.max_duration_ms),
      successRate: Number(row.total_runs) > 0
        ? Math.round((Number(row.success_count) / Number(row.total_runs)) * 100)
        : 0,
    } : null

    // Run history (laatste 50)
    const { data: runs } = await supabase
      .from('automation_runs')
      .select('*')
      .eq('automation_id', id)
      .order('started_at', { ascending: false })
      .limit(50)

    return NextResponse.json({
      success: true,
      automation,
      stats,
      runs: runs ?? [],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching automation detail:', errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

export const GET = withAuth(detailHandler)
```

- [ ] **Step 2: Type-check**

```bash
cd apps/admin && npm run type-check
```

- [ ] **Step 3: Smoke-test**

```bash
curl -H "Cookie: <session>" http://localhost:3000/api/automations/fix-job-postings-geocoding | head -30
```

Verwacht: `{"success":true,"automation":{...},"runs":[],"stats":null}` (nog geen runs).

Test ook 404: `curl http://localhost:3000/api/automations/onbekend-id` → `{"success":false,"error":"Automation not found"}`.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/api/automations/[id]/route.ts
git commit -m "feat(api): GET /api/automations/[id] returns detail + runs"
```

---

### Task C3: `POST /api/automations/[id]/trigger` (Run Now)

**Files:**
- Create: `apps/admin/app/api/automations/[id]/trigger/route.ts`

- [ ] **Step 1: Schrijf endpoint**

```ts
// apps/admin/app/api/automations/[id]/trigger/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { getAutomation } from '@/lib/automations-registry'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function triggerHandler(
  request: NextRequest,
  auth: AuthResult,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const automation = getAutomation(id)
    if (!automation) {
      return NextResponse.json({ success: false, error: 'Automation not found' }, { status: 404 })
    }

    // Concurrency-lock: bestaande 'running' row binnen 6 minuten?
    const supabase = getServiceClient()
    const lockCutoff = new Date(Date.now() - 6 * 60_000).toISOString()
    const { data: running } = await supabase
      .from('automation_runs')
      .select('id, started_at')
      .eq('automation_id', id)
      .eq('status', 'running')
      .gte('started_at', lockCutoff)
      .limit(1)

    if (running && running.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Automation already running', runId: running[0].id },
        { status: 409 }
      )
    }

    // Server-side fetch naar handler — wrapper handelt insert/update af
    const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRET_KEY
    if (!cronSecret) {
      return NextResponse.json({ success: false, error: 'CRON_SECRET not configured' }, { status: 500 })
    }

    const protocol = request.nextUrl.protocol
    const host = request.headers.get('host')
    const handlerUrl = `${protocol}//${host}${automation.handlerPath}`

    // Kick off zonder te wachten — UI poolt voor afronding
    fetch(handlerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'X-Automation-Trigger': 'manual',
        'X-Automation-User-Id': auth.user.id,
      },
    }).catch((err) => {
      console.error(`[trigger] fetch to ${handlerUrl} failed:`, err)
    })

    return NextResponse.json({ success: true, status: 'triggered', automationId: id })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error triggering automation:', errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

export const POST = withAdminAuth(triggerHandler)
```

- [ ] **Step 2: Type-check + smoke-test**

```bash
cd apps/admin && npm run type-check
```

Manual test (na C2 deployed): `curl -X POST -H "Cookie: <admin session>" http://localhost:3000/api/automations/fix-job-postings-geocoding/trigger`. Verwacht: `{"success":true,"status":"triggered",...}` (de kick-off slaagt 401 omdat handler nog niet bestaat — dat is OK in deze stap, we testen alleen de trigger-endpoint).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/api/automations/[id]/trigger/route.ts
git commit -m "feat(api): POST /api/automations/[id]/trigger for Run Now"
```

---

## Chunk D — UI Lijstpagina + Sidebar

### Task D1: Sidebar entry "Automatiseringen"

**Files:**
- Modify: `apps/admin/components/app-sidebar.tsx`

- [ ] **Step 1: Voeg `Workflow` icon import toe**

In de import-regel `from "lucide-react"`, voeg `Workflow` toe:

```ts
import {
  Home, Building2, Users, Briefcase, MapPin, Settings, LogOut, Bot,
  ChevronRight, Layers, Mail, Workflow,
} from "lucide-react"
```

- [ ] **Step 2: Voeg menu-item toe**

In `data.navMain`, voeg het item toe vlak vóór "Instellingen" (= het laatste item):

```ts
{
  title: "Automatiseringen",
  url: "/automatiseringen",
  icon: Workflow,
},
{
  title: "Instellingen",
  url: "/settings",
  icon: Settings,
},
```

- [ ] **Step 3: Type-check**

```bash
cd apps/admin && npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/components/app-sidebar.tsx
git commit -m "feat(ui): add Automatiseringen sidebar entry"
```

---

### Task D2: Lijstpagina `/automatiseringen`

**Files:**
- Create: `apps/admin/app/automatiseringen/page.tsx`
- Create: `apps/admin/app/automatiseringen/automations-table.tsx`

- [ ] **Step 1: Schrijf server component**

```tsx
// apps/admin/app/automatiseringen/page.tsx

import { headers } from 'next/headers'
import { AutomationsTable } from './automations-table'
import type { AutomationDefinition } from '@/lib/automations-registry'

export const dynamic = 'force-dynamic'

interface AutomationRun {
  id: string
  automation_id: string
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  status: 'running' | 'success' | 'error' | 'timeout'
  business_stats: Record<string, unknown> | null
  error_message: string | null
  triggered_by: 'schedule' | 'manual'
}

interface AutomationStats {
  totalRuns: number; successCount: number; errorCount: number;
  timeoutCount: number; avgDurationMs: number; maxDurationMs: number; successRate: number
}

export interface AutomationView extends AutomationDefinition {
  latestRun: AutomationRun | null
  stats: AutomationStats | null
}

async function fetchAutomations(): Promise<AutomationView[]> {
  const h = await headers()
  const cookie = h.get('cookie') ?? ''
  const host = h.get('host')
  const protocol = h.get('x-forwarded-proto') ?? 'http'
  const res = await fetch(`${protocol}://${host}/api/automations?days=7`, {
    headers: { cookie },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`fetch /api/automations failed: ${res.status}`)
  const json = await res.json()
  return json.automations as AutomationView[]
}

export default async function AutomatiseringenPage() {
  const automations = await fetchAutomations()

  const ok = automations.filter(a => a.latestRun?.status === 'success').length
  const err = automations.filter(a => a.latestRun && (a.latestRun.status === 'error' || a.latestRun.status === 'timeout')).length
  const warn = 0  // toekomstige slot voor 'nadering timeout'
  const total = automations.length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Automatiseringen</h1>
          <p className="text-sm text-gray-500">{total} actief · laatste 7 dagen</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">Totaal</div>
          <div className="text-2xl font-bold mt-1">{total}</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="text-sm text-green-700">OK</div>
          <div className="text-2xl font-bold text-green-700 mt-1">{ok}</div>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="text-sm text-orange-700">Warnings</div>
          <div className="text-2xl font-bold text-orange-700 mt-1">{warn}</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-sm text-red-700">Errors</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{err}</div>
        </div>
      </div>

      <AutomationsTable automations={automations} />

      <p className="text-xs text-gray-400 text-right">
        Geocoding via{' '}
        <a href="https://locationiq.com" target="_blank" rel="noopener noreferrer" className="hover:underline">
          LocationIQ
        </a>
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Schrijf tabel-component**

```tsx
// apps/admin/app/automatiseringen/automations-table.tsx
'use client'

import Link from 'next/link'
import type { AutomationView } from './page'

function formatDuration(ms: number | null): string {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffMin < 1) return 'zojuist'
  if (diffMin < 60) return `${diffMin} min geleden`
  if (diffHours < 24) return `${diffHours}u geleden`
  return `${diffDays}d geleden`
}

function StatusBadge({ status }: { status: 'success' | 'error' | 'timeout' | 'running' }) {
  const map = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    timeout: 'bg-orange-100 text-orange-800',
    running: 'bg-blue-100 text-blue-800',
  } as const
  return <span className={`px-2 py-0.5 rounded-full text-xs ${map[status]}`}>{status}</span>
}

function summarizeStats(business: Record<string, unknown> | null, displayStats: AutomationView['displayStats']): string {
  if (!business) return '—'
  return displayStats
    .slice(0, 3)
    .map((s) => business[s.key] != null ? `${business[s.key]} ${s.label}` : null)
    .filter(Boolean)
    .join(' · ') || '—'
}

export function AutomationsTable({ automations }: { automations: AutomationView[] }) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left">
            <th className="p-3 font-medium">Naam</th>
            <th className="p-3 font-medium">Schedule</th>
            <th className="p-3 font-medium">Laatste run</th>
            <th className="p-3 font-medium">Resultaat</th>
            <th className="p-3 font-medium">Duur</th>
            <th className="p-3 font-medium">Status</th>
            <th className="p-3 font-medium text-right">7d</th>
          </tr>
        </thead>
        <tbody>
          {automations.map((a) => (
            <tr key={a.id} className="border-b last:border-b-0 hover:bg-gray-50">
              <td className="p-3">
                <Link href={`/automatiseringen/${a.id}`} className="font-medium hover:underline">
                  {a.displayName}
                </Link>
                <div className="text-xs text-gray-500">{a.description}</div>
              </td>
              <td className="p-3"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{a.schedule}</code></td>
              <td className="p-3">{a.latestRun ? formatRelativeTime(a.latestRun.started_at) : <span className="text-gray-400">geen data</span>}</td>
              <td className="p-3">{summarizeStats(a.latestRun?.business_stats ?? null, a.displayStats)}</td>
              <td className="p-3 font-mono">{formatDuration(a.latestRun?.duration_ms ?? null)}</td>
              <td className="p-3">{a.latestRun ? <StatusBadge status={a.latestRun.status} /> : <span className="text-gray-400 text-xs">N/A</span>}</td>
              <td className="p-3 text-right text-xs">
                {a.stats ? (
                  <div>
                    <div>{a.stats.totalRuns} runs</div>
                    <div className="text-green-600">{a.stats.successRate}% OK</div>
                  </div>
                ) : <span className="text-gray-400">geen data</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Type-check + handmatige UI-test**

```bash
cd apps/admin && npm run type-check
```

Start dev server (`npm run dev`), open `http://localhost:3000/automatiseringen`. Verwacht: lijst van 12 automatiseringen, allemaal met "geen data" tot er runs zijn.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/automatiseringen/
git commit -m "feat(ui): add /automatiseringen list page"
```

---

## Chunk E — UI Detailpagina

### Task E1: Detailpagina skeleton + Run Now

**Files:**
- Create: `apps/admin/app/automatiseringen/[id]/page.tsx`
- Create: `apps/admin/app/automatiseringen/[id]/run-now-button.tsx`

- [ ] **Step 1: Schrijf server component**

```tsx
// apps/admin/app/automatiseringen/[id]/page.tsx

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { AutomationDefinition } from '@/lib/automations-registry'
import { RunNowButton } from './run-now-button'
import { TrendChart } from './trend-chart'
import { RunHistoryTable } from './run-history-table'

export const dynamic = 'force-dynamic'

interface AutomationRun {
  id: string
  automation_id: string
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  status: 'running' | 'success' | 'error' | 'timeout'
  business_stats: Record<string, number | string | boolean | null> | null
  error_message: string | null
  triggered_by: 'schedule' | 'manual'
  triggered_by_user_id: string | null
}

interface DetailResponse {
  success: boolean
  automation: AutomationDefinition
  stats: { totalRuns: number; successCount: number; errorCount: number; avgDurationMs: number; successRate: number } | null
  runs: AutomationRun[]
  error?: string
}

async function fetchDetail(id: string): Promise<DetailResponse | null> {
  const h = await headers()
  const cookie = h.get('cookie') ?? ''
  const host = h.get('host')
  const protocol = h.get('x-forwarded-proto') ?? 'http'
  const res = await fetch(`${protocol}://${host}/api/automations/${id}?days=30`, {
    headers: { cookie },
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`fetch detail failed: ${res.status}`)
  return res.json()
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffMin < 1) return 'zojuist'
  if (diffMin < 60) return `${diffMin} min geleden`
  if (diffHours < 24) return `${diffHours}u geleden`
  return `${diffDays}d geleden`
}

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await fetchDetail(id)
  if (!detail) notFound()

  const { automation, stats, runs } = detail
  const latest = runs[0] ?? null

  return (
    <div className="p-6 space-y-6">
      <div className="text-xs text-gray-500">
        <Link href="/automatiseringen" className="text-blue-600 hover:underline">Automatiseringen</Link>
        {' / '}
        {automation.id}
      </div>

      <div className="flex items-start justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{automation.displayName}</h1>
            {latest && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                latest.status === 'success' ? 'bg-green-100 text-green-800'
                : latest.status === 'error' ? 'bg-red-100 text-red-800'
                : latest.status === 'timeout' ? 'bg-orange-100 text-orange-800'
                : 'bg-blue-100 text-blue-800'
              }`}>{latest.status}</span>
            )}
            <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700">{automation.category}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{automation.description}</p>
          <p className="text-xs text-gray-400 mt-1">
            <code className="bg-gray-100 px-1 rounded">{automation.schedule}</code>
            {' · handler '}
            <code className="bg-gray-100 px-1 rounded">{automation.handlerPath}</code>
          </p>
        </div>
        <RunNowButton automationId={automation.id} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">Vorige run</div>
          <div className="text-lg font-semibold">{latest ? formatRelativeTime(latest.started_at) : '—'}</div>
          <div className="text-xs text-gray-500">{latest ? formatDuration(latest.duration_ms) : ''}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">Schedule</div>
          <div className="text-lg font-semibold"><code className="text-base">{automation.schedule}</code></div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">Success rate (30d)</div>
          <div className="text-lg font-semibold text-green-700">{stats?.successRate ?? 0}%</div>
          <div className="text-xs text-gray-500">{stats ? `${stats.successCount}/${stats.totalRuns} runs` : '—'}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">Avg duur</div>
          <div className="text-lg font-semibold">{stats ? formatDuration(stats.avgDurationMs) : '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-lg border p-4">
          <h3 className="font-medium text-sm mb-2">Trend laatste 30 dagen</h3>
          <TrendChart runs={runs} primaryStatKey={automation.primaryStatKey ?? automation.displayStats[0]?.key ?? null} />
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="font-medium text-sm mb-2">Business stats (laatste run)</h3>
          {latest?.business_stats ? (
            <table className="w-full text-sm">
              <tbody>
                {automation.displayStats.map((s) => (
                  <tr key={s.key}>
                    <td className="text-gray-500 py-1">{s.label}</td>
                    <td className="text-right font-medium">
                      {String(latest.business_stats?.[s.key] ?? '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-gray-400">Geen data</p>}
        </div>
      </div>

      <RunHistoryTable runs={runs} displayStats={automation.displayStats} />
    </div>
  )
}
```

- [ ] **Step 2: Schrijf RunNowButton client component**

```tsx
// apps/admin/app/automatiseringen/[id]/run-now-button.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RunNowButton({ automationId }: { automationId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function trigger() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/automations/${automationId}/trigger`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }
      setPolling(true)
      // Poll detail-endpoint elke 2s tot de 'running' row verdwenen is, max 6 min
      const start = Date.now()
      const poll = async () => {
        if (Date.now() - start > 6 * 60_000) {
          setPolling(false); router.refresh(); return
        }
        const detail = await fetch(`/api/automations/${automationId}?days=1`).then(r => r.json())
        const stillRunning = (detail.runs ?? []).some((r: { status: string }) => r.status === 'running')
        if (!stillRunning) {
          setPolling(false); router.refresh(); return
        }
        setTimeout(poll, 2000)
      }
      setTimeout(poll, 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={trigger}
        disabled={loading || polling}
        className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {polling ? 'Bezig met draaien…' : loading ? 'Triggeren…' : 'Run Now'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd apps/admin && npm run type-check
```

Verwacht: errors over missing `TrendChart` en `RunHistoryTable` — die maken we in E2 en E3. Skip naar volgende task; type-check komt clean na E3.

- [ ] **Step 4: Commit (WIP)**

```bash
git add apps/admin/app/automatiseringen/[id]/
git commit -m "feat(ui): detail page skeleton + Run Now button"
```

---

### Task E2: TrendChart component

**Files:**
- Create: `apps/admin/app/automatiseringen/[id]/trend-chart.tsx`

- [ ] **Step 1: Schrijf component (recharts)**

```tsx
// apps/admin/app/automatiseringen/[id]/trend-chart.tsx
'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface Run {
  started_at: string
  status: 'running' | 'success' | 'error' | 'timeout'
  business_stats: Record<string, number | string | boolean | null> | null
}

export function TrendChart({ runs, primaryStatKey }: { runs: Run[]; primaryStatKey: string | null }) {
  if (!primaryStatKey || runs.length === 0) {
    return <p className="text-sm text-gray-400">Geen data</p>
  }
  const data = [...runs]
    .reverse()
    .map((r) => ({
      time: new Date(r.started_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' }),
      value: typeof r.business_stats?.[primaryStatKey] === 'number'
        ? (r.business_stats[primaryStatKey] as number)
        : 0,
      status: r.status,
    }))

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} />
          <YAxis stroke="#9ca3af" fontSize={11} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-1">{primaryStatKey} per run</p>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/admin && npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/automatiseringen/[id]/trend-chart.tsx
git commit -m "feat(ui): trend chart for automation detail"
```

---

### Task E3: RunHistoryTable component

**Files:**
- Create: `apps/admin/app/automatiseringen/[id]/run-history-table.tsx`

- [ ] **Step 1: Schrijf component**

```tsx
// apps/admin/app/automatiseringen/[id]/run-history-table.tsx
'use client'

import { useState } from 'react'
import type { DisplayStat } from '@/lib/automations-registry'

interface Run {
  id: string
  started_at: string
  duration_ms: number | null
  status: 'running' | 'success' | 'error' | 'timeout'
  business_stats: Record<string, number | string | boolean | null> | null
  error_message: string | null
  triggered_by: 'schedule' | 'manual'
  triggered_by_user_id: string | null
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function summarize(stats: Run['business_stats'], displayStats: DisplayStat[]): string {
  if (!stats) return '—'
  return displayStats
    .slice(0, 3)
    .map((s) => stats[s.key] != null ? `${stats[s.key]} ${s.label}` : null)
    .filter(Boolean)
    .join(' · ') || '—'
}

export function RunHistoryTable({ runs, displayStats }: { runs: Run[]; displayStats: DisplayStat[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="rounded-lg border">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-medium text-sm">Run history</h3>
        <span className="text-xs text-gray-500">laatste {runs.length}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs">
            <th className="p-2 font-medium">Tijd</th>
            <th className="p-2 font-medium">Trigger</th>
            <th className="p-2 font-medium">Duur</th>
            <th className="p-2 font-medium">Stats</th>
            <th className="p-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <RowWithExpand key={r.id} run={r} displayStats={displayStats} expanded={expandedId === r.id} onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)} />
          ))}
          {runs.length === 0 && (
            <tr><td colSpan={5} className="p-4 text-center text-gray-400 text-sm">Geen runs nog</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function RowWithExpand({ run, displayStats, expanded, onToggle }: {
  run: Run; displayStats: DisplayStat[]; expanded: boolean; onToggle: () => void
}) {
  return (
    <>
      <tr className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="p-2">{new Date(run.started_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
        <td className="p-2">{run.triggered_by}</td>
        <td className="p-2 font-mono">{formatDuration(run.duration_ms)}</td>
        <td className="p-2">{summarize(run.business_stats, displayStats)}</td>
        <td className="p-2">
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            run.status === 'success' ? 'bg-green-100 text-green-800'
            : run.status === 'error' ? 'bg-red-100 text-red-800'
            : run.status === 'timeout' ? 'bg-orange-100 text-orange-800'
            : 'bg-blue-100 text-blue-800'
          }`}>{run.status}</span>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={5} className="p-3">
            {run.error_message && (
              <div className="mb-2">
                <div className="text-xs font-medium text-red-700">Error:</div>
                <pre className="text-xs bg-red-50 p-2 rounded mt-1 whitespace-pre-wrap">{run.error_message}</pre>
              </div>
            )}
            <div className="text-xs font-medium text-gray-700">business_stats:</div>
            <pre className="text-xs bg-white border p-2 rounded mt-1 overflow-auto">
              {JSON.stringify(run.business_stats, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}
```

- [ ] **Step 2: Type-check + UI test**

```bash
cd apps/admin && npm run type-check
```

Open `/automatiseringen/fix-job-postings-geocoding`. Verwacht: detailpagina rendert, Run Now-knop zichtbaar, "Geen runs nog" in history.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/automatiseringen/[id]/run-history-table.tsx
git commit -m "feat(ui): run history table with expand-row JSON view"
```

---

## Chunk F — LocationIQ Migratie

### Task F1: Types + LocationIQ client (TDD)

**Files:**
- Create: `apps/admin/lib/automations/fix-job-postings-geocoding/types.ts`
- Create: `apps/admin/lib/automations/fix-job-postings-geocoding/locationiq-client.ts`
- Create: `apps/admin/__tests__/locationiq-client.test.ts`

- [ ] **Step 1: Schrijf types**

```ts
// apps/admin/lib/automations/fix-job-postings-geocoding/types.ts

export interface LocationIQAddress {
  road?: string
  postcode?: string
  city?: string
  town?: string
  village?: string
  state?: string
  country?: string
  country_code?: string
}

export interface LocationIQSearchResult {
  lat: string
  lon: string
  display_name: string
  address: LocationIQAddress
}

export interface SearchSuccess {
  ok: true
  result: LocationIQSearchResult
}

export interface SearchEmpty {
  ok: false
  reason: 'no_match'
}

export interface SearchError {
  ok: false
  reason: 'http_error' | 'auth_failed' | 'rate_limit'
  httpStatus?: number
  message: string
}

export type SearchOutcome = SearchSuccess | SearchEmpty | SearchError

export interface BusinessStats {
  processed: number
  enriched: number
  geocoding_failed_no_match: number
  geocoding_failed_no_postcode: number
  platform_matched: number
  queue_remaining: number
  api_calls_used: number
  stopped_early: boolean
  skipped_reason?: 'daily_budget_reached' | 'auth_failed'
}
```

- [ ] **Step 2: Schrijf failing test**

```ts
// apps/admin/__tests__/locationiq-client.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchCity } from '@/lib/automations/fix-job-postings-geocoding/locationiq-client'

const apiKey = 'test-key'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('searchCity', () => {
  it('returns ok with result on 200', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ([
        { lat: '52.37', lon: '4.89', display_name: 'Amsterdam', address: { city: 'Amsterdam', postcode: '1011', country_code: 'nl' } },
      ]),
    } as unknown as Response)
    const r = await searchCity('Amsterdam', { apiKey })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.result.address.postcode).toBe('1011')
    }
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('eu1.locationiq.com/v1/search'),
      expect.any(Object)
    )
  })

  it('returns no_match on empty array', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ([]),
    } as unknown as Response)
    const r = await searchCity('NietBestaand', { apiKey })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('no_match')
  })

  it('returns rate_limit on 429', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false, status: 429,
      json: async () => ({ error: 'Rate limit' }),
    } as unknown as Response)
    const r = await searchCity('Amsterdam', { apiKey })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('rate_limit')
  })

  it('returns auth_failed on 401', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({ error: 'Bad key' }),
    } as unknown as Response)
    const r = await searchCity('Amsterdam', { apiKey })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('auth_failed')
  })

  it('encodes city query', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ([{ lat: '0', lon: '0', display_name: '', address: {} }]),
    } as unknown as Response)
    await searchCity("'s-Gravenhage", { apiKey })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("'s-Gravenhage")),
      expect.any(Object)
    )
  })
})
```

- [ ] **Step 3: Run test, verify failure**

```bash
cd apps/admin && npx vitest run __tests__/locationiq-client.test.ts
```

Expected: FAIL — module niet gevonden.

- [ ] **Step 4: Schrijf client**

```ts
// apps/admin/lib/automations/fix-job-postings-geocoding/locationiq-client.ts

import type { LocationIQSearchResult, SearchOutcome } from './types'

const BASE_URL = 'https://eu1.locationiq.com/v1/search'

export interface SearchOptions {
  apiKey: string
  /** Voor server-side gebruik — dictates User-Agent header */
  userAgent?: string
}

/**
 * Forward geocoding via LocationIQ EU endpoint.
 * Eén call levert lat/lng + address.postcode (mits dat bekend is).
 * Geen retry — caller is verantwoordelijk voor backoff op rate_limit.
 */
export async function searchCity(city: string, opts: SearchOptions): Promise<SearchOutcome> {
  const url = new URL(BASE_URL)
  url.searchParams.set('q', city)
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('countrycodes', 'nl')
  url.searchParams.set('limit', '1')
  url.searchParams.set('key', opts.apiKey)

  let response: Response
  try {
    response = await fetch(url.toString(), {
      headers: {
        'User-Agent': opts.userAgent ?? 'LokaleBanen/1.0 (kenny@bespokeautomation.ai)',
        Accept: 'application/json',
      },
    })
  } catch (err) {
    return {
      ok: false,
      reason: 'http_error',
      message: err instanceof Error ? err.message : 'fetch failed',
    }
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'auth_failed', httpStatus: response.status, message: `LocationIQ ${response.status}` }
  }
  if (response.status === 429) {
    return { ok: false, reason: 'rate_limit', httpStatus: 429, message: 'LocationIQ rate limit' }
  }
  if (!response.ok) {
    return { ok: false, reason: 'http_error', httpStatus: response.status, message: `LocationIQ ${response.status}` }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, reason: 'http_error', message: 'invalid JSON' }
  }

  if (!Array.isArray(body) || body.length === 0) {
    return { ok: false, reason: 'no_match' }
  }

  return { ok: true, result: body[0] as LocationIQSearchResult }
}
```

- [ ] **Step 5: Run tests, verify pass**

```bash
cd apps/admin && npx vitest run __tests__/locationiq-client.test.ts
```

Expected: 5 tests passing.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/lib/automations/fix-job-postings-geocoding/types.ts \
        apps/admin/lib/automations/fix-job-postings-geocoding/locationiq-client.ts \
        apps/admin/__tests__/locationiq-client.test.ts
git commit -m "feat(geocoding): add LocationIQ search client + tests"
```

---

### Task F2: Platform lookup (TDD)

**Files:**
- Create: `apps/admin/lib/automations/fix-job-postings-geocoding/platform-lookup.ts`
- Create: `apps/admin/__tests__/platform-lookup.test.ts`

- [ ] **Step 1: Schrijf failing test**

```ts
// apps/admin/__tests__/platform-lookup.test.ts

import { describe, it, expect } from 'vitest'
import { extractPostcodePrefix } from '@/lib/automations/fix-job-postings-geocoding/platform-lookup'

describe('extractPostcodePrefix', () => {
  it('returns first 4 digits from "1011 AB"', () => {
    expect(extractPostcodePrefix('1011 AB')).toBe('1011')
  })
  it('returns first 4 digits from "1011AB"', () => {
    expect(extractPostcodePrefix('1011AB')).toBe('1011')
  })
  it('returns null for null input', () => {
    expect(extractPostcodePrefix(null)).toBeNull()
  })
  it('returns null for empty string', () => {
    expect(extractPostcodePrefix('')).toBeNull()
  })
  it('returns null for postcode without 4-digit prefix', () => {
    expect(extractPostcodePrefix('AB12')).toBeNull()
  })
  it('handles "1011" alone', () => {
    expect(extractPostcodePrefix('1011')).toBe('1011')
  })
})
```

- [ ] **Step 2: Run test, verify failure**

```bash
cd apps/admin && npx vitest run __tests__/platform-lookup.test.ts
```

Expected: FAIL — module niet gevonden.

- [ ] **Step 3: Schrijf module**

```ts
// apps/admin/lib/automations/fix-job-postings-geocoding/platform-lookup.ts

import type { SupabaseClient } from '@supabase/supabase-js'

export function extractPostcodePrefix(postcode: string | null | undefined): string | null {
  if (!postcode) return null
  const match = postcode.match(/^(\d{4})/)
  return match ? match[1] : null
}

/**
 * Lookup platform_id voor de eerste-4-cijfers van een postcode.
 * Returnt null als geen city-row gevonden of geen platform_id heeft.
 */
export async function findPlatformIdByPostcode(
  supabase: SupabaseClient,
  postcodePrefix: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('cities')
    .select('platform_id')
    .eq('postcode', postcodePrefix)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error(`[platform-lookup] ${postcodePrefix}:`, error.message)
    return null
  }
  return data?.platform_id ?? null
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
cd apps/admin && npx vitest run __tests__/platform-lookup.test.ts
```

Expected: 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/automations/fix-job-postings-geocoding/platform-lookup.ts \
        apps/admin/__tests__/platform-lookup.test.ts
git commit -m "feat(geocoding): platform lookup with postcode-prefix extraction"
```

---

### Task F3: Queue + budget guard

**Files:**
- Create: `apps/admin/lib/automations/fix-job-postings-geocoding/queue.ts`
- Create: `apps/admin/lib/automations/fix-job-postings-geocoding/budget-check.ts`

- [ ] **Step 1: Schrijf queue.ts**

```ts
// apps/admin/lib/automations/fix-job-postings-geocoding/queue.ts

import type { SupabaseClient } from '@supabase/supabase-js'

export interface QueueRow {
  id: string
  location: string | null
  city: string | null
  zipcode: string | null
  street: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
}

export async function fetchQueueBatch(supabase: SupabaseClient, limit: number): Promise<QueueRow[]> {
  const { data, error } = await supabase
    .from('job_postings')
    .select('id, location, city, zipcode, street, country, latitude, longitude')
    .not('location', 'is', null)
    .neq('location', '')
    .neq('location', 'The Randstad, Netherlands')
    .is('geocoding_failed', null)
    .or('zipcode.is.null,zipcode.eq.,latitude.is.null,longitude.is.null')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`queue fetch: ${error.message}`)
  return (data ?? []) as QueueRow[]
}

export async function countQueueRemaining(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('job_postings')
    .select('id', { count: 'exact', head: true })
    .not('location', 'is', null)
    .neq('location', '')
    .neq('location', 'The Randstad, Netherlands')
    .is('geocoding_failed', null)
    .or('zipcode.is.null,zipcode.eq.,latitude.is.null,longitude.is.null')
  if (error) {
    console.error('[queue] count failed:', error.message)
    return -1
  }
  return count ?? 0
}
```

- [ ] **Step 2: Schrijf budget-check.ts**

```ts
// apps/admin/lib/automations/fix-job-postings-geocoding/budget-check.ts

import type { SupabaseClient } from '@supabase/supabase-js'

const DAILY_CAP = 4500  // 500-call buffer onder de 5000 free-tier cap

export async function getApiCallsToday(supabase: SupabaseClient, automationId: string): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const { data, error } = await supabase
    .from('automation_runs')
    .select('business_stats')
    .eq('automation_id', automationId)
    .gte('started_at', startOfDay.toISOString())
  if (error) {
    console.error('[budget-check] query failed:', error.message)
    return 0
  }
  return (data ?? []).reduce((sum, r) => {
    const calls = (r.business_stats as Record<string, unknown> | null)?.['api_calls_used']
    return sum + (typeof calls === 'number' ? calls : 0)
  }, 0)
}

export function isBudgetExhausted(callsToday: number, plannedCallsForRun: number): boolean {
  return callsToday + plannedCallsForRun > DAILY_CAP
}

export { DAILY_CAP }
```

- [ ] **Step 3: Type-check**

```bash
cd apps/admin && npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/lib/automations/fix-job-postings-geocoding/queue.ts \
        apps/admin/lib/automations/fix-job-postings-geocoding/budget-check.ts
git commit -m "feat(geocoding): queue fetch + daily budget guard"
```

---

### Task F4: Main `run()` orchestrator

**Files:**
- Create: `apps/admin/lib/automations/fix-job-postings-geocoding/index.ts`

- [ ] **Step 1: Schrijf orchestrator**

```ts
// apps/admin/lib/automations/fix-job-postings-geocoding/index.ts

import { createClient } from '@supabase/supabase-js'
import { searchCity } from './locationiq-client'
import { extractPostcodePrefix, findPlatformIdByPostcode } from './platform-lookup'
import { fetchQueueBatch, countQueueRemaining, type QueueRow } from './queue'
import { getApiCallsToday, isBudgetExhausted, DAILY_CAP } from './budget-check'
import type { BusinessStats } from './types'

const AUTOMATION_ID = 'fix-job-postings-geocoding'
const PER_RUN_LIMIT = 290
const ITEM_DELAY_MS = 1000           // 60 req/min sustained
const MAX_RUN_MS = 270_000           // 30s buffer onder 300s timeout
const RETRY_DELAY_MS = 2000          // backoff op rate_limit

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

function deriveCity(row: QueueRow): string | null {
  if (row.city && row.city.trim()) return row.city.trim()
  if (row.location && typeof row.location === 'string' && !row.location.startsWith('{')) {
    return row.location.trim()
  }
  return null
}

export async function run(): Promise<{ stats: BusinessStats; success: boolean; error?: string }> {
  const supabase = getServiceClient()
  const apiKey = process.env.LOCATIONIQ_API_KEY
  if (!apiKey) {
    return {
      success: false, error: 'LOCATIONIQ_API_KEY not configured',
      stats: emptyStats({ skipped_reason: 'auth_failed' }),
    }
  }

  // Budget-check
  const callsToday = await getApiCallsToday(supabase, AUTOMATION_ID)
  if (isBudgetExhausted(callsToday, PER_RUN_LIMIT)) {
    return {
      success: true,
      stats: emptyStats({ skipped_reason: 'daily_budget_reached', api_calls_used: 0 }),
    }
  }

  const startTime = Date.now()
  const stats: BusinessStats = {
    processed: 0, enriched: 0,
    geocoding_failed_no_match: 0, geocoding_failed_no_postcode: 0,
    platform_matched: 0, queue_remaining: 0,
    api_calls_used: 0, stopped_early: false,
  }

  const queue = await fetchQueueBatch(supabase, PER_RUN_LIMIT)

  for (const row of queue) {
    if (Date.now() - startTime > MAX_RUN_MS) {
      stats.stopped_early = true
      break
    }

    stats.processed++

    const city = deriveCity(row)
    if (!city) {
      await markFailed(supabase, row.id, 'no_city')
      stats.geocoding_failed_no_match++
      continue
    }

    let outcome = await searchCity(city, { apiKey })
    stats.api_calls_used++

    if (!outcome.ok && outcome.reason === 'rate_limit') {
      await sleep(RETRY_DELAY_MS)
      outcome = await searchCity(city, { apiKey })
      stats.api_calls_used++
    }

    if (!outcome.ok && outcome.reason === 'auth_failed') {
      // Stop direct — geen verdere calls verspillen
      return { success: false, error: 'auth_failed', stats: { ...stats, skipped_reason: 'auth_failed' } }
    }

    if (!outcome.ok && outcome.reason === 'no_match') {
      await markFailed(supabase, row.id, 'no_match')
      stats.geocoding_failed_no_match++
      await sleep(ITEM_DELAY_MS)
      continue
    }

    if (!outcome.ok) {
      // http_error — log, ga door zonder markFailed (kan tijdelijk zijn)
      console.warn(`[geocoding] http_error voor ${row.id}:`, outcome.message)
      await sleep(ITEM_DELAY_MS)
      continue
    }

    const addr = outcome.result.address
    const postcode = addr.postcode ?? null
    if (!postcode) {
      await markFailed(supabase, row.id, 'missing_postcode')
      stats.geocoding_failed_no_postcode++
      await sleep(ITEM_DELAY_MS)
      continue
    }

    const prefix = extractPostcodePrefix(postcode)
    let platformId: string | null = null
    if (prefix) {
      platformId = await findPlatformIdByPostcode(supabase, prefix)
      if (platformId) stats.platform_matched++
    }

    const { error: updateErr } = await supabase
      .from('job_postings')
      .update({
        street: addr.road ?? null,
        zipcode: postcode,
        latitude: parseFloat(outcome.result.lat),
        longitude: parseFloat(outcome.result.lon),
        city: addr.city ?? addr.town ?? addr.village ?? null,
        country: addr.country_code ?? null,
        state: addr.state ?? null,
        platform_id: platformId,
      })
      .eq('id', row.id)

    if (updateErr) {
      console.error(`[geocoding] update ${row.id} failed:`, updateErr.message)
    } else {
      stats.enriched++
    }

    await sleep(ITEM_DELAY_MS)
  }

  stats.queue_remaining = await countQueueRemaining(supabase)

  return { success: true, stats }
}

async function markFailed(
  supabase: ReturnType<typeof getServiceClient>,
  id: string,
  reason: string,
) {
  const { error } = await supabase
    .from('job_postings')
    .update({ geocoding_failed: true, geocoding_failed_reason: reason })
    .eq('id', id)
  if (error) console.error(`[geocoding] markFailed ${id}:`, error.message)
}

function emptyStats(over: Partial<BusinessStats>): BusinessStats {
  return {
    processed: 0, enriched: 0,
    geocoding_failed_no_match: 0, geocoding_failed_no_postcode: 0,
    platform_matched: 0, queue_remaining: 0,
    api_calls_used: 0, stopped_early: false,
    ...over,
  }
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/admin && npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/lib/automations/fix-job-postings-geocoding/index.ts
git commit -m "feat(geocoding): main run() orchestrator with budget guard"
```

---

### Task F5: API handler + vercel.json + env-var

**Files:**
- Create: `apps/admin/app/api/cron/fix-job-postings-geocoding/route.ts`
- Modify: `apps/admin/vercel.json`

- [ ] **Step 1: Schrijf handler**

```ts
// apps/admin/app/api/cron/fix-job-postings-geocoding/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { withAutomationMonitoring } from '@/lib/automation-monitor'
import { run } from '@/lib/automations/fix-job-postings-geocoding'

async function handler(_req: NextRequest) {
  const result = await run()
  return NextResponse.json({
    success: result.success,
    stats: result.stats,
    error: result.error,
    message: result.success ? 'completed' : 'failed',
  }, { status: result.success ? 200 : 500 })
}

export const POST = withAutomationMonitoring('fix-job-postings-geocoding')(handler)
export const GET = POST  // Vercel Cron stuurt GET
export const maxDuration = 300
```

- [ ] **Step 2: Voeg cron-entry toe aan vercel.json**

```json
{
  "crons": [
    ...,
    { "path": "/api/cron/fix-job-postings-geocoding", "schedule": "0 */2 * * *" }
  ],
  "functions": {
    ...,
    "app/api/cron/fix-job-postings-geocoding/route.ts": { "maxDuration": 300 }
  }
}
```

- [ ] **Step 3: Voeg env-var toe**

```bash
# In Vercel dashboard: voeg LOCATIONIQ_API_KEY toe (Production + Preview).
# Lokaal: .env.local
echo "LOCATIONIQ_API_KEY=<your-key>" >> apps/admin/.env.local
```

Voor de plan-executor: ik (Kenny) regel de Vercel env var. De executor moet hier expliciet **stoppen en bevestigen** dat de key toegevoegd is voordat de handler in productie aangeroepen wordt.

- [ ] **Step 4: Type-check + build**

```bash
cd apps/admin && npm run type-check && npm run build
```

- [ ] **Step 5: Lokaal handmatig testen**

Dev server: `npm run dev`. In andere shell:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/fix-job-postings-geocoding
```

Verwacht: `{"success":true,"stats":{...processed:N,enriched:M},...}` (loopt 4-5 min). Voor een snellere test: tijdelijk `PER_RUN_LIMIT = 5` zetten in `index.ts`, runnen, dan terug naar 290.

Open `/automatiseringen/fix-job-postings-geocoding` in browser → run zou zichtbaar moeten zijn met business_stats.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/app/api/cron/fix-job-postings-geocoding/route.ts apps/admin/vercel.json
git commit -m "feat(geocoding): handler + Vercel Cron entry (every 2h)"
```

---

### Task F6: Update references van `nominatim_failed` → `geocoding_failed`

**Files:**
- Modify: alle bestanden die A2-grep teruggaf met `nominatim_failed`

- [ ] **Step 1: Vind alle live references**

```bash
grep -rn "nominatim_failed" /Users/kennylipman/Lokale-Banen/apps/admin --include="*.ts" --include="*.tsx" 2>/dev/null
```

Expected: misschien lege output (de oude naam stond alleen in n8n JSON die niet in deze repo zit). Als wel hits: vervang elk gebruik door `geocoding_failed`.

- [ ] **Step 2: Type-check**

```bash
cd apps/admin && npm run type-check
```

- [ ] **Step 3: Commit (alleen als er wijzigingen zijn)**

```bash
git add -A
git commit -m "refactor(geocoding): update nominatim_failed references to geocoding_failed"
```

---

## Chunk G — Watchdog & CronJobMonitor migratie

### Task G1: Watchdog leest `automation_runs`

**Files:**
- Modify: `apps/admin/app/api/cron/watchdog/route.ts`

- [ ] **Step 1: Lees huidige inhoud**

Read `apps/admin/app/api/cron/watchdog/route.ts`. Noteer welke kolommen + tabel hij momenteel raadpleegt (`cron_job_logs`).

- [ ] **Step 2: Vervang queries**

Vervang alle `from('cron_job_logs')` → `from('automation_runs')`. Vervang `job_name` → `automation_id`. Hou de overige logica (overdue detection, Slack alert, alert-cooldown) ongemoeid. Pas het registry-import aan: gebruik `EXPECTED_INTERVAL_MS` uit `@/lib/cron-config` (= compat-bridge naar registry).

- [ ] **Step 3: Type-check**

```bash
cd apps/admin && npm run type-check
```

- [ ] **Step 4: Verify in dev**

Trigger handmatig: `curl -X GET -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/watchdog`. Verwacht: 200 OK, geen errors over missende tabel/kolom.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/app/api/cron/watchdog/route.ts
git commit -m "refactor(watchdog): query automation_runs instead of cron_job_logs"
```

---

### Task G2: CronJobMonitor leest `automation_runs`

**Files:**
- Modify: `apps/admin/components/CronJobMonitor.tsx`
- Modify: `apps/admin/app/api/cron/logs/route.ts`

- [ ] **Step 1: Pas API endpoint aan**

In `apps/admin/app/api/cron/logs/route.ts`:
- Vervang `from('cron_job_logs')` → `from('automation_runs')`.
- Vervang `job_name` → `automation_id` overal.
- Vervang `get_cron_job_stats` RPC-call → `get_automation_run_stats`.

- [ ] **Step 2: Pas component aan**

In `apps/admin/components/CronJobMonitor.tsx`:
- `CronJobLog.job_name` → `automation_id`.
- `JobSummary.name` blijft (matcht registry-id), maar properties van `latestRun` updaten.
- `response_summary` → `business_stats`.

- [ ] **Step 3: Type-check + UI smoke-test**

```bash
cd apps/admin && npm run type-check && npm run dev
```

Open `/settings`, scroll naar CronJobMonitor sectie. Verwacht: rendert zonder errors. Data toont alleen runs uit `automation_runs` (oude data uit `cron_job_logs` is nu onzichtbaar — dat is OK).

- [ ] **Step 4: Commit**

```bash
git add apps/admin/components/CronJobMonitor.tsx apps/admin/app/api/cron/logs/route.ts
git commit -m "refactor(monitor): CronJobMonitor reads automation_runs"
```

---

## Chunk H — Verificatie & E2E

### Task H1: End-to-end verificatie

**Files:** geen wijzigingen — alleen verificatie

- [ ] **Step 1: Deploy naar preview**

```bash
git push origin main  # of de feature branch
```

Wacht tot Vercel preview-deploy klaar is (of als main: production).

- [ ] **Step 2: Set `LOCATIONIQ_API_KEY` env-var**

In Vercel project settings → Environment Variables → voeg `LOCATIONIQ_API_KEY` toe voor Production en Preview. Re-deploy.

- [ ] **Step 3: Trigger manual run via UI**

Open `https://lokale-banen-app.vercel.app/automatiseringen/fix-job-postings-geocoding`. Klik "Run Now". Verwacht: knop verandert naar "Bezig met draaien…", na 4-5 min refresh-de-pagina toont een nieuwe row met success-status en business_stats.

- [ ] **Step 4: Verify business stats kloppen**

```sql
-- Via mcp__supabase__execute_sql
select business_stats, status, duration_ms, started_at, triggered_by
from automation_runs
where automation_id = 'fix-job-postings-geocoding'
order by started_at desc
limit 3;
```

Expected: `business_stats.processed` tussen 1-290, `business_stats.api_calls_used` ≥ processed, `queue_remaining` < 152.500.

- [ ] **Step 5: Verify queue daalt**

```sql
select count(*) from job_postings
where geocoding_failed is null
  and (zipcode is null or latitude is null or longitude is null)
  and location is not null and location != '';
```

Expected: lager dan voorheen.

- [ ] **Step 6: Trigger watchdog, check Slack**

```bash
curl -X GET -H "Authorization: Bearer $CRON_SECRET" https://lokale-banen-app.vercel.app/api/cron/watchdog
```

Expected: 200 OK. Geen Slack-spam (geen jobs zijn overdue).

- [ ] **Step 7: Lijst-pagina sanity-check**

Open `/automatiseringen` — verwacht: 12 automatiseringen, KPI-strip toont juiste counts, fix-job-postings-geocoding heeft een laatste-run-time en stats.

- [ ] **Step 8: Sluit eerste cron-cycle af**

Wacht tot de eerste **scheduled** run (bv. om 14:00 UTC). Verifieer in dashboard dat `triggered_by='schedule'` en stats correct.

- [ ] **Step 9: Schakel n8n-flow uit**

In n8n: deactivate de "Fix Platform_id Nominatim" workflow. We runnen nu via code.

---

## Self-Review Notes

**Spec coverage:**
- §3 architectuur → A, B, C, D, E ✓
- §4 DB → A1-A3 ✓
- §5 registry → B1 ✓
- §6 monitoring wrapper → B2-B4 ✓
- §7 UI → D2, E1-E3 ✓
- §8 API → C1-C3 ✓
- §9 LocationIQ migratie → F1-F6 ✓
- §11 chunks → één-op-één ✓

**Type consistency check:**
- `BusinessStats` keys consistent gebruikt in F4 (`run()`) en in `displayStats` van fix-job-postings-geocoding entry in B1.
- `automation_id` text-veld matcht registry `id` veld in B1 — string-matching geldt.
- Wrapper `withAutomationMonitoring(id)` signature in B2 matcht gebruik in F5.

**Open beslispunten voor executor:**
- Task A1's RLS-policy gebruikt `current_setting('app.admin_emails', true)` als fallback — alleen werkbaar als die postgres-setting elders al geset is. Als niet: enkel `app_metadata.role='admin'` check zou voldoende moeten zijn voor jullie use-case. Executor: bij twijfel deze fallback weghalen.
- Task F5 step 3 vereist user-actie (env-var). Executor moet hier pauzeren en bevestigen voor verder gaan.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-06-automatiseringen-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review tussen taken, snelle iteratie. Geschikt omdat het project in 8 onafhankelijke chunks valt en taken in F-G parallel kunnen.

**2. Inline Execution** — taken in deze sessie uitvoeren, batches met checkpoints.

**Welke aanpak?**
