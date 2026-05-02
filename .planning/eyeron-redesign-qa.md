# Eyeron portal-redesign — QA-rapport

**Datum:** 2026-05-02
**Branch:** `main` (12 commits, big-bang refactor)
**Scope:** `apps/public-sites` (alle 24 live regio-domeinen + master `lokalebanen.nl`)
**Status:** ✅ Refactor compleet, build groen, alle 27 routes registered.

---

## 1. Delivery-overzicht

### Commits per fase
| # | Commit | Doel |
|---|--------|------|
| 0 | `b63d52b` | Tokens + Tomica-fonts + theme.ts |
| 1 | `456f1fb` | Logo pre-process pipeline + 52 SVG's |
| 2 | `5bc6546` | Atomic primitives + `/dev/eyeron` showcase |
| 3 | `e90be32` | SiteHeader, SearchBanner, SiteFooter, MobileMenu |
| 4 | `7a35aaf` | VacatureCard, JobList, skeleton, EmptyState, SaveJobButton |
| 5 | `325f0c7` | FilterPanel, MobileBottomBar, SortToolbar |
| 6 | `af3d399` | Homepage wire-up (regio + master) |
| 7 | `4274ac1` | List-routes (`/vacatures`, `/vacatures/[city-slug]`, `/bedrijven`) |
| 8 | `e78c507` | Detail-routes (`/vacature/[slug]`, `/bedrijf/[company-slug]`) |
| 9 | `d4142c5` | Static content (`/over-ons`, `/contact`, `/privacy`, `/voorwaarden`, `/werkgevers`) |
| 10 | `75e0655` | Account + auth + preview |
| 11 | `e0cb34c` | Legacy cleanup (-54 files, -6075 regels) |

### Componenten geleverd
- **31 Eyeron-componenten** in `src/components/eyeron/`
- Plus `cookie-consent` (legacy, blijft) — verder is alles eyeron-namespace
- **53 portal-logo SVG's** in `public/logos/` met runtime CSS-vars
- **5 Tomica woff2 weights** in `public/fonts/` (Light + Regular + Bold preloaded)

### Build-status
- ✅ `pnpm type-check` groen
- ✅ `pnpm build` groen
- ✅ Alle 27 routes registered + compileren
- ✅ 0 imports buiten `eyeron/` (m.u.v. `cookie-consent`)

---

## 2. Routes geconverteerd

| Route | Type | Eyeron-componenten |
|-------|------|---------------------|
| `/` (regio) | server | SiteHeader, SearchBanner, SortToolbar, JobList, FilterPanel, MobileBottomBar, SiteFooter |
| `/` (master) | server | SiteHeader, MasterHomepage (PlatformTile + VacatureCard), SiteFooter |
| `/vacatures` (regio + master) | server | Breadcrumbs, PageHero, VacatureCard, Pagination, EmptyState, SiteFooter |
| `/vacatures/[city-slug]` | server | + city-pills nabijgelegen-plaatsen |
| `/bedrijven` | server | EmptyState (placeholder) |
| `/bedrijf/[company-slug]` | server | CompanyProfile, VacatureCard, Pagination |
| `/vacature/[slug]` | server | JobDetail (2-col met sticky info-sidebar) + ApplyButton sticky-mobile |
| `/over-ons` | server | ProseContent (DB about_text + fallback) |
| `/contact` | server | ContactCard-tegels met icon-hexagons |
| `/privacy` | server | ProseContent (DB privacy_text) |
| `/voorwaarden` | server | ProseContent (DB terms_text) |
| `/werkgevers` | server | Stat-tegels + 3-stappen-proces + mailto-CTA |
| `/account` | server | User-chip + 3 menu-tegels |
| `/account/profiel` | server | Clerk UserProfile in surface-wrapper |
| `/account/sollicitaties` | server | List + EmptyState |
| `/account/opgeslagen` | server | List + UnsaveButton + EmptyState |
| `/sign-in` | server | Clerk SignIn met Eyeron appearance |
| `/sign-up` | server | Clerk SignUp met Eyeron appearance |
| `/preview/[id]` | server | Sticky DRAFT-banner + JobDetail |
| `/dev/eyeron` | client | Design-system showcase (4 brand-varianten) |

