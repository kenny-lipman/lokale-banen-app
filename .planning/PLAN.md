# Lokale Banen — Publieke Sites Uitvoeringsplan

**Versie:** 1.0
**Datum:** 2026-04-11
**Status:** Draft — ter review door Kenny + Luc
**Eigenaar:** Kenny Lipman
**Duur MVP:** ~16 werkdagen (Phase 0 t/m Phase 5)

---

## 1. Samenvatting

Dit plan beschrijft de bouw van een nieuwe **template-based publieke vacaturesite** voor het Lokale Banen netwerk. Eén Next.js 16 codebase serveert alle 50+ regio-domeinen (WestlandseBanen, GroningseBanen, LeidseBanen, etc.) via host-based tenant routing. Vacatures worden handmatig goedgekeurd via een nieuwe bulk review UI in de bestaande admin en worden gepubliceerd met volledige SEO/GEO optimalisatie: JSON-LD JobPosting schema, llms.txt manifest, markdown-mirrors voor LLM-discovery, en IndexNow integratie.

**Pilot**: WestlandseBanen als eerste live domein, ~2 weken na projectstart.

**Schaal-doel na pilot**: elke nieuwe regio live in <2 uur met alleen DB-record + DNS-change + logo upload.

---

## 2. Doelen & Success Criteria

### Wat we bouwen
1. Publieke vacaturesites per regio met lijst, detail, en zoek/filter
2. Bulk goedkeurings UI in admin dashboard
3. Kandidaat-account systeem (Clerk, satellite domains)
4. SEO/GEO infrastructuur vanaf dag 1
5. Master aggregator domein voor alle regio's samen

### Harde success metrics (MVP)
| Metric | Target | Meetpunt |
|---|---|---|
| LCP (mobiel, 4G) | <2.5s | Vercel Analytics |
| CLS | <0.1 | Vercel Analytics |
| INP | <200ms | Vercel Analytics |
| Lighthouse mobiel | ≥95 | CI check per PR |
| First Load JS | <100kb | `next build` output |
| Google Jobs eligible | ja | Search Console → Rich Results |
| JSON-LD validatie | 100% | schema.org validator in CI |
| Tijd om nieuwe regio live te zetten (na pilot) | <2 uur | Manual check |

### Expliciet NIET in MVP
- Split-view (Google Jobs stijl) — Luc wil minimalistisch
- Intern sollicitatie formulier met CV upload — extern redirect met logging
- Paid tier / CMS voor betaalde klanten
- Otis API voor vacature-aanmaak door partners
- LinkedIn OAuth (Google OAuth wel)
- Cross-TLD SSO (Clerk satellite domains voldoen)
- Admin Clerk migratie (blijft op bestaande withAuth)

---

## 3. Architectuur op Hoofdlijnen

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           DNS Layer                                       │
│                                                                            │
│  auth.lokalebanen.nl    ← Clerk PRIMARY domain (handshake/login)         │
│                                                                            │
│  lokalebanen.nl         ← Satellite: master aggregator                    │
│  westlandsebanen.nl     ← Satellite: regio (PILOT)                        │
│  groningsebanen.nl      ← Satellite: regio                                │
│  leidsebanen.nl         ← Satellite: regio                                │
│  ... (50+)                                                                 │
│  werkgevers.lokalebanen.nl ← Satellite: employer portal (LATER)           │
│                                                                            │
│  lokale-banen-app.vercel.app ← admin (blijft, eigen auth)                 │
└────────────────┬─────────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        Vercel Projects                                    │
│                                                                            │
│   ┌─────────────────────┐    ┌──────────────────────────┐               │
│   │ lokale-banen-admin  │    │ lokale-banen-public      │               │
│   │                     │    │                          │               │
│   │ Root: apps/admin    │    │ Root: apps/public-sites  │               │
│   │ Next.js 15          │    │ Next.js 16 + cacheComp.  │               │
│   │ Bestaande cron jobs │    │ Clerk satellite config   │               │
│   └─────────────────────┘    └──────────────────────────┘               │
└────────────────┬─────────────────────────┬──────────────────────────────┘
                 │                         │
                 │         ┌───────────────┘
                 ▼         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    Shared Supabase DB                                     │
│                                                                            │
│  Bestaand (hergebruik):                                                   │
│  • platforms (54 rijen, uit te breiden)                                   │
│  • job_postings (1M rijen, uit te breiden)                                │
│  • companies (193k, al rijk aan metadata)                                 │
│  • postcode_platform_lookup (3251 postcodes → platforms met distance)    │
│  • cities (1384 plaatsen → platforms)                                     │
│                                                                            │
│  Nieuw:                                                                    │
│  • job_posting_platforms (junction tabel voor multi-regio)                │
│  • user_profiles (Clerk user_id als TEXT)                                 │
│  • saved_jobs (RLS via Clerk JWT)                                         │
│  • job_applications (tracking + Clerk organization_id)                    │
└──────────────────────────────────────────────────────────────────────────┘
                 ▲
                 │ JWT bridge (sub claim = Clerk user_id)
                 │
┌──────────────────────────────────────────────────────────────────────────┐
│                  Clerk Application: "Lokale Banen Netwerk"                │
│                                                                            │
│   • Shared user pool (kandidaten cross-domain)                            │
│   • Organizations feature (voor werkgevers, later)                        │
│   • JWT template "supabase" → RLS bridge                                  │
│   • Satellite Domains met satelliteAutoSync (skip handshake anon traffic) │
│   • Avatar/profile hosting native (geen eigen storage)                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Request flow (ingelogde kandidaat bekijkt vacature)

