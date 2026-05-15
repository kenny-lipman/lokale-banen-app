# Public-sites UI-audit: alignment, spacing, line-height

**Scope:** `apps/public-sites` (regio-jobboards + master aggregator)
**Methode:** code-review (Tailwind/JSX), spec-vergelijking met `.branding-staging/eyeron-mockups/tokens.css` en globals.css
**Datum:** 2026-05-15
**Severity:**
- **P0** = visueel duidelijk fout / blokkeert bruikbaarheid op een breakpoint
- **P1** = duidelijke spec-afwijking, oogt inconsistent maar pagina werkt
- **P2** = subtiele drift of code-hygiëne (hardcoded waardes waar tokens horen)

---

## 1. Design tokens audit (root-cause van de meeste issues)

De Eyeron-mockup-tokens in `.branding-staging/eyeron-mockups/tokens.css` zijn **niet volledig overgenomen** in `apps/public-sites/src/app/globals.css`. Daardoor:
- Code valt terug op Tailwind-defaults (die niet matchen met de spec).
- Componenten gebruiken hardcoded waardes (`px-7`, `pt-3`, `gap-2.5`, `min-h-7`, `leading-snug`, ...) die er **bijna** zijn maar nét niet.

### 1.1 Ontbrekende tokens in `globals.css`

| Token in mockup | Waarde | Status in code | P |
|---|---|---|---|
| `--space-1` t/m `--space-6` (8/12/18/30/44/60px) | Eigen spacing-schaal | **Ontbreekt** — code gebruikt Tailwind-defaults (4/8/12/16/24/32/...) | P1 |
| `--lh-tight` (1.15), `--lh-snug` (1.4), `--lh-relaxed` (1.75) | Line-height-schaal | **Ontbreekt** — code mixt `leading-tight` (1.25), `leading-snug` (1.375), `leading-relaxed` (1.625) | P1 |
| `--radius-card` (0), `--radius-checkbox` (0) | Radii | Wel in `tailwind.config.ts` (`borderRadius.card = '0'`) — OK | – |
| `--fw-thin/light/regular/bold/black` (100/300/400/700/900) | Font weights | **Ontbreekt** als CSS vars — code gebruikt `font-light/regular/bold` (Tailwind defaults: 300/400/700) — match toevallig | P2 |
| Reset (`html, body { margin: 0 }`, `ul { list-style: none }`, `img, svg { display: block }`) | Base-reset | **Ontbreekt** — Tailwind preflight dekt meeste, maar `ul` heeft default list-style. Markdown-prose werkt nog, native `<ul>` (zoals in werkgevers-page Step) wordt expliciet via `list-none` overschreven. | P2 |

### 1.2 Inconsistentie binnen tokens

| Issue | Mockup | Globals.css | P |
|---|---|---|---|
| `--text-body` kleur | `#7C7C7C` | `#4B5563` | P1 |
| `text-body` in Tailwind config | `lineHeight: 1.6` | gebruikt als `<p className="text-body">` op vele plekken | – (designkeuze) |
| `--lh-tight` op `h1`-utility | `1.15` | `tailwind.config.ts` zet `'h1': lineHeight: '1.15'` — OK | – |
| `--lh-snug` op `h2`/`h3` | `1.4` | `'h2'/'h3': lineHeight: '1.4'` — OK | – |

### 1.3 Aanbeveling (root-cause fix)

Voeg in `apps/public-sites/src/app/globals.css` onder `@layer base` toe:

```css
/* ── SPACING-SCHAAL (Eyeron) ────────────────────────────────────────── */
--space-1: 0.5rem;     /*  8px */
--space-2: 0.75rem;    /* 12px */
--space-3: 1.125rem;   /* 18px */
--space-4: 1.875rem;   /* 30px */
--space-5: 2.75rem;    /* 44px */
--space-6: 3.75rem;    /* 60px */

/* ── LINE-HEIGHT ────────────────────────────────────────────────────── */
--lh-tight:   1.15;
--lh-snug:    1.4;
--lh-relaxed: 1.75;
```

En in `tailwind.config.ts` onder `theme.extend.spacing` en nieuwe `lineHeight`:

```ts
spacing: {
  // ...bestaande
  '1.5x': 'var(--space-1)',   // 8
  '2x':   'var(--space-2)',   // 12
  '3x':   'var(--space-3)',   // 18
  '4x':   'var(--space-4)',   // 30
  '5x':   'var(--space-5)',   // 44
  '6x':   'var(--space-6)',   // 60
},
lineHeight: {
  tight:   '1.15',
  snug:    '1.4',
  relaxed: '1.75',
},
```

