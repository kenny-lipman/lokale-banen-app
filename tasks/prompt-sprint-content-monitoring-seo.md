# Prompt — Lokale Banen: Content Seed + Master Aggregator + Monitoring + SEO

Kopieer deze hele prompt naar een nieuw Claude Code gesprek om de sprint op te starten.

---

Ik ben Kenny (CTO). Project: **Lokale Banen** — monorepo met 24 regionale jobboards in productie op Vercel. Lees eerst:
- `CLAUDE.md` (repo root) — conventies + toestemmingen (Supabase MCP mag altijd, commit mag autonoom, **push vragen**)
- `tasks/followups-mvp-v2.md` — laatste sprint overzicht
- `tasks/public-sites-architecture.md` — architectuur + gap analyse

## Huidige staat (wat er al is)

- **Monorepo**: `apps/admin` (Next.js 15), `apps/public-sites` (Next.js 16 Cache Components), `apps/employer-portal` (placeholder). Shared packages in `packages/`.
- **24 regio-jobboards live** op `*.vercel.app` aliases (utrechtsebanen, achterhoeksebanen, bosschebanen etc.). Elke heeft eigen `platforms` rij met `domain` (productie .nl, DNS wacht nog op Kay), `preview_domain` (vercel alias), `indexnow_key`, branding.
- **Host-based multi-tenant**: `apps/public-sites/src/proxy.ts` → `x-tenant-host` header → `lib/tenant.ts` resolve via `platforms.domain OR preview_domain`.
- **Admin CRUD**: `/job-postings` met tabs (pending/approved/rejected/all), bulk approve/reject, drawer met ActionBar (publish/unpublish/preview/archive), live-preview iframe, ActivityLog, HeaderImageField.
- **Cache invalidation**: admin PATCH/approve → `revalidatePublicSite()` → public-sites `/api/revalidate` met tag schema `platform:{id}`, `jobs:{id}`, `job:{slug}`, `company:{platformId}:{slug}`, `sitemap:{id}`, `platform:host:${host}`.
- **IndexNow**: `submitToIndexNow()` helper pingt api.indexnow.org bij publish/unpublish/bulk. Key file served via next.config rewrite op UUID-pattern.
- **DB schema**: `job_postings` (1M+ rijen), `platforms` (55 rows, 25 target), `companies`, `user_profiles` (Clerk bridge), `job_posting_platforms` (junction), `saved_jobs`, `job_applications`.
- **Supabase project_id**: `wnfhwhvrknvmidmzeclh`
- **Vercel projecten**: `lokale-banen-public` (prj_ht1wPrgsG5ktFLFyxTY3avUFMgGt), `lokale-banen-app` (prj_msZTE4F5g1ioUPzLjTgAxhsZZRHM). Team `team_PlngQPHXlPVJkziKq9MLOr3X`.
- **Env vars** (beide projects): `REVALIDATE_SECRET`, `PUBLIC_SITES_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_*` — al gezet.
- **Status van content**: alleen WestlandseBanen heeft 20 approved vacatures. De overige 23 preview URLs zijn inhoudelijk leeg (toont "Er zijn momenteel nog geen vacatures"). 1.009.181 pending rijen beschikbaar.

## Scope van deze sprint (4 onderdelen)

### 1. Content seed script (~1 uur)

Automatisch per platform 20-30 approved vacatures zodat alle 24 sites direct content tonen voor Kay/Luc review.

**Bouw**: `scripts/seed-approved-per-platform.mjs`
- Per platform (uit `platforms` waar `is_public=true AND preview_domain IS NOT NULL`): pak de 20 nieuwste pending vacatures met `scraped_at > now() - interval '90 days'`
- Voor elk: `UPDATE job_postings SET review_status='approved', published_at=now(), slug=<generated>, reviewed_by=NULL, reviewed_at=now() WHERE id=...`
- Gebruik zelfde slug algoritme als bulk-approve endpoint (title + city + 8-char id)
- Upsert in `job_posting_platforms` (is_primary=true)
- Na elke batch per platform: call `revalidatePublicSite({platformIds:[id], jobSlugs:[...]})` én `submitToIndexNow(...)` — beide services bestaan in admin, dus **run het script tegen een lokale admin dev server** OF importeer de services direct uit `apps/admin/lib/services/`.

