# Lokale Banen — Design System & UX

**Versie:** 1.0
**Datum:** 2026-04-11
**Status:** Draft
**Voor:** `apps/public-sites` (alle 50+ regio-domeinen + master aggregator)

---

## 1. Design Principes

Elke beslissing volgt uit deze 7 principes. Als iets ze breekt, gaat het terug naar de tekentafel.

1. **Mobile-first, écht** — ~75% van verkeer is mobiel. Desktop is de upgrade, niet het uitgangspunt.
2. **Zoekbalk is koning** — altijd zichtbaar, sticky, centraal, dominant.
3. **Thumb-zone UX** — primaire acties in onderste 1/3 van mobiele viewport.
4. **Geen marketing-hero** — vacaturelijst begint op fold 1. (Luc's principe.)
5. **Max 2 clicks tot solliciteren** vanaf homepage.
6. **Per-tenant theming via CSS custom properties** — 50 regio's, één codebase, DB-driven accent kleur.
7. **Performance is design** — traag = lelijk. Bundle <100kb, LCP <2.5s, Lighthouse ≥95.

---

## 2. Aesthetic Reference

Wat we wél willen: **Otta.com**, **Linear.app**, **Welcome to the Jungle**.
- Clean cards, soft shadows (geen harde borders)
- Eén accent kleur, rest neutraal grijs
- Generous whitespace, confidente typografie
- Micro-interacties via CSS transitions (niet Framer Motion)

Wat we NIET willen: **Indeed**, **LinkedIn Jobs**, **Monsterboard**.
- Overladen met modules en ads
- Druk, goedkoop gevoel
- Corporate-heavy

**Kernwoord**: "premium minimalism" — weinig elementen, elke in perfecte staat.

---

## 3. Layout — Mobiele Homepage (primair use case)

```
┌──────────────────────────┐
│ [logo] Westlandse Banen  │  ← header: 56px hoog
│                    [👤]  │    avatar / login icon rechts
├──────────────────────────┤
│ 🔍 Functie of trefwoord  │  ← sticky search (72px)
│ 📍 Westland              │    default = tenant regio
│ [────── Zoeken ──────]   │    primary button, full width
├──────────────────────────┤
│ [Alle] [Fulltime] [Parttime] [Stage] →  ← filter chips horizontal scroll
├──────────────────────────┤
│                          │
│ ┌──────────────────────┐ │
│ │ [Logo]               │ │  ← shadcn Card, full width
│ │ Junior Developer     │ │
│ │ Bedrijf X · Naaldwijk│ │
│ │ € 2.800 - 3.500/mnd  │ │    salary als subtle highlight
│ │ Fulltime · Vandaag   │ │
│ └──────────────────────┘ │
│                          │
│ ┌──────────────────────┐ │
│ │ [Logo]  Monteur CV   │ │
│ │ ...           [Nieuw]│ │  ← amber badge voor <3 dagen
│ └──────────────────────┘ │
│                          │
│         [Meer ▼]         │  ← load-more (niet infinite scroll, voor SEO)
├──────────────────────────┤
│                          │  ← footer: hub brand link
│ Onderdeel van Lokale     │
│ Banen Netwerk            │
└──────────────────────────┘
```

**Mobile rationale:**
- Zoekveld + locatie + "hier staan vacatures" binnen 3 sec zichtbaar
- Filter chips horizontaal scrollable = native iOS/Android gevoel, geen dropdowns
- Hele card = tap target (44px+ minimum)
- "Meer" button ipv infinite scroll voor SEO (crawlers volgen geen JS-pagination)
- Max 2 cards above-the-fold zodat gebruiker ziet dat er meer is

---

## 4. Layout — Mobiele Detail Pagina

```
┌──────────────────────────┐
│ ← Terug       [↗][♡]    │  ← back + share + save (44px tap targets)
├──────────────────────────┤
│ [Bedrijf Logo]           │
│                          │
│ Junior Developer         │  ← H1, 24px bold, -0.02em tracking
│ @ Bedrijf X · Naaldwijk  │
│                          │
│ ┌──────────────────────┐ │
│ │ 💰 € 2.800 - 3.500   │ │  ← callout box (emerald accent)
│ │ 🕐 32-40 uur/week    │ │    icons voor scanbaarheid
│ │ 📋 Fulltime          │ │
│ │ 📅 Gepost: vandaag   │ │
│ └──────────────────────┘ │
│                          │
│ ## Wat ga je doen?       │  ← H2 question-based (GEO-goud)
│ Je werkt als junior ...  │    134-167 word passage
│ [2-4 zinnen max]         │
│                          │
│ ## Wie zoeken we?        │
│ • HBO werk-denkniveau    │
│ • 0-3 jaar ervaring      │
│                          │
│ ## Wat bieden we?        │
│ • Salaris tot €3500      │
│ • 25 vakantiedagen       │
│                          │
│ ## Over Bedrijf X        │
│ [Logo] Beschrijving      │  ← from companies tabel
│ [🌐 website] [💼 LinkedIn]│    sameAs links = JSON-LD voeding
│                          │
│ ## Vergelijkbare banen   │  ← interne linking + sessie verlenger
│ [3 compacte cards]       │
├──────────────────────────┤
│ [━━━ Solliciteer ━━━]    │  ← STICKY bottom, full width
└──────────────────────────┘    primary color, 56px hoog
```

**Kritische patterns:**
- **Sticky "Solliciteer" CTA** onderaan — thumb-zone, altijd bereikbaar
- **Back button** links boven — iOS/Android muscle memory
- **Salary callout box** bovenin — 70% van job seekers filtert op salaris
- **H2's met vragen** ("Wat ga je doen?") — matcht zoekqueries én LLM citation patterns
- **Company block** met sameAs → JSON-LD Organization → authority signals

---

## 5. Layout — Desktop Homepage

```
┌─────────────────────────────────────────────────────────────────┐
│ [Logo] WestlandseBanen  🔍 [Functie]  📍 [Plaats]   [👤 Kenny] │ ← 72px
├─────────────────────────────────────────────────────────────────┤
│ [Fulltime] [Parttime] [Stage] [Thuiswerk] | [Alle filters ▼]   │ ← chips
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │ [Logo] Junior Developer│  │ [Logo] Monteur CV    │            │
│  │ Bedrijf X · Naaldwijk │  │ Bedrijf Y · Maasdijk │            │
│  │ € 2.800 - 3.500/mnd  │  │ € 2.500 - 3.200/mnd  │            │
│  │ Fulltime · 2u geleden│  │ Fulltime · Vandaag   │            │
│  │ Korte beschrijving...│  │ Korte beschrijving...│            │
│  │                  [→] │  │                  [→] │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                  │
│  [meer cards in 2-kolom grid]                                   │
│                                                                  │
│                 [Meer vacatures]                                │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│  Vacatures per plaats: Naaldwijk · Maasdijk · Wateringen · ...   │ ← SEO
│  Vacatures per sector: Tuinbouw · Logistiek · Techniek · ...     │    links
│                                                                  │
│  Onderdeel van Lokale Banen Netwerk · © 2026                     │
└─────────────────────────────────────────────────────────────────┘
```

**Desktop rationale:**
- **2-kolom card grid** (niet 3-4, te klein). Max width 1200px gecentreerd.
- **Zoekbalk inline in header** — spaart verticale ruimte vs aparte rij
- **Footer interne links** per stad/sector — SEO juice + landingspagina's
- **Geen split-view** in MVP — Luc wil minimalistisch, later toe te voegen

---

## 6. Filter UI

### Mobiel: Bottom Sheet (shadcn Drawer)
```
┌──────────────────────────┐
│ ──── (drag handle) ────  │
│                          │
│ Filters          [Reset] │
├──────────────────────────┤
│ Dienstverband            │
│ ☑ Fulltime               │
│ ☐ Parttime               │
│ ☐ Stage                  │
│                          │
│ Salaris                  │
│ € 2000 ━━━●━━━━ € 5000  │
│                          │
│ Afstand tot              │
│ [10km] [25km] [50km]     │
├──────────────────────────┤
│ [━━ Toon 124 banen ━━]  │
└──────────────────────────┘
```

### Desktop: Side Panel (shadcn Sheet)
```
┌────────────────────┐
│ Filters        [×] │
├────────────────────┤
│ Dienstverband      │
│ ☑ Fulltime         │
│ ☐ Parttime         │
│                    │
│ Salaris            │
│ € 2000 ━━●━━ 5000 │
│                    │
│ Afstand            │
│ [5][10][25][50]    │
│                    │
│ Branche            │
│ ☐ Techniek         │
│ ☐ Logistiek        │
│                    │
│ [Toon 124 banen]   │
└────────────────────┘
```

**Belangrijk**: filters muteren de URL (`?type=fulltime&salary_min=2000`). Crawlers en back/forward werken zonder JS. Zero client-side fetch. Server re-rendert met nieuwe searchParams. Snel, SEO-proof.

---

## 7. Account Flow (Clerk-powered)

### Sign-in (mobiel full-screen, desktop dialog)

```
┌──────────────────────────┐
│ ← Terug                  │
│                          │
│  Welkom bij              │
│  WestlandseBanen         │
│                          │
│  Log in of maak een      │
│  account aan om vacatures│
│  op te slaan en te       │
│  solliciteren            │
│                          │
│  [ 📧 E-mail.......... ] │
│  [ 🔒 Wachtwoord..... ]  │
│                          │
│  [━━━━ Inloggen ━━━━]   │
│                          │
│  ────  of  ────          │
│                          │
│  [🌐 Inloggen met Google]│
│  [📧 Stuur magic link]   │
│                          │
│  Nog geen account?       │
│  [Account aanmaken]      │
└──────────────────────────┘
```

Deze UI komt uit Clerk's `<SignIn />` component. Voor MVP gebruiken we **Clerk default met custom `appearance` prop** voor theming naar tenant primary color. Custom shadcn-form implementatie komt in fase 2 als conversie optimalisatie nodig is.

### Account Dashboard (`/account`)

```
┌──────────────────────────┐
│ ← Terug     Mijn Account │
├──────────────────────────┤
│                          │
│ [Avatar] Kenny Lipman    │
│         kenny@lokale...  │
│                          │
│ ┌──────────────────────┐ │
│ │ 📌 Opgeslagen        │ │  ← link to /account/opgeslagen
│ │    12 vacatures      │ │
│ └──────────────────────┘ │
│                          │
│ ┌──────────────────────┐ │
│ │ 📝 Sollicitaties     │ │  ← link to /account/sollicitaties
│ │    3 verstuurd       │ │
│ └──────────────────────┘ │
│                          │
│ ┌──────────────────────┐ │
│ │ ⚙️  Profiel           │ │  ← link to /account/profiel
│ │    Clerk UserProfile │ │
│ └──────────────────────┘ │
│                          │
│ [ Uitloggen ]            │
└──────────────────────────┘
```

---

## 8. Design Tokens

### Kleuren (shadcn/ui + tenant override)

```css
/* app/globals.css */
@layer base {
  :root {
    /* Vaste base tokens (nooit per tenant) */
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --border: 214 32% 91%;
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    --ring: 221 83% 53%;

    /* Status kleuren */
    --salary: 160 84% 39%;        /* emerald — salary highlights */
    --new: 38 92% 50%;            /* amber — "Nieuw" badge */
    --destructive: 0 84% 60%;

    /* Per-tenant override via layout.tsx <style> */
    --primary: 221 83% 53%;       /* default, wordt overschreven */
    --primary-foreground: 210 40% 98%;

    --radius: 0.625rem;           /* 10px — iets ronder = vriendelijk */
  }
}
```

### Tenant override (server-side, zero JS)

```tsx
// apps/public-sites/app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs'
import { getTenant } from '@/lib/tenant'
import { hexToHsl } from '@lokale-banen/shared/color'

export default async function RootLayout({ children }) {
  const tenant = await getTenant()
  const primaryHsl = hexToHsl(tenant.primary_color)

  return (
    <html lang="nl">
      <head>
        <style>{`
          :root {
            --primary: ${primaryHsl};
            --ring: ${primaryHsl};
          }
        `}</style>
      </head>
      <body>
        <ClerkProvider
          appearance={{
            variables: { colorPrimary: tenant.primary_color },
          }}
          dynamic
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
```

**Resultaat**: 50 regio's, één codebase, verschillende accents op exact dezelfde layout. Geen design drift.

### Typografie

```
Font: Inter (self-hosted via next/font)
Gewichten: 400, 500, 600, 700
Fallback: system-ui, -apple-system, sans-serif

H1 (page title)     → 32/36px Bold      letter-spacing -0.02em
H2 (section)        → 20/28px SemiBold
H3 (card title)     → 17/24px SemiBold
Body                → 15/22px Regular
Meta (grey)         → 13/18px Medium   (muted-foreground)
Price (highlight)   → 16/22px SemiBold  tabular-nums
```

Fluid sizing via Tailwind:
```ts
// tailwind.config.ts excerpt
fontSize: {
  'display': ['clamp(28px, 1.5rem + 1vw, 36px)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
  'h1':      ['clamp(24px, 1.3rem + 0.8vw, 32px)', { lineHeight: '1.2',  letterSpacing: '-0.02em' }],
  'h2':      ['clamp(18px, 1.05rem + 0.4vw, 20px)', { lineHeight: '1.35' }],
  'h3':      ['clamp(16px, 0.95rem + 0.3vw, 17px)', { lineHeight: '1.4' }],
  'body':    ['clamp(15px, 0.9rem + 0.2vw, 16px)', { lineHeight: '1.55' }],
  'meta':    ['13px', { lineHeight: '1.5' }],
}
```

### Spacing (8px grid)

```
xs: 4px   (badge padding, tight groups)
sm: 8px   (element gap)
md: 16px  (card padding, section gap — default)
lg: 24px  (section padding, card block)
xl: 32px  (page section)
2xl: 48px (hero, major separators)
3xl: 64px (hero padding desktop)
```

### Border radius

```
sm: 6px     (chips, small badges)
md: 8px     (buttons, inputs)
lg: 10px    (cards, dialogs — default --radius)
xl: 12px    (modals, feature blocks)
full: 9999px (pills, avatars)
```

### Shadows (niet-harsh, moderne stijl)

```css
--shadow-sm:  0 1px 2px 0 rgb(0 0 0 / 0.04);
--shadow-md:  0 2px 6px -1px rgb(0 0 0 / 0.08), 0 1px 4px -1px rgb(0 0 0 / 0.04);
--shadow-lg:  0 8px 24px -4px rgb(0 0 0 / 0.12);
```

Gebruikt alleen bij: card hover, bottom sheet, sticky footer CTA, dialogs. Niet als default.

---

## 9. Componenten — shadcn/ui Installatie

### Welke shadcn componenten we installeren

```bash
# Core
pnpm dlx shadcn@latest add button input label badge card

# Navigation & feedback
pnpm dlx shadcn@latest add dropdown-menu popover
pnpm dlx shadcn@latest add skeleton separator

# Mobiel kritiek
pnpm dlx shadcn@latest add drawer      # Vaul — bottom sheet voor filters
pnpm dlx shadcn@latest add sheet       # side panel filters (desktop)
pnpm dlx shadcn@latest add dialog      # login modal, confirmations

# Search / forms
pnpm dlx shadcn@latest add command     # combobox voor autocomplete
pnpm dlx shadcn@latest add select
pnpm dlx shadcn@latest add form
pnpm dlx shadcn@latest add checkbox radio-group toggle-group

# Account
pnpm dlx shadcn@latest add avatar tabs

# Feedback
pnpm dlx shadcn@latest add sonner      # toasts
pnpm dlx shadcn@latest add alert
```

### Bundle impact

| Stack | First Load JS |
|---|---|
| Base (Next.js + Tailwind) | ~40kb |
| + shadcn core componenten | ~75kb |
| + Vaul drawer + Radix primitives | ~88kb |
| + Clerk SDK | ~105kb |
| **Target** | **<110kb** ✅ |

Nog steeds 4-5× lichter dan Indeed (400-800kb).

### Custom componenten (op shadcn primitives)

```
components/
├── ui/                    ← shadcn componenten (copy-paste, niet aanpassen)
│   ├── button.tsx
│   ├── card.tsx
│   ├── drawer.tsx
│   └── ...
├── job-card.tsx           ← custom, gebruikt ui/card
├── job-list.tsx           ← server component
├── search-bar.tsx         ← custom, gebruikt ui/command
├── filter-chips.tsx       ← custom, gebruikt ui/button variants
├── filter-drawer.tsx      ← custom, gebruikt ui/drawer
├── filter-sheet.tsx       ← custom, gebruikt ui/sheet
├── apply-button.tsx       ← sticky CTA variant
├── save-job-button.tsx    ← Clerk-aware save toggle
├── user-nav.tsx           ← Clerk UserButton wrapper
└── tenant-header.tsx      ← per-tenant branded header
```

Shadcn is je **startpunt**, niet je **eindpunt**. Voor elke unieke UI-compositie (job card, hero, detail) schrijven we custom components op de primitives. Zo krijg je geen generieke AI-aesthetic.

---

## 10. Vacature Card — Code Voorbeeld

```tsx
// components/job-card.tsx
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Clock, MapPin } from 'lucide-react'
import { formatRelative } from '@/lib/date'
import type { JobPosting } from '@lokale-banen/database'

export function JobCard({ job }: { job: JobPosting }) {
  const isNew = Date.now() - new Date(job.published_at).getTime() < 3 * 24 * 60 * 60 * 1000

  return (
    <Link href={`/vacature/${job.slug}`} className="block group">
      <Card className="transition-all hover:shadow-md hover:border-border">
        <CardContent className="p-5 sm:p-6">
          <div className="flex gap-4">
            <Avatar className="h-12 w-12 rounded-md shrink-0">
              <AvatarImage src={job.company.logo_url ?? undefined} alt={job.company.name} />
              <AvatarFallback className="rounded-md bg-muted text-xs font-semibold">
                {job.company.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-[17px] leading-tight tracking-tight group-hover:text-primary transition-colors line-clamp-2">
                  {job.title}
                </h3>
                {isNew && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200 shrink-0">
                    Nieuw
                  </Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <span className="font-medium">{job.company.name}</span>
                <span>·</span>
                <MapPin className="h-3.5 w-3.5" />
                <span>{job.city}</span>
              </p>

              {job.salary && (
                <p className="text-sm font-semibold text-emerald-700 mt-2 tabular-nums">
                  {job.salary}
                </p>
              )}

              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{job.employment ?? 'Onbekend'}</span>
                <span>·</span>
                <span>{formatRelative(job.published_at)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
```

Cruciale details:
- `<Link>` wraps de hele card → hele card is klikbaar (groot tap target)
- `group` + `group-hover:` laat title in primary color oplichten bij hover
- `transition-all` op Card → subtle lift bij hover (shadow grow)
- `tabular-nums` op salary → nummers voelen premium
- `line-clamp-2` voorkomt layout shift bij lange titels
- `shrink-0` op Avatar en Badge → flex layout robust

---

## 11. Key Mobile Patterns (de 7 die het verschil maken)

1. **Sticky search bar** — plakt onder header tijdens scroll, altijd 1 tap nieuwe zoekopdracht
2. **Sticky "Solliciteer" CTA** op detail page — `fixed bottom-0`, thumb-zone
3. **Filter chips horizontaal scrollable** — geen dropdowns, native swipe feel
4. **Bottom sheet voor uitgebreide filters** — shadcn Drawer (Vaul) — pull-to-dismiss
5. **"Nieuw" badge** op cards <3 dagen — urgentie signal, subtiel
6. **Skeleton loaders via shadcn Skeleton** — nooit spinners (voelen traag)
7. **Native share sheet** via `navigator.share()` — gebruikers snappen het direct

---

## 12. Accessibility (WCAG AA baseline)

| Eis | Target | Meting |
|---|---|---|
| Kleur contrast | 4.5:1 voor text | axe-core CI check |
| Tap targets | ≥44×44px (Apple HIG) | manual + Playwright |
| Keyboard navigatie | alles bereikbaar | Tab-through test |
| Focus states | zichtbaar, primary ring | shadcn default |
| ARIA labels | op icon buttons | code review |
| Alt text | op alle images | `next/image` verplicht `alt` |
| Semantic HTML | `<header>`, `<main>`, `<nav>`, `<article>` | structural review |
| Heading hiërarchie | H1 → H2 → H3, geen skips | Lighthouse SEO |

### Specifieke Clerk-accessibility

Clerk componenten zijn WCAG AA compliant out-of-the-box. Voor theming via `appearance` prop:

```tsx
<ClerkProvider
  appearance={{
    variables: {
      colorPrimary: tenant.primary_color,
      colorText: 'hsl(222 47% 11%)',
      colorInputBackground: 'hsl(0 0% 100%)',
      colorInputText: 'hsl(222 47% 11%)',
      fontFamily: 'var(--font-inter)',
      borderRadius: '8px',
    },
  }}
>
```

---

## 13. Performance Budgets (harde eisen)

| Metric | Target | Blocker bij |
|---|---|---|
| First Load JS (home) | <100kb | >120kb |
| First Load JS (detail) | <100kb | >120kb |
| First Load JS (account) | <130kb | >150kb |
| LCP (mobile 4G) | <2.5s | >3.5s |
| CLS | <0.1 | >0.15 |
| INP | <200ms | >300ms |
| Lighthouse Performance | ≥95 | <85 |
| Lighthouse SEO | 100 | <100 |
| Lighthouse Accessibility | ≥95 | <90 |

Deze worden gemeten via:
- **Vercel Analytics** (productie, real user data)
- **Lighthouse CI** (elke PR, laptop + mobile profiles)
- **Playwright E2E** (happy path, Core Web Vitals)

### Wat houden we bewust weg

- Geen **Framer Motion** — CSS transitions doen het werk
- Geen **React Query / SWR** — Server Components + `'use cache'`
- Geen **Zustand / Jotai** — URL searchParams + React state
- Geen **Moment / date-fns-tz** — `Intl.RelativeTimeFormat` built-in
- Geen **Axios** — `fetch` is genoeg
- Geen **icon fonts** — Lucide tree-shaken per icon (~1-2kb)
- Geen **Google Fonts network request** — Inter self-hosted

---

## 14. Next.js 16 + Cache Components — Component Patterns

Drie patronen die we overal hanteren (conform sectie 2 van Cache Components docs):

### A. Static (geen data, prerendered at build)

```tsx
export function TenantHeader({ logo, hero_title }: Props) {
  return (
    <header className="sticky top-0 z-50 bg-background border-b">
      <div className="container flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2">
          <img src={logo} alt="" className="h-8 w-auto" />
          <span className="font-semibold">{hero_title}</span>
        </Link>
        <UserNav />
      </div>
    </header>
  )
}
```

Geen `'use cache'`, geen data fetch. Wordt pre-rendered bij build.

### B. Cached (async data, revalidates)

```tsx
async function JobList({ tenantId, filter }: Props) {
  'use cache'
  cacheLife('minutes')                     // 5m stale / 15m revalidate
  cacheTag(`jobs:${tenantId}`)

  const jobs = await getApprovedJobs(tenantId, filter)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {jobs.map((job) => <JobCard key={job.id} job={job} />)}
    </div>
  )
}
```

Cached per tenant + filter combinatie. Invalidate via `revalidateTag('jobs:uuid')` na admin approve.

### C. Dynamic (user-specific, Suspense)

```tsx
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function JobDetailPage({ params }) {
  return (
    <>
      <JobDetail slug={params.slug} />           {/* cached */}

      <Suspense fallback={<Skeleton className="h-10 w-32" />}>
        <SaveJobButton slug={params.slug} />     {/* user-specific */}
      </Suspense>
    </>
  )
}

async function SaveJobButton({ slug }: { slug: string }) {
  const { userId } = await auth()              // Clerk runtime
  if (!userId) return <SaveJobButtonAnon slug={slug} />

  const isSaved = await checkSavedStatus(userId, slug)
  return <SaveJobButtonClient initialSaved={isSaved} />
}
```

Static shell (header, footer, cards) streamt instant van CDN. Cached data komt binnen 100ms daarna. User-specific elementen streamen als laatste, met Skeleton fallback. LCP treft alleen de static/cached delen = snel.

---

## 15. Responsive Breakpoints

Mobile-first via Tailwind defaults:

```
default (mobile)     < 640px   — single column, sticky search, bottom sheet filters
sm (large mobile)    ≥ 640px   — ietsje meer spacing
md (tablet)          ≥ 768px   — 2-column card grid begins
lg (desktop)         ≥ 1024px  — filter side panel, max-width container
xl (desktop large)   ≥ 1280px  — full 2-col + sidebar (alleen als nodig)
2xl (wide)           ≥ 1536px  — geen layout verandering, content blijft 1200px
```

Geen aparte "tablet" design — tablet = kleine desktop in ons model. Simpeler te maintainen over 50 regio's.

---

## 16. Animatie & Micro-interacties

Alle animaties via **CSS transitions**, nooit via JS library.

```css
/* globals.css */
@layer base {
  * {
    transition-duration: 150ms;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
}
```

Specifieke interacties:
- **Card hover**: `hover:shadow-md hover:border-border/80` (150ms)
- **Button active**: `active:scale-[0.98]` (100ms) — tactile feedback
- **Link hover**: `hover:text-primary` (150ms)
- **Filter chip toggle**: `data-[state=active]:bg-primary data-[state=active]:text-primary-foreground`
- **Drawer slide**: Vaul handles dit, native feel
- **Skeleton pulse**: shadcn default `animate-pulse`

Geen entrance animations, geen parallax, geen scroll-triggered effects. Houdt het rustig en snel.

---

## 17. Empty States & Error States

Bij lege lijst of fout: meaningful content, niet "Er ging iets mis".

### Empty zoekresultaat

```tsx
<div className="py-16 text-center space-y-4">
  <Search className="h-12 w-12 mx-auto text-muted-foreground" />
  <h2 className="text-h2 font-semibold">Geen vacatures gevonden</h2>
  <p className="text-muted-foreground max-w-sm mx-auto">
    Probeer je zoekopdracht aan te passen of bekijk alle vacatures in {tenant.name}.
  </p>
  <Button asChild>
    <Link href="/">Bekijk alle vacatures</Link>
  </Button>
</div>
```

### 404 (onbekende vacature)

```tsx
<div className="py-16 text-center space-y-4">
  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
  <h1 className="text-h1 font-semibold">Deze vacature bestaat niet meer</h1>
  <p className="text-muted-foreground">
    De vacature is verwijderd of de link is niet correct.
  </p>
  <Button asChild>
    <Link href="/">Terug naar vacatures</Link>
  </Button>
</div>
```

### 410 (verlopen vacature)

```tsx
<div className="py-16 text-center space-y-4">
  <Clock className="h-12 w-12 mx-auto text-muted-foreground" />
  <h1 className="text-h1 font-semibold">Deze vacature is verlopen</h1>
  <p className="text-muted-foreground">
    De deadline is gepasseerd. Bekijk onze actuele vacatures.
  </p>
  <Button asChild>
    <Link href="/">Actuele vacatures</Link>
  </Button>
</div>
```

Server returnt HTTP 410 status voor expired jobs (niet 404) — goed voor crawl budget.

---

## 18. Te vermijden valkuilen

- ❌ **Hover states als enige affordance** — werkt niet op mobiel, altijd ook visual cue
- ❌ **Modals voor alles** — gebruik inline where possible
- ❌ **Autoplay animations** — afleidend, drain batterij
- ❌ **Color-only information** — altijd tekst/icon combineren (a11y)
- ❌ **Placeholder als label** — verdwijnt bij typen, slecht voor a11y
- ❌ **Fixed font sizes** — gebruik fluid `clamp()`
- ❌ **Carousel op homepage** — slechte engagement, slecht voor SEO
- ❌ **Pop-up cookie banner met blur** — geen JS-dependent legal UI
- ❌ **"Accept all" donker patroon** — transparante cookie keuze
- ❌ **Skeleton die te snel verdwijnt** — min 300ms zichtbaar voor perceptie

---

## 19. Design QA Checklist (pre-launch)

Elke tenant voor go-live:
- [ ] Logo upload en weergave correct (mobiel + desktop)
- [ ] Primary color contrast ≥4.5:1 met wit
- [ ] Hero title past binnen 2 regels mobiel
- [ ] Homepage LCP <2.5s op throttled 4G
- [ ] Lighthouse mobiel ≥95
- [ ] 3-5 verschillende schermformaten getest (iPhone SE, Pixel 6, iPad, laptop, 4K)
- [ ] Keyboard-only navigatie werkt
- [ ] Screen reader test (VoiceOver mobiel)
- [ ] Clerk login flow werkt (signup → email verify → redirect back)
- [ ] Save job werkt anoniem (localStorage) en ingelogd (DB)
- [ ] Detail page: JSON-LD valideert via schema.org validator
- [ ] /sitemap.xml bereikbaar, correct format
- [ ] /llms.txt bereikbaar, bevat tenant-specifieke content
- [ ] 404/410 handling werkt correct
- [ ] Open Graph preview werkt op WhatsApp/Slack/Twitter

---

## 20. Gerelateerde documenten

- `.planning/PLAN.md` — uitvoeringsplan, fases, timeline
- `.planning/GEO-ANALYSIS.md` — SEO/GEO audit, schema requirements, brand strategie