Daarna zijn componenten te refactoren naar `gap-2x`, `py-3x`, `leading-snug` (=1.4 ipv 1.375), `text-body` color blijft `#4B5563` (keuze: passend voor a11y contrast) of terug naar `#7C7C7C` per mockup.

---

## 2. Filter-component (de directe screenshot-issue)

`src/components/eyeron/filter-panel.tsx`, `filter-group.tsx`, `checkbox.tsx`, `radio.tsx`.

### 2.1 Checkbox/Radio (P0 — verklaart de screenshot)

**`checkbox.tsx:46-56` + `radio.tsx:48-58`** wijken duidelijk af van zowel JSDoc als mockup-spec.

| Aspect | Spec (mockup CSS + JSDoc-claim in code) | Werkelijke code | Visueel effect |
|---|---|---|---|
| Outer size | 20×20px | `w-[18px] h-[18px]` | 10% kleiner; meta-label kantelt zwaarder t.o.v. de box |
| Border weight | 2px | `border` = 1px | Box oogt dun en grijzig (zie screenshot) |
| Border color (unchecked) | `var(--brand-primary)` | `border-neutral-400` | Box is **niet groen** in unchecked state — afwijking van het Eyeron-design |
| Inner dot/square | 12×12 | `w-[10px] h-[10px]` | Te klein; checked-state oogt zwak |
| Gap label↔box | 12px (`gap: 12px`) | `gap-2.5` = 10px | Te krap |
| Vertical padding | 5px top+bottom (`padding: 5px 0`) | `py-0.5` = 2px | Items te dicht op elkaar (zie hoe "Vast (17)" en "Stage (2)" plakken in screenshot) |
| Min-height | 32px | `min-h-7` = 28px | Touch-target krap voor mobile (44px is WCAG-target maar 32 is acceptabel) |
| Label line-height | 1.45 | `leading-snug` = 1.375 | Marginaal |
| Label color | `var(--brand-primary)` | `text-neutral-700` | Label-tekst zou primary-groen moeten zijn |

**Fix `checkbox.tsx`:**

```tsx
// Vervang label-classes
'group flex items-center gap-3 py-[5px] cursor-pointer min-h-8',

// Vervang box span-classes
'relative inline-flex w-5 h-5 shrink-0 rounded-card',
'border-2 border-primary bg-transparent',
'transition-colors duration-150 ease-eyeron',
'group-hover:border-primary-hover',
'peer-focus-visible:ring-2 peer-focus-visible:ring-secondary peer-focus-visible:ring-offset-2',
'after:content-[""] after:absolute after:inset-1/2 after:-translate-x-1/2 after:-translate-y-1/2',
'after:w-3 after:h-3 after:bg-primary',
'after:opacity-0 after:transition-opacity after:duration-150',
'peer-checked:after:opacity-100'

// Vervang label-text class
'text-meta font-light text-primary leading-[1.45]'
```

**Idem `radio.tsx`** — zelfde patroon: `w-5 h-5`, `border-2 border-primary`, `after:w-[13px] after:h-[13px]`, label `text-primary`.

### 2.2 FilterGroup spacing (P1)

`filter-group.tsx:67-77`:

