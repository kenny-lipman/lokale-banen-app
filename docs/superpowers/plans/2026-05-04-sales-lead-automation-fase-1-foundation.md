# Sales Lead Automation — Fase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leg het fundament voor de Sales Lead Automation feature: 3 nieuwe DB-tabellen + uitbreiding op `job_sources`, regenererende TypeScript types, owner-config seed, sidebar-refactor naar Sales-cluster, en 3 placeholder-routes — zodat fase 2-7 op een schoon fundament kunnen bouwen.

**Architecture:** Eén Supabase-migratie die de 3 nieuwe tabellen aanmaakt en `job_sources` uitbreidt met `kind`-discriminator + career-page-velden + monitoring-velden. Sidebar krijgt een nieuwe **Sales** parent-cluster en **Vacatures** wordt uitgebreid met "Scrape-bronnen". 3 routes worden als placeholders aangemaakt achter bestaande auth-middleware.

**Tech Stack:** Next.js 15 App Router (Turbopack) · Supabase (PostgreSQL) · TypeScript · `@/lib/auth-middleware` · shadcn/ui Card-component · Vercel.

**Spec:** [`docs/superpowers/specs/2026-05-04-sales-lead-automation-design.md`](../specs/2026-05-04-sales-lead-automation-design.md) (sectie 4, 12 fase 1, 18)

---

## File Structure

| Pad | Actie | Verantwoordelijkheid |
|---|---|---|
| `supabase/migrations/20260504_sales_lead_automation_foundation.sql` | **Create** | Schema-migratie: 3 nieuwe tabellen + ALTER `job_sources` + RLS-toggles |
| `apps/admin/lib/supabase.ts` | **Modify** | Database-type uitbreiden met nieuwe tabel-typings (gegenereerd door Supabase) |
| `apps/admin/components/Sidebar.tsx` | **Modify** | Sales-parent toevoegen (5 children) + Vacatures-children uitbreiden |
| `apps/admin/app/sales/lead-verrijking/page.tsx` | **Create** | Placeholder run-historie pagina |
| `apps/admin/app/sales/owner-mapping/page.tsx` | **Create** | Placeholder owner-mapping pagina |
| `apps/admin/app/job-postings/scrape-bronnen/page.tsx` | **Create** | Placeholder scrape-bronnen overzicht |

---

## Task 1: Schrijf migration-SQL (3 tabellen + ALTER `job_sources`)

**Files:**
- Create: `supabase/migrations/20260504_sales_lead_automation_foundation.sql`

- [ ] **Step 1: Maak het migration-bestand met de volledige SQL**

Schrijf naar `supabase/migrations/20260504_sales_lead_automation_foundation.sql`:

