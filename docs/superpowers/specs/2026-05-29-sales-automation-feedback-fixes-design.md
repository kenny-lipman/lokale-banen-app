# Sales Automation Feedback Fixes — Design

**Datum:** 2026-05-29
**Bron feedback:** Dean + Bart test-sessie op `https://lokale-banen-app.vercel.app/sales/lead-verrijking`
**Casus die het triggerde:** Run `a9741c0b-6710-490c-8a58-c63c4eaa9af5` (Automobielbedrijf Vriesde) faalde op Pipedrive sync.

## Scope

Vijf gerichte fixes op de bestaande sales-lead-automation feature. Geen redesign, geen nieuwe scope. Doel: review-pagina ergonomischer maken en twee echte bugs oplossen (adres + Cloudflare email-placeholder).

## 1. Layout reorder — sync-card en contactmoment naar top

**Probleem:** Sales scrolt nu door alle verrijkings-data heen vóór ze de actie-knop (sync) en het contactmoment zien. Beide zijn primaire beslismomenten.

**Bestand:** `apps/admin/app/sales/lead-verrijking/[run_id]/page.tsx`

**Wijziging:**
- `<LeadSyncStatus>` verplaatsen van onderaan de pagina naar direct onder `<LeadSourceStatusGrid>`.
- `<LeadContactmomentPicker>` verplaatsen van onder in de review-grid naar direct onder `<LeadSyncStatus>`.
- De rest van de review-grid (master-record, contacts, vacancies, branche, notes) blijft eronder.

**Niet gewijzigd:** componenten zelf (interne logica, props), styling van individuele cards. Alleen render-volgorde in de page-component.

**Implicatie voor user:** Bij elke run zie je nu direct boven de fold: status-banner, bron-status-grid, sync-knop, contactmoment-picker, rest.

## 2. "Afdeling Personeelszaken" altijd als selectable contact

**Probleem:** Dit fallback-contact wordt nu alleen aangemaakt als de Mistral website-scrape een `info@`/`hr@`-mailbox vindt op een pagina. Sales wil hem altijd kunnen kiezen, ook bij sites zonder generieke mail.

**Bestand:** `apps/admin/lib/services/sales-leads/orchestrator.ts` (finalize-fase, na merge van alle bronnen).

**Wijziging:** Inject synthetisch contact in een nieuwe `enrichments.synthetic` bron met:
```ts
{
  name: 'Afdeling Personeelszaken',
  email: master.email ?? `info@${extractApex(input_domain)}`,
  phone_mobile: master.phone,
  title: null,
  department: 'human_resources',
  source_origin: ['synthetic'],
  ai_priority_score: 10,
  ai_priority_reason: 'Synthetic fallback - bedrijfsemail + telefoon',
}
```

**Dedupe-regel:** Als de website-scrape al een `name === 'Afdeling Personeelszaken'`-record opleverde (Mistral placeholder-fallback), wint die. Synthetic skipt zichzelf.

**Email-prioriteit:** `master.email` (bedrijfsemail uit gekozen bron) > `info@{apex}` als laatste vangnet.

**Telefoon-prioriteit:** `master.phone` (bedrijfsnummer). Als geen telefoon bekend: veld leeg laten (Pipedrive-sync valt al terug op `companyPhone` in `buildPersonPayload`).

**UI:** `LeadContactsColumn` toont synthetic contacts met lage score onderaan de lijst, sales kan ze net als andere contacts aanvinken. Geen aparte UI-handling nodig, bestaande component sorteert al op `ai_priority_score`.

**Niet gewijzigd:** Mistral-prompt, website.service.ts placeholder-detectie (blijft als primaire bron). Apollo/Maps/KvK contact-flows.

## 3. Stap 1 — contactmoment-veld toevoegen aan create-form

**Probleem:** Contactmoment is nu alleen in de review-stap instelbaar. Sales weet bij invoer vaak al wanneer ze willen bellen.

**Bestanden:**
- `apps/admin/components/sales/lead-form-stap1.tsx`
- `apps/admin/lib/sales-leads/api-schemas.ts` (schema `stap1FormSchema`)
- `apps/admin/app/api/sales-leads/create/route.ts`