```
1. User → westlandsebanen.nl/vacature/junior-dev-abc123
2. Vercel Edge → apps/public-sites Next.js 16
3. proxy.ts:
   - clerkMiddleware() checkt session cookie
   - getTenant() resolvet host → platform_id (use cache, hours)
   - injecteert x-tenant-id in request headers
4. app/vacature/[slug]/page.tsx:
   - STATIC: header, footer, breadcrumbs (prerendered)
   - CACHED: job detail (use cache, cacheLife('hours'), cacheTag)
   - DYNAMIC (Suspense): "Opgeslagen" knop (user-specific, use cache: private)
5. JSON-LD JobPosting in HTML head
6. Response stream → user ziet LCP <2s
```

---

## 4. Tech Stack

| Laag | Keuze | Versie | Waarom |
|---|---|---|---|
| **Framework (public)** | Next.js App Router | 16.x | Cache Components, PPR, proxy.ts |
| **Framework (admin)** | Next.js App Router | 15.x | Blijft op huidige versie |
| **Runtime** | Node.js | 20.9+ | Clerk Core 3 vereist |
| **Package manager** | pnpm | 9.x | Workspaces support |
| **Monorepo tooling** | Turborepo | 2.x | Incrementele builds |
| **Styling** | Tailwind CSS + CSS vars | 3.x | Per-tenant theming |
| **Componenten (public)** | shadcn/ui (copy-paste) | latest | Kenny's keuze, Vaul drawer, a11y |
| **Icons** | Lucide React | latest | Tree-shaken |
| **Font** | Inter via `next/font` | self-hosted | Geen FOUT |
| **Auth** | Clerk | `@clerk/nextjs` v7 (Core 3) | Native Vercel Marketplace |
| **Database** | Supabase PostgreSQL | - | Bestaand, met RLS |
| **Supabase client** | `@supabase/ssr` | latest | Server-side sessions |
| **Validation** | Zod + react-hook-form | latest | shadcn Form pattern |
| **Forms** | react-hook-form | latest | Server actions submit |
| **Markdown** | remark + turndown | latest | HTML → MD conversie |
| **JSON-LD typing** | schema-dts | latest | Typed JobPosting schema |
| **OG images** | @vercel/og | latest | Dynamic social images |
| **Linting** | Biome | latest | Format + lint |
| **Testing** | Vitest + Playwright | latest | Unit + E2E |

---

## 5. Monorepo Structuur

```
Lokale-Banen/                        ← repo root (was single Next.js app)
├── apps/
│   ├── admin/                       ← huidige code, verhuisd
│   │   ├── app/                     (ongewijzigde routes)
│   │   ├── lib/                     (withAuth, services, crons)
│   │   ├── package.json             (admin-specifieke deps)
│   │   ├── vercel.json              (cron jobs)
│   │   └── next.config.mjs          (blijft Next.js 15)
│   ├── public-sites/                ← NIEUW — Next.js 16
│   │   ├── app/
│   │   │   ├── layout.tsx           (tenant loader + ClerkProvider)
│   │   │   ├── page.tsx             (vacaturelijst + filter)
│   │   │   ├── vacature/[slug]/
│   │   │   │   ├── page.tsx         (HTML detail)
│   │   │   │   ├── md/route.ts      (Markdown mirror)
│   │   │   │   └── og/route.tsx     (OG image)
│   │   │   ├── account/             (Clerk protected)
│   │   │   │   ├── page.tsx         (dashboard)
│   │   │   │   ├── opgeslagen/
│   │   │   │   ├── sollicitaties/
│   │   │   │   └── profiel/
│   │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   │   ├── sign-up/[[...sign-up]]/page.tsx
│   │   │   ├── sitemap.ts
│   │   │   ├── robots.ts
│   │   │   └── (seo)/
│   │   │       ├── llms.txt/route.ts
│   │   │       ├── llms-full.txt/route.ts
│   │   │       └── rsl.xml/route.ts
│   │   ├── components/              (shadcn + custom)
│   │   ├── lib/
│   │   │   ├── tenant.ts            (getTenant cached)
│   │   │   ├── queries.ts           (alle 'use cache' queries)
│   │   │   └── supabase-clerk.ts    (Clerk JWT → Supabase client)
│   │   ├── proxy.ts                 (host→tenant + clerkMiddleware)
│   │   ├── next.config.ts           ({ cacheComponents: true })
│   │   └── package.json
│   └── employer-portal/             ← PLACEHOLDER voor later
│       ├── README.md                ("To be built in Phase 7")
│       └── package.json             (empty)
├── packages/
│   ├── database/                    ← Supabase helpers
│   │   ├── src/
│   │   │   ├── types.ts             (gegenereerde Supabase types)
│   │   │   ├── queries/
│   │   │   │   ├── jobs.ts
│   │   │   │   ├── platforms.ts
│   │   │   │   └── users.ts
│   │   │   ├── slug.ts              (slugify + decode)
│   │   │   └── markdown.ts          (HTML → MD via turndown)
│   │   └── package.json
│   ├── auth/                        ← Clerk helpers
│   │   ├── src/
│   │   │   ├── supabase-client.ts   (Clerk JWT → Supabase)
│   │   │   ├── types.ts             (Clerk user types)
│   │   │   └── middleware.ts        (shared clerkMiddleware config)
│   │   └── package.json
│   ├── shared/                      ← JSON-LD, brand, utils
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── job-posting.ts   (JobPosting JSON-LD builder)
│   │   │   │   ├── organization.ts
│   │   │   │   ├── website.ts
│   │   │   │   └── breadcrumb.ts
│   │   │   ├── brand.ts             (hub-and-spoke constants)
│   │   │   └── color.ts             (hex → hsl voor tenant theming)
│   │   └── package.json
│   └── config/                      ← gedeelde presets
│       ├── tsconfig.base.json
│       ├── tailwind.base.ts
│       ├── biome.base.json
│       └── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── package.json                     (root, minimal deps)
├── .planning/                       (deze map, niet gebuild)
│   ├── PLAN.md
│   ├── DESIGN.md
│   └── GEO-ANALYSIS.md
└── CLAUDE.md                        (project instructions)
```

