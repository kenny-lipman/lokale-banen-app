# Apollo API — Research voor Sales Lead Automation

**Datum:** 2026-05-04
**Bronnen:** https://docs.apollo.io/, geverifieerde endpoint pages
**Doel:** Decision-maker discovery + contact enrichment voor Sales Lead Automation

---

## 1. Huidige status in onze codebase

- `APOLLO_WEBHOOK_URL` env var bestaat → loopt nu via een **externe webhook** (vermoedelijk Apify-actor of Make.com proxy), géén directe Apollo API
- Endpoint `/api/apollo/enrich-selected` (referentie: `apps/admin/app/api/apollo/enrich-selected/route.ts`) post naar die webhook
- **Voor de nieuwe feature:** we willen direct met Apollo API praten zodat we synchroon kunnen werken in de review-flow

→ Vereist nieuwe env var: `APOLLO_API_KEY`. Te valideren of de bestaande webhook hergebruikt kan/moet worden of dat we direct gaan.

## 2. Auth

- **Header:** `X-Api-Key: <KEY>` (sommige docs noemen "Bearer token", maar de officiële endpoint-pagina's tonen `X-Api-Key`)
- **Base URL:** `https://api.apollo.io/api/v1/`
- API-key aanvragen via Apollo dashboard → Settings → API. Vereist betaald plan (geen API access op gratis Starter).

## 3. Relevante endpoints

### 3.1 Organization Enrichment (op domein)
```
GET https://api.apollo.io/api/v1/organizations/enrich?domain=<domain>
```
- `domain` zonder `www.` of `https://`, voorbeeld: `apollo.io`
- **Response (rijke firmografie):** industry, revenue, employee count, funding rounds, corporate phone, addresses, technologies (1.500+ getrackte tools), founding date, description
- **Status codes:** 200 success / 401 invalid key / 422 niet gevonden / 429 rate limit
- **Bulk variant** beschikbaar voor max 10 domeinen tegelijk

### 3.2 Organization Search
```
POST https://api.apollo.io/api/v1/mixed_companies/search
```
- Powerful filter-endpoint, niet primair voor onze flow (we hebben al een domein) maar wel voor edge cases (geen domein → zoek op naam + locatie)
- Belangrijke filters voor ons:
  - `q_organization_domains_list[]` (max 1.000 domeinen)
  - `q_organization_name` (partial match)
  - `organization_locations[]` (HQ-locatie)
  - `organization_num_employees_ranges[]`
  - `q_organization_keyword_tags[]` (industry keywords)
- **Limit:** max 50.000 records (100/page × 500 pages)

### 3.3 People Search (decision makers vinden)
```
POST https://api.apollo.io/api/v1/mixed_people/search
```
*(URL-naamconventie analoog aan organization search; te valideren door eerst test-call te doen)*

**Filters voor onze decision-maker discovery (zoals Make.com flow doet):**
- `q_organization_domains_list[]` of `organization_ids[]` — vastpinnen op het juiste bedrijf
- `person_titles[]` — specifieke titels (CEO, Owner, HR Manager, COO)
- `person_seniorities[]` — `owner`, `founder`, `c_suite`, `vp`, `head`, `director`, `manager`, `senior`, `entry`, `intern`
- `person_department_or_subdepartments[]` — `human_resources`, `executive`, `operations`, etc.
- `contact_email_status[]` — `verified`, `unverified`, `likely_to_engage` (alleen verified levert betrouwbare emails op)
- `q_keywords` — vrije tekst
- `page`, `per_page`

**Strategie voor onze flow** (volgens klant brief: HR Manager → Eigenaar → HR Medewerker → fallback "Afdeling Personeelszaken"):
1. Eerste call: `person_seniorities=[owner, founder, c_suite]` + `person_department_or_subdepartments=[human_resources, executive]`
2. Mistral/AI selecteert top 2 uit resultaat (zoals Make.com OpenAI step doet)

### 3.4 Person Enrichment / Match (single)
```
POST https://api.apollo.io/api/v1/people/match
```
- **Input:** een van `first_name+last_name` / `name` / `email` / `id` / `linkedin_url`
- Plus optioneel: `domain`, `organization_name`
- **Reveal toggles:**
  - `reveal_personal_emails: true` — toont privé-email (NIET in GDPR-regio's, dus voor NL beperkt)
  - `reveal_phone_number: true` — vereist `webhook_url` (async delivery)
- **Response:** LinkedIn URL, work email, phone (bij reveal), title, organization, employment history

### 3.5 Bulk People Enrichment
```
POST https://api.apollo.io/api/v1/people/bulk_match
```
- Tot 10 personen tegelijk
- Kostenbesparend bij grotere batches

## 4. Credits & rate limits (te valideren)

**Wat publiek bekend is:**
- Apollo gebruikt een **credit-systeem**: standard credits, mobile credits, export credits
- Trial = 50 credits
- Free Starter plan = geen API access
- Enrichment kost meer credits dan search
- Email reveal = extra credit per onthulling
- Phone reveal (mobile credit) = duurder

**Wat NIET in de docs vond:** exacte credit-kosten per endpoint, exacte rate limits per plan. De Rate Limits-pagina bestaat (`/docs/rate-limits`) maar laadt content dynamisch — onze WebFetch zag alleen navigatie.

**TODO Kenny:**
- Welk Apollo-plan hebben we (of: welk plan kopen we)?
- Hoeveel API credits/maand?
- Begroting: bij **100 leads/dag**:
  - 100× org enrich = 100 credits
  - 100× people search (bv 1 call returnt 5-10 contacten) = ~100 credits
  - 200× people match (2 contacten per lead, met email reveal) = 200-400 credits
  - **Totaal ruwe schatting:** 400-600 credits/dag, 12-18k/maand

## 5. Webhooks

- Apollo support webhooks voor **async phone reveal** (resultaat komt binnen via callback)
- Geen generieke webhook voor enrichment-resultaten

## 6. NL-specifieke datakwaliteit

- Apollo dekt EU/NL bedrijven, maar dekking is **dunner dan VS**:
  - Veel ZZP'ers en kleine NL-bedrijven ontbreken
  - LinkedIn-URL dekking is goed voor bedrijven >20 medewerkers
  - Email-dekking is matig voor NL (vooral werk-emails wel beschikbaar)
- **Compliance:** GDPR-regio personal email reveal is geblokkeerd — werk-email wel toegestaan
- Voor NL is **KvK-data robuuster** voor company info; Apollo's kracht zit in **personen + LinkedIn**

→ **Strategie:** KvK = primaire bron voor company-velden, Apollo = primaire bron voor decision-makers

## 7. Foutscenario's

| Status | Betekenis | Actie |
|---|---|---|
| 401 | Ongeldige key | Health-check faalt; tonen aan admin |
| 422 | Niet gevonden (org) | Markeer "niet in Apollo", val terug op website-crawl |
| 429 | Rate limit / credits op | Exponential backoff; bij credits-op = stop run, alert admin |
| 500-503 | Apollo down | Retry 3× met backoff |

## 8. Mapping op onze data

### Organization (Apollo) → onze "Master record" / Pipedrive
| Apollo veld | Master record veld | Pipedrive |
|---|---|---|
| `industry` | `industry_apollo` | `5a467ae0` (Branche) — fallback als KvK SBI niet matcht |
| `estimated_num_employees` | `employee_count_apollo` | `f68e6051` (Bedrijfsgrootte bucket) |
| `phone` | `company_phone_apollo` | `f249147e` (Telefoonnummer) — fallback |
| `linkedin_url` | `company_linkedin` | (geen field, evt notitie) |
| `technologies` | `technologies` | notitie of custom field (toekomst) |

### Person (Apollo) → onze contactpersonen / Pipedrive
| Apollo veld | Master record | Pipedrive |
|---|---|---|
| `first_name` + `last_name` | `name` | Person `name` |
| `title` | `title` | `eff8a336` (Functie) |
| `linkedin_url` | `linkedin_url` | `275274fd` (Linkedin) |
| `email` (verified) | `email` | Person `email` |
| `phone_numbers[].sanitized_number` | `phone` | Person `phone` |
| `seniority` | `seniority` | (intern, voor AI ranking) |
| `department` | `department` | (intern) |

## 9. Implementatie aanbeveling

```ts
// lib/services/apollo.service.ts
class ApolloService {
  async enrichOrganization(domain: string): Promise<ApolloOrganization | null>
  async findDecisionMakers(opts: {
    domain: string
    titles?: string[]      // optioneel — als we Mistral het filteren laten doen
    limit?: number         // default 10
  }): Promise<ApolloPerson[]>
  async matchPerson(opts: PersonMatchInput): Promise<ApolloPerson | null>
  async health(): Promise<{ ok: boolean; credits_remaining?: number }>
}
```

- Cache organization-enrich op domein (TTL 24u) in `apollo_cache` tabel — voorkomt herhaalde credits bij dubbele leads
- Health-endpoint die credits laat zien zodat we sales kunnen waarschuwen ("nog X credits over")
- Bij elke API-call loggen naar `apollo_api_log` met `endpoint`, `credits_used` (bij beschikbare info), `response_status`, voor budget-tracking

## 10. Hergebruik bestaande Apollo-webhook?

**Optie A (aanbevolen):** Directe Apollo API gebruiken in de nieuwe feature. Voordelen: synchroon (review-flow blokkeert er niet op), volledige controle, gestructureerde fout-afhandeling. Nadeel: tweede integratiepad naast de bestaande webhook.

**Optie B:** Bestaande `APOLLO_WEBHOOK_URL` route hergebruiken/uitbreiden. Voordeel: één integratiepad. Nadeel: webhook is async + opaak, niet geschikt voor live review-UI.

→ **Aanbeveling:** Optie A voor de nieuwe feature, bestaande webhook intact laten voor de OTIS Apify-flow.

## 11. Open vragen voor Kenny

1. Heb je al een Apollo API key (welk plan)?
2. Mogen we direct de Apollo API aanroepen, of moeten we via de bestaande webhook?
3. Akkoord met budget-schatting van ~12-18k credits/maand bij 100 leads/dag?
4. Willen we mobile (mobiel) phone reveal aan? Dat kost extra credits maar levert 06-nummers — direct waarde voor sales.
