---
name: sales-lead-automation-design
description: Design spec voor de Sales Lead Automation feature — URL-input, multi-bron verrijking (KvK + Google Maps + Apollo + website-crawl), review-flow met per-bron details, en Pipedrive-sync (org + persons + deal) voor 4 dealeigenaars over 3 brands (WeTarget, LokaleBanen, WIA).
status: approved-for-planning
date: 2026-05-04
author: Kenny Lipman
related:
  - research/2026-05-04-kvk-api-research.md
  - research/2026-05-04-apollo-api-research.md
---

# Sales Lead Automation — Design Spec

## 1. Context

WeTarget (jobmarketing-bureau, klant van Lokale Banen) wil een Sales Lead Automation om vanaf een bedrijfs-URL automatisch een complete Pipedrive-deal aan te maken inclusief geselecteerde decision-makers en vacature-context. De flow is geïnspireerd door een bestaande Make.com-scenario ("Leads Zwarte Kraai") maar wordt heroverwogen voor Pipedrive (i.p.v. HubSpot/Salesforce) en aangepast aan de NL-context (KvK als primaire bron i.p.v. enkel Apollo).

De feature komt in het bestaande Lokale Banen admin-dashboard (Next.js App Router monorepo, Supabase backend, Pipedrive-integratie via `lib/pipedrive-client.ts`).

### 1.1 Goals

- **Sales-snelheid**: van URL → complete Pipedrive-deal in <1 minuut, met menselijke review-stap voor kwaliteitsborging.
- **Multi-source data**: bedrijfsdata uit 4 bronnen tonen, sales kiest welke bron voor welk veld leidend is.
- **Decision-maker selectie**: AI-gerangschikte top-2 contacten per lead, fallback op manueel of "Afdeling Personeelszaken".
- **Volledige Pipedrive-binding**: org (met dedupe), 1-2 persons, 1 deal in juiste pipeline + stage + owner + contactmoment.
- **Schaalbaar**: tot ~200 leads/dag, ~10-12 dagen development effort.

### 1.2 Non-goals (out of scope V1)

- Outbound email versturen vanuit deze feature (loopt via bestaande Instantly-flow).
- Bulk-upload van leads (CSV/Excel) — V1 is per-lead-handmatig.
- Pipedrive deal-pijplijn-geautomatiseerde-progressie (stages worden alleen op aanmaakmoment gezet).
- Multi-tenancy per WeTarget-klant — feature is voor het Lokale Banen team intern.

## 2. User flow (3-staps wizard)

```
┌─ Stap 1 — Input ─┐    ┌─ Stap 2 — Review ─┐    ┌─ Stap 3 — Sync ─┐
│ URL              │ →  │ 4 bronnen-kaarten │ →  │ Pipedrive create│
│ Dealeigenaar     │    │ Per-bron details  │    │ Deeplinks       │
│ Vacatures (opt.) │    │ Master record     │    │ Of dedupe-warn. │
└──────────────────┘    │ AI-top-2 contacten│    └─────────────────┘
                        │ Auto-notitie      │
                        └───────────────────┘
```

Routes:
| Path | Doel |
|---|---|
| `/sales/lead-verrijking` | Run-historie tabel (default landing) + "Nieuwe lead" |
| `/sales/lead-verrijking/nieuw` | Stap 1 |
| `/sales/lead-verrijking/{run_id}` | Stap 2 of 3 op basis van `runs.status` |
| `/sales/owner-mapping` | 4-rijen owner-config UI (superadmin) |

Sidebar-refactor: nieuwe **Sales** parent-menu in `apps/admin/components/Sidebar.tsx`. Onder Sales: Lead Verrijking · Owner Mapping · Campaign Assignment · Blocklist · Instantly &lt;&gt; PD Sync. Bestaande deeplinks blijven werken.

## 3. Architectuur

```
Frontend (Next.js)                    Backend (Vercel Functions, Fluid)
─────────────────                     ──────────────────────────────────
Stap 1 form                           POST /api/sales-leads/create
  └─→ POST create ───────────────────→  Insert sales_lead_runs (status=enriching)
                                        Fire-and-forget: runEnrichment(run_id)
Stap 2 (polling 1.5s)                       │
  └─→ GET /run_id ──────────────────→ Read sales_lead_runs (incl. enrichments)
                                            ▼
                          ┌─────────────────┴─────────────────┐
                          │  4 parallel enrichers (Promise.allSettled)
                          ▼                                   ▼
                    KvkService                          ApolloService
                    MapsService                         WebsiteService (+ Mistral)
                    Each writes own jsonb-subkey via UPDATE jsonb_set(...)

After all 4 done:
                    Mistral rankContacts()  →  master_record voorvullen
                    runs.status = 'review'

Stap 3 sync                            POST /api/sales-leads/{id}/sync-pipedrive
  └─→ POST sync ────────────────────→  PipedriveSyncService:
                                          1. dedupe-check (search org by domain+name)
                                          2. createOrganization(payload)
                                          3. createPerson × N
                                          4. createDeal (v2 API)
                                          5. addNote (rijke markdown)
                                          6. Update runs.status = 'completed'
```

Patroon: **DB-backed jobs + polling** (geen SSE). Robuust voor refresh, drafts kunnen hervat worden.

### 3.1 Orchestrator-fasen (binnen `runEnrichment`)

```
Fase A — parallel (Promise.allSettled):
  ├─ KvkService.enrichByDomain(domain)
  ├─ MapsService.findPlace(domain)
  ├─ ApolloService.enrichOrganization(domain)
  ├─ ApolloService.searchContactsByDomain(domain)  ← warm-lead detection in Apollo CRM
  └─ WebsiteService.crawlAndParse(url)             ← levert kandidaat-namen

Fase B — sequentieel na Fase A (alleen als WebsiteService kandidaten leverde):
  Voor elke unieke contact-naam uit website ∪ apollo_warm_leads:
    └─ ApolloService.matchPerson({name, domain})    ← verrijkt LinkedIn/email/title
  Resultaten gemerged in enrichments.apollo.parsed.contacts[]
  Contacten uit searchContactsByDomain krijgen is_warm_lead=true

Fase C — na Fase B:
  └─ MistralService.rankContacts(merged_contacts, master_context)
  Output schrijft ai_priority_score + ai_priority_reason per contact

Fase D — finalisatie:
  └─ computePrimaryMaster() vult master_record voor (zie sectie 6.4 voor bron-prioriteit)
  └─ runs.status = 'review'
```

Per-bron-resultaat schrijven gaat via `jsonb_set` (sectie 6.3). Apollo `matchPerson`-resultaten worden onder `enrichments.apollo.parsed.contacts[]` gemerged.

## 4. Data model

4 tabellen, RLS aan met service-role-only policies. (`company_career_sources` is voorbereid voor V2-monitoring — zie sectie 17.)