### Vercel deployment setup

| Project | Git repo | Root Directory | Framework | Domains |
|---|---|---|---|---|
| `lokale-banen-admin` | Lokale-Banen | `apps/admin` | Next.js | `lokale-banen-app.vercel.app` |
| `lokale-banen-public` | Lokale-Banen | `apps/public-sites` | Next.js | 50+ custom domains |

Ignored Build Step per project filtert op path changes zodat admin-deploys niet triggeren op public-site wijzigingen.

---

## 6. Authenticatie — Clerk Satellite Domains

### Architectuur

```
Clerk Application: "Lokale Banen Netwerk"
│
├─── Primary Domain:
│    └── auth.lokalebanen.nl        ← dedicated subdomain, alleen voor handshake
│
├─── Satellite Domains:
│    ├── lokalebanen.nl             ← master aggregator
│    ├── westlandsebanen.nl         ← pilot regio
│    ├── groningsebanen.nl
│    ├── leidsebanen.nl
│    ├── ... (47 meer)
│    └── werkgevers.lokalebanen.nl  ← employer portal (later)
│
├─── User Pool:
│    • Kandidaten (normale users)
│    • Werkgever-medewerkers (users binnen organizations, later)
│
├─── Organizations (Pro plan, pas bij employer portal):
│    • "Bedrijf X BV" → members: HR, recruiter
│    • "Bedrijf Y BV" → ...
│
└─── JWT Template "supabase":
     • sub claim = Clerk user_id (clerk_xxx format)
     • exp = 1h
     • algorithm = HS256 met Supabase JWT secret
```

### Clerk ↔ Supabase RLS bridge

```tsx
// packages/auth/src/supabase-client.ts
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

export async function createClerkSupabaseClient() {
  const { getToken } = await auth()
  const token = await getToken({ template: 'supabase' })

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  )
}
```

### RLS policies (nieuwe user-scoped tabellen)

```sql
CREATE POLICY "own_profile" ON user_profiles
  FOR ALL USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "own_saved_jobs" ON saved_jobs
  FOR ALL USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "own_applications" ON job_applications
  FOR ALL USING (user_id = auth.jwt() ->> 'sub');
```

### Kosten-inschatting

| Plan | Bij | Kosten/mo |
|---|---|---|
| Free | <10k MAU, geen Organizations | $0 |
| Pro | >10k MAU of Organizations nodig | $25 + $0.02/MAU na 10k |
| Schatting bij 50 regio's × 500 MAU = 25k MAU | Pro + 15k overage | ~$325/mo |

Start op Free tier, upgrade naar Pro bij employer portal launch.

---

## 7. Database Wijzigingen

Alle migraties via `mcp__supabase__apply_migration` in Phase 0 Stap 3.

### 7.1 Platforms tabel uitbreiden

```sql
ALTER TABLE platforms
  ADD COLUMN domain           TEXT,
  ADD COLUMN is_public        BOOLEAN DEFAULT false,
  ADD COLUMN tier             TEXT DEFAULT 'free'
    CHECK (tier IN ('free','paid','master')),
  ADD COLUMN logo_url         TEXT,
  ADD COLUMN primary_color    TEXT DEFAULT '#0066cc',
  ADD COLUMN hero_title       TEXT,
  ADD COLUMN hero_subtitle    TEXT,
  ADD COLUMN seo_description  TEXT,
  ADD COLUMN published_at     TIMESTAMPTZ;

CREATE UNIQUE INDEX idx_platforms_domain_unique
  ON platforms(domain) WHERE domain IS NOT NULL;
```

> **Let op:** `is_active` blijft onaangeroerd (die betekent "scraping aan/uit"). `is_public` is een nieuwe, aparte flag voor publicatie.

### 7.2 Job postings uitbreiden

```sql
ALTER TABLE job_postings
  ADD COLUMN slug                 TEXT,
  ADD COLUMN seo_title            TEXT,
  ADD COLUMN seo_description      TEXT,
  ADD COLUMN content_md           TEXT,
  ADD COLUMN content_enriched_at  TIMESTAMPTZ,
  ADD COLUMN published_at         TIMESTAMPTZ;
```

