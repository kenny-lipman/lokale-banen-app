# Next Session — Lokale Banen UI Polish

## Context

Lokale Banen is een monorepo met 53+ regionale vacature-jobboards (AchterhoekseBanen, UtrechtseBanen, etc.) — één Next.js 15 codebase in `apps/public-sites/`, per-tenant theming via CSS vars (`--primary`, `--secondary`, `--tertiary`).

**Live**: https://lokale-banen-app.vercel.app  
**Admin**: `apps/admin/` (apart deployed)

---

## Wat er al is (ga er niet opnieuw mee bezig)

### Public sites (apps/public-sites/)
- **Homepage** — split-view desktop (420px list + detail panel), mobile stack
- **Vacature detail** `/vacature/[slug]` — header image, markdown, JSON-LD, canonical URL
- **City landing** `/vacatures/[city-slug]` — CityHero, pagination, nearby cities
- **Company page** `/bedrijf/[company-slug]`
- **Account pages** — profiel, opgeslagen, sollicitaties
- **Theme** — volledig: primary/secondary/tertiary met fallbacks, `buildTenantThemeCss()`
- **`EditorialJobCard`** — distance chip, salary, facets met icons, bookmark, Nieuw-badge
- **`GeolocateButton`** — "Bij mij in de buurt" knop, zet `?lat=X&lng=Y` in URL
- **Distance filter** — `haversineKm()` in utils, lat/lng in `getApprovedJobs` select, `jobDistanceKm()` per card in `JobListContent`
- **FilterBar** — compact: functie-input + locatie-input + type-dropdown + GeolocateButton

### Admin (apps/admin/)
- **Platform detail** `/dashboard/platforms/[id]` — 6 tabs: Basis, Branding, Content, SEO, Contact, Go-Live
- **Image upload** — drag/drop naar Supabase Storage, signed URL flow
- **Auto-save** — 2s debounce, status indicator

---

## Wat nog gebouwd moet worden

### Prioriteit 1 — Design prototype afstemmen

Er is een HTML/CSS prototype op `.branding-staging/design-prototype/` (index.html, vacature.html, stad.html). Open dit bestand in de browser. De volgende elementen staan IN het prototype maar NIET (of anders) in de code:

1. **Search bar UX** — het prototype heeft een groot "Wat / Waar" 2-veld formaat met labels erboven. De huidige `FilterBar` is compact inline. Prototype: `search-bar` class met `search-field-text` + zoekknop met pijl-icoon.

2. **Filter chips met count-badge** — "Nieuw deze week **47** ×", "Binnen 15 km ×". Actieve chips hebben een `×` knop. Huidige chips zijn type-only.

3. **"Dichtstbijzijnd" als sort-optie** — staat in prototype `<select>`. Huidige `SortSelect` mist deze optie. Vereist een extra `sort=nearest` query-optie (client-side sort op `distanceKm` als `userLat/userLng` aanwezig zijn).

4. **Update pulse animatie** — `● Bijgewerkt 3 min geleden · 12 nieuw vandaag` in de context strip. Kleine pulserende groene dot. Huidige `ContextStrip` heeft dit niet.

5. **Company logo initials fallback** — als `logo_url` null is, toon 2-letter initialen in een gekleurde cirkel (op basis van bedrijfsnaam). Huidige `CompanyLogo` check dit.

### Prioriteit 2 — Geolocate mobile

De `GeolocateButton` zit nu alleen in de **desktop** FilterBar. Mobile FilterBar (chip-rij) heeft hem nog niet.

### Prioriteit 3 — Junction reads

`apps/public-sites/src/lib/queries.ts` gebruikt nog overal `.eq('platform_id', tenantId)`. Dit moet via de `job_posting_platforms` junction table zodat vacatures op meerdere platforms kunnen staan.

**Vóór implementatie verifiëren**: voer in Supabase uit:
```sql
SELECT COUNT(*) FROM job_posting_platforms;
SELECT COUNT(*) FROM job_postings WHERE review_status='approved' AND published_at IS NOT NULL;
-- Als de counts sterk verschillen: eerst backfill uitvoeren
```

Backfill SQL:
```sql
INSERT INTO job_posting_platforms (job_posting_id, platform_id, is_primary)
SELECT jp.id, jp.platform_id, true
FROM job_postings jp
WHERE jp.review_status = 'approved' AND jp.published_at IS NOT NULL AND jp.platform_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM job_posting_platforms jpp
  WHERE jpp.job_posting_id = jp.id AND jpp.platform_id = jp.platform_id
)
ON CONFLICT DO NOTHING;
```

Dan in queries.ts elke `.eq('platform_id', tenantId)` vervangen door:
```ts
.select(`..., job_posting_platforms!inner(platform_id)`)
.eq('job_posting_platforms.platform_id', tenantId)
```

---

## Slimste volgorde

1. Open `.branding-staging/design-prototype/index.html` in browser → vergelijk visueel met live site
2. Bouw search bar UX (Wat/Waar) — meest zichtbaar voor gebruikers
3. Voeg "Dichtstbijzijnd" sort toe
4. Geolocate-knop ook in mobile chips
5. Junction reads (na DB-verificatie)

---

## Technische context

- **Supabase project**: `wnfhwhvrknvmidmzeclh`
- **pnpm monorepo** — filters: `pnpm --filter public-sites`, `pnpm --filter admin`
- **Builds**: beide apps builden clean
- **Theming**: CSS vars via `buildTenantThemeCss()` in `src/lib/theme.ts`
- **Key files**:
  - `apps/public-sites/src/app/page.tsx` — homepage
  - `apps/public-sites/src/components/filter-bar.tsx` — zoekbalk
  - `apps/public-sites/src/components/job-list.tsx` — lijstweergave + afstand
  - `apps/public-sites/src/components/editorial-job-card.tsx` — kaart
  - `apps/public-sites/src/components/context-strip.tsx` — regio-header
  - `apps/public-sites/src/lib/queries.ts` — alle DB-queries