```sql
-- Hoofdtabel: 1 rij per ingevoerde URL
CREATE TABLE sales_lead_runs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid REFERENCES auth.users(id),
  input_url            text NOT NULL,
  input_domain         text NOT NULL,
  owner_config_id      uuid NOT NULL REFERENCES sales_lead_owner_config(id),
  manual_vacancies     jsonb NOT NULL DEFAULT '[]',
  scrape_vacancies     boolean NOT NULL DEFAULT true,

  status               text NOT NULL DEFAULT 'enriching'
                       CHECK (status IN ('enriching','review','syncing','completed','failed','duplicate')),

  -- per-bron resultaten (zie 4.1)
  enrichments          jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- door user samengesteld in stap 2
  master_record        jsonb,
  selected_contacts    jsonb NOT NULL DEFAULT '[]',

  -- pipedrive output
  pipedrive_org_id     bigint,
  pipedrive_deal_id    bigint,
  pipedrive_person_ids bigint[] DEFAULT '{}',
  existing_pipedrive_org_id  bigint,  -- bij duplicate-detection

  -- audit
  audit_log            jsonb NOT NULL DEFAULT '[]',
  error                text
);
CREATE INDEX idx_sales_lead_runs_created_by ON sales_lead_runs(created_by, created_at DESC);
CREATE INDEX idx_sales_lead_runs_status ON sales_lead_runs(status);
CREATE INDEX idx_sales_lead_runs_domain ON sales_lead_runs(input_domain);

-- Owner-config (4 rijen seed, UI-beheerd)
CREATE TABLE sales_lead_owner_config (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key                         text UNIQUE NOT NULL,    -- 'dean_wetarget' etc.
  label                       text NOT NULL,            -- 'Dean WeTarget'
  pipedrive_user_id           bigint NOT NULL,
  pipedrive_pipeline_id       int NOT NULL,
  pipedrive_default_stage_id  int NOT NULL,
  hoofddomein_strategy        text NOT NULL CHECK (hoofddomein_strategy IN ('fixed','auto_match_by_address')),
  hoofddomein_fixed_value     text,                     -- bv 'WeTarget' bij fixed
  wetarget_flag_value         smallint NOT NULL DEFAULT 301,  -- Org-custom-field a92798b0: 265=Ja (Dean/Rico WeTarget), 301=Nee (Rico LokaleBanen/WIA)
  contactmoment_field_key     text,                     -- 40-char hash of NULL
  contactmoment_offset_workdays smallint NOT NULL DEFAULT 1,  -- 0=vandaag, 1=volgende werkdag
  is_active                   boolean NOT NULL DEFAULT true,
  display_order               int NOT NULL DEFAULT 100,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Generieke cache (vervangt aparte kvk_cache + apollo_cache + maps_cache + pipedrive_meta)
CREATE TABLE enrichment_cache (
  source       text NOT NULL,
  cache_key    text NOT NULL,
  response     jsonb NOT NULL,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  PRIMARY KEY (source, cache_key)
);
CREATE INDEX idx_enrichment_cache_expires ON enrichment_cache(expires_at);
-- source-waardes: 'kvk_basisprofiel' | 'kvk_zoeken' | 'apollo_org' | 'google_maps_place'
--               | 'pipedrive_users' | 'pipedrive_pipelines' | 'pipedrive_stages' | 'pipedrive_deal_fields'

-- 4. Career-page registry (V1: alleen rij aanmaken bij sync; V2: cron-driven scrapen — sectie 17)
CREATE TABLE company_career_sources (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url                  text NOT NULL,
  discovery_method     text NOT NULL CHECK (discovery_method IN ('sitemap','robots','common_path','html_link','manual')),
  is_external_ats      boolean NOT NULL DEFAULT false,
  ats_type             text,
  is_active            boolean NOT NULL DEFAULT true,
  scrape_frequency     text NOT NULL DEFAULT 'weekly' CHECK (scrape_frequency IN ('daily','weekly','monthly','manual')),
  last_scraped_at      timestamptz,
  last_scrape_status   text,
  last_scrape_count    int,
  consecutive_failures int NOT NULL DEFAULT 0,
  created_via          text NOT NULL CHECK (created_via IN ('sales_lead_run','manual','admin_bulk_import')),
  source_run_id        uuid REFERENCES sales_lead_runs(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, url)
);
CREATE INDEX idx_company_career_sources_active_next ON company_career_sources(scrape_frequency, last_scraped_at) WHERE is_active;

-- RLS
ALTER TABLE sales_lead_runs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_lead_owner_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_cache          ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_career_sources    ENABLE ROW LEVEL SECURITY;
-- (geen policies = alleen service_role kan lezen/schrijven)
```

### 4.1 Shape van `sales_lead_runs.enrichments`

```ts
type RunEnrichments = {
  kvk?:          PerSourceEnrichment
  google_maps?:  PerSourceEnrichment
  apollo?:       PerSourceEnrichment
  website?:      PerSourceEnrichment
}

type PerSourceEnrichment = {
  status:       'pending' | 'running' | 'completed' | 'failed' | 'not_found'
  started_at?:  string  // ISO
  completed_at?: string
  raw?:         unknown            // volledige API response (debug; null'd na 30 dagen)
  parsed?:      NormalizedFields   // genormaliseerde, UI-ready velden
  error?:       string
}
```

### 4.2 `NormalizedFields` (uitgebreid)

Alle bronnen retourneren een subset van dit schema; missing fields = `undefined`.

```ts
type NormalizedFields = {
  // Identiteit
  company_name?:        string
  trade_names?:         string[]      // KvK handelsnamen
  legal_form?:          string         // 'Besloten Vennootschap'
  kvk_number?:          string
  rsin?:                string         // KvK
  vestigingsnummer?:    string         // KvK

  // Locatie
  address?: {
    street?: string; number?: string; postcode?: string; city?: string; country?: string
    full?: string                       // gecombineerde "Slotenmakerstraat 60, 2672GD Naaldwijk"
  }
  coordinates?:         { lat: number; lng: number }
  bag_id?:              string         // KvK addresseerbaarObjectId

  // Web
  website?:             string
  email?:               string
  emails_all?:          string[]       // website-crawl vindt soms meerdere
  phone?:               string         // E.164 indien mogelijk
  phones_all?:          string[]
  linkedin_url?:        string
  linkedin_uid?:        string
  twitter_url?:         string
  facebook_url?:        string
  instagram_url?:       string
  tiktok_url?:          string
  crunchbase_url?:      string

  // Bedrijfsprofiel
  industry?:            string         // raw label
  industry_codes?:      string[]       // SIC of NAICS (Apollo)
  sbi_activities?:      Array<{ code: string; description: string; is_main: boolean }>  // KvK
  employee_count?:      number
  employee_bucket?:     'klein_<10' | 'middel_<100' | 'groot_>100'
  founded_year?:        number
  founded_date?:        string         // KvK formeleRegistratiedatum YYYY-MM-DD
  description_short?:   string
  description_long?:    string

  // Apollo-specifiek (Display + Notitie)
  apollo_org_id?:       string
  technologies?:        Array<{ name: string; category: string }>
  keywords?:            string[]       // 60+
  departmental_head_count?: Record<string, number>
  annual_revenue?:      number
  funding_total?:       number

  // Maps-specifiek
  rating?:              number
  ratings_total?:       number
  business_status?:     string         // 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | ...
  opening_hours?:       string[]       // ['Ma 09:00-17:00', ...]
  business_types?:      string[]       // ['marketing_agency', ...]
  photos_count?:        number
  logo_url?:            string

  // Website-specifiek
  pages_crawled?:       Array<{ path: string; title: string; word_count: number }>
  blog_post_count?:     number
  blog_last_post_date?: string

  // Career-page (sectie 6.5 + 17)
  career_page_url?:     string         // ontdekt /werkenbij URL
  career_page_method?:  'sitemap' | 'robots' | 'common_path' | 'html_link' | 'manual'
  career_page_last_seen?: string

  // Lead-output
  contacts?:            NormalizedContact[]
  vacancies?:           NormalizedVacancy[]

  // Bron-attribution (per veld welk bronveld de waarde leverde — voor master_record UI)
  source?:              'kvk' | 'google_maps' | 'apollo' | 'website'
}

type NormalizedContact = {
  name:                string
  first_name?:         string
  last_name?:          string
  title?:              string
  seniority?:          'owner' | 'founder' | 'c_suite' | 'vp' | 'head' | 'director' | 'manager' | 'senior' | 'junior' | 'intern'
  department?:         'executive' | 'human_resources' | 'operations' | 'sales' | 'marketing' | 'finance' | 'engineering' | 'other'
  email?:              string
  email_verified?:     boolean
  phone_mobile?:       string           // 06-nummer
  phone_other?:        string
  linkedin_url?:       string
  ai_priority_score?:  number           // 0-100 (Mistral output)
  ai_priority_reason?: string
  source_origin:       Array<'apollo' | 'website' | 'kvk' | 'manual'>
  is_warm_lead?:       boolean          // Apollo /contacts/search hit
}

type NormalizedVacancy = {
  title:               string
  url?:                string
  location?:           string
  description_short?:  string         // bij scrape mogelijk preview
  source:              'manual' | 'website_werkenbij'
}
```