> **Let op:** `lokalebanen_pushed_at` en `lokalebanen_id` blijven voor de CRM push naar oude LokaleBanen site. `published_at` is voor onze nieuwe publieke sites.

### 7.3 Multi-platform junction (canonical vs. secondary)

```sql
CREATE TABLE job_posting_platforms (
  job_posting_id  UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  platform_id     UUID NOT NULL REFERENCES platforms(id)    ON DELETE CASCADE,
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  distance_km     INT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (job_posting_id, platform_id)
);

CREATE UNIQUE INDEX idx_one_primary_per_job
  ON job_posting_platforms(job_posting_id) WHERE is_primary = true;

CREATE INDEX idx_jpp_platform_primary
  ON job_posting_platforms(platform_id, is_primary);
```

**Hergebruik**: `postcode_platform_lookup` (3251 rijen bestaand) wordt gebruikt om primary toe te wijzen bij approve.

### 7.4 User tabellen (Clerk-scoped)

```sql
CREATE TABLE user_profiles (
  user_id      TEXT PRIMARY KEY,                     -- Clerk user_id
  platform_id  UUID REFERENCES platforms(id),        -- waar ze aanmeldden
  display_name TEXT,
  email        TEXT,
  phone        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE saved_jobs (
  user_id         TEXT NOT NULL,
  job_posting_id  UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  platform_id     UUID REFERENCES platforms(id),     -- context waar opgeslagen
  saved_at        TIMESTAMPTZ DEFAULT now(),
  notes           TEXT,
  PRIMARY KEY (user_id, job_posting_id)
);

CREATE INDEX idx_saved_jobs_user
  ON saved_jobs(user_id, saved_at DESC);

CREATE TABLE job_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT,
  organization_id TEXT,                              -- Clerk org_id (toekomst)
  job_posting_id  UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  platform_id     UUID REFERENCES platforms(id),
  applied_at      TIMESTAMPTZ DEFAULT now(),
  method          TEXT CHECK (method IN ('external_redirect','email','internal_form')),
  status          TEXT DEFAULT 'submitted',
  metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_applications_user
  ON job_applications(user_id, applied_at DESC);
```

### 7.5 Indexen voor bulk review + public read (kritiek voor performance)

```sql
-- Admin bulk review queue (nu ontbrekend!)
CREATE INDEX idx_jp_review_queue
  ON job_postings(platform_id, review_status, scraped_at DESC)
  WHERE review_status IN ('pending', 'still_pending');

-- Publieke lijst query (hot path)
CREATE INDEX idx_jp_public_list
  ON job_postings(platform_id, published_at DESC)
  WHERE review_status = 'approved' AND published_at IS NOT NULL;

-- Slug-based detail lookup
CREATE UNIQUE INDEX idx_jp_slug_platform
  ON job_postings(platform_id, slug) WHERE slug IS NOT NULL;
```

### 7.6 RLS policies

```sql
-- Publieke reads: alleen approved + gepubliceerd + niet verlopen
CREATE POLICY "public_read_approved_jobs" ON job_postings
  FOR SELECT USING (
    review_status = 'approved'
    AND published_at IS NOT NULL
    AND published_at <= now()
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  );

CREATE POLICY "public_read_public_platforms" ON platforms
  FOR SELECT USING (is_public = true AND domain IS NOT NULL);

CREATE POLICY "public_read_companies_of_approved_jobs" ON companies
  FOR SELECT USING (
    id IN (
      SELECT company_id FROM job_postings
      WHERE review_status = 'approved' AND published_at IS NOT NULL
    )
  );

CREATE POLICY "public_read_jpp" ON job_posting_platforms
  FOR SELECT USING (
    platform_id IN (SELECT id FROM platforms WHERE is_public = true)
  );

-- User-scoped (Clerk JWT)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile" ON user_profiles
  FOR ALL USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "own_saved_jobs" ON saved_jobs
  FOR ALL USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "own_applications" ON job_applications
  FOR ALL USING (user_id = auth.jwt() ->> 'sub');
```

### 7.7 Na DDL: advisors check

```
mcp__supabase__get_advisors → check voor security warnings
mcp__supabase__generate_typescript_types → regenereer in packages/database
```

---

## 8. Fases

### Fase 0 — Foundation (3 dagen)

**Doel:** Monorepo staat, database is klaar, Clerk is geconfigureerd, nieuwe app scaffold draait lokaal met tenant detectie + werkende login.

#### Stap 1 — Monorepo refactor (4 uur)

- [ ] Maak `pnpm-workspace.yaml` en `turbo.json` in repo root
- [ ] Verplaats alle bestaande code naar `apps/admin/`
- [ ] Split `package.json`: root = turbo only, `apps/admin/package.json` = admin deps
- [ ] Update Vercel project `lokale-banen-app`: Root Directory = `apps/admin`
- [ ] Verify: `pnpm dev` werkt, `pnpm build` passeert, crons schema intact
- [ ] Commit: `refactor: migrate to pnpm workspaces monorepo`

#### Stap 2 — packages scaffolden (2 uur)

- [ ] `packages/database`: Supabase types, slug.ts, markdown.ts, queries/
- [ ] `packages/auth`: Clerk helpers placeholder
- [ ] `packages/shared`: JSON-LD builders, brand.ts, color.ts
- [ ] `packages/config`: tsconfig.base, tailwind.base, biome.base
- [ ] Verify: `pnpm --filter @lokale-banen/database typecheck` passeert

