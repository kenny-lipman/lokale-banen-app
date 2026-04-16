# Project: Pipedrive Backfill — 18.774 ongesyncte Instantly contacts

## Probleem

Op 27 februari 2026 zijn ~20.000 leads in bulk uit Instantly verwijderd, maar **18.774 daarvan zijn NIET naar Pipedrive gesynct**. Ze staan wel in onze `contacts` tabel met alle data, maar hebben geen `pipedrive_person_id` en `pipedrive_synced = false`.

### Oorzaak
De cleanup heeft leads uit Instantly verwijderd zonder de Pipedrive sync uit te voeren. Alleen 1.306 contacts zijn correct gesynct (via webhooks of eerdere kleine backfill batches).

---

## Scope

### Totaal te verwerken: 18.774 contacts

| Status | Aantal | Pipedrive Status Prospect | Actie |
|--------|--------|---------------------------|-------|
| `campaign_completed` | 17.176 | "Niet gereageerd Instantly" | Sync naar Pipedrive |
| `email_bounced` | 1.394 | "Niet meer Benaderen" | Sync naar Pipedrive (nu uitgesloten in code!) |
| `lead_out_of_office` | 203 | "Niet gereageerd Instantly" | Sync naar Pipedrive |
| `lead_wrong_person` | 1 | "Niet meer Benaderen" | Sync naar Pipedrive |

### Data beschikbaarheid

**Contact data:**
- Email: 100% (18.774)
- Naam: ~0% (~6 hebben naam)
- Telefoon: ~55% (~10.400)
- Functietitel: ~1% (~180)
- Company link: 100%

**Company data:**
- Bedrijfsnaam: 100%
- Postcode + Stad: ~64% (~12.000)
- Hoofddomein: ~63% (~11.800)
- Website: ~18% (~3.400)
- Subdomeinen: ~10% (~1.900)
- Adres: ~16% (~3.000)

---

## Pipedrive velden die gevuld worden per lead

### Organisatie (Organization)

| Pipedrive Veld | Custom Field ID | Bron | Vereist |
|----------------|-----------------|------|---------|
| Name | - | `companies.name` of email domain | Ja |
| Status Prospect | `e8a27f47529d2091399f063b834339316d7d852a` | Mapping van `instantly_status` | Ja |
| Hoofddomein | `7180a7123d1de658e8d1d642b8496802002ddc66` | `companies.hoofddomein` (via postcode) | Nee (alleen als postcode beschikbaar) |
| Subdomeinen | `2a8e7ff62fa14d0c69b48fb025d0bdf80c04a28c` | `companies.subdomeinen` | Nee |
| Einde Instantly / Start Pipedrive | `ea203acb05edaece965736651111cb1aefe83f3b` | `contacts.instantly_removed_at` (27 feb 2026) | Ja |
| Website | `79f6688e77fed7099077425e7f956d52aaa9defb` | `companies.website` | Nee |
| Adres (straat, stad, postcode) | - | `companies.street_address/city/postal_code` | Nee |
| Telefoonnummer | `f249147e63f82da820824528364fe2cc8fb86482` | `companies.phone` of `contacts.phone` | Nee |
| KvK-nummer | `1e887677c33f2cd084eb85a4bf421b657e7ba154` | `companies.kvk_number` | Nee |
| Branche | `75a7b46357970b58a7c5f9763ddcd23a5806e108` | Job categories mapping | Nee |
| Bedrijfsgrootte | `f68e60517a23efa9a0d9defa762c534bb7cbfc46` | `companies.employee_count` | Nee |
| Notitie | - | Sync details, campaign info | Ja |

### Persoon (Person)

| Pipedrive Veld | Custom Field ID | Bron |
|----------------|-----------------|------|
| Name | - | `contacts.name` of email prefix |
| Email | - | `contacts.email` |
| Organisatie | - | Gekoppeld aan bovenstaande org |
| Telefoon | - | `contacts.phone` |
| Functie | `eff8a3361f8ec8bc1c3edc57b170019bdf9d99f3` | `contacts.title` |
| Linkedin | `275274fd29282c0679a1e84e7cef010dba5513b0` | `contacts.linkedin_url` |

### Email Activities
- Verzonden/ontvangen emails uit Instantly gelogd als Pipedrive activities

---

## Gatekeepers / Voorwaarden

