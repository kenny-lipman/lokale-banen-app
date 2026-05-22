# Lokale Banen — Architectuur Refactor

Multi-fase werk: rename naar OTIS + auth UX + TanStack Query + UI-audit.

## Fases

### Fase 1 — Rename `/dashboard` → `/otis` (done)
- [x] Server-side route `/otis` werkend (kopie van dashboard)
- [x] `/dashboard` server-redirect naar `/otis`
- [x] Alle interne refs vervangen (Sidebar, redirects, prefetch keys)
- [x] Logo placeholder met "OTIS" wordmark
- [x] App title aangepast naar "OTIS"
- [x] Build groen
- [ ] Verify in browser: bezoek `/dashboard` → redirect naar `/otis`; sidebar toont OTIS-wordmark

### Fase 2 — Sloop blocking auth-overlay
- [ ] `AuthProvider` non-blocking maken
- [ ] `authenticated-layout.tsx` overlay verwijderen
- [ ] Server-side user-data in `app/layout.tsx`
- [ ] 8 useAuth-consumers auditen
- [ ] Verify: navigatie zonder "Authenticatie controleren..." flash

### Fase 3 — TanStack Query vervangt SWR
- [ ] TanStack Query installeren + provider
- [ ] Patroon vastleggen in `lib/queries/`
- [ ] Eerste scherm migreren (job-postings)
- [ ] Restmigratie: alle SWR-hooks → TanStack Query
- [ ] SWR uninstall
- [ ] Verify: optimistic updates werken op job-postings

### Fase 4 — UI-audit + skeletons
- [ ] Audit van 5 meest-gebruikte schermen
- [ ] Custom components review
- [ ] Skeletons standaardiseren
- [ ] Link-prefetch overal aan
- [ ] Tabel-virtualisatie waar nodig

## Next Steps

Fase 2 starten: blocking auth-overlay slopen + `AuthProvider` non-blocking maken + server-side user-data in `app/layout.tsx`.

## Aangeraakte files

### Fase 1 (2026-05-22)
- `apps/admin/app/otis/page.tsx` (new — kopie van oude dashboard met heading "OTIS")
- `apps/admin/app/dashboard/page.tsx` (legacy-redirect naar `/otis`)
- `apps/admin/app/page.tsx` (root redirect target)
- `apps/admin/app/admin/gebruikers/page.tsx` (admin-guard redirect target)
- `apps/admin/app/layout.tsx` (metadata title "OTIS")
- `apps/admin/lib/swr-prefetch.ts` (prefetcher key)
- `apps/admin/components/Sidebar.tsx` (href + label)
- `apps/admin/components/authenticated-layout.tsx` (router.replace target)
- `apps/admin/components/ui/logo.tsx` (vervangen door OTIS wordmark placeholder)
