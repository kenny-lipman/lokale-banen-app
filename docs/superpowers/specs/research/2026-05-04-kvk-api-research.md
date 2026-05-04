# KvK API — Research voor Sales Lead Automation

**Datum:** 2026-05-04
**Bron:** https://developers.kvk.nl/documentation
**Doel:** Verrijking van bedrijfsdata in Sales Lead Automation (Otis-context)

---

## 1. Beschikbare API's (één abonnement, vier endpoints)

| API | Use case | Belangrijke velden |
|---|---|---|
| **Zoeken** (v2) | KvK-nummer/vestigingsnummer vinden o.b.v. naam, adres, postcode | `kvkNummer`, `vestigingsnummer`, `naam`, `type`, `actief`, `adres` |
| **Basisprofiel** (v1) | Basisgegevens van een bedrijf op KvK-nummer | SBI-codes, werknemers, statutaire naam, eigenaar, adressen, telefoon, e-mail, website |
| **Vestigingsprofiel** (v1) | Detail per vestiging op vestigingsnummer | SBI per vestiging, fysiek vs postadres |
| **Naamgeving** (v1) | Statutaire + handelsnamen | Alle handelsnamen (relevant voor "WeTarget B.V." vs "WeTarget") |

**Voor onze flow gebruiken we:**
1. **Zoeken v2** om vanuit de invoer (URL → domein → bedrijfsnaam-guess of handmatige input) de KvK-nummers te vinden
2. **Basisprofiel v1** om het hoofdvestigingsprofiel op te halen — dit is waar 90% van de relevante data zit

## 2. Endpoints

### Zoeken v2
```
GET https://api.kvk.nl/api/v2/zoeken
```

**Query params (alle optioneel, combineerbaar):**
- `kvkNummer` (8 cijfers)
- `naam` — handels- of statutaire naam (whole-text match, geen fuzzy!)
- `vestigingsnummer`
- `straatnaam`, `huisnummer`, `postcode`, `plaats`
- `type` — `hoofdvestiging` | `nevenvestiging` | `rechtspersoon`
- `pagina` (default 1)
- `resultatenPerPagina` (max 100)
- `actief` — `Yes` (default) | `No` | `All`

**Response shape:**
```json
{
  "pagina": 1,
  "resultatenPerPagina": 10,
  "totaal": 1,
  "resultaten": [
    {
      "kvkNummer": "12345678",
      "vestigingsnummer": "000000123456",
      "naam": "Example Company B.V.",
      "type": "rechtspersoon",
      "actief": "Yes",
      "adres": {
        "straatnaam": "Hoofdstraat",
        "huisnummer": 42,
        "postcode": "1012AB",
        "plaats": "Amsterdam"
      },
      "links": [{ "rel": "basisprofiel", "href": "..." }]
    }
  ]
}
```

**⚠ Quirk:** zoeken op naam doet *whole-text matching* (geen fuzzy). Voor "WeTarget B.V." moet je waarschijnlijk meerdere variaties proberen of vanuit het domein eerst de naam afleiden.

### Basisprofiel v1
```
GET https://api.kvk.nl/api/v1/basisprofielen/{kvkNummer}
```

**Optionele query:** `?geoData=true` voor BAG-IDs en GPS-coördinaten.

**Response — relevante velden:**
- `kvkNummer`, `rsin`, `statutaireNaam`, `formeleRegistratiedatum`
- `materieleRegistratie` (start/end)
- `totaalWerkzamePersonen`, `deeltijdWerkzamePersonen`, `voltijdWerkzamePersonen`
- `sbiActiviteiten[]` — `{ sbiCode, sbiOmschrijving, indHoofdactiviteit }`
- `handelsnamen[]`
- `_embedded.eigenaar` — `{ rechtsvorm, uitgebreideRechtsvorm, ... }`
- `_embedded.hoofdvestiging` — `{ vestigingsnummer, adressen[], websites[], emailadressen[], telefoonnummers[] }`
- `_embedded.vestigingen[]` — alle vestigingen kort

## 3. Authenticatie

- Header **`apikey: <KEY>`** (lowercase, geverifieerd 2026-05-04)
- **Productie endpoint:** `https://api.kvk.nl/api/v1/` en `/v2/` ✅
- **Test endpoint:** `https://api.kvk.nl/test/api/...` — onze huidige key werkt **niet** op test (HTTP 401). Dit is een **productie-only key**.
- **Live test:** zoeken op "WeTarget" gaf 7 resultaten incl. WeTarget B.V. (kvkNummer 87886022, Slotenmakerstraat Naaldwijk) ✅
- API geconfigureerd in `.env.vercel.local`:
  - `KVK_API_KEY`
  - `KVK_API_BASE_URL=https://api.kvk.nl/api`

