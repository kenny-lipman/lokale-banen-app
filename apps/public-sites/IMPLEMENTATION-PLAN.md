# Implementatieplan: UI alignment + spacing audit fixes

**Output:** 1 bundled commit op `main`: `refactor(public-sites): UI alignment + spacing audit`
**Basis:** `AUDIT-UI.md` in dezelfde directory
**Beslissingen (vastgelegd 2026-05-15):**
- `colors.body` -> `colors.muted` (font-size `text-body` blijft)
- Nieuwe `text-lead` (1.125rem / 18px, line-height 1.55) voor hero descriptions
- Bundled commit, geen feature-branch

---

## Fase 1: Token-fundament

**Files:** `src/app/globals.css`, `tailwind.config.ts`

1. In `globals.css` `:root` toevoegen:
   ```css
   --space-1: 0.5rem;     /*  8px */
   --space-2: 0.75rem;    /* 12px */
   --space-3: 1.125rem;   /* 18px */
   --space-4: 1.875rem;   /* 30px */
   --space-5: 2.75rem;    /* 44px */
   --space-6: 3.75rem;    /* 60px */
   --lh-tight:   1.15;
   --lh-snug:    1.4;
   --lh-relaxed: 1.75;
   --fs-lead:    1.125rem;
   ```

2. In `tailwind.config.ts`:
   - `spacing`: voeg `s1..s6` toe (verwijzend naar `--space-*`).
   - `lineHeight`: voeg `tight` (1.15), `snug` (1.4), `relaxed` (1.75) toe (overschrijft Tailwind-defaults bewust).
   - `fontSize`: voeg `'lead': ['var(--fs-lead)', { lineHeight: '1.55' }]` toe.
   - **Rename:** `colors.body` -> `colors.muted` (value blijft `var(--text-body)`, ook in `globals.css` blijft `--text-body` als CSS-var).
   - **Verwijder:** `colors.body` is weg, dus `text-body` is voortaan alleen font-size.

-> verify: `pnpm --filter public-sites build` succesvol; class `text-muted` resolvet naar `#4B5563`; class `text-body` is enkel font-size.

---

## Fase 2: text-body color -> text-muted rename (mechanisch)

**Files:** alle `src/**/*.{tsx,ts}` met `text-body` in className waar het *color* betekent.

1. Inventariseer met `grep -rn "text-body" src/` -- ~30 hits.
2. Per hit beoordelen: is het color of size?
   - Color: in combinatie met `text-meta`/`text-small`/`text-h1` -> color, rename naar `text-muted`.
   - Standalone `text-body` of in combinatie met `font-light`/`leading-*` -> size, behouden.
3. Bekende color-locaties (uit audit):
   - `breadcrumbs.tsx:21,34` -- `text-body` (color)
   - `vacature-card.tsx:44` -- `text-body tracking-tight font-light text-body` (DOUBLE: 1× color, 1× size; behoud size, rename color naar `text-muted`)
   - `vacature-card.tsx:132` -- MetaRow color
   - `pagination.tsx:58,103` -- color
   - `mobile-bottom-bar.tsx:127` -- color
   - `master-homepage.tsx:117,121` -- color
   - `empty-state.tsx:22,24` -- color
   - `company-profile.tsx:48,54,83` -- color
   - `job-detail.tsx:113,158,241` -- color
   - `contact-form.tsx:111` -- color (`text-red-600` blijft, alleen `text-body` rename)
   - `site-footer.tsx:60` -- check (tagline op donkere achtergrond -- moet `text-on-dark/85` blijven, niet `text-muted`)
   - In `prose-content.tsx:34-35`: `prose-p:text-body prose-li:text-body` -> `prose-p:text-muted prose-li:text-muted`
4. Page-files: `app/page.tsx:83`, `app/contact/page.tsx:31`, `app/over-ons/page.tsx:48`, contact-form info-rows, `werkgevers/page.tsx:128,150`, etc.

