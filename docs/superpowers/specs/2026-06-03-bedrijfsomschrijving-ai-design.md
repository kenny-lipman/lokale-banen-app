# Bedrijfsomschrijving beheren + AI-herschrijven

**Datum:** 2026-06-03
**Status:** Goedgekeurd (design), klaar voor implementatieplan
**App:** `apps/admin` (deels), public-sites ongewijzigd

## Aanleiding

Op de public sites (bijv. `achterhoeksebanen.vercel.app/bedrijf/<slug>`) toont de bedrijfspagina een lange "over ons"-alinea die in werkelijkheid een complete **vacaturetekst** is. Dit komt uit het veld `companies.description`, dat bij de oorspronkelijke Indeed-import (via Apify, aug 2025) gevuld is met de body van een vacature in plaats van een echte bedrijfsbeschrijving. Het speelt breed: ~18.000 van de ~21.000 bedrijven met een omschrijving hebben zo'n vacaturetekst in dat veld.

De huidige in-repo scrapers schrijven `description` niet meer; dit is legacy data.

## Doel

1. Een nette, feitelijke bedrijfsomschrijving kunnen genereren met AI, per bedrijf en handmatig beoordeeld, op basis van de bedrijfswebsite én de vacatures van dat bedrijf.
2. Vanuit de job-postings-weergave snel naar de bedrijf-bewerken-pagina kunnen springen om daar een wijziging te maken.

Bewerken van bedrijfsgegevens bestaat al (`/bedrijven/[id]/bewerken` + `PATCH /api/bedrijven/[id]`), inclusief een vrij "Beschrijving"-veld. Deze feature voegt het AI-genereren en de snelle navigatie toe.

## Scope

**In scope:**
- AI-genereren van uitsluitend het `description`-veld, twee-staps (bron tonen, dan herschrijven), per bedrijf, handmatig beoordeeld.
- Snelle link van de `JobPostingDrawer` naar de bedrijf-bewerken-pagina.

**Buiten scope (expliciete keuzes):**
- Public-site weergave blijft ongewijzigd. Geen gating/verbergen, geen heuristiek, geen nieuwe DB-kolom voor publicatiestatus.
- Geen andere velden dan `description` (geen sector/grootte/adres via AI).
- Geen bulk-verwerking of cron over alle bedrijven. Eventuele bulk is een latere, aparte fase.
- Geen aparte company-detailpagina; de bestaande bewerken-pagina is de plek om te editen.

## Architectuur & dataflow (deel A, twee stappen)

Twee aparte acties op de bedrijf-bewerken-pagina:

```
[Bron ophalen]      → POST /api/bedrijven/[id]/ai-source
                      website-"over ons" (indien beschikbaar) + vacaturetitels
                      → toont bron als bewerkbare textarea + gebruikte bron-URL
                                 ↓ (gebruiker kan de bron bijsturen)
[Herschrijf met AI] → POST /api/bedrijven/[id]/ai-rewrite  (bron in de body)
                      Mistral(bron) → korte feitelijke omschrijving
                      → vult het bestaande "Beschrijving"-veld
                                 ↓ (gebruiker beoordeelt / past aan)
[Opslaan]           → bestaande PATCH /api/bedrijven/[id]
```

Kernprincipe: de AI ziet alleen wat in de getoonde bron staat. De gebruiker kan de bron bewerken vóór het herschrijven, en het eindresultaat altijd nog handmatig aanpassen vóór opslaan. Niets wordt automatisch opgeslagen; opslaan loopt via de bestaande PATCH.

## Componenten

### 1. Bron-service (hergebruik bestaande website-infra)

Nieuwe functie, bijv. `apps/admin/lib/services/company-description/source.service.ts`:

`fetchCompanySource({ website, companyId }): Promise<CompanySource>`

Stappen:
- **Website-tekst** (alleen als `website` aanwezig): `discoverUrls(website)` uit `sales-leads/website/sitemap-discovery` → selecteer een URL met `role === 'about'` (val terug op `role === 'home'` als er geen about-pagina is). Haal die op met `tieredFetch` (JS-shell fallback) of `safeFetch`, converteer met `htmlToMarkdown`, kort in met `truncateForLLM`. Bij fetch-fout: website-tekst = null (geen exception naar de gebruiker).
- **Vacaturetitels**: query `job_postings` op `company_id` → lijst van titels (en eventueel stad/categorie als lichte context). Cap op een redelijk aantal (bijv. 25).

Retourtype:
```ts
interface CompanySource {
  websiteText: string | null
  websiteUrl: string | null   // de daadwerkelijk gebruikte URL (about of home)
  vacancyTitles: string[]
}
```

Alle netwerk-toegang loopt via de bestaande `safeFetch`/`tieredFetch` met SSRF-bescherming en size-limits; geen nieuwe rauwe `fetch` naar externe domeinen.

### 2. Rewrite-service

Nieuwe service `apps/admin/lib/services/company-description/rewrite.service.ts`:

`rewriteCompanyDescription({ name, city, sourceText }): Promise<{ description: string }>`