**Na run**: verify 10 willekeurige platforms via `curl -s https://{slug}.vercel.app/vacatures` → moet ≥10 vacatures tonen.

### 2. Master aggregator `lokalebanen.nl` (~1 dag)

Master site die vacatures van ALLE 24 regio's toont — de landingspagina voor zoekers die niet regio-specifiek zijn.

**DB setup**:
- INSERT platform `LokaleBanen` met `tier='master'`, `domain='lokalebanen.nl'`, `preview_domain='lokalebanen-master.vercel.app'`, `is_public=true`, eigen kleuren + hero
- `tier='master'` is al bestaand maar ongebruikt

**Code**:
- `apps/public-sites/src/lib/tenant.ts`: detect `tenant.tier === 'master'` en expose in `Tenant` interface
- `apps/public-sites/src/lib/queries.ts`: nieuwe functies `getJobsAcrossAllPlatforms(filter)`, `getTopPlatforms()`, `getTopCitiesAcrossPlatforms()`. Join via `job_posting_platforms` junction (niet alleen primary). Cache met `cacheTag('master:jobs')`, `cacheLife('minutes')`.
- `apps/public-sites/src/app/page.tsx`: als `tenant.tier === 'master'`, render master landing (hero + top 24 platforms grid + gecombineerde vacatures feed). Niet-master blijft huidige regio-homepage.
- `apps/public-sites/src/app/vacatures/page.tsx`: als master, render gecombineerde lijst met platform-badge per vacature + filter op platform.
- Sitemap + llms.txt: als master, render all platforms en cross-regio jobs.

**Vercel alias**: `vercel alias set <deploy-url> lokalebanen-master.vercel.app` (of via script).

**Canonical URLs**: vacatures op master → canonical altijd naar primary platform (gebruik bestaande `getCanonicalInfo` in `canonical.ts`).

### 3. Monitoring (~0.5 dag)

**Sentry** in beide Next.js apps:
- `pnpm add -w @sentry/nextjs` in beide apps
- `npx @sentry/wizard@latest -i nextjs` per app, OR handmatig config files
- DSN als env var (`SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`)
- Release tracking via git commit SHA
- Source maps upload bij Vercel build
- Tag per tenant (uit `x-tenant-host` of `tenant.id`) — essentieel voor multi-tenant debugging

**Vercel Analytics** in `apps/public-sites`:
- `pnpm add @vercel/analytics @vercel/speed-insights`
- Mount `<Analytics />` + `<SpeedInsights />` in `src/app/layout.tsx`

**Slack alerts uitbreiden** (bestaande watchdog in `cron_job_logs`):
- Uitbreiden naar: 5xx rate spike (>1% in 5 min), revalidate endpoint failure, IndexNow non-OK responses, Supabase slow query (>2s)
- Check bestaande `apps/admin/app/api/cron/watchdog/` voor patroon

### 4. SEO finetuning (~0.5 dag)

**Per-tenant audits** (alle 24):

- **`sitemap.xml`**: bestaat al op `apps/public-sites/src/app/sitemap.ts` — check dat hij alleen approved+published jobs include, per-tenant gefilterd, `<lastmod>` correct (uit `updated_at` of `published_at`). Add `<changefreq>daily</changefreq>` en `<priority>`. Voor master: sitemap index die linkt naar alle 24 sub-sitemaps.

- **`robots.txt`**: bestaat op `robots.ts` — verify `Sitemap:` pointer klopt per host, geen onbedoelde `Disallow:` voor crawlers.

- **`llms.txt` per tenant** — NIEUW. Create `apps/public-sites/src/app/llms.txt/route.ts` met tenant context + top N vacatures (zie llmstxt.org spec). Voor master: links naar alle 24 tenants.