```sql
-- Sales Lead Automation — Foundation
-- Spec: docs/superpowers/specs/2026-05-04-sales-lead-automation-design.md (sectie 4)

-- ============================================================
-- 1. sales_lead_owner_config — 4 dealeigenaars (UI-beheerd)
-- ============================================================
CREATE TABLE sales_lead_owner_config (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key                           text UNIQUE NOT NULL,
  label                         text NOT NULL,
  pipedrive_user_id             bigint NOT NULL,
  pipedrive_pipeline_id         int NOT NULL,
  pipedrive_default_stage_id    int NOT NULL,
  hoofddomein_strategy          text NOT NULL CHECK (hoofddomein_strategy IN ('fixed','auto_match_by_address')),
  hoofddomein_fixed_value       text,
  wetarget_flag_value           smallint NOT NULL DEFAULT 301,
  contactmoment_field_key       text,
  contactmoment_offset_workdays smallint NOT NULL DEFAULT 1,
  is_active                     boolean NOT NULL DEFAULT true,
  display_order                 int NOT NULL DEFAULT 100,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sales_lead_owner_config ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. sales_lead_runs — 1 rij per ingevoerde URL
-- ============================================================
CREATE TABLE sales_lead_runs (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  created_by                  uuid REFERENCES auth.users(id),
  input_url                   text NOT NULL,
  input_domain                text NOT NULL,
  owner_config_id             uuid NOT NULL REFERENCES sales_lead_owner_config(id),
  manual_vacancies            jsonb NOT NULL DEFAULT '[]'::jsonb,
  scrape_vacancies            boolean NOT NULL DEFAULT true,
  status                      text NOT NULL DEFAULT 'enriching'
                              CHECK (status IN ('enriching','review','syncing','completed','failed','duplicate')),
  enrichments                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  master_record               jsonb,
  selected_contacts           jsonb NOT NULL DEFAULT '[]'::jsonb,
  pipedrive_org_id            bigint,
  pipedrive_deal_id           bigint,
  pipedrive_person_ids        bigint[] NOT NULL DEFAULT '{}',
  existing_pipedrive_org_id   bigint,
  audit_log                   jsonb NOT NULL DEFAULT '[]'::jsonb,
  error                       text
);
CREATE INDEX idx_sales_lead_runs_created_by ON sales_lead_runs(created_by, created_at DESC);
CREATE INDEX idx_sales_lead_runs_status ON sales_lead_runs(status);
CREATE INDEX idx_sales_lead_runs_domain ON sales_lead_runs(input_domain);
ALTER TABLE sales_lead_runs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. enrichment_cache — generieke cache (KvK / Apollo / Maps / Pipedrive-meta)
-- ============================================================
CREATE TABLE enrichment_cache (
  source       text NOT NULL,
  cache_key    text NOT NULL,
  response     jsonb NOT NULL,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  PRIMARY KEY (source, cache_key)
);
CREATE INDEX idx_enrichment_cache_expires ON enrichment_cache(expires_at);
ALTER TABLE enrichment_cache ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. ALTER bestaande job_sources — career-page support
-- (8 bestaande aggregator-rijen krijgen via DEFAULT kind='aggregator')
-- ============================================================
ALTER TABLE job_sources ADD COLUMN kind text NOT NULL DEFAULT 'aggregator'
  CHECK (kind IN ('aggregator','company_career_page'));
ALTER TABLE job_sources ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE job_sources ADD COLUMN url text;
ALTER TABLE job_sources ADD COLUMN discovery_method text
  CHECK (discovery_method IS NULL OR discovery_method IN ('sitemap','robots','common_path','html_link','manual'));
ALTER TABLE job_sources ADD COLUMN is_external_ats boolean DEFAULT false;
ALTER TABLE job_sources ADD COLUMN ats_type text;
ALTER TABLE job_sources ADD COLUMN created_via text
  CHECK (created_via IS NULL OR created_via IN ('sales_lead_run','manual','seed'));
ALTER TABLE job_sources ADD COLUMN source_run_id uuid REFERENCES sales_lead_runs(id);
ALTER TABLE job_sources ADD COLUMN scrape_frequency text DEFAULT 'weekly'
  CHECK (scrape_frequency IN ('daily','weekly','monthly','manual'));
ALTER TABLE job_sources ADD COLUMN last_scraped_at timestamptz;
ALTER TABLE job_sources ADD COLUMN last_scrape_status text;
ALTER TABLE job_sources ADD COLUMN last_scrape_count int;
ALTER TABLE job_sources ADD COLUMN consecutive_failures int NOT NULL DEFAULT 0;
ALTER TABLE job_sources ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE job_sources ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE job_sources ADD CONSTRAINT job_sources_career_page_completeness CHECK (
  kind = 'aggregator'
  OR (kind = 'company_career_page' AND company_id IS NOT NULL AND url IS NOT NULL AND discovery_method IS NOT NULL)
);

CREATE INDEX idx_job_sources_kind ON job_sources(kind);
CREATE INDEX idx_job_sources_company ON job_sources(company_id) WHERE kind='company_career_page';
CREATE INDEX idx_job_sources_active_next ON job_sources(scrape_frequency, last_scraped_at)
  WHERE kind='company_career_page' AND active=true;
CREATE UNIQUE INDEX idx_job_sources_company_url ON job_sources(company_id, url) WHERE kind='company_career_page';
```

- [ ] **Step 2: Verifieer dat het bestand syntactisch geldig is**

```bash
ls -la supabase/migrations/20260504_sales_lead_automation_foundation.sql
wc -l supabase/migrations/20260504_sales_lead_automation_foundation.sql
```