## 4. Pricing (te valideren — pricing pagina laadt dynamisch)

**Wat ik weet:**
- Vaste **maandelijkse fee** + **bedrag per query**
- BTW-vrij ("KVK APIs are exempt from VAT")
- **Open data**: gratis access op gelimiteerde basisinfo
- **API-abonnement (paid)**: volledige toegang

**TODO Kenny:** check huidige tarieven op https://www.kvk.nl/zoeken-en-bestellen/over-ons-handelsregister/handelsregister-data/api/ — verwacht in de buurt van €X/maand + €0,02-0,05/call (orde van grootte; was zo enkele jaren geleden).

**Implicatie design:** elke verrijking-run kost 1× Zoeken + 1× Basisprofiel = 2 calls. Bij 100 leads/dag = 200 calls/dag = 6.000/maand.

## 5. Rate limits

Niet expliciet gedocumenteerd. **Aanname:** redelijk royaal voor productie keys; we bouwen wel een retry-met-backoff in en cachen Basisprofiel-responses op KvK-nummer (minstens 24u, basisdata muteert traag).

## 6. NL-specifieke quirks

- **Type-onderscheid**: een bedrijf bestaat als "rechtspersoon" (juridische entiteit) + minstens één "hoofdvestiging" + 0..n "nevenvestigingen". Voor B2B-prospecting willen we doorgaans de **hoofdvestiging** (heeft het echte adres/contact).
- **ZZP'ers** hebben vaak rechtspersoon = "natuurlijk persoon" + één vestiging. Geen werknemer-data.
- **Holdings/dochters**: eigen KvK-nummers per entiteit. Bij "WeTarget B.V." ↔ "WeTarget Holding" moeten we de dealeigenaar laten kiezen.
- **GIO-flag** (gegevens in onderzoek): KvK toont deze niet in resultaten, dus we hoeven niet te filteren.
- **Inactieve registraties** zijn standaard uitgesloten (`actief=Yes`); voor leadgeneratie is dat juist wat we willen.
- Maximum **100 resultaten per pagina**.

## 7. Mapping op onze Pipedrive custom fields

| KvK-veld | Pipedrive field |
|---|---|
| `statutaireNaam` of `handelsnamen[0]` | `name` (Organization) |
| `kvkNummer` | `1e887677` (KvK-nummer) |
| `_embedded.hoofdvestiging.adressen[0]` | `address` (Pipedrive standaard, met geocoding) |
| `_embedded.hoofdvestiging.websites[0]` | `79f6688e` (Website) |
| `_embedded.hoofdvestiging.emailadressen[0]` | `4811ae7e` (E-mailadres) |
| `_embedded.hoofdvestiging.telefoonnummers[0]` | `f249147e` (Telefoonnummer) |
| `totaalWerkzamePersonen` → bucket | `f68e6051` (Bedrijfsgrootte: <10/<100/>100) |
| `sbiActiviteiten[].sbiCode` (hoofd) → mapping | `75a7b463` (Branche, enum) |

**SBI → Branche-enum mapping** (Pipedrive heeft 8-12 branches als enum):
- SBI 41–43 (bouw) → "Bouw + gerelateerd"
- SBI 45 (autohandel) → "Automotive"
- SBI 46–47 (groot/detailhandel) → "Detailhandel, groothandel en ambachten"
- SBI 55–56 (horeca) → "Horeca & ..."
- enz. — volledige mapping bouwen we als constants-bestand

## 8. Implementatie aanbeveling

```ts
// lib/services/kvk.service.ts
class KvkService {
  async searchByDomain(domain: string): Promise<KvkSearchResult[]>
  async searchByName(naam: string): Promise<KvkSearchResult[]>
  async getBasisprofiel(kvkNummer: string): Promise<KvkBasisprofiel>
  async enrichByDomain(domain: string): Promise<EnrichedKvkData>  // combineert search + basisprofiel
}
```

- Cache `basisprofiel` per KvK-nummer in Supabase (`kvk_cache` tabel) met TTL 7 dagen
- Bij meerdere zoekresultaten: laat sales user kiezen in het review-scherm (= bekend als "ambiguity resolution")
- Health-check endpoint die testkey valideert
- Errors: 401 (key probleem), 404 (niet gevonden), 429 (rate limit; backoff)

## 9. Open vragen voor Kenny

1. Hebben we al een KvK-account waar we een API-key voor kunnen aanvragen?
2. Begroten we test + prod keys, of starten we alleen test?
3. SBI → Branche mapping: jij hebt domeinkennis voor de Pipedrive enum-opties. Wil je die mapping zelf valideren als we het design uitschrijven?
