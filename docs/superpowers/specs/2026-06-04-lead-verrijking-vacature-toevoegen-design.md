# Vacature toevoegen in Lead Verrijking

Datum: 2026-06-04
Status: Goedgekeurd (ontwerp)

## Probleem

In de Lead Verrijking-pagina (`/sales/lead-verrijking/[run_id]`) kun je per lead wel
contactpersonen **handmatig toevoegen** (knop "Handmatig" in de Contacten-kolom), maar
vacatures kun je alleen **selecteren** uit wat de scrapers/website-stap hebben gevonden.
Er is geen manier om zelf een vacature toe te voegen.

De gebruiker wil dezelfde mogelijkheid als bij contactpersonen, maar dan volwaardig
geintegreerd met `/job-postings`: een handmatig toegevoegde vacature moet een **echt
`job_posting`-record** worden, niet alleen een lokaal lead-veld.

## Doel

Een "Vacature toevoegen"-knop in de Vacatures-kolom van een lead, die een dialog opent
met hetzelfde uitgebreide formulier als `/vacatures/nieuw`. Bij opslaan:

1. Een echt `job_posting`-record wordt aangemaakt (via bestaande `POST /api/vacatures`).
2. Het record wordt gekoppeld aan een automatisch herkend bedrijf, of er wordt een nieuw
   bedrijf aangemaakt op basis van de lead-data.
3. De vacature verschijnt direct **aangevinkt** in de lead-lijst en gaat mee in de
   Pipedrive-deal.

## Beslissingen

- **Echte `job_posting`** (niet alleen `manual_vacancies`-veld). Standaard
  `review_status: 'pending'`, dus de vacature komt **niet** automatisch op de publieke
  jobboards; pas na goedkeuring via de bestaande review-flow.
- **Bedrijf: auto-match, anders aanmaken.** Match-volgorde: KvK -> website-domein ->
  bedrijfsnaam. Geen match: nieuw bedrijf aanmaken met lead-data (naam, website, plaats).
  De gebruiker kan altijd corrigeren.
- **Formulier-UI: modal op de lead-pagina**, met een herbruikbaar formulier-component dat
  uit `/vacatures/nieuw` wordt geextraheerd (DRY, geen velddefinitie-duplicatie).
- **Auto-selecteren: ja.** Na aanmaken staat de vacature aangevinkt.

## Architectuur

### 1. Herbruikbaar formulier-component `VacatureForm`

Nieuw: `apps/admin/components/vacatures/vacature-form.tsx`.

Het create-formulier (velddefinities + UI) wordt uit `app/vacatures/nieuw/page.tsx`
geextraheerd naar een props-based component:

- Props: `initialValues`, `lockedCompany` (optioneel: vergrendeld/voorgevuld bedrijf voor
  lead-context), `onSubmit(values)`, `submitting`, `submitLabel`.
- Velden: titel*, bedrijf (bestaand kiezen of nieuw aanmaken), plaats, postcode, straat,
  provincie, salaris, dienstverband, uren min/max, opleidingsniveau, categorie, externe
  URL, einddatum, omschrijving, review-status.
- `app/vacatures/nieuw/page.tsx` gebruikt voortaan deze component. **Geen
  gedragsverandering** voor de bestaande create-pagina.

Buiten scope van de component: AI-rewrite, header-image, `content_md` (dat zijn
edit-only velden). De edit-pagina (`/vacatures/[id]/bewerken`) blijft volledig ongemoeid.

### 2. Bedrijf-match endpoint `GET /api/companies/match`

Nieuw: `apps/admin/app/api/companies/match/route.ts` (`// @auth SESSION`).

- Query-params: `kvk`, `domain`, `name` (alle optioneel).
- Match-volgorde (eerste hit wint):
  1. `kvk` exact (meest betrouwbaar).
  2. `website` apex-domein (via `extractApex`, ilike).
  3. `name` / `normalized_name` (ilike, hoge zekerheid).