| Gatekeeper | Effect | Impact op backfill |
|------------|--------|-------------------|
| **Postcode vereist** | HARD BLOCK — geen Pipedrive sync zonder postcode | ~6.978 contacts geblokkeerd |
| **Geldig email** | Skip bij ongeldig format | Minimaal |
| **Freemail check** | Gmail/Outlook → alleen person, geen org (tenzij bedrijfsnaam) | Minimaal (zakelijke emails) |
| **Protected statuses** | KLANT/IN_ONDERHANDELING wordt niet overschreven | Beschermt bestaande klanten |
| **Deduplicatie** | Skip als al gesynct voor email+campaign+event | Voorkomt dubbelen |

---

## Taken

### Fase 1: Code fixes (voorbereidend)

- [x] **Fix `campaignCompletedAt` in repair methode** — `instantly_campaign_completed_at` en `instantly_removed_at` ophalen en doorgeven als `campaignCompletedAt` in `syncUnprocessedContactsToPipedrive()`
- [ ] **Bounced contacts includeren** — De huidige `syncUnprocessedContactsToPipedrive()` sluit `email_bounced` uit (lijn 1702/1724). Voor de backfill moeten deze WEL mee met status "Niet meer Benaderen"
- [ ] **Postcode backfill voor ~6.978 contacts** — Probeer postcodes te verrijken via Nominatim geocoding zodat meer contacts een hoofddomein krijgen

### Fase 2: Test run

- [ ] **Dry-run / kleine batch test** — Draai `syncUnprocessedContactsToPipedrive(batchSize: 10)` en verifieer in Pipedrive:
  - Organisatie correct aangemaakt/gevonden
  - Status Prospect correct gezet ("Niet gereageerd Instantly")
  - Hoofddomein correct ingevuld
  - "Einde Instantly / Start Pipedrive" datum = 27 feb 2026
  - Persoon correct gekoppeld
  - Notitie toegevoegd
  - Email activities gelogd
- [ ] **Verifieer edge cases**: freemail, ontbrekende postcode, bestaande org in Pipedrive

### Fase 3: Bulk sync uitvoeren

- [ ] **Batch 1: Contacts MET postcode** (~11.800) — In batches van 50, met 200ms delay per lead. ~7-11 Pipedrive API calls per lead = ~130.000 API calls totaal. Geschatte tijd: ~7-8 uur bij 200ms interval
- [ ] **Batch 2: Contacts ZONDER postcode** (~6.978) — Na postcode backfill, zelfde proces
- [ ] **Batch 3: Bounced contacts** (1.394) — Na code fix, sync met status "Niet meer Benaderen"

### Fase 4: Verificatie

- [ ] **Database check** — Verifieer dat `pipedrive_synced = true` en `pipedrive_person_id IS NOT NULL` voor alle verwerkte contacts
- [ ] **Pipedrive steekproef** — Controleer ~20 willekeurige organisaties in Pipedrive op correcte velden
- [ ] **Filter test** — Verifieer dat Pipedrive filter "Hoofddomein = ZoetermeerseBanen" + "Status Prospect = Niet gereageerd Instantly" nu meer dan 6 resultaten geeft
- [ ] **Resterende contacts** — Documenteer hoeveel contacts niet gesynct konden worden en waarom

### Fase 5: Opruiming

- [ ] **Backfill queue opruimen** — 59.634 pending leads in `instantly_backfill_leads` (allemaal "AlmeerseBanen" campagne) die nooit verwerkt zijn. Besluit: verwijderen of alsnog verwerken?
- [ ] **Cancelled batches opruimen** — 5 cancelled batches in `instantly_backfill_batches`

---

## Bestaande methode

De repair sync gebruikt `syncUnprocessedContactsToPipedrive()` in `lib/services/instantly-pipedrive-sync.service.ts` (lijn 1684). Deze roept intern `syncLeadToPipedrive()` aan — dezelfde flow als webhooks en normale backfill.

### API rate limits
- Pipedrive: 100 requests / 10 seconden
- Elke lead = ~7-11 API calls (search org, create/find org, search person, create/find person, set status, set hoofddomein, set subdomeinen, update enrichment, add note, log activities)
- 200ms delay per lead ingebouwd
- Bij 18.774 leads: geschatte doorlooptijd ~7-10 uur

---

## Risico's

| Risico | Mitigatie |
|--------|----------|
| Pipedrive rate limiting | 200ms delay per lead + exponential backoff in client |
| Duplicate organisaties | `findOrCreateOrganization()` zoekt eerst op naam/domein |
| Protected statuses overschrijven | Code checkt KLANT/IN_ONDERHANDELING |
| Verkeerde hoofddomein | Single source of truth via `companies.hoofddomein` (postcode-based) |
| Timeout bij grote batches | Verwerk in batches van 50, kan hervat worden (query pakt alleen `pipedrive_person_id IS NULL`) |