#### Stap 3 — Database migraties (2 uur)

- [ ] Run migraties via `mcp__supabase__apply_migration` (sectie 7.1-7.6)
- [ ] `mcp__supabase__get_advisors` check — resolve warnings
- [ ] Regenereer types: `mcp__supabase__generate_typescript_types` → `packages/database/src/types.ts`
- [ ] Backfill `platforms.domain` voor 54 bestaande records (alleen pilot krijgt echte domain, rest NULL)
- [ ] Seed: update `WestlandseBanen` record met `domain='westlandsebanen.nl'`, `is_public=false` (tot pilot review klaar)

#### Stap 4 — Clerk setup (2 uur, Kenny begeleidt)

Dit doet Kenny zelf met instructies van Claude. Stappen:

- [ ] **Clerk Dashboard**: Maak nieuwe application "Lokale Banen Netwerk"
- [ ] **Clerk Dashboard**: Authentication → Providers → enable Email + Password, Magic Link, Google OAuth
- [ ] **Clerk Dashboard**: Customization → Appearance → brand kleuren (later per-tenant via appearance prop)
- [ ] **Clerk Dashboard**: Domains → Add primary domain `auth.lokalebanen.nl`
- [ ] **DNS** (Kay): CNAME `auth.lokalebanen.nl` → Clerk's frontend API endpoint
- [ ] **Clerk Dashboard**: JWT Templates → Create "supabase" template → selecteer Supabase preset
- [ ] **Clerk Dashboard**: Copy Supabase JWT signing secret
- [ ] **Supabase Dashboard**: Settings → Auth → JWT → paste Clerk's signing secret
- [ ] **Vercel**: Maak nieuw project `lokale-banen-public`, link aan Lokale-Banen repo, Root = `apps/public-sites`
- [ ] **Vercel Marketplace**: `vercel integration add clerk` voor `lokale-banen-public` project
- [ ] Verify: env vars `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` aanwezig in Vercel

#### Stap 5 — Nieuwe publieke app scaffold (4 uur)

- [ ] `pnpm create next-app@latest apps/public-sites` (App Router, TS, Tailwind, Biome)
- [ ] `next.config.ts`: `cacheComponents: true`
- [ ] `pnpm add @clerk/nextjs @supabase/ssr @supabase/supabase-js lucide-react`
- [ ] `pnpm dlx shadcn@latest init` → selecteer Tailwind, gebruik `packages/config/tailwind.base.ts`
- [ ] Install shadcn components: `button input card badge drawer sheet dialog form avatar tabs skeleton separator sonner command popover dropdown-menu`
- [ ] `proxy.ts` met `clerkMiddleware()` + host-based tenant resolution
- [ ] `app/layout.tsx`: ClerkProvider binnen `<body>`, tenant theming in `<head>`
- [ ] `app/page.tsx`: Hello-world "Welkom op {tenant.hero_title}"
- [ ] `app/sign-in/[[...sign-in]]/page.tsx`: Clerk `<SignIn />`
- [ ] `app/sign-up/[[...sign-up]]/page.tsx`: Clerk `<SignUp />`
- [ ] Voeg `/etc/hosts` entries toe: `127.0.0.1 westlandsebanen.local`, `groningsebanen.local`, `auth.lokale-banen.local`
- [ ] Verify: `pnpm dev:public` → open `http://westlandsebanen.local:3000` → ziet "Welkom op Vacatures in het Westland"
- [ ] Verify: klik "Inloggen" → werkende Clerk login flow

**Einde Fase 0:**
- Monorepo draait
- DB heeft alle nieuwe velden + indexen
- Clerk is geconfigureerd en werkend
- Publieke app draait lokaal met tenant-detectie + login

---

### Fase 1 — Core Pages (3 dagen)

**Doel:** Vacaturelijst + detail pagina werken met echte data uit Supabase via Clerk-authenticated queries. Zoek/filter via URL state, server-side rendered.

- [ ] **Stap 1** `lib/queries.ts`: `'use cache'` queries voor getTenant, getApprovedJobs, getJobBySlug, getRelatedJobs
- [ ] **Stap 2** `lib/supabase-clerk.ts`: Clerk JWT → Supabase client helper
- [ ] **Stap 3** Theme loader in layout: tenant.primary_color → CSS var injectie
- [ ] **Stap 4** Homepage (`app/page.tsx`):
  - Static shell (header, footer)
  - Cached `<JobList>` component met Suspense
  - `<SearchBar>` + `<FilterChips>` met URL searchParams
- [ ] **Stap 5** `components/job-card.tsx`: shadcn Card met titel, bedrijf, locatie, salaris, badges
- [ ] **Stap 6** Detail pagina (`app/vacature/[slug]/page.tsx`):
  - H1 + metadata
  - Cached job fetch
  - Sticky solliciteer CTA (mobiel bottom, desktop inline)
  - Gerelateerde vacatures (zelfde city)
- [ ] **Stap 7** Filter UI: shadcn Sheet (desktop) + Drawer (mobiel)
- [ ] **Stap 8** Error states: 404 voor onbekende slug, 410 voor verlopen (end_date < today)
- [ ] **Stap 9** Loading states: shadcn Skeleton voor JobList
- [ ] **Stap 10** Empty states: "Geen vacatures gevonden" met reset filters CTA
- [ ] Tests (Playwright): homepage laadt, filter werkt, detail opent

