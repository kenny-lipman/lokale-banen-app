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

## Next Steps

Fase 2 starten: blocking auth-overlay slopen + `AuthProvider` non-blocking maken + server-side user-data in `app/layout.tsx`.

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