**Wijziging:**
- Optioneel veld `contactmoment_override` (date, YYYY-MM-DD) in form-schema en form-UI. Gebruik bestaande `<LeadContactmomentPicker>` (workday-aware).
- Helptext: "Standaard: eerstvolgende werkdag(en) volgens dealeigenaar-config. Laat leeg voor default." Bij bulk-create (>1 URL): "Override geldt voor alle URLs in deze batch."
- Bij `POST /api/sales-leads/create`: als veld gevuld, zet `contactmoment_override` op elke aangemaakte `sales_lead_runs`-row.

**Geen DB-wijziging:** kolom `contactmoment_override` bestaat al (gebruikt door huidige review-flow en `pipedrive-sync.service.ts:resolveContactmoment`).

**Niet gewijzigd:** `resolveContactmoment` zelf, owner-config fallback-gedrag, review-page picker (sales kan daar nog altijd het override aanpassen).

## 4. Adres-subvelden naar Pipedrive

**Probleem:** Pipedrive's adresveld is een geocodable structured field. We sturen nu alleen `{ value: "<plat samengesteld adres>" }`. Resultaat: org krijgt het adres als text-only, deals erven niets, sales moet handmatig de Maps-suggestie in Pipedrive UI aanklikken.

**Bestanden:**
- `apps/admin/lib/services/sales-leads/pipedrive-payloads.ts`
- `apps/admin/__tests__/sales-leads/pipedrive-payloads.test.ts`

**Wijziging:**
- Vervang `composeAddressString(address)` door `buildAddressPayload(address)`:
  ```ts
  function buildAddressPayload(address: NormalizedFields['address']): {
    value: string
    route?: string
    street_number?: string
    postal_code?: string
    locality?: string
    country?: string
  } | null {
    if (!address) return null
    const value = address.full?.trim() || composeFallbackString(address)
    if (!value) return null
    const out: Record<string, string> = { value }
    if (address.street) out.route = address.street
    if (address.number) out.street_number = address.number
    if (address.postcode) out.postal_code = address.postcode
    if (address.city) out.locality = address.city
    if (address.country) out.country = address.country
    return out
  }
  ```
- `buildOrgPayload` gebruikt `buildAddressPayload` i.p.v. `composeAddressString`. Bij `null`: address-veld weglaten (huidige gedrag).
- Behoud `composeFallbackString` als private helper voor de `value`-fallback.

**Bron-onafhankelijk:** Werkt voor address uit elke bron in master_record (KvK, Google Maps via Apollo, website-scrape) zolang de subvelden ingevuld zijn. Voor address met alleen `.full`: subfields blijven leeg, value-only payload (huidige gedrag).

**Test-cases om toe te voegen:**
1. Volledig structured address (KvK-stijl) -> alle subfields aanwezig.
2. Alleen `.full` aanwezig -> enkel `value` in payload.
3. `null` address -> `address`-veld weggelaten uit org-payload.
4. Partial (street + city, geen postcode) -> `route` + `locality`, geen `postal_code`.

## 5. Cloudflare email-placeholder filteren — bug fix Vriesde

**Probleem:** Mistral extraheerde `[email protected]` (letterlijk; non-breaking space tussen "email" en "protected") als email-veld op de Vriesde-site. Cloudflare Email Protection rendert deze placeholder in HTML waar normaal een email zou staan, met een JS-decoder. Mistral leest de placeholder-tekst. Pipedrive V2 weigert dit met 400 Bad Request.

**Komt vaker voor:** Cloudflare Email Protection draait op duizenden NL B2B-sites. Geen one-off bug.

### 5a. Bron-filter (defense layer 1)

**Bestand:** `apps/admin/lib/services/sales-leads/website.service.ts`

