# Pipedrive integratie

Hoe OTIS (sales automation / Lead Verrijking) bedrijven, contactpersonen en deals naar Pipedrive synct. Lees dit bij werk aan de sync-flow, de Pipedrive-client of bron-prioriteit van verrijkte velden.

## Waar zit het

| Onderdeel | Bestand |
|-----------|---------|
| API-client (alle HTTP-calls) | `apps/admin/lib/pipedrive-client.ts` |
| Sync-orchestrator | `apps/admin/lib/services/sales-leads/pipedrive-sync.service.ts` |
| Payload-builders (org/person/deal velden) | `apps/admin/lib/services/sales-leads/pipedrive-payloads.ts` |
| Bron-prioriteit verrijkte velden | `apps/admin/lib/services/sales-leads/master-record.ts` (`FIELD_PRIORITY`) |
| UI-trigger (sync-knop, "in bestaande organisatie") | `apps/admin/components/sales/lead-sync-status.tsx` |
| API-route | `apps/admin/app/api/sales-leads/[id]/sync-pipedrive/route.ts` |

## Pipedrive API basics

**Twee API-versies, beide in gebruik:**
- **v1**: `https://api.pipedrive.com/v1` (env `PIPEDRIVE_API_URL`). Gebruikt voor o.a. notes en activities.
- **v2**: `https://lokalebanen.pipedrive.com/api/v2` (env `PIPEDRIVE_API_V2_URL`). Gebruikt voor organizations, persons, deals. v2 is goedkoper in rate-limit-kosten en sneller; gebruik v2 waar een endpoint bestaat.

**Auth**: API-token (env `PIPEDRIVE_API_KEY`), meegestuurd als query-parameter `?api_token=...`. Geen OAuth. OAuth is alleen nodig voor publieke Marketplace-apps; dit is een private integratie, dus token volstaat. Houd de token server-side (nooit naar de client).

**Request/response**: REST + JSON. Datums in `YYYY-MM-DD`. Lijst-endpoints pagineren met `start` + `limit`.

### Rate limiting

Pipedrive werkt met een **token-budget per dag** (gedeeld over het hele account), naast een **burst-limiet per 2 seconden per gebruiker**.

- Dagbudget = 30.000 basis-tokens x plan-multiplier x aantal seats. Reset om middernacht (servertijd).
- Kosten per call (v1; v2 is lager): GET enkel = 2, lijst = 20, update = 10, delete = 6, **search = 40**. Search is dus duur, zet zoekacties zuinig in.
- Burst: afhankelijk van plan (Lite 20 -> Ultimate 120 requests per 2s). Search apart gecapt op 10 per 2s.
- Headers om te monitoren: `x-ratelimit-remaining`, `x-ratelimit-reset`, `x-daily-requests-left`.
- **429** = budget op (komt terug na reset). Aanhoudend misbruik geeft **403**.

**Hoe de client hiermee omgaat** (`pipedrive-client.ts`):
- 429 met `Retry-After` > 60s wordt als dagbudget-uitputting beschouwd en gooit `PipedriveDailyLimitError` (niet blind retryen, dat put het budget verder uit).
- Kortere 429's: exponential backoff met begrensd aantal retries.
- De client is reactief (retry na 429), niet proactief (geen vooraf doseren). Bij hoge concurrency kan dit een 429-storm geven; let daarop bij bulk-sync.

## Sync-flow (org -> person -> deal)

`syncLeadToPipedrive(runId, orgMode)` coordineert. `orgMode`: `new` | `existing` | `auto`.

1. **Dedupe** (alleen `auto`): zoek bestaande org op domein, dan op naam. Gevonden -> run wordt `duplicate`, `existing_pipedrive_org_id` opgeslagen.
2. **Organisatie**: nieuw -> aanmaken met volledige payload. Bestaand ("in bestaande organisatie") -> `fillEmptyOrgFields`: lege velden aanvullen, bestaande Pipedrive-data niet overschrijven. **Uitzondering: het adres is leidend vanuit OTIS en overschrijft altijd.**
3. **Contactpersonen**: bij bestaande-org-flow eerst zoeken op e-mail (`findExistingPersonByEmail`). Match -> persoon hergebruiken; `org_id` koppelen als de persoon nog geen org heeft, en de naam meesturen als die handmatig in OTIS is aangepast (`name_overridden`). Geen match -> nieuwe persoon aanmaken met naam uit `selected_contacts[].name`.
4. **Deal**: nieuwe deal onder de org; extra contacten als participants.

### Gedragsregel: aanvullen, met gerichte uitzonderingen

Bij een bestaande organisatie/persoon vult het systeem standaard alleen aan en overschrijft het niets, zodat handmatig gepoetste Pipedrive-data intact blijft. Twee bewuste uitzonderingen waar OTIS leidend is:

- **Adres** (org): `fillEmptyOrgFields` zet het OTIS-adres altijd door, ook als er al een ander adres staat (een leeg OTIS-adres wist nooit een bestaand adres).
- **Contactpersoon-naam** (person): alleen als de gebruiker de naam in de OTIS-review handmatig heeft aangepast. Dat wordt vastgelegd met `NormalizedContact.name_overridden` (gezet door `PATCH /api/sales-leads/[id]/edit-contact`) en in de sync verwerkt via `buildExistingPersonPatch`. Automatisch verrijkte namen laten de bestaande Pipedrive-naam ongemoeid.

## Custom fields

Pipedrive custom fields worden aangesproken via hun **hash-veld-ID** (lange hex-string), niet via een leesbare naam. De IDs en hun enum-opties (bijv. Hoofddomein-platform -> enum-ID) staan boven in `pipedrive-client.ts`. Nieuwe platforms of velden vereisen het toevoegen van de juiste ID/enum-mapping daar.

## Env vars

- `PIPEDRIVE_API_KEY` - API-token (verplicht)
- `PIPEDRIVE_API_URL` - v1 base-URL (default `https://api.pipedrive.com/v1`)
- `PIPEDRIVE_API_V2_URL` - v2 base-URL (default `https://lokalebanen.pipedrive.com/api/v2`)
- `PIPEDRIVE_NIEUWSBRIEF_STATUS_FIELD_ID` - custom field-ID nieuwsbrief-status

## Officiele docs

Startpunt: https://pipedrive.readme.io/docs/getting-started. Relevant: Core API Concepts (requests/responses, pagination, rate limiting), v1 -> v2 migration guide, en de endpoint-referenties voor Organizations, Persons en Deals.