### 4.3 `master_record` shape

Door user samengesteld in stap 2. Dezelfde shape als `NormalizedFields`, plus per-veld bron-attributie (`source_overrides`) en custom-edits:

```ts
type MasterRecord = NormalizedFields & {
  source_overrides: Record<keyof NormalizedFields, 'kvk'|'google_maps'|'apollo'|'website'|'custom'>
  // bv. {company_name:'kvk', address:'google_maps', industry:'apollo', industry_codes:'apollo', ...}
  hoofddomein:    string         // resolved waarde — uit owner_config strategy
  deal_note_text: string         // generated markdown, user-editable
}
```

## 5. UI/UX detail

### 5.1 Stap 1 — Input form

Componenten (shadcn): `Card`, `Form`, `Input`, `Select`, `Textarea`, custom tag-input.

Velden:
- **Website URL** *: text-input. Validatie: valid URL (zod), client-side fetch test, normalisatie naar domein.
- **Dealeigenaar** *: select uit `sales_lead_owner_config WHERE is_active`.
- **Vacatures** (optioneel): tag-input met chips voor handmatige titels/URLs.
- **☑ Auto-detect vacatures via /werkenbij**: default aan.

Submit → POST `/api/sales-leads/create` → 200 met `{run_id}` → router push `/sales/lead-verrijking/{run_id}`.

### 5.2 Stap 2 — Review

**Layout:** twee koloms (master record links 60%, contacten/vacatures rechts 40%) op desktop, gestapeld op mobile.

#### 5.2.1 Bron-status grid bovenaan

4 klikbare kaarten met realtime status. Elk klikbaar om expandable detail-panel te openen (toont alle raw velden). Status icons: ✓ done (groen) / ⏳ running (oranje) / ✗ failed (rood) / ⊘ not_found (grijs).

Stats per kaart (samenvatting):
- KvK: "X velden · Y SBI · Z vestigingen"
- Maps: "place_id · GPS · X.X★"
- Apollo: "X velden · Y tech · Z keywords"
- Website: "X pagina's · Y contacten · Z vacatures"

#### 5.2.2 Per-bron detail-panel

Elk panel toont **alle** velden die de bron leverde, gegroepeerd per categorie (Identiteit, Registratie, Activiteit, Vestiging, etc.). Per veld 3 kolommen:

| key | val | destination |
|---|---|---|
| `formeleRegistratiedatum` | `20221017` | 🟧 Notitie · "opgericht 17 okt 2022" |

**Bestemming-pills**:
- 🟦 **PD Org** — landt in Pipedrive Organization custom field
- 🟦 **PD Deal** — landt in Pipedrive Deal veld
- 🟪 **PD Person** — landt in Pipedrive Person veld
- 🟧 **Notitie** — landt in auto-gegenereerde deal-notitie
- ⚪ **Display** — alleen tonen in UI, niet gesynced

**Bron-discrepantie-warnings**: wanneer KvK en Apollo verschillende waardes leveren voor hetzelfde concept (founded_year, postcode, branche), tonen we een geel waarschuwingsblok onder de discrepante velden met uitleg en de gekozen primaire bron.

#### 5.2.3 Master record (links)

Per veld: `<input>` + bron-pill-dropdown. Dropdown toont primaire waarde + alternatieven uit andere bronnen + "custom" optie (free-text). Auto-save bij wijziging (debounced 500ms via PATCH `/api/sales-leads/{id}`).

Velden in master record (= velden die naar PD Org custom fields gaan):
- Bedrijfsnaam, KvK-nummer, Adres, Branche, Bedrijfsgrootte, Telefoon, E-mail, Website, Hoofddomein

**Hoofddomein-resolutie:**
- `owner_config.hoofddomein_strategy === 'fixed'` → kopieer `hoofddomein_fixed_value`, lock-icon, niet bewerkbaar
- `'auto_match_by_address'` → roep `platform-matcher.service` aan met master_record.address.city → match tegen `regio_platforms` + `central_places` → vul `WestlandseBanen` etc. — bewerkbaar door user

#### 5.2.4 Contacten (rechts boven)

AI top-2 als oranje-bordered cards met `★ score`. Daaronder "Niet geselecteerd" lijst met:
- Te junior / niet-passende contacten met grayed-out styling
- **Warm-lead-badge** ⚠ "Apollo CRM" voor contacten die in `apollo /contacts/search` matchen op het domein

Toggle-mechaniek: klik op niet-geselecteerd contact → wissel met laagst-gerangschikte selected. Maximum 2 selected (klant brief: "2 BESTE personen"), maar **0 of 1 mag ook** als geen passende contacten gevonden zijn — UI toont dan "Géén contact" / "1 contact" met disclaimer.

"+ Handmatig contact toevoegen" knop opent modal met velden naam/functie/email/telefoon/linkedin.

#### 5.2.5 Vacatures (rechts onder)

Twee secties: handmatige (uit stap 1) + auto-gevonden (`/werkenbij`-scrape). Checkboxes per vacature; alleen aangevinkte landen in deal-notitie.

#### 5.2.6 Auto-notitie (onderaan, full-width)

Markdown-textarea, auto-gegenereerd op moment van overgang naar `review`-status. Bevat:
- **Bedrijfsprofiel**: KvK identiteit + registratie
- **Activiteit**: SBI codes + Apollo industry/SIC/NAICS + beschrijving
- **Departement-distributie**: Apollo `departmental_head_count` als context voor sales
- **Technology stack**: top-5 Apollo technologies
- **Online aanwezigheid**: alle social media + blog/cases
- **Vacatures** (geselecteerde)
- **Bron-discrepanties** (informatief)

User mag de notitie editten voor sync. Bij sync wordt het integraal als deal-note gepost.

### 5.3 Stap 3 — Sync resultaat

**Loading state**: per Pipedrive-call een check-step (dedupe → org → persons → deal → notitie). Spin op huidige stap, ✓ op gedane.

**Success state**: 5 deeplinks naar Pipedrive (org, persons × N, deal). "Nieuwe lead" + "Naar overzicht" knoppen.