**Wijziging:** In de map-functie die `MistralExtractResult.contacts[].email` -> `NormalizedContact.email` zet:
```ts
const CLOUDFLARE_PLACEHOLDER_RE = /^\[email[\s ]*protected\]$/i

function sanitizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (CLOUDFLARE_PLACEHOLDER_RE.test(trimmed)) {
    console.warn('[website.service] Cloudflare email-placeholder gefilterd:', raw)
    return null
  }
  return trimmed
}
```
Apply op elke `contact.email` én op de top-level `emails[]` array die naar master gaat.

### 5b. Boundary-validatie (defense layer 2)

**Bestand:** `apps/admin/lib/services/sales-leads/pipedrive-payloads.ts`

**Wijziging:** In `buildPersonPayload`: voeg basic RFC-vorm check toe vóór email naar Pipedrive gaat:
```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(e: string | null | undefined): boolean {
  return !!e && EMAIL_RE.test(e.trim())
}
```
- Als `contact.email` invalid is: val terug op `info@{companyDomain}` (huidige fallback). Log warning.
- Als ook fallback invalid (geen companyDomain): geen `email`-veld in payload, sync gaat door zonder email.

**Waarom dubbel:** Layer 1 voorkomt herhaling van deze specifieke bug. Layer 2 vangt alle nog onbekende edge-cases (typfouten in Mistral output, gekke unicode, andere obfuscatie-schemes) zonder dat we Pipedrive 400s blijven krijgen.

### 5c. Eenmalige fix voor bestaande Vriesde-run

Run `a9741c0b-6710-490c-8a58-c63c4eaa9af5` heeft `pipedrive_org_id=61345` al (org bestaat). Person en deal moeten nog.

**Actie:** SQL-update om de Cloudflare-email te clearen op de huidige selected_contact, daarna kan sales op "Hervatten" klikken in de UI. Sync is idempotent, pakt door waar hij gebleven was.

```sql
UPDATE sales_lead_runs
SET selected_contacts = jsonb_set(
  selected_contacts,
  '{0,email}',
  'null'::jsonb
),
status = 'review',
error = null
WHERE id = 'a9741c0b-6710-490c-8a58-c63c4eaa9af5';
```

Na deze update: sales klikt "Sync naar Pipedrive" opnieuw. Person wordt aangemaakt met `info@automobielbedrijf-vriesde.nl` fallback, deal volgt.

## Test-strategie

- **Unit tests** (`apps/admin/__tests__/sales-leads/pipedrive-payloads.test.ts`): adres-subfields-cases (4 boven), email-validatie (Cloudflare placeholder, invalid format, fallback path, geen domain).
- **Unit test orchestrator** (`apps/admin/__tests__/sales-leads/orchestrator.test.ts` of nieuw): synthetic Personeelszaken wordt geïnjecteerd; bij bestaande website-placeholder skipt synthetic.
- **Type-check + build** in `apps/admin`.
- **Handmatige verificatie** op staging:
  - Nieuwe run met contactmoment-override in stap 1 -> check dat de date doorkomt in de deal.
  - Run op een site mét Cloudflare email-protection -> check dat email gefilterd is en sync slaagt.
  - Run op een nieuwe site -> check dat adres-subfields in Pipedrive org doorkomen en dat de deal het adres erft.

## Niet meegenomen (out-of-scope)

- Redesign review-pagina.
- Vervangen Pipedrive V2 door V1 voor org-address.
- Externe geocoding (Google Maps).
- Bredere refactor van orchestrator finalize-fase.
- Cloudflare-placeholder filter delen met andere scrapers (kan later naar `lib/utils/email.ts` als hergebruik nodig is).

## Implementation-volgorde (suggestie)

1. **Fix #5 (Vriesde)** eerst, heeft prio omdat het sync-failures veroorzaakt. Eenmalige SQL na deploy.
2. **Fix #4 (adres)**, losse refactor in pipedrive-payloads, makkelijk geïsoleerd te testen.
3. **Fix #2 (Personeelszaken altijd)**, raakt orchestrator finalize, vereist orchestrator-test.
4. **Fix #3 (stap 1 contactmoment)**, schema + form + create-route, geen DB-wijziging.
5. **Fix #1 (layout reorder)**, laatste, puur visueel, makkelijk om te valideren.

Elk fix is los committable en deploybaar.
