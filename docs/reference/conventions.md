# Programmeer-conventies

> Onderhoudsregel: bij significante wijziging aan een gedocumenteerd pattern, werk deze doc bij in dezelfde commit.

Dit document beschrijft HOE wij in de Lokale-Banen monorepo programmeren. Het is een reference-doc waar `CLAUDE.md` naar pointert. Lees dit als je een API-route, service, of Supabase-query toevoegt of wijzigt. De patterns hieronder zijn afgeleid uit de echte code, niet verzonnen.

## Writing convention (hard regel)

GEEN em-dash (Unicode U+2014, het lange streepje) in user-facing content (JSX strings, Markdown, e-mails, SEO titles), code-comments, JSDoc en commit messages. Geldt voor alle apps (`apps/admin`, `apps/employer-portal`, `apps/public-sites`), scripts en docs. Gebruik in plaats daarvan een punt, komma, dubbele punt of gewone hyphen (`-`), of herfraseer de zin.

## Monorepo-structuur

Drie Next.js (App Router) apps onder `apps/`:

| App | Doel |
|-----|------|
| `apps/admin` | Interne admin/dashboard (scrapers, sales, CRM-sync). De bulk van de code. |
| `apps/employer-portal` | Werkgever-portaal. |
| `apps/public-sites` | 50+ regio jobboards (multi-tenant). |

Database = Supabase (PostgreSQL), project ID `wnfhwhvrknvmidmzeclh`. Deployment via Vercel.

### Folder-structuur per app

Voor `apps/admin` (canonieke indeling, de andere apps volgen dezelfde geest):

- `app/` - App Router routes. Pages in route-groepen zoals `app/(dashboard)/`, API-routes onder `app/api/**/route.ts`.
- `components/` - React-componenten.
- `hooks/` - Custom React hooks.
- `contexts/` - React context providers.
- `lib/` - Niet-React logica: clients, services, utils, middleware-helpers.
  - `lib/services/` - Business-logica, gegroepeerd per domein (bv. `lib/services/sales-leads/`, `lib/services/werkenindekempen/`). Bestanden eindigen op `.service.ts`.
  - `lib/scrapers/` - Scraper-implementaties per bron (`baanindebuurt/`, `debanensite/`, `werkenindekempen/`).
  - `lib/automations/` - Cron-job logica, los van de route-wrapper.
  - `lib/utils/` - Gedeelde pure helpers (bv. `url.ts`).
- `types/` - Losse type-definities.
- `__tests__/` - Vitest-tests.

`apps/public-sites` gebruikt `src/` als root (`src/app`, `src/components`, `src/lib`).

## Naming-conventies

- **Database**: tabellen en kolommen `snake_case` (bv. `job_postings`, `last_seen_in_sitemap`). Zo ook bij nieuwe migraties.
- **React-componenten**: `PascalCase` als component-naam. Component-bestanden zijn gemengd: nieuwere bestanden `kebab-case.tsx` (`company-drawer.tsx`, `companies-table.tsx`), oudere `PascalCase.tsx` (`Sidebar.tsx`, `BulkActionBar.tsx`). Volg voor nieuwe bestanden `kebab-case.tsx`, want dat is de meerderheidsstijl in recent werk.
- **Hooks**: bestand en functie `use*`. Bestand bij voorkeur `kebab-case` (`use-companies-cache.tsx`, `use-debounce.tsx`). Enkele oudere camelCase-bestanden bestaan nog (`useAutomationPreferences.tsx`).
- **Services**: `kebab-case.service.ts` (`company-enrichment.service.ts`, `pipedrive-sync.service.ts`).
- **Lib-utils**: `kebab-case.ts`.

## API-routes

Elke route leeft in `app/api/<pad>/route.ts` en exporteert HTTP-method handlers (`GET`, `POST`, `PATCH`, `DELETE`).

### Auth-seam: verplichte `// @auth` marker (hard regel)

Elke `route.ts` MOET op de eerste regels een marker hebben en de bijbehorende wrapper gebruiken. Dit is een fail-closed gate: een Vitest-test (`apps/admin/__tests__/auth-coverage.test.ts`) faalt als een route geen marker heeft, een ongeldige klasse gebruikt, of de verkeerde wrapper. Geen enkele route belandt zonder bewuste auth-keuze in productie.

De vijf klassen en hun wrapper (uit `apps/admin/lib/auth-middleware.ts`):