Expected: bestaat, ~110 regels.

---

## Task 2: Apply migratie via Supabase MCP

- [ ] **Step 1: Pas de migratie toe**

Roep `mcp__supabase__apply_migration` aan met:
- `project_id`: `wnfhwhvrknvmidmzeclh`
- `name`: `sales_lead_automation_foundation`
- `query`: volledige SQL-inhoud uit task 1

Expected: success response, geen error.

- [ ] **Step 2: Run get_advisors om RLS/security checks te valideren**

Roep `mcp__supabase__get_advisors` aan met:
- `project_id`: `wnfhwhvrknvmidmzeclh`
- `type`: `security`

Expected: geen NIEUWE warnings voor de 3 nieuwe tabellen (`sales_lead_runs`, `sales_lead_owner_config`, `enrichment_cache`). De pre-existing 8 RLS-disabled tabellen (instantly_backfill_leads etc.) zijn niet door deze migratie gewijzigd en blijven als-is.

- [ ] **Step 3: Verifieer schema via SQL-query**

Roep `mcp__supabase__execute_sql` aan met:

```sql
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('sales_lead_runs','sales_lead_owner_config','enrichment_cache')
ORDER BY table_name, ordinal_position;
```

Expected: alle kolommen uit task 1 stap 1 zichtbaar.

- [ ] **Step 4: Verifieer dat bestaande job_sources rijen kind='aggregator' kregen**

Roep `mcp__supabase__execute_sql` aan met:

```sql
SELECT kind, COUNT(*) FROM job_sources GROUP BY kind;
```

Expected: één rij `aggregator | 8`. (Geen `company_career_page` rijen — die komen pas via fase 5.)

---

## Task 3: Seed `sales_lead_owner_config` met 4 dealeigenaars

- [ ] **Step 1: Insert de 4 owner-configs**

Roep `mcp__supabase__execute_sql` aan met:

```sql
INSERT INTO sales_lead_owner_config (
  key, label, pipedrive_user_id, pipedrive_pipeline_id, pipedrive_default_stage_id,
  hoofddomein_strategy, hoofddomein_fixed_value, wetarget_flag_value,
  contactmoment_field_key, contactmoment_offset_workdays, display_order
) VALUES
  ('dean_wetarget',    'Dean WeTarget',     26007186,  5, 22,
   'fixed', 'WeTarget', 265,
   '6b624a58761cbbd7a95363c1a5c969daa172563c', 1, 10),
  ('rico_wetarget',    'Rico WeTarget',     22971285, 11, 66,
   'fixed', 'WeTarget', 265,
   '6b624a58761cbbd7a95363c1a5c969daa172563c', 1, 20),
  ('rico_lokalebanen', 'Rico LokaleBanen',  22971285, 10, 59,
   'auto_match_by_address', NULL, 301,
   '62bfdd211c39219e11e25e7f770ca92fd35fe39b', 1, 30),
  ('rico_wia',         'Rico WIA',          22971285,  9, 57,
   'auto_match_by_address', NULL, 301,
   '62bfdd211c39219e11e25e7f770ca92fd35fe39b', 1, 40);
```

Expected: success, 4 rows inserted.

- [ ] **Step 2: Verifieer seed-data**

Roep `mcp__supabase__execute_sql` aan met:

```sql
SELECT label, pipedrive_user_id, pipedrive_pipeline_id, pipedrive_default_stage_id,
       hoofddomein_strategy, hoofddomein_fixed_value, wetarget_flag_value
FROM sales_lead_owner_config ORDER BY display_order;
```

Expected: 4 rijen exact zoals geseed (Dean WeTarget eerst, Rico WIA laatst).

---

## Task 4: Regenereer TypeScript-types

**Files:**
- Modify: `apps/admin/lib/supabase.ts:117` (`Database` type uitbreiden)

- [ ] **Step 1: Genereer types via Supabase MCP**

Roep `mcp__supabase__generate_typescript_types` aan met:
- `project_id`: `wnfhwhvrknvmidmzeclh`

Output: complete TypeScript `Database` type-definitie. Bewaar deze output.