| Aspect | Spec | Code | Fix |
|---|---|---|---|
| `padding: 18px 0 12px` | py-[18px]/[12px] | `pt-3 pb-2` (12/8) | `pt-[18px] pb-3` |
| `legend mb 8px`, `font-weight: bold` | mb-2, bold | `mb-1.5` (6px) + `font-medium` | `mb-2 font-bold` |
| Divider color | `var(--border-medium)` (#E5E7EB) | `bg-divider` — OK | – |
| Inner items wrapper `<div className="grid gap-0">` | (n/a, items hebben eigen py) | redundant `grid` met `gap-0` | Vervang door `<div className="flex flex-col">` voor duidelijkheid |

### 2.3 FilterPanel padding (P2)

`filter-panel.tsx:43`:

| Spec | Code | Fix |
|---|---|---|
| `padding: 28px 30px 30px` | `px-7 py-7 sm:px-8` (28/28 + 32 horizontaal sm) | `px-[30px] pt-7 pb-[30px]` (of accepteer kleine drift) |
| Heading `mb: 14px` | `mb-3` (12px) | `mb-3.5` of `mb-[14px]` |
| Heading mist `m-0` reset? Class heeft `m-0` — OK | – | – |

### 2.4 Waarom "Vakgebied" een extra gap onder titel oogt vs. "Aantal uur per week" (P1)

Beide groepen rendert exact dezelfde JSX. In screenshot oogt het toch verschillend. Twee mogelijke oorzaken:

1. **Long-label wrap in legend**: "Aantal uur per week" + "Vakgebied" hebben verschillende lengtes. `tracking-tight` op een vetter weight kan minimaal verschillende baseline genereren.
2. **Native `<legend>` quirk**: `<legend>` heeft browser-specific intrinsic padding/margin die de `mb-1.5` (6px) niet volledig overschrijft. **Voeg `padding: 0; margin-inline: 0` toe op de `<legend>`** (de mockup CSS doet dit expliciet: `.filter-group__label { padding: 0; }`).

**Fix:**
```tsx
<legend className="block w-full p-0 ml-0 text-body font-bold text-primary tracking-tight mb-2">
```

---

## 3. Layout-componenten

### 3.1 SiteHeader (`site-header.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| `h-header-mob lg:h-header-desk` = 64/99px — komt uit spec, OK | regel 28 | – |
| `gap-4` (16px) tussen logo en nav — spec zegt `gap: 24px`. Op `lg` upscale je naar `lg:gap-6` (24px) — OK voor desktop, **mobile gap 16px is krap** als nav-items in de hamburger zitten. | regel 29 | P2 |
| `gap-7` (28px) tussen nav-items — spec 28px — OK | regel 43 | – |
| **`gap-4 lg:gap-6` op de rechter cluster (regel 39)** mengt nav, "Vacature plaatsen" CTA en user-actions. Op een schermbreedte van ~768-1023px is de nav verborgen maar de CTA-knop staat erg dicht op de hamburger. | – | P1 |
| "Vacature plaatsen" CTA `h-10 px-5 rounded-button` (40px hoog) **wijkt af van standaard PillButton `h-11`** — inconsistent met andere primary CTAs. | regel 57 | P1 |
| `min-w-11 min-h-11` op icon-buttons — WCAG-compliant tap target, OK | regel 67 | – |
| `hidden sm:inline-flex` op de bookmark-button — verbergt bookmark op mobile. Vermoedelijk bewust (in hamburger?). Verify in `mobile-menu.tsx`. | regel 67 | P2 |

### 3.2 SiteFooter (`site-footer.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| `pt-14 pb-7` (56/28px) — mockup `padding: 56px 0 28px` — OK | regel 46 | – |
| `gap-8 sm:gap-9` op de grid — mockup `gap: 36px`. `gap-9` = 36px — OK op sm+, **op mobile gap-8 (32px) is iets te krap** | regel 47 | P2 |
| Mobile breakpoint: spec valt naar 1-koloms onder 640px (`@media (max-width: 639px)`). Code: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]` — OK | regel 47 | – |
| **`li.leading-7` (28px line-height) op footer-links** — bedoeld voor visuele rust tussen links. Mockup spec gebruikt `line-height: 30px`. Verschil van 2px. | regel 138 | P2 |
| Brand-kolom `mb-4` (16px) tussen logo en tagline — mockup `margin-bottom: 14px`. Drift 2px. | regel 52 | P2 |
| `pt-5` (20px) op bottom-row — mockup 20px — OK | regel 96 | – |
| Master-logo `h-7` (28px) — mockup 33px — undersized | regel 106 | P2 |

### 3.3 PageHero (`page-hero.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| `mb-7` (28px) wrapper — geen mockup-tegenhanger, ad-hoc waarde | regel 30 | P2 |
| `eyebrow` heeft `mb-2` (8px) — OK | regel 32 | – |
| **Description: `mt-3 text-h2`** — gebruikt **h2 type-scale voor lopend tekst** (1.25rem responsief tot 1.5rem). Dat is zwaar voor een sub-description en oogt bijna als een tweede h2. | regel 40 | P1 |
| `max-w-prose` (~65ch) — OK voor lange description | regel 40 | – |

**Fix description:** gebruik `text-body` (1rem) of zelfs `text-meta` (0.875rem) afhankelijk van pagina.

