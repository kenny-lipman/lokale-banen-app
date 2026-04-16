# Task 4 — Branding & UI Rollout Plan

**Auteur**: Claude (CTO-modus)
**Datum**: 2026-04-15
**Status**: Ter goedkeuring door Kenny
**Scope**: Van 58 losse logo's + 12 hexcode-opgaves + design prototype naar een productie-waardige, rustig uitrolbare multi-tenant vacature-site voor 24+ live portalen.

---

## Beslissingen door Kenny (2026-04-15)

| # | Vraag | Antwoord | Effect op plan |
|---|-------|----------|----------------|
| 1 | Domein-swaps live? | **Nog geen domein live** | Typo-fixes zijn risicoloos. Geen 301-redirects nodig. Fase 0 simpeler. |
| 2 | PostGIS of Haversine? | **PostGIS** | Fase 3 gebruikt `geography(Point)` + GIST-index, niet Haversine-fallback. |
| 3 | AI-enrichment budget? | **Nee, nog niks qua AI** | **Fase 4, 5, 7 ON HOLD**. Launchen met conditioneel renderen — geen salary-filter, geen thuiswerk-filter, geen gestructureerde sections in v1. Description HTML-blob blijft tijdelijk zichtbaar op detail. |

**Nieuw kritisch pad (v2)**: Fase 0 → Fase 1 → Fase 2 → Fase 3 = launch. Fase 6 (Company-enrichment, gebruikt geen AI) kan parallel. Fase 4/5/7 worden apart ingepland zodra AI-budget vrijgegeven wordt.

---

## 1. Executive summary

We hebben drie dingen tegelijk: **(a)** een berg branding-assets die nog nergens in DB/storage staat, **(b)** een goedgekeurd editorial-regional design, en **(c)** een DB die ~80% van de UI kan serveren met huidige data — de rest is backfill/enrichment.

**Mijn voorstel als CTO**: geen big-bang release. We rollen uit in **8 fases** waarbij fase 0→2 binnen 10 werkdagen een gebrande, werkende site opleveren met het nieuwe design. Enrichment (fase 4–7) loopt daarna parallel aan normale productie en verbetert de site stap voor stap. **Onmogelijke features skippen we** (CBS population, BAG-wijken, YoY, stations-afstand) tenzij een klant er expliciet om vraagt.

**Kritisch pad**: `Fase 0 → Fase 1 → Fase 2` = launchable site. Alles daarna is enrichment, niet fundament.

---

## 2. CTO-principes voor deze rollout

| # | Principe | Operationeel effect |
|---|----------|---------------------|
| 1 | **Value first, enrichment later** | Launchen met wat werkt. 1M vacatures enrichen vóór launch = we komen nooit live. |
| 2 | **Conditioneel renderen vanaf dag 1** | Elke UI-sectie checkt data-beschikbaarheid. Geen data → sectie niet in DOM (niet een lege placeholder). Dit laat features incremental aanzetten zonder deploys. |
| 3 | **Backfill in batches, monitor kosten** | AI-extractie over 1M rows = geld. Batched processing met cost-ceiling. Niet alle vacatures enrichen — alleen recent + populair + live. |
| 4 | **Elke fase is shippable** | Geen halve state op main. Feature-flags voor in-progress werk. Als fase 4 uitloopt, is fase 3 live. |
| 5 | **Meet voordat je bouwt** | Voor elke enrichment: eerst sample-analyse op 1000 rows. Pas dan schema + pipeline. Voorkomt over-engineering. |
| 6 | **Regex en gezond verstand boven AI** | Salary-parsing: probeer eerst regex (goedkoop, deterministisch, 70% hit). AI alleen voor de rest. Niet omgekeerd. |
| 7 | **Admin UI parallel, geen blocker** | Task 3 (admin wizards + image upload) loopt parallel, niet op kritisch pad. Live kan met SQL scripts + directe storage upload. |

---