- Mistral-call (`mistral-large-latest`, `response_format: json_object`, lage temperature), patroon gelijk aan `vacancy-ai-rewrite.service.ts`: 30s timeout, HTML-strip al gebeurd in de bron, `MISTRAL_API_KEY`-guard.
- **System-prompt (anti-hallucinatie)**, zelfde principe als de vacature-prompt:
  - Gebruik uitsluitend informatie die letterlijk in de aangeleverde bron staat.
  - Verboden: marketing-superlatieven, aannames over marktpositie/grootte/internationaal, invullen op basis van de naam.
  - Output: een korte, neutrale "over ons"-omschrijving van het **bedrijf** (niet van een vacature). Richtlijn 2-4 zinnen, ca. max 600 tekens. Geen koppen, geen bullet-lists, platte tekst.
  - Als de bron te weinig feitelijke bedrijfsinfo bevat: liever een korte eerlijke omschrijving dan verzinsels.
- Output JSON: `{ "description": "..." }`. Parse + valideer dat `description` een non-lege string is.

### 3. API-routes (`// @auth SESSION`, POST)

- `apps/admin/app/api/bedrijven/[id]/ai-source/route.ts`
  - Haalt company op (`website`), roept `fetchCompanySource` aan, geeft `CompanySource` terug.
  - 400 als er géén website én géén vacatures zijn ("Geen bron beschikbaar voor dit bedrijf").
  - `maxDuration = 60`, `dynamic = 'force-dynamic'`.
- `apps/admin/app/api/bedrijven/[id]/ai-rewrite/route.ts`
  - Body: `{ sourceText: string }` (de getoonde/bewerkte bron). Haalt company-naam + stad op voor context.
  - Roept `rewriteCompanyDescription` aan, geeft `{ description }` terug. Slaat niets op.
  - 400 bij lege `sourceText`. `maxDuration = 60`.

Beide routes krijgen de verplichte `// @auth SESSION` marker op regel 1 (auth-seam gate).

### 4. UI op de bewerken-pagina

In `apps/admin/app/bedrijven/[id]/bewerken/page.tsx`, een sectie "AI-omschrijving" boven/naast het bestaande Beschrijving-veld:
- Knop **"Bron ophalen"** (met spinner) → `POST .../ai-source`. Toont resultaat in een bewerkbare textarea ("Bron"), met de gebruikte bron-URL eronder en, indien van toepassing, een notitie "Website niet bereikbaar, alleen vacatures gebruikt".
- Knop **"Herschrijf met AI"** (actief zodra er bron-tekst is) → `POST .../ai-rewrite` met de huidige bron-tekst. Vult het bestaande `description`-state-veld met het resultaat.
- Bestaande **"Opslaan"**-knop bewaart zoals nu (PATCH).
- Foutafhandeling via `toast` (zoals elders in deze pagina).

### Deel B: snelle navigatie van job-postings naar bedrijf-edit

In `apps/admin/app/job-postings/page.tsx`: geef de al bestaande prop `onCompanyClick(companyId)` aan de `JobPostingDrawer` door. Implementatie opent `/bedrijven/${companyId}/bewerken` **in een nieuw tabblad** (`window.open(..., '_blank')`), zodat de job-postings-filters en de geopende drawer behouden blijven. De knop "Bekijk bedrijf" bestaat al in de drawer en wordt alleen zichtbaar/functioneel zodra de handler is aangesloten.

## Foutafhandeling (samenvatting)

- Geen website + geen vacatures → `ai-source` geeft 400, UI toont "Geen bron beschikbaar".
- Website-fetch faalt (timeout/SSRF/size/JS-shell) → `websiteText = null`, val terug op vacaturetitels, UI toont notitie.
- `MISTRAL_API_KEY` ontbreekt of Mistral-timeout → `ai-rewrite` geeft een duidelijke foutmelding.
- Lege/ongeldige Mistral-output → foutmelding, geen wijziging aan het Beschrijving-veld.

## Verificatie

- **Auth-gate (Vitest)**: de twee nieuwe routes hebben de `// @auth SESSION` marker en worden door de bestaande auth-coverage-gate gedekt.
- **Unit (optioneel, indien er een vergelijkbare test voor de vacature-rewrite bestaat)**: parsing van de Mistral-respons in `rewriteCompanyDescription` met een gemockte API-call.
- **Type-check / lint**: `pnpm type-check` en `pnpm lint` schoon.
- **Handmatig (end-to-end)**: open een bedrijf met website (bijv. Humankind) → "Bron ophalen" toont over-ons + vacaturetitels → "Herschrijf met AI" vult een korte omschrijving → "Opslaan" → controleer op de public site dat de nieuwe, korte tekst getoond wordt in plaats van de vacaturelap. Test ook een bedrijf zónder website (alleen vacatures) en een bedrijf zonder beide (foutpad).

## Conventies

- Geen em-dash in code, comments, prompts of UI-tekst.
- Routes: `// @auth SESSION` op regel 1.
- Supabase via bestaande server-clients (`createServiceRoleClient` in routes, zoals de bestaande bedrijven-route).
- Bij wijziging van een gedocumenteerd domein de bijbehorende `docs/reference/*.md` in dezelfde commit bijwerken indien van toepassing.
