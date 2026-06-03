# Lokale Banen - Claude Code Context

Dit bestand is een **inhoudsopgave**, geen volledig handboek. Lees het, identificeer de 1-3 relevante reference docs voor je taak, en lees alleen die. Niet alles inlezen "om volledig te zijn".

## Wat is het systeem

Lokale Banen is een job posting aggregation platform: scrapet vacatures uit meerdere bronnen, verrijkt company-data, en synct met CRM-systemen (Pipedrive, Instantly). Monorepo met drie apps: `apps/admin` (hoofd-app), `apps/employer-portal`, `apps/public-sites` (50+ regio jobboards).

## Hard rules (altijd geldig)

- **Geen em-dash** (U+2014, het lange streepje). Geldt voor user-facing content (JSX, Markdown, e-mails, SEO titles), code-comments, JSDoc en commit messages. Gebruik punt/komma/dubbele punt/hyphen (`-`) of herfraseer. Geldt voor alle apps + scripts + docs.
- **Auth-seam**: elke `route.ts` heeft een verplichte `// @auth <KLASSE>` marker op regel 1, afgedwongen door een Vitest-gate. Zie `docs/reference/conventions.md`.
- **Na DB schema-changes**: `apply_migration` -> `get_advisors` -> regenerate TypeScript types.
- **Onderhoud van deze docs**: wijzig je iets significants aan een gedocumenteerd domein (UI-component, scraper, schema, auth-flow, cron), werk dan de bijbehorende `docs/reference/*.md` bij in **dezelfde commit**. Doc en code lopen nooit uiteen.

## Tech stack & kerncommands

- **Framework**: Next.js (App Router), Turbo monorepo, pnpm
- **Database**: Supabase (PostgreSQL), Project ID `wnfhwhvrknvmidmzeclh`
- **Deployment**: Vercel. Production: `https://lokale-banen-app.vercel.app`
- **UI**: shadcn/ui (`apps/admin/components/ui/`)
- **AI**: Mistral (parsing + personalization)

Commands (vanuit repo-root, tenzij anders):
- `pnpm dev` / `pnpm dev:admin` / `pnpm dev:public` - dev servers
- `pnpm build` - build alle apps
- `pnpm type-check` - TypeScript check
- `pnpm lint` - lint
- Tests: Vitest in `apps/admin` (o.a. de auth-coverage gate)

## Reference docs (lees per taak wat relevant is)

| Onderwerp | Doc | Wanneer lezen |
|-----------|-----|---------------|
| Programmeer-conventies | `docs/reference/conventions.md` | API routes, Supabase clients, auth-seam, types, naming, Mistral-patterns. **Lees dit voor vrijwel elke code-taak.** |
| UI-componenten | `docs/reference/ui-components.md` | Bouwen/wijzigen van admin-UI. Welke component wanneer, custom vs shadcn. |
| Scrapers | `docs/reference/scrapers.md` | Werk aan baanindebuurt/debanensite/werkenindekempen/Apify-scrapers. |
| Cron jobs | `docs/reference/cron-jobs.md` | Toevoegen/wijzigen scheduled jobs, monitoring, watchdog. |
| Database | `docs/reference/database.md` | Schema, key tables, dedup-logica, job_sources cascade. |
| Auth & users | `docs/reference/auth.md` | Session-flow, role-systeem, users CRUD, password reset. |
| Campaigns | `docs/reference/campaigns.md` | Campaign assignment orchestrator/worker, WeTarget, Instantly API. |
| Custom domains | `docs/reference/custom-domains.md` | Echte .nl-domeinen koppelen aan public-sites via TransIP + Vercel API. |

### Aanvullende guides (root)

- `API-AUTHENTICATION-GUIDE.md` - uitgebreide API-auth referentie
- `DATABASE-OPERATIONS-GUIDE.md` - DB-operaties draaiboek
- `SECURITY-IMPLEMENTATION-GUIDE.md` - security-implementatie

## Environment Variables (kern)

- `CRON_SECRET` - Vercel Cron auth (auto-sent als Bearer token); `CRON_SECRET_KEY` is legacy alias (zelfde value)
- `MISTRAL_API_KEY` - AI parsing
- `SUPABASE_SERVICE_ROLE_KEY` - server-side Supabase operations
- `INSTANTLY_API_KEY` - Instantly campaigns

## Voor subagents

Een subagent start vers met CLAUDE.md. Instrueer in de prompt expliciet welke reference doc(s) gelezen moeten worden voor de taak, niet "lees CLAUDE.md en bepaal zelf".