**Dedupe-state** (status=`duplicate`): yellow card met bedrijfs-info (eigenaar, pipeline, # deals laatste 6m), 3 knoppen:
- Open bestaande in Pipedrive ↗
- Toch nieuwe deal aanmaken (rood, vereist user-bevestiging in dezelfde sessie → POST met `{force_duplicate: true}`)
- Annuleren → terug naar stap 2

**Mid-flow-faal-state**: toont welke entiteiten al aangemaakt zijn (org_id, person_ids zichtbaar), "Hervatten"-knop roept hetzelfde sync-endpoint nogmaals; idempotency op DB-state.

### 5.4 Run-historie (`/sales/lead-verrijking`)

Tabel met kolommen: Status (badge) · Bedrijf (naam + domein) · Dealeigenaar · KvK · Aangemaakt (relatieve tijd + creator) · Pipedrive (deeplink of —) · Acties (👁 view / hervat).

Filters bovenaan: zoek (bedrijfsnaam/domein, ILIKE), status-select, dealeigenaar-select, datumrange. Pagination 25/pagina.

Klik op rij → lead-detail-page (read-only voor `completed`, hervatbaar voor `enriching`/`review`).

### 5.5 Owner-mapping (`/sales/owner-mapping`)

**Tabel** met 4 rijen, kolommen: Label · Pipedrive User · Pipeline · Default Stage · Hoofddomein · Contactmoment · Test (badge) · Acties (✎).

**Edit-modal** (cascading dropdowns, alle live van Pipedrive):
- Pipedrive User → loaded van `/api/sales-leads/pipedrive-meta/users` (TTL 1u cache)
- Pipeline → `/pipelines`
- Default Stage → `/stages?pipeline_id=X` (refresh bij pipeline-wijziging)
- Contactmoment veld → `/deal-fields?type=date` (filtert custom date-fields)
- Hoofddomein-strategy → radio (`fixed` met text-input | `auto_match_by_address`)
- Contactmoment-offset (workdays) → number-input default 1

**Test config-knop**: roept composite-check endpoint aan dat user/pipeline/stage/deal-field bestaan + matchen. Resultaat = ✓ valid badge of rood error per veld.

**Top-banner**: "⚠ Tijdelijke fallback: Rico is geen actieve Pipedrive-user. Drie deals worden tijdelijk onder LokaleBanen-account aangemaakt." (toont zolang ≥1 owner_config een afwijkende user_id heeft.)

## 6. Backend services

Locatie: `apps/admin/lib/services/sales-leads/`.

### 6.1 Service-laag

| Service | Methodes | Verantwoordelijkheid |
|---|---|---|
| `KvkService` | `searchByName(name)`, `searchByDomain(d)`, `getBasisprofiel(kvk)`, `enrichByDomain(d)`, `health()` | KvK Zoeken v2 + Basisprofiel v1, cache 7d |
| `MapsService` | `findPlace(domain, name?)`, `getPlaceDetails(place_id)`, `health()` | Google Places Find Place + Details, cache 30d |
| `ApolloService` | `enrichOrganization(domain)`, `matchPerson(input)`, `searchContactsByDomain(d)`, `health()` | Apollo direct API, cache org 24u |
| `WebsiteService` | `crawlAndParse(url, scrapeVacancies)`, `discoverCareerPage(domain)` | Fetch homepage + page-discovery (zie 6.6), HTML→Markdown, Mistral extract |
| `MistralService` | `extractFromMarkdown(md, prompt)`, `rankContacts(contacts, master)` | Mistral chat completion. Bestaande Mistral-calls in scrapers (`/api/scrapers/baanindebuurt`, `/api/scrapers/debanensite`) zijn referentie-pattern; nieuwe service consolideert deze in `lib/services/sales-leads/mistral.service.ts` |
| `PipedriveMetaService` | `getUsers()`, `getPipelines()`, `getStages(pipelineId)`, `getDateDealFields()`, `testConfig(config)` | Read-only Pipedrive metadata, cache 1u |
| `PlatformMatcherService` | `matchByCity(city)`, `matchByPostcode(pc)` | Address → Hoofddomein-platform via bestaande `regio_platforms` + `central_places` tabellen |
| `EnrichmentOrchestratorService` | `runEnrichment(runId)` | Fan-out naar 4 services, jsonb_set updates, Mistral ranking, master_record voorvulling |
| `PipedriveSyncService` | `syncLeadToPipedrive(runId, forceDuplicate?)` | Dedupe + create org/persons/deal/note, idempotent |

### 6.2 SBI → Branche-enum mapping

Hard-coded constant in `lib/constants/sbi-mapping.ts`:

```ts
// Eerste 2 digits SBI → Pipedrive Branche enum-id
export const SBI_TO_BRANCHE: Record<string, number> = {
  // 41-43 = Bouw
  '41': 54, '42': 54, '43': 54,    // → 'Bouw + gerelateerd'
  // 45 = autohandel/reparatie
  '45': 53,                         // → 'Automotive'
  // 46-47 = handel
  '46': 55, '47': 55,               // → 'Detailhandel, groothandel en ambachten'
  // 55-56 = horeca
  '55': 56, '56': 56,               // → 'Horeca & ...'
  // 70 = adviesbureaus → Apollo branche-fallback
  // ...volledige tabel in code
}
```

Bij conflict tussen KvK SBI en Apollo `industry`: **Apollo wint** voor de master_record-veld (Apollo is sales-relevanter). KvK SBI komt in de notitie (zichtbaar in UI met discrepantie-warning).

### 6.3 Concurrency in `enrichments` jsonb

Elke per-bron-update gaat via `jsonb_set` met row-lock:

```sql
UPDATE sales_lead_runs
SET enrichments = jsonb_set(enrichments, '{kvk}', $1::jsonb),
    updated_at = now()
WHERE id = $2;
```

Postgres serialiseert UPDATEs op dezelfde rij — geen lost updates. Audit-log appendable via `audit_log = audit_log || $1::jsonb`.

### 6.4 Primaire-bron prioriteit (`computePrimaryMaster`)

Per veld de standaard-bron waarop UI initieel staat (user kan altijd switchen via bron-pill):

| Veld | Primair | 2e fallback | 3e fallback |
|---|---|---|---|
| `company_name` | KvK statutaireNaam | Apollo | Website |
| `kvk_number` | KvK | – | – |
| `address` | Google Maps | KvK | Website |
| `phone` | KvK hoofdvestiging | Apollo `sanitized_phone` | Website |
| `email` | KvK hoofdvestiging | Website | – |
| `website` | (input URL) | Apollo | KvK |
| `industry` | Apollo | KvK SBI→branche-mapping | – |
| `employee_count` | KvK `totaalWerkzamePersonen` | Apollo `estimated_num_employees` | – |
| `description` | Apollo `short_description` | Website | – |
| `coordinates` | Google Maps | KvK `geoData` | – |
| `linkedin_url` (org) | Apollo | – | – |
| `founded_year` | KvK `formeleRegistratiedatum` (jaar) | Apollo | – |
| `legal_form` | KvK `eigenaar.rechtsvorm` | – | – |

**Conflict-resolutie** voor `industry`: bij KvK SBI-branche ≠ Apollo industry → Apollo wint voor master_record (sales-relevanter), KvK SBI in deal-notitie. Discrepantie zichtbaar in UI (sectie 5.2.2).

### 6.5 Career-page discovery (in WebsiteService)

Voor het vinden van de werkenbij/vacatures-pagina volgen we deze fallback-keten — elke stap stopt bij eerste hit:

```
1. /sitemap.xml            ← parse, zoek <loc> met /werkenbij /vacatures /careers /jobs
2. /robots.txt             ← regel "Sitemap:" → fetch + parse als boven
3. Common paths (HEAD-call):
     /werkenbij /werken-bij /vacatures /vacature
     /careers /career /jobs /job
     /werken-bij-ons /jobs-careers /carriere
     /over-ons/vacatures /werken /team/vacatures
4. Homepage HTML link-detection (Mistral hint):
     scan <a> tags op tekst "vacatures", "werken bij", "carrière", "jobs", "join"
     filter: href op zelfde domein, niet generic terms
```

Resultaat → `NormalizedFields.career_page_url` + `career_page_method`. Bij hit wordt deze pagina gefetcht, geparsed met Mistral, en vacatures landen in `parsed.vacancies[]`.

**Edge cases:**
- Sitemap.xml is een index (`<sitemapindex>`) → fetch sub-sitemaps tot max 3 niveaus diep
- Sitemap > 5 MB → skip (te groot, fall-through naar common paths)
- Career-page is een externe ATS (greenhouse.io / lever.co / personio) → URL opslaan + flag `career_page_external=true` (V2 ATS-specific scrapers)
- Geen werkenbij gevonden → `career_page_url=null`, geen vacatures, run gaat door

### 6.6 Foutscenario's per bron

| Bron | Error | Strategie |
|---|---|---|
| KvK | 404 niet gevonden | enrichment.status='not_found', run gaat door |
| KvK | 429 rate-limit | exp. backoff 3× (1s/4s/9s), dan failed |
| KvK | 401 invalid key | enrichment.status='failed' + Slack alert (CATASTROFAAL) |
| Maps | 0 resultaten | enrichment.status='not_found' |
| Apollo | 422 niet gevonden | enrichment.status='not_found' |
| Apollo | 403 API_INACCESSIBLE | enrichment.status='failed' + Slack alert + run gaat door op andere bronnen |
| Apollo | 429 credits-op | Slack alert + run.error gezet |
| Website | 4xx/5xx / SSRF block | enrichment.status='failed', run gaat door |
| Mistral | rate-limit | retry 2× backoff; bij faal: top-2 = eerste 2 contacten alfabetisch |

**Cruciale invariant**: zolang ≥1 bron `completed` of `not_found` is, gaat run door naar `review`. Pas als **alle 4** `failed`/`not_found` zijn met 0 data → run.status='failed'.

## 7. AI prompts

Locatie: `apps/admin/lib/services/sales-leads/prompts/`. Versioned files (`website-extraction.v1.md`, `contact-ranking.v1.md`).

### 7.1 Website-extraction (Mistral, prompt v1)

Input: gecombineerde markdown van max 7 pagina's (homepage, /over-ons, /team, /contact, /werkenbij, /vacatures, /diensten). Truncate op 30k tokens.

```
Je bent een data-extractor voor B2B sales lead-verrijking. Je krijgt de markdown-versie
van pagina's van een Nederlandse bedrijfswebsite. Extracteer feitelijke data.

Pagina's:
<<<
{markdown_per_page}
>>>

Geef ALLEEN geldig JSON terug, geen prose:
{
  "company_name": string|null,
  "description_short": string|null,
  "address": { "street","number","postcode","city" } | null,
  "phones": string[],
  "emails": string[],
  "kvk_number": string|null,
  "social_media": { "linkedin","instagram","tiktok","facebook","twitter" }|null,
  "contacts": [{
    "name": string, "title": string|null,
    "email": string|null, "phone": string|null,
    "linkedin_url": string|null,
    "department_guess": "executive"|"human_resources"|"operations"|"sales"|"marketing"|"other"|null,
    "source_page": string
  }],
  "vacancies": [{ "title": string, "url": string|null, "location": string|null }],
  "blog_post_count": number|null,
  "blog_last_post_date": string|null
}

REGELS:
- Verzin niets — alleen wat letterlijk in de pagina's staat
- Voor /over-ons of /team: extract iedereen met naam+functie, ook stagiairs
- Voor /werkenbij of /vacatures: extract alle vacaturetitels + URLs
- Mobiele telefoon (06): zet in phone als duidelijk persoonlijk; anders bedrijfs-vast
- Emails: alleen geldige formaten, geen "info@example.com"-placeholders
```

### 7.2 Contact-ranking (Mistral, prompt v1)

Input: gecombineerde lijst contacten uit website + Apollo (deduplication op naam-match), plus master_record context (industry, employee_count).

```
Je bent een B2B sales-strategie expert voor Nederlandse jobmarketing-bureau WeTarget.

TAAK: kies de 2 BESTE contactpersonen uit de lijst hieronder om als eerste te benaderen.

KANDIDATEN:
{json_array_of_contacts_with_metadata}

CONTEXT:
- Bedrijf: {company_name}, branche: {industry}, grootte: {employee_count} medewerkers
- Departement-distributie: {departmental_head_count_apollo}

PRIORITEIT (hoogste eerst):
0. Eigenaar / oprichter / founder
1. CEO / Algemeen Directeur / General Manager
2. HR Manager / HR Director
3. COO / Operations Manager / Procesmanager
4. HR Medewerker / HR Specialist
5. Marketing Director / CMO

UITSLUITEN:
- Junior functies zonder beslissingsbevoegdheid
- Stagiairs / werkstudenten
- Receptie / administratie

REGELS:
1. Selecteer 2 verschillende personen, bij voorkeur verschillende functies/afdelingen
2. Bij gelijke prioriteit: kies hogere seniority + verified email + LinkedIn aanwezig
3. Als maar 1 persoon past: vul person_2 met null
4. Als NIEMAND past maar er zijn contacten: kies de 2 hoogsten in rang met email
5. Als de lijst leeg is: retourneer beide null

Geef ALLEEN JSON terug:
{
  "person_1": { "name": string, "score": 0-100, "reason": "1-zin reden" } | null,
  "person_2": { "name": string, "score": 0-100, "reason": "1-zin reden" } | null,
  "fallback_used": boolean
}
```

## 8. Pipedrive sync (Stap 3)

### 8.1 Sync-volgorde

```ts
async function syncLeadToPipedrive(runId, force_duplicate=false) {
  const run = await loadRun(runId)
  const config = await loadOwnerConfig(run.owner_config_id)

  // 1. Dedupe (skip bij force)
  if (!force_duplicate) {
    const existing = await pipedrive.searchByDomainAndName(run.input_domain, run.master_record.company_name)
    if (existing) {
      await updateRun(runId, { status: 'duplicate', existing_pipedrive_org_id: existing.id })
      return { duplicate: true, existing }
    }
  }

  await updateRun(runId, { status: 'syncing' })

  // 2-5. Idempotent — skip al-aangemaakte stappen op DB-state
  if (!run.pipedrive_org_id) {
    const org = await pipedrive.createOrganization(buildOrgPayload(run, config))
    await updateRun(runId, { pipedrive_org_id: org.id })
  }

  for (const contact of run.selected_contacts) {
    if (!contact.pipedrive_person_id) {
      const person = await pipedrive.createPerson(buildPersonPayload(contact, run.pipedrive_org_id))
      await persistPersonId(runId, contact.name, person.id)
    }
  }

  if (!run.pipedrive_deal_id) {
    const deal = await pipedrive.createDealV2(buildDealPayload(run, config))
    await updateRun(runId, { pipedrive_deal_id: deal.id })
  }

  if (run.master_record.deal_note_text) {
    await pipedrive.addNoteToDeal(run.pipedrive_deal_id, run.master_record.deal_note_text)
  }

  // 6. Persisteer in interne `companies` + `job_postings` (V1 — voor latere monitoring)
  const company = await upsertCompanyFromRun(run)         // matcht op domain, anders insert
  if (run.master_record.career_page_url) {
    await upsertCompanyCareerSource(company.id, {
      url: run.master_record.career_page_url,
      method: run.master_record.career_page_method,
      created_via: 'sales_lead_run',
      run_id: run.id
    })
  }
  for (const v of run.master_record.vacancies ?? []) {
    if (v.url) await upsertJobPosting(company.id, v)        // dedupe op (company_id, url)
  }

  await updateRun(runId, { status: 'completed' })
}
```

**Internal-data linking** (V1):
- `companies` tabel — bestaat al; we upserten op `domain` of `kvk_number` voor dedupe; veld `pipedrive_org_id` krijgt de freshly-created Pipedrive org-id, `career_page_url` wordt gevuld als gevonden
- `job_postings` tabel — bestaat al; we upserten gevonden vacatures met `source = 'sales_lead_career_scrape'` en linking naar `company_id`. Voorkomt dat dezelfde vacature later via baanindebuurt/debanensite-scrapers dubbel wordt opgeslagen (bestaande dedupe-logica op title+company)
- `company_career_sources` — **nieuwe tabel** (sectie 17) registreert de career-page-URL per bedrijf voor latere recurring monitoring

### 8.2 Pipedrive payloads

**Organization (`POST /api/v1/organizations`)** — gebruikt v1 want bestaande `pipedrive-client.ts` werkt op v1:
```json
{
  "name": "WeTarget B.V.",
  "owner_id": 22971285,
  "address": "Slotenmakerstraat 60, 2672GD Naaldwijk",
  "1e887677": "87886022",
  "f249147e": "+31 174 257 221",
  "4811ae7e": "info@wetarget.nl",
  "79f6688e": "https://www.wetarget.nl",
  "f68e6051": 222,                    /* Bedrijfsgrootte enum-id 'Klein <10' */
  "75a7b463": <branche_enum_id>,       /* Branche */
  "7180a712": <hoofddomein_enum_id>,   /* Hoofddomein */
  "a92798b0": <wetarget_enum_id>       /* WeTarget enum: 265=Ja bij Dean/Rico WeTarget, 301=Nee bij Rico LB/WIA */
}
```

**Person (`POST /api/v1/persons`)**:
```json
{
  "name": "Bart van der Klaauw",
  "org_id": <org_id>,
  "owner_id": <config.pipedrive_user_id>,
  "email": [{ "value": "bart@wetarget.nl", "primary": true }],
  "phone": [{ "value": "+31612345678", "primary": true, "label": "mobile" }],
  "eff8a336": "Eigenaar",              /* Functie */
  "275274fd": "https://linkedin.com/in/..."  /* Linkedin */
}
```

**Deal (`POST /api/v2/deals`)** — v2 omdat we daar `custom_fields`-object support hebben:
```json
{
  "title": "WeTarget B.V. — 2026-05-04",
  "owner_id": 22971285,
  "person_id": <person_id_primair>,
  "org_id": <org_id>,
  "pipeline_id": 11,
  "stage_id": 66,
  "value": 0,
  "currency": "EUR",
  "visible_to": "3",
  "custom_fields": {
    "6b624a58761cbbd7a95363c1a5c969daa172563c": "2026-05-05"  /* WeTarget Contactmoment */
  }
}
```

`person_id` = ID van het hoogst-gerangschikte contact. Tweede contact wordt later als `participant` toegevoegd via `POST /api/v1/deals/{id}/participants`.

**Notitie (`POST /api/v1/notes`)**:
```json
{
  "content": "<markdown van master_record.deal_note_text>",
  "deal_id": <deal_id>
}
```

### 8.3 Contactmoment-berekening

```ts
function nextWorkday(from: Date, offset_workdays: number): string {
  let d = new Date(from)
  let added = 0
  while (added < offset_workdays) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) added++
  }
  return d.toISOString().split('T')[0]    // YYYY-MM-DD
}
```

Per `owner_config.contactmoment_offset_workdays`. Default 1 (volgende werkdag, conform klant brief).

## 9. API-routes

Alle routes in `apps/admin/app/api/sales-leads/`. Alle achter `withAuth` middleware.

| Route | Method | Doel | Body / Response |
|---|---|---|---|
| `/api/sales-leads` | GET | Run-lijst met filters/zoeken | `?status&owner&search&page&limit` → `{runs[], total}` |
| `/api/sales-leads/create` | POST | Stap 1 submit | `{input_url, owner_config_id, manual_vacancies, scrape_vacancies, force_recreate?}` → `{run_id}` of `409 {recent_run_id}` als duplicaat-binnen-24u zonder force |
| `/api/sales-leads/{id}` | GET | Stap 2 polling — run-detail | → `{run, enrichments, master_record, selected_contacts, status}` |
| `/api/sales-leads/{id}` | PATCH | Master record updates (debounced) | `{master_record?, selected_contacts?}` → `{ok}` |
| `/api/sales-leads/{id}/sync-pipedrive` | POST | Stap 3 trigger | `{force_duplicate?: boolean}` → `{org_id, deal_id, person_ids, status}` |
| `/api/sales-leads/{id}/cancel` | POST | Annuleer concept-run | → `{ok}` |
| `/api/sales-leads/pipedrive-meta/users` | GET | Owner-config dropdown | → `[{id,name,email,active_flag}]` |
| `/api/sales-leads/pipedrive-meta/pipelines` | GET | idem | → `[{id,name,active}]` |
| `/api/sales-leads/pipedrive-meta/stages` | GET | `?pipeline_id=X` | → `[{id,name,order_nr}]` |
| `/api/sales-leads/pipedrive-meta/deal-fields` | GET | `?type=date` | → `[{key,name,field_type}]` |
| `/api/sales-leads/owner-config` | GET, POST, PATCH | superadmin-only | CRUD op owner_config |
| `/api/sales-leads/owner-config/{id}/test` | POST | Valideer config tegen Pipedrive | → `{user_ok, pipeline_ok, stage_ok, field_ok, errors[]}` |
| `/api/sales-leads/health` | GET | superadmin — health van alle bronnen | → `{kvk,maps,apollo,pipedrive,mistral}` |
| `/api/cron/sales-leads-retention` | POST | Vercel Cron `0 4 * * *` | NULL'en oude raw responses + audit_log |

## 10. Error handling, observability, monitoring

### 10.1 Audit log

`sales_lead_runs.audit_log` jsonb-array. Per service-call 1 entry:
```ts
{
  ts: string                  // ISO
  source: 'kvk' | 'google_maps' | 'apollo' | 'website' | 'mistral' | 'pipedrive'
  endpoint: string
  duration_ms: number
  status: 'ok' | 'failed' | 'rate_limited' | 'cached'
  http_status?: number
  error?: string
  cost_credits?: number       // alleen Apollo
}
```

### 10.2 Slack alerts (hergebruik bestaande `lib/slack`)

Triggers (alleen catastrofaal):
- Apollo `error_code: 'API_INACCESSIBLE'`
- Apollo 429 met `retry-after > 60s`
- KvK 401 invalid key
- Pipedrive `PipedriveDailyLimitError`
- ≥3 sequentiële `runs.status='failed'` in 10 min

Alert-format: `🚨 Sales Lead Automation` + type + run-deeplink + suggested action.

### 10.3 Health-check endpoint

`GET /api/sales-leads/health` retourneert per bron `{ok, latency_ms, message?, credits_remaining?}`. Dashboard widget op `/sales/lead-verrijking` polled elke 5 min.

### 10.4 Cost-dashboard (binnen Lead Verrijking)

Sub-tab "Statistieken":
- Apollo credits-verbruik per dag (laatste 30d), per dealeigenaar
- KvK calls per dag + cache-hit-rate
- Mistral tokens per dag

Bron: `audit_log` aggregaties.

### 10.5 Data retention

| Data | TTL | Mechanisme |
|---|---|---|
| `enrichments.{*}.raw` | 30 dagen | Nightly cron NULL'en |
| `audit_log` | 90 dagen | idem (filter op ts) |
| `runs` zelf | onbeperkt | sales-historie |
| `enrichment_cache` | source-specifiek (1u-30d) | `expires_at` + cleanup-cron |

Cron-endpoint: `/api/cron/sales-leads-retention` via Vercel Cron `0 4 * * *`.

### 10.6 Sentry

Bestaande Sentry-setup in `apps/admin`. Breadcrumbs `category: 'sales-leads'`. Geen aparte project.

## 11. Security & permissions

### 11.1 RLS

Alle 3 tabellen RLS aan, **geen policies** (= service-role-only). API-routes gebruiken `createServiceRoleClient`. Geen directe Supabase-calls vanuit browser.

Validatie: na migration `mcp__supabase__get_advisors` → moet clean zijn (geen "RLS disabled"-warnings).

### 11.2 Auth

Alle `/api/sales-leads/*` via bestaande `withAuth`. `auth.user.id` → `runs.created_by`.

| Route-tier | Rol |
|---|---|
| `/sales/lead-verrijking/*`, `POST create/sync/cancel`, `GET pipedrive-meta/*` | authenticated admin |
| `/sales/owner-mapping`, `POST/PATCH owner-config`, `GET health` | **superadmin** |

Implementatie superadmin-check: bestaand rol-mechanisme onderzoeken bij start fase 2; fallback `SALES_ADMIN_USER_IDS` env-allowlist.

### 11.3 Secrets

Alle in Vercel Env Variables (productie + preview).

| Secret | Status |
|---|---|
| `KVK_API_KEY` | gezet (productie-key, geverifieerd 2026-05-04) |
| `KVK_API_BASE_URL` | `https://api.kvk.nl/api` |
| `APOLLO_API_KEY` | gezet (master-key, geverifieerd 2026-05-04) |
| `APOLLO_API_BASE_URL` | `https://api.apollo.io/api/v1` |
| `MISTRAL_API_KEY` | bestaand |
| `PIPEDRIVE_API_KEY` | bestaand |
| `GOOGLE_MAPS_API_KEY` | **TODO Kenny — GCP project + Places API enabled** |

Geen `NEXT_PUBLIC_*` voor deze keys. Health-check returnt alleen `{ok}` booleans + latency, nooit keys terug.

Logs maskeren API-keys in audit_log (alleen domein/endpoint/status).

### 11.4 Abuse-protection

**Rate-limit** op `POST /create`:
- 30/uur per user, 200/dag per user
- Implementatie: `SELECT count(*) FROM sales_lead_runs WHERE created_by=$1 AND created_at > now() - interval '1 hour'` (DB-count is voldoende voor schaal)

**Domein-validatie** vóór run-creatie:
- Reject publieke vrije-email-domeinen (gmail.com, hotmail.com, outlook.com, yahoo.com, …)
- Reject als domein recent een `completed`-run heeft (<24u) — kan via "force"-flag overruled worden

**SSRF-protection** in WebsiteService:
- Alleen public DNS — block `127.0.0.1`, `localhost`, `169.254.*`, `10.*`, `172.16-31.*`, `192.168.*`
- Max redirect-chain: 5
- Max body size: 5 MB per pagina, 30 MB totaal
- Timeout: 15s per request

### 11.5 Pipedrive write-acties

Altijd dedupe-check vóór create (klant brief expliciet). `force_duplicate=true` vereist dat dezelfde user (zelfde sessie, zelfde `run_id`) de force-call doet — geen blind-retry.

### 11.6 Penetratie-checklist (handmatig vóór go-live)

- [ ] Auth-cookie weglaten op alle `/api/sales-leads/*` → 401
- [ ] Andere user's run_id in path → 403/404
- [ ] Reguliere admin → owner-config endpoint → 403
- [ ] input_url = `http://localhost:3000/admin` → SSRF blocked
- [ ] input_url = `https://192.168.1.1/` → SSRF blocked
- [ ] `force_duplicate` cross-session → faal
- [ ] 31 runs/uur door 1 user → 31e geweigerd

## 12. Implementatie-roadmap

### Fase 1 — Foundation (~0.5-1d)
- 4 migrations: `sales_lead_runs`, `sales_lead_owner_config`, `enrichment_cache`, `company_career_sources`
- TypeScript types via `mcp__supabase__generate_typescript_types`
- `get_advisors` clean
- Sidebar refactor → Sales parent + verplaats Campaign Assignment + Blocklist + Instantly Sync eronder
- Lege routes `/sales/lead-verrijking` en `/sales/owner-mapping` (placeholder)
- Seed `sales_lead_owner_config` met 4 rows (Dean → 26007186 + Rico × 3 → 22971285 fallback)

### Fase 2 — Owner-mapping (~1-1.5d)
- `PipedriveMetaService` met `enrichment_cache` (source `pipedrive_meta`)
- 4 metadata API-routes (users / pipelines / stages / deal-fields)
- `/api/sales-leads/owner-config` CRUD (superadmin)
- `/api/sales-leads/owner-config/{id}/test` validatie-endpoint
- UI `/sales/owner-mapping` met edit-modal, cascading dropdowns, "Test config"

### Fase 3 — Per-bron services (~3-4d, parallelliseerbaar)
**3a — KvkService** (1d): zoek + basisprofiel + cache + SBI-mapping constant + health + unit-tests + 1 live-integratietest op `wetarget.nl`
**3b — MapsService** (0.5d): findPlace + placeDetails + cache
**3c — ApolloService** (1d): enrichOrg + matchPerson + searchContactsByDomain + cache + cost-tracking
**3d — WebsiteService** (1.5d): SSRF-safe fetch + page-detection (homepage/over-ons/team/contact/werkenbij/vacatures/diensten) + HTML→Markdown + Mistral prompt v1 + extraction → NormalizedFields

### Fase 4 — Orchestrator + Stap 1+2 UI (~2-3d)
- `EnrichmentOrchestratorService.runEnrichment()` met fan-out + jsonb_set updates
- `MistralService.rankContacts()` (prompt v2)
- API-routes: `POST create`, `GET {id}`, `PATCH {id}`
- `useSalesLeadRun(id)` SWR-hook met polling (1.5s, auto-stop bij completion)
- UI Stap 1: form + zod-validatie
- UI Stap 2: source-grid + per-bron detail-panels + master record + AI-contacten + auto-notitie
- Bron-discrepantie-detectie + warnings

### Fase 5 — Stap 3 + Pipedrive sync (~1.5-2d)
- `PipedriveSyncService` (nieuw, los van bestaande `pipedrive-sync.service.ts`)
- Idempotent create-org/persons/deal/note
- `PlatformMatcherService` (adres → Hoofddomein via bestaande `regio_platforms`)
- API: `POST /sync-pipedrive`
- UI Stap 3: loading, success, dedupe-warning, mid-flow-faal "Hervat"
- **Internal-data sync** (sectie 8.1 onderkant): upsert `companies` + insert `company_career_sources` + insert `job_postings` rows voor gevonden vacatures (V1-onderdeel; V2 cron in aparte spec)

### Fase 6 — Run-historie + dashboards (~1d)
- `/sales/lead-verrijking` lijst met filters + zoeken + pagination
- Sub-tab "Statistieken" met cost-dashboards
- Health-check endpoint + dashboard widget
- Resume voor concept-runs

### Fase 7 — Hardening (~1d)
- `get_advisors` finale check
- Slack alert-functies + 4 trigger-condities
- Vercel Cron retention `0 4 * * *`
- Rate-limit middleware op create
- Penetratie-checklist (zie 11.6)
- Sentry breadcrumbs `sales-leads`

**Totaal**: ~10-12 werkdagen, parallelliseerbaar in fase 3 naar 7-9d.

## 13. Test-piramide

| Laag | Coverage-doel | Tooling |
|---|---|---|
| Unit (services, helpers, prompts-shape) | 80% | Vitest + msw |
| API integration (route handlers, mocked DB+externe API's) | happy + 2 sad paths per route | Vitest + msw |
| E2E smoke (input → sync, single happy path) | 1 test op staging | Playwright |
| Live integration (echte KvK/Apollo/Maps calls) | 1 health-check, dev-only via `RUN_LIVE_TESTS=1` | Vitest tagged `@live` |

CI-gate: unit + integration moeten groen voor merge. Live alleen handmatig vóór releases.

### Definition of Done per fase
1. Code merged + groene tests
2. `get_advisors` clean (na DB-changes)
3. Manuele smoke-test in dev/staging met echt domein
4. Foutscenario's getest (1 bron offline, dedupe-hit, force_duplicate)

## 14. Backwards compatibility

- Bestaande `/api/apollo/enrich-selected` (webhook-based, OTIS Apify-flow) blijft **ongewijzigd**. Nieuwe directe Apollo API draait er parallel naast (eigen service-class).
- Bestaande `pipedrive-sync.service.ts` blijft voor OTIS-flow; nieuwe `sales-leads/PipedriveSyncService` is aparte service met andere semantiek (manuele lead vs scrape-batch).
- Sidebar-refactor: bestaande deeplinks naar `/campaign-assignment`, `/blocklist`, `/instantly-sync` blijven werken (groepering toevoegen verandert URLs niet).

## 15. Open vragen / dependencies

| # | Vraag | Owner | Voor fase |
|---|---|---|---|
| 1 | Google Maps API-key aanvragen (GCP project, Places API enabled) | Kenny | 3b |
| 2 | Apollo plan upgrade voor `/people/search`? Nu werken we met `/people/match` per-naam. | Kenny | optioneel — nice-to-have voor V2 |
| 3 | Rico als Pipedrive-user toevoegen — daarna `owner_config` updaten | Kenny | post-launch |
| 4 | Bestaand "superadmin"-rolmechanisme — bevestigen of via env-allowlist | Kenny | 2 |
| 5 | SBI → Branche-enum mapping — eerste versie door dev, validatie door Kenny | Kenny review | 3a |

## 16. Referenties

- `docs/superpowers/specs/research/2026-05-04-kvk-api-research.md` — KvK API endpoints, fields, mapping op Pipedrive custom fields
- `docs/superpowers/specs/research/2026-05-04-apollo-api-research.md` — Apollo API endpoints, plan-limitaties, NL-specifieke datakwaliteit
- Mockup: `.superpowers/brainstorm/69053-1777899997/content/full-mockup-v2.html` — visueel referentie voor stap 2 (per-bron details + bestemming-pills)
- Klant brief (Kay/Dean): in chat-history 2026-05-04
- Pipedrive custom fields (huidige config): geverifieerd via API 2026-05-04 — Hoofddomein `7180a712`, Subdomein `2a8e7ff6`, WeTarget `a92798b0`, Branche `75a7b463`/`5a467ae0`, Bedrijfsgrootte `f68e6051`, KvK-nummer `1e887677`, Telefoon `f249147e`, E-mail `4811ae7e`, Website `79f6688e`, Functie (person) `eff8a336`, Linkedin (person) `275274fd`, WeTarget Contactmoment (deal) `6b624a58761cbbd7a95363c1a5c969daa172563c`, LokaleBanen Contactmoment (deal) `62bfdd211c39219e11e25e7f770c…`
- Pipelines: Dean WeTarget (5, start-stage 22 "Prospect") · Rico WIA (9, start-stage 57 "Nieuwe bedrijven") · Rico LokaleBanen (10, start-stage 59) · Rico WeTarget (11, start-stage 66)

## 17. Future extension — Recurring career-page monitoring (V2)

**Doel**: zodra een sales-lead-run een werkenbij-pagina heeft ontdekt, blijven we die periodiek scrapen om nieuwe vacatures van dat bedrijf in onze `job_postings` te krijgen, gekoppeld aan het bedrijf én (waar relevant) de Pipedrive-deal.

### 17.1 Scope V1 vs V2

**V1 (in deze spec opgenomen):**
- Discovery + 1× initiële scrape gebeurt al binnen Sales Lead Automation (sectie 6.5)
- Vacatures worden bij sync opgeslagen in `job_postings` (sectie 8.1)
- `company_career_sources` rij wordt aangemaakt — wordt nog niet gescrapet door cron

**V2 (volgt op V1, aparte spec):**
- Vercel Cron job die `company_career_sources WHERE is_active=true` periodiek opnieuw scrapet
- Alerting bij nieuwe vacatures (bv ingesproken in bestaande Slack-alerts of Pipedrive-deal-notitie-update)
- UI in `/sales/lead-verrijking/{run_id}` die de scrape-historie van het bedrijf toont
- ATS-specific scrapers (Greenhouse, Lever, Personio, Recruitee) wanneer `career_page_external=true`

### 17.2 Data model V2 (nieuwe tabel — al voorbereid in V1)

```sql
CREATE TABLE company_career_sources (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url                 text NOT NULL,                                  -- bv https://wetarget.nl/werkenbij
  discovery_method    text NOT NULL CHECK (discovery_method IN ('sitemap','robots','common_path','html_link','manual')),
  is_external_ats     boolean NOT NULL DEFAULT false,                 -- greenhouse / lever / personio
  ats_type            text,                                            -- 'greenhouse' | 'lever' | 'personio' | 'recruitee' | null

  -- Monitoring (V2 cron-driven)
  is_active           boolean NOT NULL DEFAULT true,
  scrape_frequency    text NOT NULL DEFAULT 'weekly'
                      CHECK (scrape_frequency IN ('daily','weekly','monthly','manual')),
  last_scraped_at     timestamptz,
  last_scrape_status  text,                                            -- 'ok' | 'failed' | 'no_changes'
  last_scrape_count   int,                                             -- # vacatures gevonden
  consecutive_failures int NOT NULL DEFAULT 0,

  -- Provenance
  created_via         text NOT NULL CHECK (created_via IN ('sales_lead_run','manual','admin_bulk_import')),
  source_run_id       uuid REFERENCES sales_lead_runs(id),

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, url)
);
CREATE INDEX idx_company_career_sources_active_next ON company_career_sources(scrape_frequency, last_scraped_at) WHERE is_active;
```

**Belangrijk:** deze tabel komt al in **fase 1 of 5 van V1** zodat (a) bij sync-tijd de career-source-rij aangemaakt kan worden, en (b) we niet later een datamigratie hoeven te doen om bestaande runs te backfillen. Alleen het cron-deel + UI komt in V2.

### 17.3 V2 Cron-architectuur (schets)

Volgt bestaand patroon van `/api/scrapers/baanindebuurt` en `/api/scrapers/debanensite`:

```
Vercel Cron — daily 0 5 * * * (UTC) → /api/scrapers/career-pages

Orchestrator endpoint:
  1. Selecteer career_sources met scrape_frequency='daily' OR
     scrape_frequency='weekly' AND last_scraped_at < now() - 7d OR
     scrape_frequency='monthly' AND last_scraped_at < now() - 30d
  2. Voor elke source: spawn worker via HTTP fan-out
     (zoals campaign-assignment-parallel pattern)

Worker endpoint /api/scrapers/career-page-worker:
  - Fetch URL via WebsiteService.crawlAndParse
  - Extract vacatures via Mistral
  - Upsert job_postings (dedupe op company_id + title + url)
  - Update company_career_sources.last_scraped_at + last_scrape_status + last_scrape_count
  - Bij ≥3 consecutive failures: is_active=false + Slack alert
```

### 17.4 ATS-detectie

Bij V1 al detecteren (en flag opslaan) zodat V2 weet welke scraper te gebruiken:

```ts
// In WebsiteService.discoverCareerPage
function detectATS(url: URL): { is_external: boolean; ats_type?: string } {
  const host = url.hostname
  if (host.includes('greenhouse.io')) return { is_external: true, ats_type: 'greenhouse' }
  if (host.includes('lever.co'))      return { is_external: true, ats_type: 'lever' }
  if (host.includes('personio.de'))   return { is_external: true, ats_type: 'personio' }
  if (host.includes('recruitee.com')) return { is_external: true, ats_type: 'recruitee' }
  if (host.includes('homerun.co'))    return { is_external: true, ats_type: 'homerun' }
  return { is_external: false }
}
```

Voor V1 markeren we deze als `is_external_ats=true` maar scrapen ze nog gewoon via Mistral (werkt redelijk voor de meeste ATS-frontends). V2 kan optimaliseren met ATS-specifieke API's (de meeste hebben publieke job-list endpoints).

### 17.5 V2 effort-schatting

~3-5 werkdagen voor cron + worker + dedupe + UI uitbreiding. Aparte spec wanneer V1 stable is.