- Output: `{ match: { id, name, website } | null }`.
- Faalt of geen match: modal valt terug op "nieuw bedrijf aanmaken" met lead-data.

### 3. Nieuwe modal `LeadAddVacancyModal`

Nieuw: `apps/admin/components/sales/lead-add-vacancy-modal.tsx`.

- Bevat `VacatureForm`.
- Bij openen: roept `GET /api/companies/match` aan met lead-domein/KvK/naam ->
  voorvulling bedrijf (gematcht, of "nieuw bedrijf" voorgevuld uit lead-data).
- Plaats/postcode worden voorgevuld uit `master_record` waar beschikbaar.
- `onSubmit` -> `POST /api/vacatures` (echte `job_posting`).
- Na succes: callback `onCreated(vacancy)` naar de lead-pagina.

### 4. Aangepaste `LeadVacanciesColumn`

`apps/admin/components/sales/lead-vacancies-column.tsx`.

- "Vacature toevoegen"-knop in de `CardHeader` (gespiegeld op de "Handmatig"-knop in
  `LeadContactsColumn`).
- Nieuwe props: `runId`, lead-context (`companyName`, `domain`, `kvk`, `city`),
  `onVacancyCreated`.
- Opent `LeadAddVacancyModal`.

### 5. Lead-pagina: persistentie + auto-selecteren

`apps/admin/app/sales/lead-verrijking/[run_id]/page.tsx`.

- `manualVacancies` wordt van read-only (afgeleid uit `run.manual_vacancies`) naar
  **lokale state**, gehydrateerd uit `run.manual_vacancies` bij eerste load (zelfde
  patroon als `manualPool` in `LeadContactsColumn`).
- Bestaande auto-save PATCH (`master_record` + `selected_contacts`) wordt uitgebreid met
  `manual_vacancies`, zodat handmatig toegevoegde vacatures na refresh blijven staan.
- Na `onVacancyCreated`: de nieuwe vacature wordt als `NormalizedVacancy` (`source:
  'manual'`) toegevoegd aan de `manualVacancies`-pool en geselecteerd in
  `master.vacancies` (auto-selecteren).

## Data flow

1. Gebruiker klikt "Vacature toevoegen" in de Vacatures-kolom.
2. Modal opent, `GET /api/companies/match` -> bedrijf voorgevuld (gematcht of nieuw).
3. Gebruiker vult titel + details in, klikt Opslaan.
4. `POST /api/vacatures` -> echt `job_posting`-record (`review_status: 'pending'`).
5. `onCreated` -> pagina voegt vacature toe aan `manualVacancies`-pool + selecteert in
   `master.vacancies`.
6. Auto-save PATCHt `master_record` (met selectie) + `manual_vacancies` -> gepersisteerd.
7. Vacature verschijnt aangevinkt en gaat mee in de Pipedrive-deal.

## Error handling

- Match-endpoint faalt -> modal opent met leeg/handmatig bedrijf. Geen blokkering.
- `POST /api/vacatures` faalt -> toast met foutmelding, modal blijft open.
- Auto-save faalt -> bestaande error-toast en `saveState: 'error'`.

## Testing / verificatie

- Auth-gate (Vitest): nieuwe `route.ts` krijgt verplichte `// @auth SESSION`-marker.
- `pnpm type-check` clean.
- Handmatige verificatie:
  - Vacature aanmaken vanuit een lead -> staat in `job_postings` met juiste `company_id`.
  - Verschijnt aangevinkt in de lead, gaat mee in de deal.
  - Blijft staan na page-refresh.
  - Is **niet** publiek (review_status pending).
  - `/vacatures/nieuw` werkt nog gewoon (regressie van de formulier-extractie).

## Buiten scope (YAGNI)

- Edit-pagina `/vacatures/[id]/bewerken` (blijft ongemoeid).
- Header-image, AI-rewrite, `content_md` in de lead-modal.
- Bulk-toevoegen van meerdere vacatures tegelijk.