### 3.4 Breadcrumbs (`breadcrumbs.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| `gap-2` (8px) tussen items — adequaat | regel 21 | – |
| `text-meta font-light text-body` op container, individuele links `text-primary` — OK | regel 21, 30 | – |
| Chevron `w-3 h-3` (12px) — oogt klein bij `text-meta` (14px). Mockup heeft geen specifieke chevron-size. | regel 40 | P2 |

### 3.5 MobileBottomBar (`mobile-bottom-bar.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| `px-pad py-2.5` (clamp(20,4vw,48)/10px) — spec `padding: 10px ... ` — OK | regel 97 | – |
| `border-t border-divider-subtle` — OK | regel 97 | – |
| Filter-drawer `w-[min(420px,100vw)]` — OK | regel 177 | – |
| Drawer head `px-5 h-16 border-b` (20/64px) — spec `padding: 16px 20px` zou 16+content+16=~64 zijn — OK | regel 180 | – |
| **Drawer body `px-5 py-4` (20/16px)** — spec `padding: 8px 20px 20px` (top-py asymmetrisch). Symmetrische 16px is acceptabel maar drift bestaat. | regel 193 | P2 |
| **Drawer foot `px-5 py-4`** — spec `padding: 16px 20px` — match. OK | regel 196 | – |
| **Sort-popover `px-4 py-3` (16/12px)** voor menu-items — drukker dan andere lijstmenus | regel 143 | P2 |

---

## 4. Job-listing componenten

### 4.1 VacatureCard (`vacature-card.tsx`)

Significante drift van spec.

| Issue | Locatie | Severity |
|---|---|---|
| Grid `141px_1fr_168px` — match spec | regel 29 | – |
| `min-h-[222px]` — match spec | regel 29 | – |
| **`bg-surface shadow-card` zonder explicite `rounded-card` (=0)** — werkt door browser default (0 radius), maar best explicit | regel 29 | P2 |
| Logo cell `w-[141px] h-[141px]` desktop, `w-full h-[100px]` mobile — match spec | regel 104, 118 | – |
| **Content padding `px-5 sm:px-7 py-5 sm:py-6`** (20→28 / 20→24) — spec `padding: 26px 24px 22px 30px`. Code matched grof maar **asymmetrische padding-right (24px) en padding-left (30px) van de spec is platgeslagen tot symmetrisch**. | regel 32 | P1 |
| Title `text-h2 font-regular ... leading-snug` (1.375) — spec `line-height: 1.25` (`var(--lh-tight)` ish). Subtiel verschil. | regel 33 | P2 |
| Company `text-body tracking-tight font-light text-body` — **dubbel `text-body` token gebruikt** (`text-body` is zowel een font-size als een color in deze codebase!). Class wins kan onvoorspelbaar zijn. | regel 44 | P1 |
| Description `text-meta font-normal text-[#1F2937] leading-relaxed line-clamp-3 max-w-[60ch]` — **`text-[#1F2937]` hardcoded** in plaats van `text-body` of een token. Inconsistent met andere body-tekst. | regel 54 | P1 |
| Meta cell `px-5 sm:px-6 sm:py-6 pb-5 sm:pl-0` — spec `padding: 26px 24px 22px 0` (right=24, top=26, bottom=22, left=0). Code wijkt af, **mobile `pb-5` mist top-padding** waardoor meta-rij tegen content plakt op mobile. | regel 62 | P1 |
| `gap-1.5` (6px) tussen meta-rows — spec `gap: 6px` — OK | regel 62 | – |
| Mobile breakpoint `<sm:` (640px) — spec breekt `<= 767px` (md). **Op viewport 700px valt het al uit elkaar in grid-mode** met onvoldoende ruimte. | regel 29, 32, 62, 104, 118 | P0 op tablet portret |
| **Mobile meta-rij `flex-direction: row` met `flex-wrap`** in spec — code houdt `flex-col` op mobile (volgt de default `flex flex-col` op de cell). Spec breekt naar horizontale meta-pills op mobile. | – | P1 |
| Bookmark button absolute `top-0 right-0 w-11 h-11` — OK | regel 90 | – |
| **MetaRow icon `w-[13px] h-[13px]`** — spec idem — OK | regel 133 | – |

**Belangrijkste fix VacatureCard:** breakpoint van `sm:` naar `md:` (768px) zodat tablets niet in tussenstaat zitten. Plus consistent token-gebruik (geen `text-[#1F2937]`).

### 4.2 JobList (`job-list.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| `flex flex-col gap-[18px]` — gap is 18px = `--space-3`. Hardcoded magic-number. | regel 59 | P2 (token-gebruik) |
| `pt-7 pb-14` op "Nog X tonen" wrapper (28/56px) — geen spec, ad-hoc | regel 70 | P2 |