-> verify: build pass; visuele check op /vacatures en /vacature/[slug]: muted body-tekst rendert in `#4B5563` (zelfde als voorheen).

---

## Fase 3: Filter-component fix (de screenshot)

**Files:** `components/eyeron/checkbox.tsx`, `radio.tsx`, `filter-group.tsx`, `filter-panel.tsx`.

1. **`checkbox.tsx`**: label-classes en box-classes overschrijven per audit sectie 2.1.
   - Label: `gap-3 py-[5px] min-h-8` (was: `gap-2.5 py-0.5 min-h-7`)
   - Box: `w-5 h-5 border-2 border-primary`, after `w-3 h-3`, drop `group-hover:border-primary` (was unchecked grijs)
   - Label-text: `text-meta font-light text-primary leading-[1.45]` (was: `text-neutral-700 leading-snug`)
2. **`radio.tsx`**: identiek patroon. After: `w-[13px] h-[13px]`.
3. **`filter-group.tsx:67-77`**:
   - Fieldset: `pt-[18px] pb-3 first:pt-0`
   - Legend: voeg `p-0 ml-0` toe, `font-medium` -> `font-bold`, `mb-1.5` -> `mb-2`
   - Vervang `<div className="grid gap-0">` door `<div className="flex flex-col">`
4. **`filter-panel.tsx:43`**:
   - `px-7 py-7 sm:px-8` -> `px-[30px] pt-7 pb-[30px]`
   - Heading `mb-3` -> `mb-3.5`

-> verify: dev-server, viewport 1280px, navigeer naar /vacatures. Filters checkbox-borders zijn 2px primary-groen, items hebben 5px vertical padding, label-tekst is primary-groen.
-> verify: viewport 375px (mobile drawer), open filter-drawer, idem visueel.

---

## Fase 4: CTA-consolidatie (PillButton uniform)

**Files:** `components/eyeron/pill-button.tsx`, alle CTA-call-sites.

1. **`pill-button.tsx`**: voeg `size?: 'md' | 'lg'` toe.
   - `md` (default) = `h-11 px-[22px]` (huidige spec: 44px hoog, 22px padding)
   - `lg` = `h-12 px-6` (voor solliciteer/contact-submit)
   - Verwijder `border border-primary` uit `primary`-variant (onzichtbaar onder fill, voegt visuele drift toe).
2. **`apply-button.tsx`**: vervang inline `h-12 px-6 rounded-button bg-primary ...` door `<PillButton variant="primary" size="lg" href={jobUrl}>`. Sticky-mobile wrapper-div blijft (vanwege `fixed bottom`).
3. **`site-header.tsx:57`** "Vacature plaatsen" CTA: `h-10 px-5 rounded-button bg-secondary ...` -> behouden zoals het is (secondary-fill, kleinere CTA in header), maar normaliseer hoogte naar `h-11`.
4. **`werkgevers/page.tsx:94`** mailto-CTA: vervang door `<a><PillButton variant="primary" size="lg" asChild>` of normaliseer inline.
5. **`contact-form.tsx:97`** submit-button: kan geen `<Link>`/`<button>` switchen via `PillButton` direct (PillButton renders `<button>` of `<Link>`, beide). Refactor: maak submit een `<PillButton type="submit" variant="primary" size="lg">`.

-> verify: alle primary CTAs hebben dezelfde visuele hoogte (44 of 48), zelfde radius, zelfde focus-ring.

---

## Fase 5: VacatureCard breakpoint + padding

**Files:** `components/eyeron/vacature-card.tsx`.

1. Breakpoint: `sm:` (640) -> `md:` (768) op alle responsive classes in dit component.
   - Grid: `md:grid-cols-[141px_1fr_168px]`
   - Logo cell: `md:w-[141px] md:h-[141px]`, border `border-b md:border-b-0 md:border-r`
   - Content: `md:px-7 md:py-6`
   - Meta cell: `md:px-6 md:py-6 md:pl-0`