---

## 3. Theming-flow per portal

```
DB platforms.primary_color/secondary_color
         ↓
   getTenant() (host-based via x-tenant-host header)
         ↓
   <TenantTheme> in app/layout.tsx → <style data-tenant-theme="...">
         ↓
   :root { --primary: #xxx; --secondary: #xxx; --primary-hover: ...; ... }
         ↓
   Tailwind classes (bg-primary, text-secondary, border-primary, ...)
         ↓
   /logos/<regio_platform>.svg met var(--primary)/var(--secondary) fills
```

**Geen DB-wijzigingen.** `tertiary_color` blijft in DB, wordt niet gerenderd.

---

## 4. A11y-implementatie

| Pattern | Status | Locatie |
|---------|--------|---------|
| Skip-to-main link | ✓ | `globals.css` `.skip-link` |
| Touch targets ≥ 44×44px | ✓ | header acties, bookmark, drawer-trigger, sort-pill |
| `<fieldset>` + `<legend>` voor filter-groepen | ✓ | `FilterGroup` |
| `aria-modal="true"` op drawers | ✓ | MobileMenu, MobileBottomBar |
| `aria-pressed` op toggle-buttons | ✓ | SaveJobButton, MobileMenu trigger |
| `aria-haspopup="listbox"` op dropdowns | ✓ | SortToolbar, MobileBottomBar sort |
| `aria-live="polite"` op result-count | ✓ | SortToolbar |
| ESC sluit modals + drawers | ✓ | MobileMenu, MobileBottomBar |
| Body-scroll-lock terwijl drawer open | ✓ | MobileMenu, MobileBottomBar |
| Focus-visible outline op alle interactieve elementen | ✓ | PillButton, Radio, Checkbox, header-nav, drawers |
| `prefers-reduced-motion` honoreren | ✓ | `globals.css` global rule |
| Native `<input type="search">` | ✓ | SearchBanner — browser-autocomplete + clear-button |
| Card-wide click-target zonder bookmark/links te kapen | ✓ | VacatureCard via z-index |
| Semantische H-hiërarchie | ✓ | `<h1>` per pagina, `<h2>` voor secties |
| `<dl>` voor key-facts in JobDetail | ✓ | `JobDetail` sidebar |

---

## 5. Per-portal kleur-risico's (WCAG-check)

`getLinkColor(secondary, primary)` in `lib/utils.ts` schakelt automatisch naar `primary` voor body-links wanneer secondary luminance > 0.45.

| Portal | Primary | Secondary | Lum sec | Body-link |
|--------|---------|-----------|---------|-----------|
| OssenseBanen | `#003D52` | `#BFCED4` | ~0.61 | → primary (auto) |
| HoornseBanen | `#CB2038` | `#B2B3B4` | ~0.46 | → primary (auto) |
| ZaanstadseBanen | `#007D96` | `#A9ABA5` | ~0.41 | secondary (rand-geval, manueel valideren) |
| ZaanstreekseBanen | `#007D96` | `#A9ABA5` | ~0.41 | idem |

**Aanbeveling:** voor ZaanstadseBanen / ZaanstreekseBanen handmatig in de browser checken of secondary nog AA-conform leesbaar is op witte achtergrond. Anders luminance-drempel naar 0.40 verlagen.

---

## 6. Logo-pipeline status

| Bron | Aantal | Methode |
|------|--------|---------|
| Match via portals-config | 5 | Closest-color (≤30/channel) |
| Luminance heuristiek | 47 | Donkerste fill = primary |
| Master | 1 | Eigen kleuren behouden |
| ZIP zonder DB-record | 15 (skipped) | BARseBanen, BrabantseBanen, etc. |

**Total:** 53 SVG's in `public/logos/`.

**Edge cases:**
- 8 typo-mappings (NijmeegseBanen → NijmegenseBanen, OsseBanen → OssseBanen, etc.)
- 5 portals met 1 fill in SVG (GoudseBanen, LeeuwardseBanen, MaasluisseBanen, VlaardingeseBanen, ZwolseBanen) — alleen primary vervangen, secondary niet aanwezig in bron-SVG