### 4.3 SortToolbar (`sort-toolbar.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| `pt-3 pb-5` (12/20px) — spec `padding: 6px 0 14px` — drift, vooral top is 2× spec | regel 83 | P1 |
| `gap-3` (12px) tussen count + sort-pill — adequaat | regel 83 | – |
| Sort-popover `min-w-[220px]` `px-4 py-2.5` — geen mockup-tegenhanger; oogt OK | regel 106, 119 | – |
| **`mt-2` (8px) offset onder pill voor popover** — geen visuele connector. Mockup heeft popover `top` aansluitend op de pill. | regel 106 | P2 |

### 4.4 Pagination (`pagination.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| `gap-1` (4px) tussen pagina-knoppen — krap. Mockup heeft geen explicite spec, maar visueel 6-8px gangbaar. | regel 41 | P2 |
| `py-6` (24px) wrapper — adequaat | regel 41 | – |
| Page-buttons `min-w-9 h-9` (36px) — krap voor mobile WCAG-target (44px). Spec heeft ook 36. | regel 64, 74 | P2 |
| PageStep (prev/next) `min-w-11 h-11` (44px) — OK | regel 100 | – |
| Page-button `border` (1px) `border-primary` op outline-variant — spec heeft outline-pattern. OK. | regel 74 | – |

---

## 5. Detail-pagina's

### 5.1 JobDetail (`job-detail.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| Grid `1fr_344px` met `gap-gap-content` (38px) — match spec | regel 34 | – |
| Sticky sidebar `top: calc(var(--header-height-desk) + 24px)` — magic 24px voor lucht boven sidebar, redelijk | regel 178 | – |
| **H1 `m-0 text-h1 font-bold tracking-tight leading-tight`** — `leading-tight` (1.25) vs spec `--lh-tight` (1.15) — drift | regel 47 | P2 |
| `mt-3 text-body tracking-tight` op company+location — adequaat | regel 50 | – |
| **Prose-class inline (regel 98) is ENORM**: `prose-p:text-[18px] prose-p:font-normal prose-p:text-[#1F2937] prose-p:leading-[1.7]` etc. Hardcoded `text-[18px]`, hardcoded `#1F2937`, hardcoded `1.7`. **Volledig buiten het token-systeem.** | regel 98 | P1 |
| Prose-headings `prose-h2:mt-10 prose-h2:mb-4 prose-h3:mt-8 prose-h3:mb-3` — match spec | regel 98 | – |
| `mt-8` voor description-wrapper (32px) — geen mockup-tegenhanger; adequaat | regel 91 | – |
| Company-block `mt-10 bg-surface shadow-card px-6 py-5` (40/24/20px) — adequaat, geen mockup | regel 108 | – |
| Related-section `mt-12 pt-8 border-t` (48/32px) — adequaat | regel 154 | – |
| Sidebar `p-6 flex flex-col gap-4` (24/16px) — adequaat, geen mockup | regel 180 | – |
| Sidebar dl `grid gap-3 pt-4 border-t` (12/16px) — adequaat | regel 194 | – |
| `<dt>` `text-small text-body uppercase tracking-[0.06em]` — hardcoded letter-spacing | regel 241 | P2 |
| **MobileFacts `grid grid-cols-1 sm:grid-cols-2 gap-4`** op een `<dl>` — op viewport 640-1024px (tablet) twee koloms, kan krap zijn bij lange waardes (bv. lange adressen). | regel 263 | P2 |

### 5.2 CompanyProfile (`company-profile.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| Grid `[120px_1fr]` met `gap-6 sm:gap-7` (24/28px) — adequaat | regel 28 | – |
| `mb-10 pb-8 border-b` (40/32px) — adequaat | regel 28 | – |
| Logo `w-[120px] h-[120px] border ... p-3` — adequaat | regel 29 | – |
| H1 `leading-tight` (1.25) — drift t.o.v. `--lh-tight` (1.15) | regel 45 | P2 |
| `mt-2 text-meta` voor jobcount — adequaat | regel 48 | – |
| `mt-4 max-w-prose` description — adequaat | regel 54 | – |
| `mt-5` voor link-row — adequaat | regel 59 | – |

---

## 6. Content-pagina's