## 3. Fasering — overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  KRITISCH PAD (10 werkdagen naar launchable)                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   Dag 1   Dag 2-5              Dag 6-10                               │
│   [0]  →  [1 TSX] ────────→    [2 MVP site]   ← LAUNCH               │
│              │                     ↑                                   │
│              └──→ [3 Distance]─────┘ (parallel)                       │
│                                                                        │
├──────────────────────────────────────────────────────────────────────┤
│  ENRICHMENT (parallel na launch)                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   Week 3-4   Week 4-5   Week 5-6   Week 6-7   (optioneel)            │
│   [4 Salary] [5 AI sec] [6 Company] [7 Remote] [8 Header img]        │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

| Fase | Titel | Effort | Dep op | Start-moment |
|:----:|-------|:------:|:------:|--------------|
| 0 | Foundation (DB + storage + logo-upload) | 1 dag | — | **Deze week** |
| 1 | Design-tokens + TSX-conversie | 3-4 dagen | 0 | Na 0 |
| 2 | Homepage + detail + city MVP | 4 dagen | 1 | Na 1 |
| 3 | Distance-filter + user-location | 2 dagen | 0 | Parallel met 1/2 |
| 4 | Salary-parsing + filter | 4-5 dagen | 0 | Parallel met 2 (backfill op achtergrond) |
| 5 | AI-extractie: duties/requirements/benefits | 3-4 dagen | 0 | Na 4 (deelt pipeline) |
| 6 | Company-enrichment (logo/verified/size) | 2 dagen | 0 | Parallel met 5 |
| 7 | Remote/thuiswerk-classificatie | 2 dagen | 0 | Parallel met 5/6 |
| 8 | Header images | 2 dagen | Admin task 3 (ImageUpload) | Na task 3 |

**Totale inzet**: ~24 werkdagen, maar 70% parallelliseerbaar → **wall-time ~4-5 weken** tot fase 7 live.

---

## 4. Per-fase detail

### Fase 0 — Foundation (1 dag)

**Doel**: zorgen dat het fundament klopt vóór we UI-code schrijven.