- [ ] **Step 2: Open `apps/admin/lib/supabase.ts` en zoek de bestaande `Database` type-definitie (start ±regel 117)**

```bash
grep -n "^export type Database" /Users/kennylipman/Lokale-Banen/apps/admin/lib/supabase.ts
```

Expected: 1 match op regel 117.

- [ ] **Step 3: Vervang de volledige `Database` type-definitie met de gegenereerde output**

Edit `apps/admin/lib/supabase.ts` — vervang de bestaande `export type Database = { ... }` block met de output van stap 1. Behoud alle imports, helper-types en exports vóór en ná de Database-block.

- [ ] **Step 4: Verifieer dat de nieuwe tabellen in de types staan**

```bash
grep -E "sales_lead_runs|sales_lead_owner_config|enrichment_cache" /Users/kennylipman/Lokale-Banen/apps/admin/lib/supabase.ts | head -20
```

Expected: refs naar elk van de 3 tabellen + uitgebreide `job_sources` met nieuwe kolommen (kind, company_id, url, discovery_method, etc.)

- [ ] **Step 5: TypeScript compile-check**

```bash
cd /Users/kennylipman/Lokale-Banen/apps/admin && pnpm exec tsc --noEmit 2>&1 | head -40
```

Expected: geen errors gerelateerd aan `Database`-type. (Pre-existing errors in andere files mogen blijven.)

---

## Task 5: Sidebar-refactor — voeg Sales-cluster toe + Vacatures uitbreiden

**Files:**
- Modify: `apps/admin/components/Sidebar.tsx:28-65` (menu-array)

- [ ] **Step 1: Open `apps/admin/components/Sidebar.tsx` en bekijk de huidige menu-array**

```bash
sed -n '28,65p' /Users/kennylipman/Lokale-Banen/apps/admin/components/Sidebar.tsx
```

- [ ] **Step 2: Vervang de huidige `menu`-array (regels 28-65) met de nieuwe versie**

Edit `apps/admin/components/Sidebar.tsx` — vervang de `const menu = [ ... ]` block met:

```tsx
const menu = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  {
    label: "Agents",
    icon: Users,
    children: [
      { href: "/agents/otis/enhanced", icon: Bot, label: "Otis" },
    ],
    href: "/agents"
  },
  { href: "/job-postings?status=pending", icon: ClipboardCheck, label: "Review" },
  {
    label: "Vacatures",
    icon: Briefcase,
    href: "/job-postings",
    children: [
      { href: "/job-postings", icon: Briefcase, label: "Overzicht" },
      { href: "/vacatures/nieuw", icon: Plus, label: "Nieuw aanmaken" },
      { href: "/job-postings/scrape-bronnen", icon: Monitor, label: "Scrape-bronnen" },
    ],
  },
  {
    label: "Bedrijven",
    icon: Building2,
    href: "/companies",
    children: [
      { href: "/companies", icon: Building2, label: "Overzicht" },
      { href: "/bedrijven/nieuw", icon: Plus, label: "Nieuw aanmaken" },
    ],
  },
  { href: "/contacten", icon: Users, label: "Contacten" },
  {
    label: "Sales",
    icon: Mail,
    href: "/sales/lead-verrijking",
    children: [
      { href: "/sales/lead-verrijking", icon: Mail, label: "Lead Verrijking" },
      { href: "/sales/owner-mapping", icon: Settings, label: "Owner Mapping" },
      { href: "/campaign-assignment", icon: Mail, label: "Campaign Assignment" },
      { href: "/blocklist", icon: Shield, label: "Blocklist" },
      { href: "/instantly-sync", icon: ArrowLeftRight, label: "Instantly <> PD Sync" },
    ],
  },
  { href: "/mailerlite-sync", icon: Mail, label: "MailerLite Sync" },
  { href: "/platforms", icon: Monitor, label: "Platforms" },
  { href: "/regios", icon: MapPin, label: "Regio's" },
  { href: "/settings", icon: Settings, label: "Instellingen" },
]
```