### 6.1 Homepage (`app/page.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| Main `pb-15` — **`pb-15` bestaat niet in default Tailwind** (alleen `pb-14`/`pb-16`). Tenzij in tailwind.config.ts gedefinieerd, valt het terug op niets/`pb-0`. | regel 186 | **P0** indien niet gedefinieerd |
| Grid `gap-gap-content` (38px) + `pt-6` (24px) — adequaat | regel 187 | – |
| `pt-5 lg:pt-0` op main column — 20px buffer onder header op mobile. Acceptabel. | regel 188 | – |
| **`<p className="text-h2 font-regular text-primary leading-snug tracking-tight mt-7 mb-0 max-w-prose">` intro-paragraph** — gebruikt **h2-type-scale voor body-tekst**. Conflicteert visueel met de pagina-H1 niveau. | regel 195 | P1 |
| `mt-6` (24px) tussen SortToolbar en lijst — adequaat | regel 205 | – |

**Verify `pb-15`:** `grep -r "pb-15\|p-15" tailwind.config.ts` → niet zichtbaar in config. Vermoedelijk doet Tailwind 3.x `pb-15` als arbitrary-syntax niet automatisch; zou `pb-[60px]` of `pb-14` moeten zijn.

### 6.2 /vacatures (`app/vacatures/page.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| `py-8 pb-15` op main — zelfde `pb-15`-issue | regel 201 | P0 ZIE 6.1 |
| `mt-2` op SortToolbar — geen consistentie met homepage (`mt-6`) | regel 236 | P2 |

### 6.3 /vacatures/[city-slug]

| Issue | Locatie | Severity |
|---|---|---|
| `py-8` main — adequaat | regel 99 | – |
| `mt-12 pt-8 border-t` nabijgelegen-section — adequaat | regel 154 | – |
| "Nabijgelegen plaatsen" link `px-4 py-2 border` (16/8px) — **niet als PillButton, eigen variant** met `border-primary`, `font-bold`, geen `rounded-button`. Inconsistent met het pill-pattern elders. | regel 163 | P1 |

### 6.4 /contact (`app/contact/page.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| Grid `lg:grid-cols-[1.3fr_1fr]` met `gap-10 lg:gap-14` (40/56px) — adequaat | regel 57 | – |
| `mt-10` tussen hero en grid — adequaat | regel 57 | – |
| **`lg:pt-12`** op aside (48px buffer) — bewuste vertical-align om aside onder form-h2 te starten. Adequaat. | regel 73 | – |
| ContactInfoRow `w-9 h-9` icon-bubble (36px) + `rounded-button` (20px radius) — radius is groter dan halve breedte = oogt als softe square. Bewust? | regel 170 | P2 |
| Social-icons `w-11 h-11 rounded-button` — bug: `rounded-button` (20px) op een 44px element geeft pill-vorm. Vermoedelijk OK. | regel 112 | – |
| Bedrijfsgegevens `<dl grid-cols-[auto_1fr] gap-x-4 gap-y-1.5>` — adequaat | regel 131 | – |

### 6.5 /werkgevers (`app/werkgevers/page.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| Stats `grid sm:grid-cols-3 gap-3 max-w-3xl my-10` — `max-w-3xl` (48rem ≈ 768px) is willekeurig, niet token | regel 57 | P2 |
| Stats card `p-5` — adequaat | regel 126 | – |
| Step-list `grid gap-5` (20px) — adequaat | regel 72 | – |
| Step `grid-cols-[44px_1fr] gap-4` — adequaat | regel 144 | – |
| CTA-knop `h-12 px-6 rounded-button` — **eigen styling, niet via `<PillButton variant="primary">`**. Duplicatie. | regel 95 | P1 |

### 6.6 /over-ons (`app/over-ons/page.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| `mt-12 pt-8 border-t` CTA-section — consistent | regel 68 | – |
| Gebruikt `ProseContent` — zie 7.x | regel 66 | – |

### 6.7 /bedrijven (`app/bedrijven/page.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| EmptyState als placeholder. OK. | regel 48 | – |

### 6.8 MasterHomepage (`master-homepage.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| Hero `py-14` (56px) — adequaat | regel 42 | – |
| Hero h1 `leading-tight` (1.25) — drift vs `--lh-tight` | regel 43 | P2 |
| Mt-5 + gap-4 + h-9 px-4 pill — adequaat | regel 47-48 | – |
| Regio-grid `gap-3` (12px) `p-5` (20px) op tile — **te krap op grote tiles**. Vergelijk met footer-grid `gap-9` (36px). | regel 62, 111 | P2 |
| "Recente vacatures" section `pb-14` — adequaat | regel 69 | – |
| Section header `mb-6` (24px) — adequaat | regel 70 | – |
| Card-grid `gap-[18px]` — hardcoded waarde | regel 82 | P2 |