**Dependency**: approved data nodig om iets te tonen. Tijdens dev gebruiken we enkele handmatig-goedgekeurde test records (via Supabase dashboard).

---

### Fase 1.5 — Account Features (2 dagen)

**Doel:** Ingelogde kandidaten kunnen vacatures opslaan, sollicitaties zien, profiel beheren.

- [ ] **Stap 1** `/account/page.tsx`: dashboard met Clerk `currentUser()` + laatste saved jobs
- [ ] **Stap 2** `/account/opgeslagen/page.tsx`: lijst uit `saved_jobs` tabel
- [ ] **Stap 3** `/account/sollicitaties/page.tsx`: lijst uit `job_applications` tabel
- [ ] **Stap 4** `/account/profiel/page.tsx`: Clerk `<UserProfile />` component
- [ ] **Stap 5** `SaveJobButton` component:
  - Ingelogd: server action → insert in `saved_jobs`
  - Anoniem: `localStorage` + soft prompt "Account aanmaken om permanent op te slaan"
  - Bij login: merge `localStorage` → DB
- [ ] **Stap 6** `ApplyButton` component:
  - External redirect naar `job.url`
  - Server action logt `job_applications` (method='external_redirect')
  - Track ook zonder login (user_id NULL, alleen applied_at + metadata)
- [ ] **Stap 7** UserButton in header (shadcn Avatar + Clerk)
- [ ] **Stap 8** Protected middleware: `proxy.ts` checkt `/account/*` routes, redirect naar `/sign-in?next=...`
- [ ] Tests: signup → save job → logout → login → job nog opgeslagen

---

### Fase 2 — SEO/GEO (3 dagen)

**Doel:** Google Jobs eligibility, LLM citeerbaarheid, volledige structured data.

- [ ] **Stap 1** `generateMetadata` per pagina:
  - Homepage: `{tenant.hero_title} | {tenant.seo_description}`
  - Detail: `{job.title} bij {company.name} - {tenant.name}`
  - OG image via `@vercel/og`
- [ ] **Stap 2** `packages/shared/schema/job-posting.ts`: complete JobPosting JSON-LD builder met:
  - title, description, datePosted, validThrough (end_date), employmentType
  - hiringOrganization (met sameAs naar LinkedIn, KvK URL, hoofddomein)
  - jobLocation met PostalAddress + geo coordinates
  - baseSalary (wanneer beschikbaar)
  - directApply, identifier, applicantLocationRequirements
- [ ] **Stap 3** Organization + WebSite + BreadcrumbList schemas in layout
- [ ] **Stap 4** `app/sitemap.ts` → sitemap index met sub-sitemaps per maand
- [ ] **Stap 5** `app/robots.ts` → allow GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot + sitemap link
- [ ] **Stap 6** `app/llms.txt/route.ts`: tenant-scoped manifest met:
  - Titel + beschrijving + CBS regio-data (als beschikbaar)
  - Top vacatures gecategoriseerd per sector
  - Bronvermelding
- [ ] **Stap 7** `app/llms-full.txt/route.ts`: volledige markdown dump van alle approved jobs voor tenant
- [ ] **Stap 8** `app/vacature/[slug]/md/route.ts`: markdown variant per vacature (schone content, geen chrome)
- [ ] **Stap 9** `app/rsl.xml/route.ts`: RSL 1.0 licensing manifest (permit AI search, block training)
- [ ] **Stap 10** IndexNow integratie: op approve → POST naar Bing/IndexNow API
- [ ] **Stap 11** Search Console setup (Kenny): domain property + sitemap submit voor pilot
- [ ] **Stap 12** 410 handling: `app/vacature/[slug]/page.tsx` returnt 410 Gone als `end_date < today`
- [ ] **Stap 13** Canonical URLs: altijd het primary platform, via `<link rel="canonical">`
- [ ] **Stap 14** `<link rel="alternate" type="text/markdown">` naar /md variant
- [ ] Tests: schema.org validator CLI per pagina, Lighthouse SEO ≥ 100

---

### Fase 2.5 — Content Enrichment Pipeline (1 dag)

**Doel:** Alle approved vacatures hebben rijke, 134-167 word passage-structured content (zonder dit voelt content dun en is niet citeerbaar).

- [ ] **Stap 1** Extend bestaande `lokalebanen-content.service.ts` in admin:
  - Output nu HTML → ook markdown variant
  - Passage lengte control in Mistral prompt (134-167 words per sectie)
  - Nieuwe sectie: "Waarom werken in {city}?" (uniek per stad × sector)
- [ ] **Stap 2** Batch enrichment endpoint `/api/admin/enrich-batch`:
  - Input: array van job_posting_ids
  - Mistral call per job → output in `job_postings.content_md`
  - Set `content_enriched_at`
- [ ] **Stap 3** Admin bulk action: "Verrijk geselecteerde" in review UI
- [ ] **Stap 4** Publish gate: alleen jobs met `content_enriched_at IS NOT NULL` kunnen `published_at` krijgen
- [ ] **Stap 5** Regeneratie-optie: "Refresh markdown" voor specifieke vacature
- [ ] Tests: enrich 10 vacatures → valideer output lengtes + heading structuur

---

### Fase 3 — Admin Bulk Review UI (3 dagen)