**Risico met luminance-heuristiek:** voor portals waar secondary toevallig donkerder is dan primary worden de twee omgewisseld. Visueel langs alle 24 live domeinen lopen om te valideren. Bij issue: handmatig SVG corrigeren of explicit override toevoegen aan `ZIP_TO_DB` mapping.

---

## 7. SEO ongewijzigd

Alle bestaande JSON-LD intact behouden:
- ✓ JobPosting schema (datePosted, validThrough, salary, hiringOrganization, jobLocation)
- ✓ BreadcrumbList per route
- ✓ Organization (bedrijf-detail)
- ✓ ItemList (vacature-grids)
- ✓ WebSite met sitelinks searchbox (regio-home)
- ✓ Canonical URLs met `?page=N`
- ✓ Master → primary platform redirect
- ✓ Markdown route (`/vacature/[slug]/md/route.ts`)

---

## 8. Bekende beperkingen / vervolg

### Te valideren (manueel, in browser)
1. **Per-portal logo-correctheid** — luminance-heuristiek kan primary/secondary omdraaien voor portals waar secondary donkerder is. 24 live domeinen langslopen.
2. **ZaanstadseBanen / ZaanstreekseBanen** body-links — luminance valt rand op de 0.45-drempel.
3. **Lighthouse Core Web Vitals** — niet automatisch gemeten in dit traject. Aanbeveling: run `lighthouse https://westlandsebanen.nl --view` na deploy.
4. **Cross-browser** — alleen op Chrome ontwikkeld. Safari + Firefox + mobiel Safari sweep aanbevolen.
5. **Tomica fontload** — eerste page-render op `/` toont "FOUT" (flash-of-unstyled-text) tot Regular-weight binnen is. Acceptabel met `font-display: swap`.

### Wat ik bewust heb laten vallen
- **Wegwijzer-strip** (paper-aesthetic patroon, inconsistent met clean Eyeron)
- **Editorial gradient hero-fallback** op vacature-detail (te zwaar voor clean design)
- **ContentSection-splits** ("Wat ga je doen / Wie zoeken / Wat bieden") — vereiste markdown-pre-parsing met onbetrouwbare resultaten
- **Geolocate-button** (kan terug als enhancement op SearchBanner in latere fase)
- **Active-filters-chips** boven de cards (Eyeron-design toonde die niet expliciet)

### Te overwegen voor v2
- **Sticky search-bar** op mobile na scroll past hero
- **Nieuwe "Steden"-overzichtsroute** op `/vacatures` (nu een vacature-list, geen city-grid)
- **Bedrijven-overzichtspagina** (nu stub) — full city/branche-filter
- **OG-image generation** via `next/og` met portal-kleuren als variabelen
- **Cypress / Playwright e2e** — schrijf één suite met portal-slug-parameter
- **Feedback-collection-mechanism** in UI voor vroege gebruikers

---

## 9. Aanbevolen rollout

1. **Vercel preview-deploy** vanaf `main` → `lokale-banen-app.vercel.app` updaten
2. **Visual sweep** op alle 24 live domeinen via Vercel preview-aliassen (zie `.planning/vercel-aliases.json`)
3. **6 sample portals** voor kleurvariatie:
   - Achterhoek (groen, normaal contrast)
   - Alkmaar (zwart+rood, hoog contrast)
   - Assen (blauw, normaal)
   - Bollenstreek (donkerblauw+roze)
   - HoornseBanen (risico — secondary `#B2B3B4`)
   - MoerdijkseBanen (extreem contrast: `#00442B` + `#F29933`)
4. **Lighthouse** op één portal — LCP < 2.5s, CLS = 0, perf ≥ 90, a11y = 100
5. **Mobile**: 375 / 768 / 1280 / 1440 viewport-sweep
6. **Cross-browser**: Chrome / Safari / Firefox / mobiel Safari
7. **Production-promote** zodra QA groen