2. Vervang `text-[#1F2937]` (regel 54) door `text-muted` (consistent met andere body-tekst).
3. Mobile meta-rij naar `flex-row flex-wrap gap-y-2 gap-x-4` per spec (regel 62). Op `md:` blijft `flex-col gap-1.5`.
4. Asymmetrische content padding herstellen: spec is `padding: 26px 24px 22px 30px`. Code: `md:px-7 md:py-6` -> exact maken met `md:pt-[26px] md:pr-6 md:pb-[22px] md:pl-[30px]`. (Of accepteer 28/24 als bewuste vereenvoudiging.)
5. Title `leading-snug` -> `leading-tight` (spec 1.25).

-> verify: viewport 700px (iPad portret): cards renderen stacked met logo bovenop. Viewport 800px+: 3-koloms grid.

---

## Fase 6: pb-15 + magic-numbers naar tokens

**Files:** `app/page.tsx`, `app/vacatures/page.tsx`, `job-list.tsx`, `job-detail.tsx`, `master-homepage.tsx`, `vacatures/[city-slug]/page.tsx`.

1. **`pb-15` fix**: `app/page.tsx:186` en `app/vacatures/page.tsx:201`: `pb-15` -> `pb-s6` (= 60px = `--space-6`).
2. **`gap-[18px]` -> `gap-s3`** in: `job-list.tsx:59`, `job-detail.tsx:161`, `master-homepage.tsx:82`, `vacatures/page.tsx:124,240`, `vacatures/[city-slug]/page.tsx:134`.
3. **Inline prose-class in `job-detail.tsx:98`**: vervang hardcoded `prose-p:text-[18px] prose-p:font-normal prose-p:text-[#1F2937] prose-p:leading-[1.7] prose-li:text-[18px] prose-li:font-normal prose-li:text-[#1F2937] prose-li:leading-[1.7]` door `prose-p:text-lead prose-p:text-muted prose-li:text-lead prose-li:text-muted`. (text-lead heeft al `lineHeight: 1.55` -- iets minder ruim dan 1.7 maar dichter bij spec; alternatief: aparte `--lh-prose: 1.7` token toevoegen).
4. Andere hardcoded `text-[...]px]`/`leading-[...]`: grep en consolideer waar mogelijk.

-> verify: `grep -rn "text-\[#" src/` minder dan 5 hits over.
-> verify: `pb-15` is weg, dev-server: bottom-padding op homepage en /vacatures rendert nu zichtbaar.

---

## Fase 7: Type-scale correcties (text-lead invoeren)

**Files:** `components/eyeron/page-hero.tsx`, `app/page.tsx`.

1. **`page-hero.tsx:40`**: description `text-h2 font-regular leading-snug` -> `text-lead font-regular text-primary`.
2. **`app/page.tsx:195`**: intro-paragraph `text-h2 font-regular text-primary leading-snug tracking-tight` -> `text-lead text-primary`.
3. **`prose-content.tsx:27`**: `prose prose-sm` -> `prose` (default). Body-tekst wordt nu 16px (`text-body`) ipv 14px (`prose-sm`).
   - Risico: over-ons en legal pages worden wat groter. Bewuste consistentie-keuze.

-> verify: homepage intro en page-hero descriptions zijn merkbaar lichter dan voorheen (18px regular ipv 24px regular).
-> verify: over-ons content rendert in 16px body-tekst.

---

## Fase 8: Drift opruimen

**Files:** divers.