**Doel:** Luc/Kay kunnen efficiënt 500+ vacatures per uur reviewen met keyboard shortcuts + bulk acties.

- [ ] **Stap 1** Nieuwe route `/review` in admin app
- [ ] **Stap 2** Platform selector (dropdown), status filter, zoek, categorie filter
- [ ] **Stap 3** Virtualized lijst (react-virtual) voor 1000+ rijen
- [ ] **Stap 4** Keyboard shortcuts:
  - `J`/`K`: navigate up/down
  - `A`: approve huidige
  - `R`: reject huidige
  - `Space`: select/deselect
  - `Shift+Click`: range select
- [ ] **Stap 5** Preview drawer rechts: shadcn Sheet met job titel, description, enriched markdown, JSON-LD preview
- [ ] **Stap 6** Bulk acties: Approve (N), Reject (N), Archive (N), Enrich (N)
- [ ] **Stap 7** Approve logic:
  - Set `review_status = 'approved'`, `reviewed_by`, `reviewed_at`, `published_at = now()`
  - Auto-generate slug als NULL
  - Auto-assign `platform_id` via `postcode_platform_lookup` als NULL
  - Populate `job_posting_platforms` junction met primary + nearby
  - Trigger `revalidateTag()` voor betrokken tenants
  - Trigger IndexNow push
- [ ] **Stap 8** AI pre-score via Mistral: 0-100 kwaliteitsscore per vacature, sorteerbaar
- [ ] **Stap 9** Undo-stack: laatste 50 acties terugdraaibaar
- [ ] **Stap 10** `/admin/platforms/[id]` settings pagina:
  - Toggle `is_public`
  - Edit `domain`, `logo_url`, `primary_color`, `hero_title`
  - DNS checklist + Vercel domain status (via Vercel API)
- [ ] **Stap 11** Auto-assign service in `lib/services/platform-assigner.ts`:
  - Input: job_posting_id
  - Logic: zipcode → postcode_platform_lookup → dichtstbijzijnde platform = primary
  - Fallback: city → cities tabel → platform
- [ ] Tests: approve 50 vacatures in <2 min via keyboard, undo werkt, auto-assign correct

---

### Fase 4 — Pilot Launch: WestlandseBanen (1-2 dagen)

**Doel:** WestlandseBanen live op echte URL met minimaal 100 goedgekeurde vacatures, volledige SEO/GEO.

- [ ] **Stap 1** (Kay): Domein `westlandsebanen.nl` verwerven of bevestigen
- [ ] **Stap 2** (Kay): DNS A/CNAME naar Vercel
- [ ] **Stap 3** (Kenny): Custom domain toevoegen aan `lokale-banen-public` Vercel project
- [ ] **Stap 4** (Kenny): Toevoegen aan Clerk satellite domains
- [ ] **Stap 5** (Luc + Kay): Pilot batch review sessie:
  - Selecteer ~200-500 pending vacatures voor `platform_id = WestlandseBanen`
  - Trigger enrichment batch (~30 min Mistral processing)
  - Bulk review in nieuwe admin UI (~2 uur werk)
  - Target: minimaal 100 approved jobs live
- [ ] **Stap 6** (Luc): Platform settings invullen:
  - `domain = westlandsebanen.nl`
  - `is_public = true`
  - `logo_url` upload (Luc levert)
  - `primary_color` (brand kleur Westland)
  - `hero_title = "Vacatures in het Westland"`
  - `hero_subtitle = "Vind je nieuwe baan dichtbij huis"`
  - `seo_description`
- [ ] **Stap 7** (Kenny): Go-live checklist:
  - [ ] Homepage laadt <2s op mobiel
  - [ ] JSON-LD valideert per pagina
  - [ ] Lighthouse mobiel ≥95
  - [ ] Sitemap accessible
  - [ ] llms.txt accessible met echte content
  - [ ] robots.txt correct
  - [ ] Clerk login werkt op westlandsebanen.nl
  - [ ] Een testgebruiker kan saven + solliciteren
- [ ] **Stap 8** Search Console: submit sitemap, request indexing for homepage + 10 sample jobs
- [ ] **Stap 9** IndexNow: eerste batch push
- [ ] **Stap 10** Vercel Analytics: verify data binnenkomt
- [ ] **Stap 11** Communicatie: Luc's kanalen (LinkedIn, nieuwsbrief)

---

### Fase 5 — Master Aggregator (1 dag)

**Doel:** `lokalebanen.nl` als aggregator voor alle publieke platforms.

- [ ] **Stap 1** Insert master platform record:
  ```sql
  INSERT INTO platforms (name, regio_platform, domain, is_public, tier, hero_title, primary_color)
  VALUES ('Alle Banen', 'master', 'lokalebanen.nl', true, 'master',
          'Lokale vacatures in heel Nederland', '#...');
  ```
- [ ] **Stap 2** Update `getJobs()` query: als `tenant.tier = 'master'` → filter op `platform_id IN (public platforms)` ipv één specifiek
- [ ] **Stap 3** Master-specifieke homepage: extra regio-selector chip bar
- [ ] **Stap 4** DNS + Vercel domain + Clerk satellite
- [ ] **Stap 5** Go-live: `lokalebanen.nl` live als master

---

### Fase 6 — Brand Hub Setup (optioneel, 2 dagen na pilot)

