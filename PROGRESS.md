# Lokale Banen - Architectuur Refactor

Multi-fase werk: rename naar OTIS + auth UX + TanStack Query + UI-audit.

## Fases

### Fase 1 - Rebrand naar OTIS (in progress)
- [x] Dashboard verhuisd naar `/` (root)
- [x] `/dashboard` en `/otis` server-redirect naar `/`
- [x] Alle interne refs vervangen (Sidebar, redirects, prefetch keys)
- [x] Logo placeholder met "OTIS" wordmark
- [x] App title aangepast naar "OTIS"
- [x] Hard-coded `lokale-banen-app.vercel.app` refs vervangen door `otis-app.vercel.app` (4 files)
- [x] Build groen na route-reshuffle
- [ ] **Door user**: Vercel project rename `lokale-banen-app` -> `otis-app` (via dashboard)
- [ ] **Door user**: env-var `NEXT_PUBLIC_APP_URL` updaten naar `https://otis-app.vercel.app`
- [ ] Verify in browser: `/` toont dashboard; `/dashboard` en `/otis` redirecten naar `/`

### Fase 2 - Sloop blocking auth-overlay
- [ ] `AuthProvider` non-blocking maken
- [ ] `authenticated-layout.tsx` overlay verwijderen
- [ ] Server-side user-data in `app/layout.tsx`
- [ ] 8 useAuth-consumers auditen
- [ ] Verify: navigatie zonder "Authenticatie controleren..." flash

### Fase 3 - TanStack Query vervangt SWR
- [ ] TanStack Query installeren + provider
- [ ] Patroon vastleggen in `lib/queries/`
- [ ] Eerste scherm migreren (job-postings)
- [ ] Restmigratie: alle SWR-hooks → TanStack Query
- [ ] SWR uninstall
- [ ] Verify: optimistic updates werken op job-postings

### Fase 4 - UI-audit + skeletons
- [ ] Audit van 5 meest-gebruikte schermen
- [ ] Custom components review
- [ ] Skeletons standaardiseren
- [ ] Link-prefetch overal aan
- [ ] Tabel-virtualisatie waar nodig

### Security - API auth-seam (gestart 2026-05-29, aparte werkstroom)

Fail-open -> fail-closed. Zie DECISIONS.md (2026-05-29). NB: dit is de API-route-auth, los van Fase 2 (client-side auth-overlay).

**Gedaan:**
- [x] Security-review: 62 onbeschermde niet-publieke routes (31 muterend), bypassbare `validateDashboardRequest`, 2x hardcoded Instantly-key geverifieerd.
- [x] Beide hardcoded Instantly-keys -> `process.env.INSTANTLY_API_KEY` (`contacts/route.ts:525`, `instantly-campaigns/[campaignId]/details/route.ts:4`).
- [x] Aanroeper-inventarisatie 69 routes + klasse per route. `otis-app.vercel.app` = eigen deploy (geen externe frontend). Public-sites lezen Supabase direct, raken admin-API niet -> geen operationeel effect op publieke vacatures.
- [x] Pilot-patroon bevestigd.

**Conventie:**
```ts
import { withAuth, AuthResult } from '@/lib/auth-middleware'   // of withAdminAuth
export const auth = 'SESSION'   // SESSION/ADMIN/SECRET/SIGNATURE/PUBLIC
type Ctx = { params: Promise<{ id: string }> }   // alleen dynamisch
async function getHandler(req: NextRequest, _auth: AuthResult, ctx: Ctx) { ... }
export const GET = withAuth(getHandler)
```
Wrapper: SESSION=withAuth, ADMIN=withAdminAuth, SECRET=withCronAuth, SIGNATURE=withWebhookSecurity, PUBLIC=geen.