| Marker | Betekenis | Vereiste wrapper |
|--------|-----------|------------------|
| `// @auth PUBLIC` | Geen auth (zeldzaam, bewust). | geen |
| `// @auth SESSION` | Elke ingelogde user. | `withAuth(handler)` |
| `// @auth ADMIN` | Alleen admins. | `withAdminAuth(handler)` |
| `// @auth SECRET` | Cron/system-call via `CRON_SECRET` Bearer-token. | `withCronAuth`, `withCronMonitoring`, of `withAutomationMonitoring` |
| `// @auth SIGNATURE` | Webhook met HMAC-verificatie. | `withWebhookSecurity` |

`SESSION` is verreweg het meest gebruikt, daarna `SECRET` en `ADMIN`.

### Typische SESSION-route

```ts
// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'

async function companiesGetHandler(req: NextRequest, authResult: AuthResult) {
  try {
    const { supabase } = authResult            // RLS-respecterende client van de user
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    // ... query bouwen ...
    const { data, error, count } = await query
    if (error) {
      console.error('Error fetching companies:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    return NextResponse.json({ data: data || [], count: count || 0 })
  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export const GET = withAuth(companiesGetHandler)
```

`withAuth`/`withAdminAuth` geven je een `AuthResult` met `{ user, profile, supabase }`. Die `supabase` is de RLS-client van de ingelogde user (uit cookies of Authorization-header). Auth-fouten (401/403) worden door de wrapper afgehandeld met een standaard error-shape, dus je handler hoeft alleen de business-fouten te vangen.

### Typische SECRET (cron) route

Cron-logica zelf staat in `lib/automations/<naam>.ts` als een `run()`-functie. De route is dun:

```ts
// @auth SECRET
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
export const GET = POST          // Vercel Cron stuurt GET
export const maxDuration = 300   // lambda timeout
```

`withAutomationMonitoring(automationId)` wrapt intern met `withCronAuth` (Bearer `CRON_SECRET`) en logt elke run naar de `automation_runs` tabel (start, duur, status, business-stats), met orphan-cleanup en duplicate-run-bescherming via een unique partial index. `withCronMonitoring(jobName, path)` is een deprecated alias die naar `withAutomationMonitoring` doorverwijst, gebruik bij nieuwe jobs direct `withAutomationMonitoring`.

### Response-shape en status-codes

- Succes: `NextResponse.json({ data, count, ... })` of `{ success: true, ... }`.
- Auth-fout (door wrapper): `{ success: false, error, code, timestamp }` met status 401 (auth) of 403 (autorisatie).
- Business/server-fout: `{ error: '...', details?: ... }` met de passende status (`400` validatie, `404` niet gevonden, `500` server). Cron-routes gebruiken `{ success, stats, error, message }`.

Request-parsing: query-params via `new URL(req.url).searchParams`, body via `await req.json()`.

## Supabase clients: welke wanneer

Drie soorten clients. De regel: gebruik de RLS-respecterende client tenzij je expliciet RLS moet omzeilen.

| Client | Bestand / functie | Wanneer |
|--------|-------------------|---------|
| Browser (anon) | `apps/admin/lib/supabase.ts` `createClient()` (singleton, `createBrowserClient` van `@supabase/ssr`) | Client-side React. Schrijft `sb-*` cookies die middleware en API-routes lezen. |
| Server (anon, RLS) | `apps/admin/lib/supabase-server.ts` `createServerClient()` / `createServerClientFromRequest(req)` | Server Components en API-routes die als de user moeten queryen (RLS aan). In SESSION/ADMIN-routes krijg je deze al via `authResult.supabase`. |
| Service-role (bypass RLS) | `createServiceRoleClient()` (in zowel `supabase.ts` als `supabase-server.ts`) | Administratieve/cron/system-operaties die volledige toegang nodig hebben. `autoRefreshToken: false`, `persistSession: false`. NOOIT in client-side code. |

Regel service-role vs anon: gebruik **anon/ssr** (RLS) voor alles wat namens een ingelogde user gebeurt. Gebruik **service-role** alleen voor cron-jobs, webhooks, scrapers en system-taken die data van alle users raken of waar geen user-sessie is. Service-role omzeilt alle RLS, dus elke service-role-query is volledig jouw verantwoordelijkheid qua scoping.

Beide service-role-factories geven een Proxy terug die pas bij eerste gebruik throwt als de env-vars missen. Dat is bewust, zodat Next.js tijdens de build page-data kan verzamelen zonder dat de secrets aanwezig zijn.

## Supabase types

De `Database`-type wordt gegenereerd door Supabase en leeft in `apps/admin/lib/supabase.ts` (`export type Database`, plus de helpers `Tables<>`, `TablesInsert<>`, `TablesUpdate<>`, `Enums<>` en `Constants`). Niet handmatig editen, dit bestand wordt geregenereerd.