1. **`sort-toolbar.tsx:83`**: `pt-3 pb-5` -> `pt-1.5 pb-3.5` (spec 6/14px).
2. **`search-banner.tsx:122`**: vertical padding naar spec (`pt-[22px] pb-6 sm:pt-[30px] sm:pb-8`).
3. **`search-banner.tsx:135`**: pill `h-9` -> `h-[34px]`.
4. **`site-footer.tsx:106`**: master-logo `h-7` -> `h-[33px]`.
5. **`site-footer.tsx:138`**: `leading-7` -> `leading-[30px]` (matcht spec).
6. **`site-footer.tsx:52`**: `mb-4` -> `mb-3.5` (spec 14px).
7. **`breadcrumbs.tsx:40`**: chevron `w-3 h-3` -> `w-3.5 h-3.5` (12->14px, beter bij text-meta 14px).
8. **`vacatures/[city-slug]/page.tsx:163`** "nabijgelegen plaatsen" link: refactor naar `<PillButton size="md">` met arrow-slot.
9. **`page-hero.tsx:30`**: `mb-7` -> `mb-s4` (30px, in plaats van 28px hardcode).

-> verify: `pnpm typecheck` schoon, geen layout-regressies in walk-through.

---

## Fase 9: Validatie

1. **Build**: `pnpm --filter public-sites build` -- 0 errors.
2. **Type-check**: `pnpm --filter public-sites typecheck` -- 0 errors.
3. **Lint**: `pnpm --filter public-sites lint` -- 0 nieuwe warnings.
4. **Visuele walk-through** in dev-server (`pnpm --filter public-sites dev`):
   - Viewports: 375, 768, 1280
   - Routes: `/`, `/vacatures`, `/vacatures/doetinchem` (regio-portal: subdomain.test.lokale-banen.nl), `/vacature/[slug]`, `/bedrijf/[slug]`, `/contact`, `/werkgevers`, `/over-ons`, `/bedrijven`
   - Master vs regio: test minstens 1 regio-portal en de master (lokalebanen.nl).
   - Filter-drawer mobile: open + close, check checkbox-styling.
   - Sticky elementen: ApplyButton mobile + MobileBottomBar -- mogen niet overlappen.
5. **Diff-check op screenshots:** Eyeron-mockup vs huidige render voor filter-panel + vacature-card + search-banner.

-> verify: alle vorige issues uit AUDIT-UI.md zijn weg of expliciet gedocumenteerd als bewuste afwijking.

---

## Commit

```
refactor(public-sites): UI alignment + spacing audit

- Token-fundament: --space-1..6, --lh-*, --fs-lead, text-lead, text-muted
- Filter-component: checkbox/radio 20x20 + 2px primary border + text-primary labels
- VacatureCard: sm: -> md: breakpoint (tablet portrait fix)
- CTA-consolidatie: alle primary CTAs via PillButton (md/lg sizes)
- text-body naamconflict opgelost (color -> muted, size blijft text-body)
- pb-15 -> pb-s6 (was niet gedefinieerd in Tailwind config)
- ProseContent: prose-sm -> prose (16px body)
- Diverse drift: SearchBanner/SortToolbar/SiteFooter spacing per Eyeron-spec
```

---

## Out-of-scope (expliciet niet in dit plan)

- `app/account/*`, `app/sign-in/*`, `app/sign-up/*`, `app/voorwaarden/*`, `app/privacy/*`, `werkgevers/pakketten`: erven token-fixes automatisch, geen aparte fase tenzij visuele regressie in walk-through.
- Cookie-consent component.
- Mobile-menu component (hamburger inhoud).
- `app/preview/*` en `app/dev/*` (dev-only routes).
- E2E tests / visual regression tooling (Playwright snapshots): valt buiten audit-scope.

---

## Risico's

- **text-body rename** is mechanisch en grep-baar, maar één gemiste color-->size verwarring kan een onleesbaar tekst-blok geven. Mitigatie: walk-through fase 9.
- **VacatureCard breakpoint shift** verandert hoe iPad-portret rendert. Mitigatie: viewport 700px expliciet testen.
- **ProseContent `prose` ipv `prose-sm`** maakt over-ons/legal-pagina's groter. Mitigatie: verify met user of dit gewenst is, anders rollback alleen die regel.
- **PillButton border verwijderen op primary-variant** is visueel onzichtbaar tenzij iemand er `border-2`/iets anders overheen pusht. Low risk.