---

## 7. Formulieren en interactieve elementen

### 7.1 ContactForm (`contact-form.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| `space-y-4` (16px) tussen velden — adequaat | regel 37 | – |
| Label `text-meta font-bold text-primary tracking-tight mb-1.5` — 6px margin. Mockup standaard 8px. | regel 81, 137 | P2 |
| Input `h-11 px-4 rounded-input border border-divider` — `h-11` (44px) ✓, `rounded-input` (24px) ✓ | regel 149 | – |
| Input `text-body` — hier is `text-body` weer ambiguïteit (size of color?). | regel 149 | P2 |
| Textarea `px-4 py-3` — `py-3` (12px) op een textarea voelt strak; `py-4` (16px) is comfortabeler met de input-radius (24px) | regel 92 | P2 |
| Submit-button `h-12 px-7 rounded-button` — **wijkt af van PillButton `h-11`** | regel 100 | P1 |
| Focus ring via `focus-visible:shadow-[0_0_0_3px_color-mix(...)]` — clean | regel 149 | – |

### 7.2 SearchBanner (`search-banner.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| `bg-primary px-5 sm:px-10 pt-6 pb-7 sm:pt-7 sm:pb-8` — spec `padding: 30px 40px 32px` desktop, `22px 20px 24px` mobile. Code: 20/40 horizontaal, 24/28 vertical mobile, 28/32 vertical desktop. **Verticale waardes wijken af.** | regel 122 | P1 |
| Head-row `flex-col-reverse sm:flex-row gap-3 mb-4 sm:mb-5` — match spec | regel 127 | – |
| H1 `leading-tight` (1.25) — drift vs `--lh-tight` (1.15) | regel 130 | P2 |
| Pill `h-9 px-4 rounded-pill border border-on-dark text-body` — spec `height: 34px, padding: 0 16px`. **`h-9` = 36px (2px te groot).** | regel 135 | P2 |
| Input `h-[51px] pl-6 pr-16 rounded-input text-input` — match spec | regel 169 | – |
| Submit `right-1.5 w-[39px] h-[39px]` — spec `right: 6px, width/height: 39px`. `right-1.5` = 6px. ✓ | regel 174 | – |
| Suggest-listbox `top-[55px]` — hardcoded; werkt als input `h-[51px]` + 4px gap | regel 184 | P2 |
| Suggest-item `px-6 py-2.5 text-body font-light` — `py-2.5` (10px), oogt krap als suggesties veel zijn | regel 198 | P2 |

### 7.3 PillButton (`pill-button.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| Base `h-11 px-5 rounded-button gap-3` — spec `height: 44px, padding: 0 22px, gap: 12px`. `h-11`=44 ✓, `px-5`=20 (spec 22) drift 2px, `gap-3`=12 ✓ | regel 26-32 | P2 |
| Outline `border border-primary` (1px) — spec `1px solid` ✓ | regel 35 | – |
| Primary variant heeft `border border-primary` op een primary-fill → border onzichtbaar maar voegt 2px aan totale breedte toe (border-box, dus geen). | regel 41 | P2 (code-hygiëne, drop de border) |

### 7.4 Checkbox/Radio — zie sectie 2

### 7.5 ApplyButton (`apply-button.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| Inline-variant `h-12 px-6 rounded-button` (48px hoog) — **wijkt af van PillButton `h-11`** (44px). Inconsistente CTA-heights. | regel 49, 59 | P1 |
| Sticky bottom `fixed bottom-0 ... p-3` (12px) — adequaat | regel 71-74 | – |
| Veilig `paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))'` — OK iOS | regel 74 | – |
| Mobile bottom-bar (MobileBottomBar) en ApplyButton op vacature-detail **stacken op mobile** — beide `fixed`/`sticky` bottom. Zou kunnen overlappen. | – | **P0 verify** |

### 7.6 ProseContent (`prose-content.tsx`)