Importeer als type-only en geef hem door aan de client-factory:

```ts
import type { Database } from './supabase'
// createSupabaseClient<Database>(url, key)
```

Voor row-types in services: gebruik de generieke helpers, bv. `Tables<'companies'>` of `TablesInsert<'job_postings'>`, in plaats van handmatig interfaces te schrijven.

Na schema-changes: `apply_migration` -> `get_advisors` -> regenereer types via `mcp__supabase__generate_typescript_types`.

## Services

Business-logica hoort in `lib/services/<domein>/`, niet in de route. Een service:

- Heeft een duidelijke verantwoordelijkheid en exporteert functies of een class.
- Krijgt zijn Supabase-client doorgegeven of maakt zelf de juiste client aan (service-role voor system-taken).
- Throwt of returnt een gestructureerd `{ success, error, ... }` resultaat. Cron-`run()`-functies returnen `{ success, stats, error }` zodat de route-wrapper dat kan doorgeven.

De route blijft dun: parse input, roep service aan, map resultaat naar `NextResponse`.

## Gedeelde utils

Pure, herbruikbare helpers horen in `lib/utils/`. Voorbeeld-conventie: `apps/admin/lib/utils/url.ts`.

```ts
// normalizeUrl: canonicaliseert URLs voor dedupe.
// Strip www., trailing slash, query, fragment. Returnt null bij invalide input.
export function normalizeUrl(input: string): string | null { /* ... */ }
```

Kenmerken die we aanhouden voor utils: kleine pure functies, defensief met input (null/empty checks), expliciete JSDoc die de regel en de edge-cases beschrijft, en een duidelijk return-contract (hier: `null` bij invalide input, caller beslist of dat een fout is). Gebruik `normalizeUrl` overal waar URLs vergeleken of gededupliceerd worden (career-page-bronnen dedupen op `(company_id, url)`).

## Mistral AI

Er zijn twee patronen, afhankelijk van de context.

1. **Gedeelde service** (voorkeur voor sales/enrichment): `apps/admin/lib/services/sales-leads/mistral.service.ts` exporteert een `MistralService`-class met `completeJson<T>({ systemPrompt, userPrompt, model?, maxTokens? })`. Kenmerken:
   - JSON-mode (`response_format: { type: 'json_object' }`), geparseerd naar generic `T`.
   - Retry 2x met backoff bij 429/5xx, een aparte non-retryable error-class.
   - Concurrency-cap via een `Semaphore(3)` om Mistral per-second rate-limits niet te overschrijden.
   - Prompts staan los in `prompts/<naam>.v<n>.ts` (geversioneerd).
   - Default model `mistral-small-latest`.

2. **Scraper-lokaal**: de scrapers (`lib/scrapers/baanindebuurt`, `debanensite`, `werkenindekempen`) callen `https://api.mistral.ai/v1/chat/completions` (of `/v1/ocr` voor PDF) direct met `process.env.MISTRAL_API_KEY` en `mistral-small-latest`. Dit is historisch zo gegroeid per scraper.

Voor nieuwe AI-features buiten een scraper: gebruik of breid `MistralService` uit in plaats van een nieuwe directe fetch. De API-key komt altijd uit `process.env.MISTRAL_API_KEY`.

## Error handling en logging

- **In routes**: `try/catch` rond de handler-body, log met `console.error('context:', error)`, return een gestructureerde JSON-error met de juiste status. Auth-fouten laat je over aan de wrapper.
- **In services/automations**: vang Supabase-fouten expliciet af (`const { data, error } = await ...; if (error) { ... }`). Log met een herkenbare prefix, bv. `console.error('[automation-monitor] ...', error.message)`.
- **Postgres error-codes** worden expliciet afgehandeld waar relevant: `23505` (unique violation), `42501` (RLS-policy), `42P01` (table bestaat niet). Zie `lib/error-handler.ts` (`OtisErrorHandler`) voor de mapping naar `{ type, message, retry }`.
- **Sentry** is geconfigureerd per app (`sentry.{client,edge,server}.config.ts`) voor productie-error-tracking.

Logging-stijl: `console.error`/`console.warn` met een korte context-prefix tussen vierkante haken voor system-componenten (`[automation-monitor]`). Geen los logging-framework, console + Sentry + de DB-logtabellen (`automation_runs`, `cron_job_logs`) dragen de observability.

## Commits

Conventional commits. Toegestane types: `feat:`, `fix:`, `refactor:`, `perf:`, `docs:`, `test:`, `chore:`. Geen em-dash in de commit-message (zie boven). Optioneel scope tussen haakjes, bv. `feat(job-postings): zoekbalk in filter-dropdown`.