**Wijzigingen samengevat:**
- Toegevoegd: `Vacatures > Scrape-bronnen` (`Monitor` icon)
- Verplaatst onder Sales-cluster: `Campaign Assignment`, `Blocklist`, `Instantly <> PD Sync`
- Nieuw toegevoegd onder Sales: `Lead Verrijking`, `Owner Mapping`
- MailerLite Sync blijft top-level (niet sales-gerelateerd)

- [ ] **Step 3: Verifieer dat geen icon-imports ontbreken**

```bash
grep -E "import.*lucide-react" /Users/kennylipman/Lokale-Banen/apps/admin/components/Sidebar.tsx | head -3
```

Expected: imports bevatten in elk geval `Home, Building2, Users, Briefcase, MapPin, Settings, ArrowLeftRight, Mail, ClipboardCheck, Monitor, Plus, Bot, Shield, ChevronLeft, ChevronRight, ChevronDown, LogOut`. Als één ontbreekt, voeg toe aan de bestaande lucide-react import block (regels 7-25).

- [ ] **Step 4: Lokale TypeScript check**

```bash
cd /Users/kennylipman/Lokale-Banen/apps/admin && pnpm exec tsc --noEmit components/Sidebar.tsx 2>&1 | head -10
```

Expected: geen errors in deze file.

---

## Task 6: Placeholder route `/sales/lead-verrijking`

**Files:**
- Create: `apps/admin/app/sales/lead-verrijking/page.tsx`

- [ ] **Step 1: Maak de directory + placeholder pagina**

```bash
mkdir -p /Users/kennylipman/Lokale-Banen/apps/admin/app/sales/lead-verrijking
```