| Issue | Locatie | Severity |
|---|---|---|
| `prose prose-sm` — Tailwind typography size. **`prose-sm` zet h2 op 1.25rem en body op 14px** — kleiner dan elders op de site (waar `text-body` = 16px). Inconsistent met de rest. | regel 27 | P1 |
| `prose-p:text-body` — color of size? In context van Tailwind typography is `text-body` mogelijk de Tailwind color token; size is overridden door `prose-sm`. **Mogelijk visuele body-text in twee maten op dezelfde pagina (over-ons body 14px vs werkgevers description 16px).** | regel 34 | P1 |
| `prose-blockquote:border-l-secondary` — match brand | regel 43 | – |

---

## 8. Hoofdthema's en samenvatting

### 8.1 Top-prioriteit (P0 + duidelijk visueel)

1. **Filter-checkbox border-color** is `border-neutral-400` ipv `border-primary`, +**1px ipv 2px**, +**18px ipv 20px**. → directe oorzaak van de screenshot.
2. **`pb-15`** op homepage en /vacatures bestaat waarschijnlijk niet → controleer of bottom-padding rendert.
3. **VacatureCard `sm:` breakpoint** (640px) breekt grid-layout te vroeg voor tablets — moet `md:` (768px) zijn.
4. **MobileBottomBar + ApplyButton overlap** op vacature-detail mobile — beide bottom-sticky.

### 8.2 P1 (spec-afwijking, oogt inconsistent)

- Filter-group padding/legend marges + bold-weight ontbreken.
- Filter-option spacing/gap/min-height te krap (items plakken).
- Diverse CTAs (`h-12`-buttons) wijken af van `PillButton h-11`.
- **`text-body` is dubbel-ambigu** (kleur én size in dezelfde naam) — leidt tot conflicting Tailwind-classes op meerdere componenten.
- Hardcoded kleuren `text-[#1F2937]` op VacatureCard en in inline prose-class op JobDetail.
- `prose-sm` voor over-ons/long-form copy maakt body-tekst 14px ipv 16px elders.
- SortToolbar `pt-3 pb-5` vs spec `padding: 6px 0 14px`.
- SearchBanner mobile vertical padding wijkt 2-4px af van spec.
- Description in PageHero gebruikt h2-type-scale → te zwaar.
- Intro-paragraph op homepage gebruikt h2-type-scale.

### 8.3 P2 (drift / token-hygiëne)

- `--space-*` en `--lh-*` tokens uit mockup niet overgenomen — verklaart 90% van de drifts.
- Vele `gap-[18px]`, `gap-[6px]`, `min-h-7`, `text-[18px]` hardcoded magic-numbers.
- `text-body` color verschil mockup (#7C7C7C) vs globals (#4B5563).
- Marginale leading- en margin-discrepanties van 2-4px (mb-1.5 vs mb-2, leading-snug vs 1.45, h-9 vs 34px pill).
- Border duplicatie op `PillButton variant="primary"`.

### 8.4 Aanbevolen aanpak

1. **Eerst tokens fixen** (sectie 1.3) → voegt `--space-*`, `--lh-*` toe en exposed ze via Tailwind.
2. **Filter-component fix** (sectie 2.1-2.4) → adresseert de screenshot direct.
3. **`text-body` ambiguïteit oplossen**: hernoem ofwel de color-token naar `text-muted` of `text-neutral`, ofwel de font-size-utility-class. Nu botsen ze in elke `<p className="text-body text-body">`.
4. **CTA-consolidatie**: alle primary CTAs door `PillButton variant="primary"`. Verwijder eigen `h-12 px-7 rounded-button bg-primary`-duplicaten.
5. **VacatureCard breakpoint** naar `md:` (768px).
6. **`pb-15` issue verifiëren** in een dev-build (zou makkelijk gemist te zijn als hij silently faalt).
7. **Op breakpoints 640-768px (tablet portret) handmatig elke route lopen** — daar valt het meeste uit elkaar (vacature-card, mobile-facts, header gap).

### 8.5 Buiten scope maar relevant

- `app/account/*`, `app/sign-in/*`, `app/sign-up/*`, `app/voorwaarden/*`, `app/privacy/*`, `app/werkgevers/pakketten` zijn niet diepgaand gecontroleerd. Aanname: gebruiken dezelfde gedeelde componenten, dus issues 1-2 (tokens, filter, card) propageren daarheen.
- Legal templates (`lib/legal/*`) gebruiken ProseContent → erven `prose-sm`-issue (8.2).
- Cookie-consent component niet beoordeeld.
- Mobile-menu component niet beoordeeld (zou idealiter de hamburger-inhoud + close-affordance valideren).