**Scope**:
- A. DB migratie: 6 platform-typos fixen (OsseBanen, LeeuwardenseBanen, NijmeegseBanen, MaassluiseBanen, VlaardingseBanen, WeerterBanen) + domein-updates. Vercel domein-mappings meteen bijwerken.
- B. DB migratie: `platforms.secondary_color` en `tertiary_color` kolommen.
- C. Storage bucket `platform-assets` verifiëren + public read policy.
- D. Upload-script: 68 portalen × (logo.svg, icon.svg indien, box.svg indien) → bucket.
- E. SQL UPDATE batch: `logo_url`, `primary_color`, `secondary_color`, `tertiary_color` per platform.
- F. Color-proposal hergenereren met **top-3 kleuren** uit SVG (niet top-2).
- G. Revalidate public-sites via bestaande `/api/revalidate`.
- H. Subagent triggeren: 15 nieuwe platforms (provincies + regio's + subbrands) aanmaken. Dit loopt parallel want het heeft geen blocker.

**Done-criteria**:
- Alle 24 live platforms tonen hun echte logo in header van hun domain.
- Alle 24 live platforms hebben `primary_color`, `secondary_color`, `tertiary_color` gezet (niet default `#0066cc`).
- Geen broken domeinen na typo-fix (handmatig check `osse banen.nl`, `leeuwardensebanen.nl`, `nijmeegsebanen.nl`).
- `.branding-staging/COLOR-PROPOSAL-V2.md` bevat 3 kleuren per portal, door Kenny gereviewed in HTML preview.

**Risico**:
- 🔴 **Domein-swaps live**: oude URL's (`osssebanen.nl`) kunnen binnenkomend verkeer hebben. **Mitigatie**: 301-redirects van oude naar nieuwe domain tijdelijk instellen, na 3 maanden uitfaseren.
- 🟡 Kleur-extractie van sommige SVGs is niet 100% accuraat (z.g. "merkkleuren" vs "logo-kleuren" verschillen). **Mitigatie**: preview-HTML, Kenny tekent af per platform.

**Open keuzes**:
- Welke URL serveren we op oude domain tijdens redirect-periode? (301 naar nieuw, of eerst een "We zijn verhuisd"-tussenpagina voor SEO-behoud?)

---

### Fase 1 — Design-tokens + TSX-conversie (3-4 dagen)

**Doel**: het HTML-prototype omzetten naar productie-TSX in `apps/public-sites/` zonder pagina's te deployen (componenten-first).

**Scope**:
- **Fonts setup** (`apps/public-sites/src/app/layout.tsx`):
  - `next/font/google` voor Newsreader (variable, display 'optional')
  - `next/font/google` voor JetBrains Mono (weight 400, 500)
  - Source Sans 3 blijft zoals het is
- **CSS variabelen uitbreiden** (`apps/public-sites/src/app/globals.css` + `src/lib/tenant.ts`):
  - Toevoegen: `--secondary`, `--secondary-ink`, `--secondary-tint`, `--secondary-dark`, `--tertiary`
  - Afgeleide kleuren runtime generen (primary-hover, primary-tint) zoals nu
  - Warme paper vars: `--bg: #FAF8F4`, `--surface: #FFFFFF`, `--text: #1A1815`
- **Tailwind config** (`tailwind.config.ts`):
  - `secondary.DEFAULT`, `secondary.foreground`, `tertiary.DEFAULT` toevoegen
  - Font-families registreren als `font-display`, `font-mono`
  - Typografie-schaal uit prototype (t-mega, t-display, t-h1, t-card)
- **Core components** bouwen/upgraden:
  - `JobCard` — rewrite met distance-chip, salary-mono, facets-divider
  - `ContextStrip` — nieuwe component (niet-hero fold-1 element)
  - `SearchBar` — 2-veld met "Wat" + "Waar", CTA rechts
  - `FilterChips` — actief-state met primary-tint, dismiss-X
  - `Wegwijzer` — nieuwe component voor detail-pagina
  - `RuleBreak` — editorial section-marker
  - `SectorTile`, `NeighbourhoodCard`, `EmployerChip`, `CityHero` — voor city landing
- **Componenten zijn conditioneel**: elk accepteert optionele props en rendert niks als die ontbreken (bv `<DistanceChip km={undefined}>` = `return null`).

**Done-criteria**:
- Storybook-achtige demo pagina op `/dev/design-system` (alleen in development) toont alle componenten.
- `pnpm build` groen, geen TS errors.
- Lighthouse op demo-pagina ≥95 alle 4 categorieën.
- Alle 53 tenants gerenderd in `<TenantSwitcher>` dev-tool: visuele check per kleurcombi.

**Dependencies**: Fase 0 af (kleuren in DB).

---

### Fase 2 — Homepage + Detail + City MVP (4 dagen)

**Doel**: drie productiepagina's live met huidige data, conditioneel.

**Scope**:
- **Homepage** (`app/page.tsx`): vervang bestaande split-view met nieuwe design. Filter-chips werken op: employment, education_level, career_level, "Nieuw deze week" (`created_at`). Geen salary-filter, geen thuiswerk-filter (conditioneel verborgen tot fase 4/7).
- **Vacature detail** (`app/vacature/[slug]/page.tsx`): wegwijzer, conditional company-meta (sector uit `categories`, size alleen als `companies.size_min` of `category_size`), apply CTA. Sections "Wat je doet/vraagt/biedt": render `description` HTML via sanitizer voor nu; vervangen in fase 5.
- **City landing** (`app/vacatures/[city-slug]/page.tsx`): stadnaam + 3 stats (vacatures, werkgevers, gemiddeld salaris — laatste **weggelaten tot fase 4**). Sector-tiles op basis van `categories`. Geen wijken (skip), geen populatie (skip). Featured jobs = recent + most-viewed. Trend-chart met "alleen laatste 6 maanden" disclaimer.
- **Load-more** ipv infinite scroll (server pagination met URL query).
- **Filter-persistence** fix: alle filters in URL query-params, behouden bij navigatie naar detail en terug.
- Conditionele UI-matrix wordt onderdeel van dit werk (zie §5).

**Done-criteria**:
- `achterhoeksebanen.nl` live met nieuwe design.
- 5 test-tenants (UtrechtseBanen, AssenseBanen, WestlandseBanen, ZeeuwseBanen, HelmondseBanen) visueel gecheckt en allemaal OK (geen contrast-issues, geen broken layouts).
- Lighthouse ≥95 mobile+desktop op productie-URL.
- Handmatige test: 10 vacatures random selecteren, detail openen, sollicitatie-knop werkt, terug naar list behoudt filters.

**Dependencies**: Fase 1 af.

**Parallel**: Fase 3 (distance) kan gelijktijdig want andere code-surface.

---

### Fase 3 — Distance filter + user-location (2 dagen)

**Doel**: distance-chip + radius-filter werkend.

**Scope**:
- **Schema-migratie**: `job_postings.lat_num` + `lng_num` (numeric) of liever `geog geography(Point, 4326)` met PostGIS extension. PostGIS is preferred: indexeerbaar, snelle `ST_DWithin` queries.
- **Backfill**: populate `geog` uit text `latitude`/`longitude` voor 843k rows (83% coverage). Script met batches van 10k.
- **Index**: `CREATE INDEX idx_job_postings_geog USING GIST (geog)`.
- **User location**: 3-traps fallback — (1) user heeft postcode in profiel → gebruiken, (2) Vercel Edge Geo-header (`x-vercel-ip-latitude`/`longitude`) → IP-geo, (3) null → geen distance chip.
- **SQL function**: `nearby_jobs(user_lat, user_lng, radius_km)` met `ST_DWithin` + `ST_Distance`.
- **UI**: distance-chip op cards conditioneel (alleen als user-location bekend EN job-coords bekend).
- **Filter**: "Binnen X km" chip werkt via query param `?radius=15`.

**Done-criteria**:
- Distance query <50ms bij 1M rows (met index).
- Coverage: bij users met postcode-profiel tonen 83% vacatures een distance-chip; bij users zonder profiel ~70% (IP-geo minder accuraat).
- Ingelogde users kunnen postcode instellen in profiel (nieuwe form-field, simpel).

**Dependencies**: Fase 0 af.

**Risico**:
- 🟡 PostGIS extension is voor sommige Supabase plans niet default aan. **Check**: `SELECT extname FROM pg_extension`. Als het er niet is: `CREATE EXTENSION postgis` vereist admin role. **Fallback**: Haversine-formule in plain SQL. Ok voor 1M rows met composite index op lat/lng numeric, ~100ms acceptabel.
- 🔴 **AVG/privacy**: IP-geo is toegestaan (grove granulariteit), opslaan van postcode-in-profiel vereist cookie-consent banner update. Check met jurist nodig.

---

### Fase 4 — Salary-parsing + filter (4-5 dagen)

**Doel**: salaris-filter werkt, gemiddeld salaris per stad werkt.

**Scope**:
- **Sample-analyse eerst** (dag 1): 1000 random rows, handmatig gelabeld — wat zijn de patroon-classes? ("3000 - 4200 p/m", "15 - 15 p/u", "€2.800,-", "NTB", "€35.000-€45.000 per jaar", "", null).
- **Schema** (dag 1):
  ```sql
  ALTER TABLE job_postings
    ADD COLUMN salary_min numeric,
    ADD COLUMN salary_max numeric,
    ADD COLUMN salary_period text CHECK (salary_period IN ('hour', 'month', 'year')),
    ADD COLUMN salary_currency char(3) DEFAULT 'EUR',
    ADD COLUMN salary_confidence smallint; -- 100 = regex deterministic, 80 = AI-extract
  CREATE INDEX idx_job_postings_salary_min ON job_postings (salary_min) WHERE salary_min IS NOT NULL;
  ```
- **Regex-laag** (dag 2): match 70% van patronen. Periode-heuristiek: `value < 100` = uurloon, `100 < value < 15000` = maand, `> 15000` = jaar. 70%-hit target.
- **AI-extractie** (dag 3-4): Mistral prompt over de overige ~30% (200k rows). Batched via bestaand Mistral-integratie. Kostencheck: Mistral Small ≈ €0.001 per call × 200k = €200. Acceptabel, maar **budget-cap van €300** zetten.
- **UI** (dag 5): filter-chip "Salaris vanaf €X", salary-column op detail-pagina, gemiddeld-salaris-stat op city landing activeren.

**Done-criteria**:
- `salary_min` gevuld bij ≥85% van vacatures met niet-null `salary` text.
- Filter-UI werkt met slider (€0, €1.500, €2.500, €3.500, €5.000).
- Gemiddeld salaris per stad afwijkt <20% van Indeed-cijfers voor dezelfde stad (sanity check).

**Dependencies**: Fase 0 af.

**Parallel**: kan beginnen tijdens Fase 2 (schema + regex + backfill). AI-extractie pas na Fase 2 live (heeft niks met Fase 2 UI te maken).

**Risico**:
- 🟡 Mistral hallucineert op ambiguous strings (`"15 - 15"` kan uurloon OF FTE zijn). **Mitigatie**: confidence-score + handmatige review op top-50 high-traffic vacatures, rest = goed genoeg.
- 🟡 Kosten lopen op als nieuwe scrapers niet-gestructureerd salary opleveren. **Mitigatie**: scraper-upgrades parallel (scraper extraheert zelf min/max waar mogelijk, AI is alleen fallback).

---

### Fase 5 — AI-extractie: duties/requirements/benefits (3-4 dagen)

**Doel**: gestructureerde sections op detail-pagina ipv één HTML-blob.

**Scope**:
- **Schema**:
  ```sql
  ALTER TABLE job_postings
    ADD COLUMN duties jsonb,
    ADD COLUMN requirements jsonb,
    ADD COLUMN benefits jsonb,
    ADD COLUMN ai_extracted_at timestamptz;
  ```
- **Prompt engineering** (dag 1-2): Mistral structured-output met JSON schema. Max 5-7 items per sectie. Language: NL output.
- **Pipeline**: Supabase function + cron → verwerk alleen vacatures met `review_status='approved'` én `published_at >= now() - interval '90 days'` én `ai_extracted_at IS NULL`. **Niet alle 1M** — alleen recent + live. Dat is ~150k rows.
- **UI**: detail-pagina rendert structured-sections indien beschikbaar (`duties jsonb`), anders fallback naar `content_md` of `description` HTML.

**Done-criteria**:
- 150k recent/live vacatures hebben structured sections (100% coverage binnen 90-dagen-window).
- Kosten gemonitord, geen runaway. Mistral Small: ~€100-150 voor 150k calls.
- Detail-pagina's gebruiken structured sections zichtbaar (visueel verschil met HTML-blob).

**Dependencies**: Fase 0 af, Fase 4 schema-patroon bewezen.

**Risico**:
- 🟡 Structured JSON-output van Mistral kan toch niet altijd parsebaar zijn. **Mitigatie**: retry met lagere temperature, en bij persistent fail gewoon `ai_extracted_at = now()` zetten met null-sections (dan fallback UI).

---

### Fase 6 — Company-enrichment (2 dagen)

**Doel**: company-logo's naar 80% coverage, verified-badge, company-size display.

**Scope**:
- **Logo-fallback chain**: bestaand `logo_url` → Clearbit Logo API (`https://logo.clearbit.com/{domain}`) → favicon van website (`{domain}/favicon.ico`) → initialen-placeholder. Cache hits opslaan in `companies.logo_url` permanent.
- **Verified-badge**:
  ```sql
  ALTER TABLE companies ADD COLUMN verified boolean DEFAULT false;
  ```
  Proxy-logic: `verified = (is_customer OR (apollo_enriched_at IS NOT NULL AND category_size IS NOT NULL))`. Admin kan handmatig overrulen in task-3 admin-UI.
- **Size display**: gebruik `category_size` (Klein/Middel/Groot) ipv exact aantal. Bij Apollo-data: toon range ("51-200 medewerkers") met `size_min` en `size_max`. Als beide null: toon helemaal niks (conditioneel!).

**Done-criteria**:
- Logo-coverage: ≥80% (van ~10% nu).
- ≥20% companies heeft verified-badge (customers + apollo-enriched).
- Company-size zichtbaar op ≥25% detail-pagina's.

**Dependencies**: Fase 0 af.

**Risico**:
- 🟢 Clearbit Logo API is gratis voor publiek gebruik, geen risico.
- 🟡 Apollo-enrichment kost credits (~€0.10 per company). Selectief: alleen top-N bedrijven met meeste vacatures.

---

### Fase 7 — Remote/thuiswerk-classificatie (2 dagen)

**Doel**: "Thuiswerk mogelijk" filter werkt.

**Scope**:
- **Schema**:
  ```sql
  ALTER TABLE job_postings
    ADD COLUMN remote_type text CHECK (remote_type IN ('onsite', 'hybrid', 'remote'));
  ```
- **Regex-laag**: ILIKE `%thuiswerk%`, `%remote%`, `%hybride%`, `%flexibel werken%`. 60% coverage target.
- **AI-fallback**: voor de rest, Mistral. Goedkoop (kleine prompt).
- **UI**: filter-chip "Thuiswerk mogelijk" (toont als `remote_type IN ('hybrid', 'remote')`).

**Done-criteria**:
- `remote_type` gevuld op ≥70% van actieve vacatures.
- Filter in UI live.

**Dependencies**: Fase 0 af.

---

### Fase 8 — Header images (2 dagen)

**Doel**: vacatures tonen relevante hero-afbeelding.

**Scope**:
- Deels in admin task-3 (ImageUpload component) — editors kunnen per vacature uploaden.
- **Default-strategie**: als `header_image_url` null, toon gradient (primary → secondary van tenant). Nooit een lege zwarte balk.
- **Optioneel (niet nu)**: AI-generatie via FLUX of Ideogram voor top-N vacatures (CTR-uplift-experiment).

**Done-criteria**:
- Elke vacature-detail toont óf echte header óf branded gradient.
- Admin kan via task-3 UI uploaden.

**Dependencies**: Task 3 (ImageUpload) live.

**Risico**:
- 🟢 Lage prioriteit — prototype ziet er met gradient-fallback ook goed uit.

---

## 5. Conditional rendering matrix

Elke UI-sectie controleert data-beschikbaarheid vóór render. Als ontbrekend → component returnt `null`, geen placeholder. Dit laat ons features aanzetten zonder code-deploys.

| UI element | Condition | Fallback |
|-----------|-----------|----------|
| Distance chip op card | `user.lat && job.lat` | Verberg chip |
| Salary filter slider | `COUNT(salary_min IS NOT NULL) / TOTAL > 0.5` | Verberg filter |
| Salary op card | `salary_min IS NOT NULL` | Toon alleen als regel |
| Thuiswerk-filter | `COUNT(remote_type IS NOT NULL) / TOTAL > 0.3` | Verberg filter |
| Header image | `header_image_url IS NOT NULL` | Gradient primary→secondary |
| Company logo | logo_url chain (eigen → clearbit → initialen) | Initialen-badge |
| Verified badge | `companies.verified = true` | Verberg badge |
| Company size | `size_min OR category_size` | Verberg size-regel |
| Duties/requirements/benefits | `duties IS NOT NULL` | Render `content_md` of `description` HTML |
| Population-stat op city | `cities.population IS NOT NULL` | Skip stat (v1 = nooit zichtbaar) |
| Wijken-strip op city | `city_neighborhoods` tabel gevuld | Skip sectie (v1 = nooit) |
| YoY growth | historische data ≥12 mnd | Skip sectie (v1 = nooit) |
| Trend-chart | ≥6 maanden data | Toon met "Laatste X maanden" label |
| "Afstand tot station" op detail | station-dataset | Skip regel (v1 = nooit) |
| Parkeren/OV-badges | facility-flags | Skip badges (v1 = nooit) |
| Related jobs | `COUNT(related) > 0` | Skip hele sectie |
| "Alle X vacatures" van werkgever | `companies.job_counts > 1` | Link naar bedrijfspagina |

**Implementatie-patroon**:

```tsx
// components/distance-chip.tsx
export function DistanceChip({ km }: { km?: number }) {
  if (km == null) return null
  return (
    <span className="chip-dist">
      <MapPin size={11} />
      {km.toFixed(1)} km
    </span>
  )
}
```

Zo simpel. Geen feature-flags nodig voor conditioneel renderen — de data zelf stuurt.

---

## 6. Rollout strategie

### Feature flags waar wel nodig

Feature-flags zijn wél nodig voor **ontwerp-wijzigingen** (oude vs nieuwe design tijdens Fase 2):

```typescript
// apps/public-sites/src/lib/flags.ts
export const flags = {
  newDesign: process.env.NEXT_PUBLIC_NEW_DESIGN === 'true',
  // of per tenant:
  newDesignTenants: process.env.NEXT_PUBLIC_NEW_DESIGN_TENANTS?.split(',') ?? [],
}
```

Rollout per tenant in Fase 2:
1. **Dag 1**: `achterhoeksebanen.nl` only (pilot). Check 24h op errors, Lighthouse, bounces.
2. **Dag 2**: 3 tenants erbij (UtrechtseBanen, AssenseBanen, WestlandseBanen — uiteenlopende kleuren als stresstest).
3. **Dag 3-4**: batch 10 tenants.
4. **Dag 5**: alle 24 live platforms + 15 nieuwe draft platforms gaan samen live.

Via `NEXT_PUBLIC_NEW_DESIGN_TENANTS` env var in Vercel, zonder code-deploy omschakelbaar.

### Rollback

Elke fase heeft een revert-pad:
- Fase 0: DB migratie heeft `DOWN` migratie; logos in storage blijven, maar `platforms.logo_url = NULL` terugzetten = oude fallback.
- Fase 1-2: env flag uit = oude design actief.
- Fase 3-7: elke kolom kan `NULL` blijven; UI toont dan gewoon niks (conditioneel).

Geen fase is "destructief".

### Monitoring per fase

| Fase | Metric | Alert threshold |
|------|--------|-----------------|
| 0 | Logo-renders / page-view | <80% = broken |
| 2 | Lighthouse perf mobile | <90 = regression |
| 2 | Core Web Vitals (LCP/CLS/INP) | LCP >2.5s, CLS >0.1 |
| 3 | Distance query p95 | >100ms = index probleem |
| 4 | Mistral spend | >€300/week |
| 5 | AI-extraction queue lag | >2000 rows = pipeline stokt |
| 6 | Clearbit 4xx rate | >5% = API-limiet |
| 7 | Thuiswerk-filter gebruik | =0 na 1 week = UX onduidelijk |

---

## 7. Skipped features (intentional)

Met uitleg, zodat we later weten WAAROM we het niet deden.

| Feature | Waarom skip | Wanneer wel? |
|---------|-------------|--------------|
| Population per stad (65.000 inwoners) | Externe data (CBS) → 1 dag werk, geen waarde voor sollicitant | Als SEO-analyse toont dat "hoeveel mensen wonen in X" zoektermen veel traffic trekken |
| Wijken per stad (7009 = Lookwartier) | Externe BAG/CBS import, complex opzet, geen conversie-driver | Als een enterprise-klant erom vraagt |
| YoY vacature-groei ("+12% vs vorig jaar") | Historische data gaat pas terug tot juli 2025 — letterlijk onmogelijk tot 2027 | Natuurlijk in juli 2027 |
| Afstand tot station ("0.8 km van Doetinchem CS") | Leuk detail, geen conversie-impact | Als iemand NS-station geojson vrijwillig integreert |
| Parkeren/OV-flags op detail | AI-extractie onbetrouwbaar, geen filter-vraag | Na data-analyse dat vacatures met "parkeren gratis" beter converteren |
| Referentienummer eigen format | `external_vacancy_id` is al aanwezig, verwarrend om tweede nummer te maken | Alleen als werkgevers expliciet vragen |
| Testimonial-quote in detail (design had er een) | Geen veld, zou AI-extractie uit description zijn → risico op valse quotes | Nooit tenzij werkgevers zelf quotes toevoegen via admin |
| Mock-hero in prototype (gradient) | Fase 8 vervangt door echte header of branded gradient | Na admin task 3 |

---

## 8. Meetbaarheid — wanneer weten we dat het werkt?

### Na Fase 0 (1 dag later)
- Alle 24 live domains tonen hun eigen logo in header.
- Geen kleur-waarde `#0066cc` meer in `platforms` voor live platforms.

### Na Fase 2 (10 werkdagen later)
- Nieuwe design live op alle 24 tenants.
- **Lighthouse**: ≥95 performance, ≥95 accessibility, ≥95 best practices, ≥95 SEO.
- **Core Web Vitals**: LCP <2.5s, CLS <0.1, INP <200ms.
- **Bounce rate**: ≤ oude design (niet doel, maar blocker als +20%).
- **CTR list → detail**: ≥ oude design (blocker als -10%).

### Na Fase 4 (week 3-4)
- `salary_min` coverage ≥85% vacatures met salary-text.
- Salary-filter gebruiks-rate >10% van zoekacties (indien lager: UX-issue).

### Na Fase 5 (week 5)
- Detail-pagina's met structured sections: ≥150k.
- Time-on-detail: +20% vs oude HTML-blob (hypothese, te meten).

### Na Fase 7 (week 7)
- Alle "OK" data-gebieden uit §5 hebben coverage >70%.
- Gebruikers met profiel-postcode: 50% gebruikt distance-filter.

---

## 9. Open beslispunten voor Kenny

1. **Domein-swaps live**: OK om in Fase 0 de 3 live domeinen (`osssebanen.nl`, `leeuwardsebanen.nl`, `nijmegensebanen.nl`) om te gooien naar de correcte `ossebanen.nl` / `leeuwardensebanen.nl` / `nijmeegsebanen.nl`? Dit vereist DNS + Vercel-updates. Oude domeinen houden met 301-redirect?

2. **PostGIS extension**: aanzetten op Supabase-project of toch Haversine fallback? PostGIS is netter, maar vereist Supabase-admin role (check plan).

3. **AI-enrichment budget**: €500 ceiling voor eerste 3 maanden (salary + sections + remote samen)? Laat weten als lager of hoger.

4. **Feature-flag voor design-rollout**: pilot op AchterhoekseBanen eerst of meteen naar 5 tenants?

5. **Task-3 parallel**: staat dit admin-UI werk ook op deze tijdlijn of pauze tot Fase 2 klaar is? Mijn voorstel: admin UI niet blokkerend, maar Kenny/Luc doen nu alles via SQL/scripts — laten we admin UI in week 3-4 inplannen, niet urgenter.

6. **Population/wijken data**: blijven we op "skip", of moet ik toch CBS-import als stretch-goal erbij zetten? Mijn advies: skip, werkt niet hard genoeg aan conversie.

7. **"Thuiswerk" filter zichtbaarheid**: aanzetten zodra ≥30% rows gevuld? Of hogere drempel? (Heeft anders misleidende resultaten.)

---

## 10. Volgende concrete actie

Als je akkoord bent: **start Fase 0 nu**. Dat is 1 werkdag en ik kan het grotendeels autonoom uitvoeren:

1. Kleur-proposal hergenereren met 3 kleuren (5 min)
2. Migratie 1: platform-typo-fixes + 3 kleur-kolommen (30 min incl Vercel-domein updates)
3. Storage bucket check + upload-script schrijven (1u)
4. Upload-run alle 68 portalen (1u, veel tijd = upload)
5. SQL UPDATE batch per platform (30 min)
6. Revalidate + visuele check 24 live tenants (30 min)
7. Subagent starten: 15 nieuwe platforms aanmaken (draait op achtergrond)

**Totaal ~4u actief werk**. Morgen Fase 1 starten.

Akkoord om door te drukken?