- **Canonical URL audit**: curl 5 vacature URLs per tenant, check dat `<link rel="canonical">` correct is (al deels gebouwd via `canonical.ts`).

- **JSON-LD JobPosting audit**: run 3 vacatures door Google Rich Results Test — zorg dat alle required fields compleet zijn (`hiringOrganization`, `jobLocation`, `datePosted`, `validThrough`, `employmentType`).

- **hreflang** (als meerdere platforms zelfde stad delen, bv Doetinchem in Achterhoek én Oost-Nederland): decide policy — ik zeg nee, gewoon canonical naar primary. Documenteer.

- **IndexNow submission**: genereer eenmalige "all URLs" submit per platform (sitemap URLs) zodat BingBot snel alle approved content weet. Script in `scripts/indexnow-initial-seed.mjs`.

## Werkwijze

1. **Parallel agents in worktrees** waar mogelijk:
   - Content seed (#1) kan ik zelf (30 min script), of 1 agent
   - Master aggregator (#2) is groot — 1 agent, goed brief
   - Monitoring (#3) — 1 agent (Sentry + Analytics + Slack extensions)
   - SEO audit (#4) — 1 agent
   - Dus potentieel 3-4 parallelle agents

2. **Deployment** via `git push origin main` — beide projects auto-deployen. Na public-sites deploy: `node scripts/vercel-aliases-bulk.mjs` met nieuwe PROD_DEPLOYMENT_URL.

3. **Commits**: autonoom mag. Conventional commits (feat:, fix:, chore:, perf:). `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`.

4. **Push**: vraag mij eerst. Zelfs voor kleine fixes.

5. **DB migraties**: via `mcp__supabase__apply_migration`. Na DDL: `mcp__supabase__get_advisors` met type=security + type=performance. Rapporteer issues.

6. **Cache**: public-sites gebruikt Next 16 Cache Components. Elke DB-reading function moet `'use cache'` + `cacheTag(...)` + `cacheLife(...)` hebben. Import uit `next/cache`. Let op: `cacheComponents: true` staat aan — kan niet mengen met `force-dynamic`.

7. **Types**: `apps/admin/lib/supabase.ts` is onlangs geregenereerd (15 apr). Als je nieuwe tabellen/kolommen toevoegt, regen types opnieuw en update casts.

## Beslispunten die ik wil bevestigen voordat je begint

1. **Content seed: hoeveel per platform**? 20 (veilig) of 30 (meer content, meer "spam" risico als scraper junk heeft)?
2. **Content seed: filter op recent**? Alleen pending met `scraped_at > 90 days ago` of oudere ook?
3. **Master aggregator: welk domain gebruikt?** `lokalebanen.nl` is het beoogde productiedomein — voor Vercel preview gebruik ik `lokalebanen-master.vercel.app` of `lokalebanen.vercel.app` (vrij?)
4. **Sentry: gratis tier** of betaald? Impact op budget.
5. **llms.txt: hoeveel jobs embedden**? Top 50 per tenant lijkt redelijk, of top 200?

Geef antwoorden op 1-5 en bevestig de scope. Dan spawnen we agents.

## Out of scope

- Platform-scoped permissies (volgende sprint)
- Radius-based `job_posting_platforms` writes bij approve (volgende sprint)
- Duplicate detectie bij scrape
- Email digest voor Luc/Kay
- Employer portal
- i18n / mobile app
- `still_pending` vs `pending` semantic consolidation

## Referentie

- `tasks/public-sites-architecture.md` — volledige architectuur + 8 schema diagrams
- `tasks/followups-mvp-v2.md` — vorige sprint beslissingen
- `tasks/task3-admin-wizards-upload-junction.md` — admin wizard ontwerp
- Git log `main` — alle commits van afgelopen 2 weken

Start. Vraag wat je nog nodig hebt voordat je de agents spawnt.
