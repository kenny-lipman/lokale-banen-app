# UI Components (admin-app)

> Onderhoud: bij het toevoegen of significant wijzigen van een component in `apps/admin/components/ui/` werk je deze doc bij in dezelfde commit.

## Intro

Alle UI-componenten staan in `apps/admin/components/ui/` (62 bestanden). De basis is [shadcn/ui](https://ui.shadcn.com) (Radix primitives + Tailwind + `class-variance-authority`), aangevuld met een aantal project-eigen (custom) componenten.

Importeren gaat altijd via de path-alias:

```tsx
import { Button } from "@/components/ui/button"
import { MultiSelect } from "@/components/ui/multi-select"
```

Toasts lopen niet via een eigen `toast.tsx`, maar direct via de `sonner`-library:

```tsx
import { toast } from "sonner"   // de functie
// <Toaster /> staat één keer in app/layout.tsx (wrapper: components/ui/sonner.tsx)
```

**Andere apps in de monorepo:** `apps/employer-portal` en `apps/public-sites` hebben géén eigen `components/ui/` map. employer-portal bevat alleen een `README.md` + `package.json` (nog niet uitgewerkt). public-sites heeft wel een `src/components/` (o.a. een `eyeron/` submap), maar deelt of dupliceert deze shadcn-set niet. Deze doc beschrijft dus uitsluitend de admin-app.

---

## Wanneer welke component

Onderstaande richtlijnen zijn afgeleid uit hoe de componenten in de codebase gebouwd en gebruikt worden.

### Selectie: `select` vs `combobox` vs `multi-select` vs `simple-dropdown`

| Component | Wanneer gebruiken |
|-----------|-------------------|
| `select` | Standaard shadcn dropdown. Eén keuze uit een korte, vaste lijst zonder zoekbehoefte (bv. "per pagina: 25/50/100", status-filters). Geen zoekveld. |
| `combobox` | Eén keuze uit een langere lijst waar zoeken nuttig is. Gebouwd op `Command` + `Popover`, met `CommandInput` zoekveld en check-vinkje bij de geselecteerde optie. Generiek (`options`, `value`, `onValueChange`). |
| `multi-select` | Meerdere keuzes uit een lijst (`selected: string[]`, `onChange`). Toont "N geselecteerd", checkbox-stijl items, wis-knop. Gebruik dit als de gebruiker meer dan één waarde mag kiezen. |
| `simple-dropdown` | Campagne-specifiek, zonder Radix/`Command`. Eigen click-outside + zoek-state in plain divs. Bestaat omdat de `Command`-variant scroll-issues had. Gebruik bij voorkeur niet voor nieuwe code: kies `campaign-combobox` (rijker) of `combobox` (generiek). |

Voor campagne-keuze bestaan drie varianten naast elkaar (historisch gegroeid, zie "Custom componenten"): `campaign-combobox` (canoniek, fuzzy search + status-groepering), `campaign-combobox-simple` en `simple-dropdown`. **Nieuwe code: `campaign-combobox`.**

### Overlays: `dialog` vs `sheet` vs `drawer` vs `popover` vs `hover-card`

| Component | Wanneer gebruiken |
|-----------|-------------------|
| `dialog` | Modale dialoog gecentreerd op het scherm. Voor formulieren/bevestigingen die volledige aandacht vragen en de achtergrond blokkeren. |
| `sheet` | Paneel dat vanaf een schermrand inschuift (`side="top \| right \| bottom \| left"`). Voor secundaire content/forms die naast de huidige view passen (bv. detail-/filterpaneel). |
| `drawer` | Onderkant-paneel op basis van `vaul`, geoptimaliseerd voor mobiel/touch (sleepbaar). Gebruik op mobiel waar `sheet` te bureaublad-achtig aanvoelt. |
| `popover` | Kleine, niet-modale floating container gekoppeld aan een trigger. Basis onder `combobox`, `multi-select` en de filters. Voor compacte, interactieve content (zoekbare lijst, datum-/range-picker). |
| `hover-card` | Read-only preview die op hover verschijnt. Alleen voor extra context, nooit voor interactie of acties. |

Vuistregel: blokkeert het de hele flow en eist het een keuze → `dialog`. Schuift het content naast de view in → `sheet`/`drawer`. Hangt het aan een element en is het klein/interactief → `popover`. Pure hover-preview → `hover-card`.

### Feedback: `alert` vs `alert-dialog` vs toast (`sonner`)

| Component | Wanneer gebruiken |
|-----------|-------------------|
| `alert` | Statische, inline melding in de pagina-flow (info/`destructive`). Blijft staan, vraagt geen actie. |
| `alert-dialog` | Modale bevestiging die een expliciete keuze afdwingt (bv. "Weet je zeker dat je wilt verwijderen?"). Heeft Action + Cancel. Gebruik voor destructieve of onomkeerbare acties. |
| toast via `sonner` | Tijdelijke, niet-blokkerende notificatie na een actie ("Opgeslagen", "Mislukt"). Aanroepen met `toast.success(...)` / `toast.error(...)`. Eén `<Toaster/>` in `app/layout.tsx`. |

Voor de enrichment-flow bestaat daarnaast een rijkere, custom toast (`enrichment-toast`, met progress/results/actions). Zie "Custom componenten".

### Loading: `skeleton` vs `loading-states`

| Component | Wanneer gebruiken |
|-----------|-------------------|
| `skeleton` | Standaard shadcn losse placeholder-blok (`<Skeleton className="h-4 w-32" />`). Bouw zelf je layout met meerdere blokken. |
| `loading-states` | Custom kant-en-klare loaders: `TableSkeleton`, `ListSkeleton`, `DashboardStatsSkeleton`, `PageLoadingOverlay`, `LoadingSpinner` en een eigen `Skeleton` (met `lines`-prop). Gebruik deze als er een passende vorm tussen zit, scheelt boilerplate. |

Let op: `loading-states` exporteert óók een `Skeleton`. Die is niet identiek aan de shadcn `skeleton`. Import bewust uit het juiste bestand.

---

## Custom componenten

### `multi-select.tsx` — `MultiSelect`

Meerkeuze-dropdown op basis van `Popover` + `Command`. Toont "N geselecteerd", checkbox-achtige items met oranje accent, een wis-knop (X) en een "Wissen"-footer.

Props: `options: {value,label}[]`, `selected: string[]`, `onChange: (string[]) => void`, `placeholder?`, `className?`.

Gebruik wanneer de gebruiker meerdere waarden mag selecteren uit een lijst.

```tsx
<MultiSelect
  options={platforms}
  selected={selectedIds}
  onChange={setSelectedIds}
  placeholder="Kies platforms..."
/>
```

### `combobox.tsx` — `Combobox`

Generieke enkel-keuze combobox (`Command` + `Popover`) met zoekveld en check-vinkje. Bedoeld als herbruikbare zoekbare select.

Props: `options: {value,label}[]`, `value?`, `onValueChange: (string)=>void`, `placeholder?`, `searchPlaceholder?`, `emptyText?`, `disabled?`.

```tsx
<Combobox options={opts} value={value} onValueChange={setValue} searchPlaceholder="Zoek..." />
```

### `campaign-combobox.tsx` — `CampaignCombobox`

Canonieke campagne-selector. Fuzzy search (`lib/fuzzy-search`) met debounce (`use-debounce`), groepering per campagne-status (vaste `STATUS_ORDER`), status-badges in de trigger, sticky group-headers, match-score per item en een resultaten-footer. Custom scroll-handling (eigen `onWheel`, `shouldFilter={false}`).

Props: `campaigns: {id,name,status}[]`, `value: string`, `onSelect: (string)=>void`, `placeholder?`, `campaignStatusMap: Record<string,{label,color,icon}>`.

Gebruik dit voor campagne-keuze. De andere twee varianten hieronder zijn legacy.

```tsx
<CampaignCombobox
  campaigns={campaigns}
  value={selectedId}
  onSelect={setSelectedId}
  campaignStatusMap={statusMap}
/>
```

### `campaign-combobox-simple.tsx` — `SimpleCampaignCombobox`

Variant van `CampaignCombobox` met dezelfde props/grouping, maar zonder `Command`: eigen keyboard-navigatie (Arrow/Enter/Escape) en handmatige selectie-index. Bestaat als fallback voor de scroll/focus-problemen die `Command` gaf. Legacy: prefereer `CampaignCombobox`.

### `simple-dropdown.tsx` — `SimpleDropdown`

Meest kale campagne-dropdown: geen Radix, geen `Command`. Plain `button` + absolute `div`, eigen click-outside-handler, substring-zoek (geen fuzzy). Props gelijk aan `CampaignCombobox`. Legacy: alleen aanwezig als laatste fallback. Niet gebruiken voor nieuwe code.

### `enrichment-button.tsx` — `EnrichmentButton` + `EnrichmentStatusBadge`

Knop voor Apollo-enrichment met statusgestuurde stijl/animatie.

`EnrichmentButton` props: `status: 'idle'|'processing'|'completed'|'failed'`, `isLoading?`, `disabled?`, `contactsCount?`, `lastEnrichedAt?`, `onClick`, `size?: 'sm'|'default'|'lg'`, `showTooltip?` (default true), `className?`. Per status andere label/icon/kleur (Sparkles/RefreshCw/CheckCircle/AlertCircle), pulse bij processing, success-animatie bij completed, en tooltip met contact-count + "last enriched".

`EnrichmentStatusBadge({status, contactsCount?, className?})`: compacte status-badge voor tabel-views.

```tsx
<EnrichmentButton status="idle" onClick={startEnrichment} contactsCount={count} />
```

### `enrichment-toast.tsx` — `EnrichmentToast`, `useEnrichmentToasts`, `EnrichmentToastContainer`

Rijke, enrichment-specifieke toast (los van `sonner`). Toont titel/message, progress-bar, results-badges (companies/contacts/failed) en action-buttons; auto-close met timer en hover-pauze.

- `EnrichmentToast({ data: EnrichmentToastData, onClose, className? })` — render één toast.
- `useEnrichmentToasts()` — state-hook met `addToast/removeToast/updateToast/clearAllToasts` plus helpers `showEnrichmentStart/Progress/Success/Error` en `showPartialSuccess`.
- `EnrichmentToastContainer()` — fixed container rechtsboven.

`EnrichmentToastData.type`: `'start'|'progress'|'success'|'error'|'partial'`. Gebruik dit alleen voor de enrichment-flow; voor gewone notificaties gebruik je `sonner`.

### `contextual-help.tsx` — `ContextualHelp`, `QuickHelpTooltip`, `ProgressiveHelp`

Uitlegblokken voor de enrichment-flow.

- `ContextualHelp({ phase: 'idle'|'processing'|'manual'|'completed'|'failed', elapsedTime?, progress?, showExpanded?, className? })` — `Card` met severity-kleur, tips/troubleshooting (uitklapbaar), geschatte tijd en dismiss-knop. Auto-expand bij warning/error.
- `QuickHelpTooltip({ content, children, side? })` — inline help-tooltip om een element.
- `ProgressiveHelp({ phase, elapsedTime? })` — tekst die meeverandert met de verstreken tijd tijdens processing.

### `image-upload.tsx` — `ImageUpload` (ook default export)

Herbruikbare drag/drop + preview upload. Flow: client-side validatie (size/MIME) → `POST /api/storage/signed-upload` → directe `PUT` naar Supabase via XHR (met progress) → `onUpload(publicUrl)`.

Props: `bucket: 'platform-assets'|'company-logos'|'job-images'`, `path: string`, `currentUrl?`, `aspectRatio?: '1:1'|'16:9'|'auto'`, `maxSizeMB?` (default 2), `acceptedFormats?` (default PNG/JPEG/WEBP/SVG), `onUpload: (url)=>void`, `onRemove?`, `label?`, `helperText?`, `disabled?`, `className?`.

```tsx
<ImageUpload
  bucket="company-logos"
  path={`${companyId}/logo.png`}
  currentUrl={logoUrl}
  aspectRatio="1:1"
  onUpload={(url) => setLogoUrl(url)}
/>
```

In "bedrijf bewerken" (`app/bedrijven/[id]/bewerken/page.tsx`) kan een logo op drie manieren worden ingesteld, allemaal gekoppeld aan dezelfde `logoUrl` state: (1) automatisch ophalen van het websitedomein via `POST /api/bedrijven/[id]/logo-suggest`, dat het logo bij Clearbit ophaalt en naar de `company-logos` bucket schrijft; (2) zelf een bestand uploaden via de `ImageUpload`-component hierboven; (3) handmatig een logo-URL plakken als override. Lukt de auto-fetch niet, dan toont de UI "Geen logo gevonden voor dit domein" en uploadt de gebruiker zelf.

### `logo.tsx` — `Logo`

Tekst-wordmark "OTIS" (placeholder, nog geen echt logo-asset). Props: `size?: 'sm'|'md'|'lg'|'xl'`, `variant?: 'default'|'white'|'monochrome'`, `className?`.

### `loading-states.tsx`

Verzameling kant-en-klare loaders (zie ook "skeleton vs loading-states"):

- `PageLoadingOverlay({ message?, className?, showRefreshButton?, onRefresh? })` — full-screen overlay met spinner.
- `Skeleton({ className?, lines? })` — multi-line placeholder (let op: naam-overlap met shadcn `skeleton`).
- `TableSkeleton({ rows?, columns? })` — placeholder `<tr>`/`<td>` rijen.
- `ListSkeleton({ items? })` — lijst-placeholder.
- `DashboardStatsSkeleton()` — grid van stat-card placeholders.
- `LoadingSpinner({ size?: 'sm'|'md'|'lg', className? })`.

### `password-input.tsx` — `PasswordInput`

`Input` met show/hide-toggle (Eye/EyeOff). `forwardRef`, accepteert alle native `input`-props. Gebruikt op login/reset-password.

```tsx
<PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} />
```

### `status-badge.tsx` — `StatusBadge`

Badge met vaste kleur + icon per status-string. Herkende statussen: `scraped`, `pending`, `failed`, `inProgress`, `enriched`, `processing`, `completed` (onbekend → "pending"-stijl, gecapitaliseerd label). Props: `status: string`, `className?`.

### `table-cell-with-tooltip.tsx` — `TableCellWithTooltip`

Tabelcel die afkapt en de volledige waarde in een tooltip toont zodra de tekst > 15 tekens is. Optioneel als link. Props: `value: string|null|undefined`, `className?`, `href?`, `hrefClassName?`, `maxWidth?` (default `w-24`).

### `table-filters.tsx`

Filterbalk- en paginatie-helpers voor tabelpagina's.

- `TableFilters` — `Card` met zoekveld, resultaten-/cap-badges, grid van filters en optionele `bulkActions`/`actionButtons`/`children`. Filters via `filters: FilterProps[]` waar elk item `multiple` kan zijn (rendert dan een interne checkbox-MultiSelect, anders een shadcn `Select`). Props o.a.: `searchValue`, `onSearchChange`, `searchPlaceholder?`, `filters?`, `totalCount?`, `isCapped?`, `resultText?`, `onResetFilters?`.
- `TablePagination` — pagina-navigatie met "per pagina"-select (15/25/50/100/250/500), pagina-info en max 5 paginanummers. Props: `currentPage`, `totalPages`, `totalCount`, `isCapped?`, `itemsPerPage`, `onPageChange`, `onItemsPerPageChange`, `className?`.

> Let op: dit bestand bevat een eigen interne `MultiSelect` (checkbox-stijl, niet geëxporteerd) die losstaat van `multi-select.tsx`.

### `sonner.tsx` — `Toaster`

Dunne wrapper rond `sonner`'s `Toaster`, gekoppeld aan `next-themes`. Plaats één keer in `app/layout.tsx`. Notificaties roep je aan via `import { toast } from "sonner"`.

### `scrolling-test.tsx` — `ScrollingTest`

Test/dev-component om scroll-gedrag in een `Popover` te verifiëren. Niet voor productie-UI.

---

## Standaard shadcn-componenten

Onderstaande zijn (vrijwel) ongewijzigde shadcn/ui-componenten. Importeren via `@/components/ui/<naam>`.

### Forms & input

| Component | Doel | Belangrijkste varianten/props | Do / Don't |
|-----------|------|-------------------------------|------------|
| `button` | Knop / link-as-button | `variant`: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`. `size`: `default`, `sm`, `lg`, `icon`. `asChild` voor render-as. | Do: gebruik `asChild` om een `<Link>` te stylen als knop. Don't: kleur niet handmatig overschrijven als een variant volstaat. |
| `input` | Tekst/number/date input | native input-props | Do: combineer met `label`. |
| `textarea` | Meerregelige tekst | native textarea-props | |
| `label` | Form-label (Radix) | `htmlFor` | Do: koppel altijd aan het veld. |
| `checkbox` | Aan/uit selectie | `checked`, `onCheckedChange` | |
| `radio-group` | Eén keuze uit set | `value`, `onValueChange` | |
| `switch` | Boolean toggle | `checked`, `onCheckedChange` | Do: voor instant-toggle settings; niet voor form-submit-keuzes (gebruik dan `checkbox`). |
| `select` | Enkel-keuze dropdown (geen zoek) | `Select/Trigger/Content/Item/Value` | Don't: niet voor lange of zoekbare lijsten (gebruik `combobox`). |
| `slider` | Numerieke range | `value`, `min`, `max`, `step` | |
| `toggle` / `toggle-group` | Toggle-knop(pen) | `variant`, `size`; group: `type` single/multiple | |
| `input-otp` | OTP/codeveld | `maxLength`, slots | |
| `form` | react-hook-form wrappers | `Form`, `FormField`, `FormItem`, `FormControl`, `FormMessage` | Do: gebruik samen met `zod`-resolver voor validatie. |
| `calendar` | Datumkiezer (react-day-picker) | `mode`, `selected`, `onSelect` | Do: combineer met `popover` voor een date-picker. |

### Overlays & dialogs

| Component | Doel | Belangrijkste props | Do / Don't |
|-----------|------|---------------------|------------|
| `dialog` | Modale dialoog | `Dialog/Trigger/Content/Header/Footer/Title/Description` | Do: voeg `DialogTitle` toe (a11y). |
| `alert-dialog` | Bevestigingsdialoog | `Action`, `Cancel` | Do: voor destructieve acties. Don't: niet voor losse info (gebruik `alert`). |
| `sheet` | Inschuif-paneel | `side`: top/right/bottom/left | |
| `drawer` | Mobiel bottom-drawer (`vaul`) | sleepbaar | Do: gebruik op touch/mobiel. |
| `popover` | Floating container bij trigger | `align`, `side` | Don't: niet voor modale flows. |
| `hover-card` | Hover-preview | `openDelay` | Don't: geen interactieve content. |
| `tooltip` | Korte hint op hover/focus | `TooltipProvider` vereist | Do: houd het kort, één regel. |
| `dropdown-menu` | Actiemenu (Radix) | items, sub-menus, checkbox/radio items | Do: voor rij-/contextacties. |
| `context-menu` | Rechtsklik-menu | idem dropdown | |
| `menubar` | App-stijl menubalk | nested menus | |
| `command` | Command palette / zoeklijst | `CommandInput/List/Item/Group` | Basis onder `combobox`/`multi-select`. |

### Navigation

| Component | Doel | Belangrijkste props |
|-----------|------|---------------------|
| `tabs` | Tab-navigatie | `Tabs/List/Trigger/Content`, `value`, `onValueChange` |
| `navigation-menu` | Horizontaal nav met dropdowns | Radix nav-menu |
| `breadcrumb` | Kruimelpad | `Breadcrumb/List/Item/Link/Page/Separator` |
| `pagination` | Pagina-links | `Previous/Next/Link/Ellipsis` (zie ook `TablePagination`) |

### Data display

| Component | Doel | Belangrijkste varianten/props | Do / Don't |
|-----------|------|-------------------------------|------------|
| `table` | Tabel-primitives | `Table/Header/Body/Row/Cell/Head` | Do: combineer met `TableFilters`/`TablePagination`. |
| `card` | Container met header/content/footer | `Card/Header/Title/Description/Content/Footer` | |
| `badge` | Status-/label-chip | `variant`: `default`, `secondary`, `destructive`, `outline` | Do: voor herhaalde status gebruik `StatusBadge`. |
| `avatar` | Profielafbeelding + fallback | `AvatarImage`, `AvatarFallback` | |
| `accordion` | In/uitklapbare secties | `type` single/multiple, `collapsible` | |
| `collapsible` | Enkele in/uitklap | `open`, `onOpenChange` | |
| `chart` | Recharts-wrappers | `ChartContainer`, `ChartTooltip`, config | |
| `carousel` | Slider (embla) | `opts`, `Previous/Next` | |
| `aspect-ratio` | Vaste verhouding-container | `ratio` | |

### Feedback & status

| Component | Doel | Belangrijkste varianten/props | Do / Don't |
|-----------|------|-------------------------------|------------|
| `alert` | Inline melding | `variant`: `default`, `destructive`; `AlertTitle`, `AlertDescription` | Don't: niet voor tijdelijke feedback (gebruik toast). |
| `sonner` | Toast-host | zie custom-sectie | Do: één `<Toaster/>` in layout; aanroepen via `toast()`. |
| `progress` | Voortgangsbalk | `value` (0-100) | |
| `skeleton` | Placeholder-blok | `className` | Do: kies `loading-states` voor kant-en-klare vormen. |

### Layout

| Component | Doel | Belangrijkste props |
|-----------|------|---------------------|
| `separator` | Scheidingslijn | `orientation` |
| `scroll-area` | Custom scrollbar-container | `ScrollArea`, `ScrollBar` |
| `resizable` | Sleepbare panelen | `PanelGroup`, `Panel`, `Handle` |

### Hooks

| Bestand | Doel |
|---------|------|
| `use-mobile.tsx` | `useIsMobile()` hook (matchMedia breakpoint) voor responsive logic, o.a. door `drawer`/`sidebar`-achtige componenten. |