**Doel:** Bouw de "Lokale Banen Netwerk" brand entity voor GEO citatie-signalen (zie GEO-ANALYSIS.md voor details).

- [ ] **Stap 1** Wikipedia page voorbereiden voor "Lokale Banen" netwerk
- [ ] **Stap 2** LinkedIn company page met multi-location (alle 50 regio's als locations)
- [ ] **Stap 3** KvK registratie bevestigen van brand name
- [ ] **Stap 4** Reddit account + 5-10 authentieke posts (niet promo)
- [ ] **Stap 5** YouTube channel (optioneel, voor later)
- [ ] **Stap 6** Schema `parentOrganization` op alle tenants → link naar hub

---

## 9. Timeline

| Fase | Dagen | Start | Eind | Kritiek voor |
|---|---|---|---|---|
| 0 — Foundation | 3 | dag 1 | dag 3 | Alles |
| 1 — Core Pages | 3 | dag 4 | dag 6 | Fase 2, 3, 4 |
| 1.5 — Account Features | 2 | dag 7 | dag 8 | Fase 4 (pilot) |
| 2 — SEO/GEO | 3 | dag 9 | dag 11 | Fase 4 |
| 2.5 — Content Enrichment | 1 | dag 12 | dag 12 | Fase 3, 4 |
| 3 — Admin Bulk Review | 3 | dag 12 | dag 14 | Fase 4 |
| 4 — Pilot Launch | 1-2 | dag 15 | dag 16 | — |
| 5 — Master Aggregator | 1 | dag 17 | dag 17 | — |
| **MVP totaal** | **~17** | | | |
| 6 — Brand Hub (optioneel) | 2 | dag 18 | dag 19 | Fase 6+ |

**Parallelisatie mogelijk**: Fase 2 (SEO/GEO) en Fase 3 (Admin review UI) kunnen deels parallel, één ontwikkelaar wisselt. Dat brengt MVP naar ~14 dagen.

---

## 10. Roles & Responsibilities

| Rol | Persoon | Verantwoordelijkheden |
|---|---|---|
| **Tech Lead / Developer** | Kenny | Architectuur, code implementatie, Supabase migraties, Clerk setup, deploys |
| **Content / Product Owner** | Luc | Pilot batch review, content-beslissingen, domein-keuzes, launch communicatie |
| **Ops / Domains** | Kay | DNS, domein-registratie, logo's verzamelen per regio |
| **AI Assistant** | Claude (via Kenny) | Plan execution, code generatie, verificatie, documentatie |

### Per-fase eigenaarschap

- **Fase 0-3**: Kenny (met Claude) — pure dev
- **Fase 4**: Kenny + Luc + Kay gezamenlijk
- **Fase 5**: Kenny
- **Fase 6**: Luc (marketing/brand) + Kenny (technisch)

---

## 11. Risico's & Mitigaties

| Risico | Waarschijnlijkheid | Impact | Mitigatie |
|---|---|---|---|
| Clerk JWT ↔ Supabase integratie werkt niet out-of-box | laag | hoog | Phase 0 Stap 4 includes dedicated test user flow |
| Pilot batch review duurt langer dan 4u | medium | medium | Luc krijgt AI pre-score om sorteren te versnellen |
| Mistral enrichment te duur bij 500 jobs | laag | medium | Rate limit + cost cap, alleen approved vacatures |
| DNS propagation vertraagt pilot launch | medium | laag | Voorbereid 48u voor launch |
| shadcn/ui + Cache Components edge cases | laag | medium | Test elk nieuw shadcn component in Phase 1 |
| Clerk satellite domain handshake glitch | laag | hoog | `satelliteAutoSync: true` enabled, fallback manual test |
| 1M job_postings query performance | laag | medium | Nieuwe indexes in 7.5 adresseren dit |
| Content hash uniqueness breekt bij meerdere sources | medium | laag | Accepteer duplicates MVP, dedup later |

---

## 12. Open Vragen / To Confirm

Geen blokkerende open vragen op dit moment. Alle architectuur-keuzes zijn genomen:

- ✅ Monorepo (pnpm workspaces + Turborepo)
- ✅ Clerk satellite domains, primary = `auth.lokalebanen.nl`
- ✅ shadcn/ui voor publieke app
- ✅ Next.js 16 + Cache Components in public, Next.js 15 in admin
- ✅ Clerk native avatar support
- ✅ Google OAuth in MVP (LinkedIn later)
- ✅ Externe redirect sollicitatie flow met logging
- ✅ Admin auth blijft bij bestaande `withAuth`
- ✅ Clerk Free tier tot employer portal launch
- ✅ Handmatige goedkeuring met bulk UI (geen auto-approve)
- ✅ Pilot = WestlandseBanen
- ✅ Master aggregator = `lokalebanen.nl`

---

## 13. Changelog

| Datum | Versie | Wijziging |
|---|---|---|
| 2026-04-11 | 1.0 | Eerste versie na architectuur sessie met Kenny. Alle keuzes verankerd. |

---

## 14. Gerelateerde documenten

- `.planning/DESIGN.md` — Design system, wireframes, shadcn component keuzes, mobile UX patterns
- `.planning/GEO-ANALYSIS.md` — SEO/GEO audit, schaalbaarheids-risico's voor 50 regio's, schema requirements
- `CLAUDE.md` — Project-wide instructies (blijft leidend)