Schrijf naar `apps/admin/app/sales/lead-verrijking/page.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail } from "lucide-react"

export default function LeadVerrijkingPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lead Verrijking</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Verrijk een bedrijf op basis van URL → review → sync naar Pipedrive
        </p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-orange-600" />
            <CardTitle>In ontwikkeling</CardTitle>
          </div>
          <CardDescription>
            Deze pagina wordt opgeleverd in fase 4 + 6 (run-historie + nieuwe lead).
            Het foundation-werk (database, sidebar) is klaar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Spec:{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded">
              docs/superpowers/specs/2026-05-04-sales-lead-automation-design.md
            </code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verifieer dat de file bestaat**

```bash
ls -la /Users/kennylipman/Lokale-Banen/apps/admin/app/sales/lead-verrijking/page.tsx
```

Expected: file bestaat, ~30 regels.

---

## Task 7: Placeholder route `/sales/owner-mapping`

**Files:**
- Create: `apps/admin/app/sales/owner-mapping/page.tsx`

- [ ] **Step 1: Maak de directory + placeholder pagina met bestaande seed-data zichtbaar**

```bash
mkdir -p /Users/kennylipman/Lokale-Banen/apps/admin/app/sales/owner-mapping
```

Schrijf naar `apps/admin/app/sales/owner-mapping/page.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { Settings } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function OwnerMappingPage() {
  const supabase = createServiceRoleClient()
  const { data: configs } = await supabase
    .from("sales_lead_owner_config")
    .select("*")
    .order("display_order", { ascending: true })

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Owner Mapping</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Koppel dealeigenaars aan Pipedrive users, pipelines en contactmoment-velden.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-orange-600" />
            <CardTitle>In ontwikkeling — fase 2</CardTitle>
          </div>
          <CardDescription>
            UI met cascading dropdowns + edit-modal komt in fase 2. Hieronder de huidige seed-data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-gray-500 border-b">
              <tr>
                <th className="text-left py-2">Label</th>
                <th className="text-left py-2">PD User</th>
                <th className="text-left py-2">Pipeline</th>
                <th className="text-left py-2">Stage</th>
                <th className="text-left py-2">Hoofddomein</th>
                <th className="text-left py-2">WeTarget flag</th>
              </tr>
            </thead>
            <tbody>
              {configs?.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 font-medium">{c.label}</td>
                  <td className="py-2 font-mono text-xs">{c.pipedrive_user_id}</td>
                  <td className="py-2 font-mono text-xs">{c.pipedrive_pipeline_id}</td>
                  <td className="py-2 font-mono text-xs">{c.pipedrive_default_stage_id}</td>
                  <td className="py-2">
                    {c.hoofddomein_strategy === "fixed"
                      ? <span className="text-orange-600">vast: {c.hoofddomein_fixed_value}</span>
                      : <span className="text-green-700">auto-match</span>}
                  </td>
                  <td className="py-2">{c.wetarget_flag_value === 265 ? "Ja" : "Nee"}</td>
                </tr>
              ))}
              {!configs?.length && (
                <tr><td colSpan={6} className="py-4 text-center text-gray-500">Geen owner-configs gevonden — voer task 3 seed uit.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verifieer dat `createServiceRoleClient` bestaat in `@/lib/supabase-server`**

```bash
grep -n "createServiceRoleClient" /Users/kennylipman/Lokale-Banen/apps/admin/lib/supabase-server.ts
```

Expected: één export. Als de functie een andere naam heeft (bv `createSupabaseServiceRoleClient`), pas de import in stap 1 aan.

---

## Task 8: Placeholder route `/job-postings/scrape-bronnen`

**Files:**
- Create: `apps/admin/app/job-postings/scrape-bronnen/page.tsx`

- [ ] **Step 1: Maak de directory + placeholder pagina met aggregator-overzicht**

```bash
mkdir -p /Users/kennylipman/Lokale-Banen/apps/admin/app/job-postings/scrape-bronnen
```

Schrijf naar `apps/admin/app/job-postings/scrape-bronnen/page.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { Monitor } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ScrapeBronnenPage() {
  const supabase = createServiceRoleClient()
  const { data: sources } = await supabase
    .from("job_sources")
    .select("id, name, scraping_method, active, kind, company_id, url, last_scraped_at")
    .order("kind", { ascending: true })
    .order("name", { ascending: true })

  const aggregators = sources?.filter((s) => s.kind === "aggregator") ?? []
  const careerPages = sources?.filter((s) => s.kind === "company_career_page") ?? []

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Scrape-bronnen</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Alle vacature-bronnen die wij scrapen — aggregator-platforms en bedrijfs-werkenbij-pagina's.
        </p>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-orange-600" />
            <CardTitle>In ontwikkeling — fase 6</CardTitle>
          </div>
          <CardDescription>
            Volledige UI met filters, edit-modal en monitoring komt in fase 6. Hieronder de huidige bronnen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h3 className="font-semibold mb-2">Aggregator-platforms ({aggregators.length})</h3>
          <table className="w-full text-sm mb-6">
            <thead className="text-xs uppercase text-gray-500 border-b">
              <tr><th className="text-left py-2">Naam</th><th className="text-left py-2">Methode</th><th className="text-left py-2">Actief</th></tr>
            </thead>
            <tbody>
              {aggregators.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="py-2 font-medium">{s.name}</td>
                  <td className="py-2 text-gray-600">{s.scraping_method ?? "—"}</td>
                  <td className="py-2">{s.active ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="font-semibold mb-2">Bedrijfs-werkenbij-pagina's ({careerPages.length})</h3>
          {careerPages.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nog geen career-pages — wordt gevuld vanaf fase 5 (Sales Lead Sync).
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500 border-b">
                <tr><th className="text-left py-2">URL</th><th className="text-left py-2">Laatst gescrapet</th></tr>
              </thead>
              <tbody>
                {careerPages.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="py-2 font-mono text-xs">{s.url}</td>
                    <td className="py-2 text-gray-600">{s.last_scraped_at ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verifieer dat de file bestaat**

```bash
ls -la /Users/kennylipman/Lokale-Banen/apps/admin/app/job-postings/scrape-bronnen/page.tsx
```

Expected: file bestaat, ~70 regels.

---

## Task 9: Smoke-test — start dev server + bezoek alle 3 routes

- [ ] **Step 1: Start de admin dev-server in de achtergrond**

```bash
cd /Users/kennylipman/Lokale-Banen/apps/admin && pnpm dev
```

Run met `run_in_background: true`. Wacht tot Turbopack "Ready" log verschijnt (~10-20s).

- [ ] **Step 2: Verifieer dat de routes bereikbaar zijn**

```bash
for path in /sales/lead-verrijking /sales/owner-mapping /job-postings/scrape-bronnen; do
  echo "=== ${path} ==="
  curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000${path}
done
```

Expected: HTTP 200 (als auth via session-cookie is) OF HTTP 307 (redirect naar /login). Géén 404 of 500.

- [ ] **Step 3: Inspecteer dev-server logs op errors**

Lees de output van de dev-server (background-task). Filter op `error|Error|ERR`:

Expected: geen errors voor de 3 nieuwe routes. Pre-existing warnings mogen blijven.

- [ ] **Step 4: Stop de dev-server**

Kill het achtergrondproces.

---

## Task 10: Final verificatie + commit

- [ ] **Step 1: Lopende `get_advisors` finaal**

Roep `mcp__supabase__get_advisors` aan met `type: 'security'`.

Expected: geen NIEUWE warnings t.o.v. de baseline (8 pre-existing RLS-disabled tabellen blijven, dat is bekende staat).

- [ ] **Step 2: Run full TypeScript check**

```bash
cd /Users/kennylipman/Lokale-Banen/apps/admin && pnpm exec tsc --noEmit 2>&1 | tee /tmp/tsc-out.txt | tail -20
```

Expected: dezelfde error-count als baseline (mag pre-existing errors hebben, mag geen NIEUWE errors hebben gerelateerd aan onze wijzigingen).

- [ ] **Step 3: Git status check + add**

```bash
cd /Users/kennylipman/Lokale-Banen && git status -s
```

Expected output bevat (orde mag verschillen):
```
A  supabase/migrations/20260504_sales_lead_automation_foundation.sql
M  apps/admin/lib/supabase.ts
M  apps/admin/components/Sidebar.tsx
A  apps/admin/app/sales/lead-verrijking/page.tsx
A  apps/admin/app/sales/owner-mapping/page.tsx
A  apps/admin/app/job-postings/scrape-bronnen/page.tsx
```

```bash
git add supabase/migrations/20260504_sales_lead_automation_foundation.sql \
        apps/admin/lib/supabase.ts \
        apps/admin/components/Sidebar.tsx \
        apps/admin/app/sales/lead-verrijking/page.tsx \
        apps/admin/app/sales/owner-mapping/page.tsx \
        apps/admin/app/job-postings/scrape-bronnen/page.tsx
```

- [ ] **Step 4: Commit met conventional message**

```bash
git commit -m "$(cat <<'EOF'
feat(sales-leads): foundation — DB schema + sidebar + placeholder routes

Fase 1 van de Sales Lead Automation feature:
- 3 nieuwe tabellen: sales_lead_runs, sales_lead_owner_config, enrichment_cache
- ALTER job_sources: kind discriminator + career-page velden + monitoring
- Seed: 4 owner-configs (Dean WeTarget, Rico WeTarget/LokaleBanen/WIA)
- Sidebar: nieuwe Sales-cluster, Vacatures uitgebreid met Scrape-bronnen
- Placeholder pagina's voor /sales/lead-verrijking, /sales/owner-mapping,
  /job-postings/scrape-bronnen

Spec: docs/superpowers/specs/2026-05-04-sales-lead-automation-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: succesvolle commit, géén pre-commit hook errors.

- [ ] **Step 5: Verifieer dat alles op `main` staat**

```bash
git log --oneline -3
```

Expected: bovenste commit is de foundation-commit van deze taak.

---

## Definition of Done — Fase 1

- [x] Migratie aangemaakt + toegepast zonder errors
- [x] `get_advisors` toont geen nieuwe warnings voor onze 3 tabellen
- [x] 4 owner-configs zichtbaar in `sales_lead_owner_config`
- [x] `job_sources` heeft 8 rijen met `kind='aggregator'`
- [x] TypeScript-types bijgewerkt, `tsc --noEmit` geen nieuwe errors
- [x] Sidebar toont Sales-cluster + Vacatures uitgebreid
- [x] 3 placeholder-routes bereikbaar (200 of auth-redirect)
- [x] Commit op `main`

**Volgt op:** Fase 2 — Owner Mapping (PipedriveMetaService + cascading dropdowns + Test config) — eigen plan in `docs/superpowers/plans/2026-XX-XX-sales-lead-automation-fase-2-owner-mapping.md`.