**Gedaan (vervolg):**
- [x] CI-test `__tests__/auth-coverage.test.ts`: marker `// @auth <KLASSE>` + wrapper-consistentie per route. GROEN.
- [x] Marker-conventie: Next.js verbiedt `export const auth` in route.ts -> comment-marker `// @auth X` i.p.v. export.
- [x] 145 reeds-gewrapte routes auto-gemarkeerd (script, klasse afgeleid uit wrapper).
- [x] 86 handmatige routes geclassificeerd + gewrapt (51 mechanisch via subagents, 35 zelf incl. manual-Bearer/SECRET/PUBLIC).
- [x] `validateDashboardRequest` + `validateSupabaseAuth` verwijderd uit api-auth.ts (bypassbaar; ongebruikt na migratie).
- [x] Verify: `pnpm exec tsc --noEmit` 0 errors; volledige vitest-suite 301 passed; coverage-gate groen.

**Status:** in-route auth-laag COMPLEET. 227/233 routes expliciet geauthenticeerd; 6 bewust pending (zie KNOWN_PENDING in auth-coverage.test.ts). De 62 open gaten zijn gedicht op de autoritatieve (route-)laag.

**Next steps:**
1. [ ] Middleware fail-closed + bypass-prefixlijst (defense-in-depth, OUTWARD-FACING). Security-gaten zijn al gedicht in-route; dit is extra hardening tegen CVE-29927-achtige middleware-bypass. Bypass-lijst = alle niet-SESSION/ADMIN paden (PUBLIC/SECRET/SIGNATURE/pending). NIET blind flippen - eerst review.
2. [ ] 6 pending routes: 3 webhooks (instantly/mailerlite/apollo-result) vereisen HMAC-secret-afstemming met provider + uitbreiding `WebhookType`/`getWebhookSecret`; process + mailerlite/backfill+setup hebben al secret-auth, caller bevestigen voor tighten.
3. [ ] **Door user**: Instantly API-key roteren (gelekt via git).

## Next Steps

Auth-seam: CI-test + batch-wrapping (zie security-sectie hierboven).
Daarnaast openstaand: Fase 2 (blocking auth-overlay slopen + `AuthProvider` non-blocking + server-side user-data in `app/layout.tsx`).

## Aangeraakte files

### Fase 1 (2026-05-22)
Eerste poging: `/dashboard` -> `/otis` (commits 9defd09 + 7830195).
Correctie na user-feedback: domain rebrand i.p.v. URL-segment-rename. Dashboard verhuist naar `/`.

- `apps/admin/app/page.tsx` (root = dashboard content)
- `apps/admin/app/otis/page.tsx` (legacy-redirect naar `/`)
- `apps/admin/app/dashboard/page.tsx` (legacy-redirect naar `/`)
- `apps/admin/app/admin/gebruikers/page.tsx` (non-admin redirect target -> `/`)
- `apps/admin/app/layout.tsx` (metadata title "OTIS")
- `apps/admin/lib/swr-prefetch.ts` (prefetcher key `/`)
- `apps/admin/components/Sidebar.tsx` (href `/` + label OTIS)
- `apps/admin/components/authenticated-layout.tsx` (router.replace target `/`)
- `apps/admin/components/ui/logo.tsx` (OTIS wordmark placeholder)
- `apps/admin/lib/api-auth.ts` (referer-check accepteert otis-app.vercel.app + legacy)
- `apps/admin/lib/auth/password-reset.ts` (fallback URL otis-app.vercel.app)
- `apps/admin/lib/services/sales-leads/website/ssrf-fetch.ts` (User-Agent + URL)
- `apps/admin/app/api/scrapers/werkenindekempen/backfill/route.ts` (doc-comment URL)

### User-acties Fase 1 (handmatig via Vercel dashboard)
1. **Vercel project rename**: dashboard -> Settings -> General -> Project Name -> `otis-app`. Production URL wordt direct `otis-app.vercel.app`. Oude URL `lokale-banen-app.vercel.app` blijft als alias maar Vercel ondersteunt de oude naam ~90 dagen voor terugval.
2. **Env-var update**: in Vercel project -> Settings -> Environment Variables -> `NEXT_PUBLIC_APP_URL` -> `https://otis-app.vercel.app` (Production scope).
3. **Optioneel**: package.json `name` field van `@lokale-banen/admin` naar `@otis/admin` (cosmetic, niet kritiek).
