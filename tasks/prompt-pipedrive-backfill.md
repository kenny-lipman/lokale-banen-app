# Prompt: Pipedrive Backfill vervolgen

Plak dit in een nieuw gesprek om verder te gaan:

---

Lees eerst `tasks/project-pipedrive-backfill.md` — dat is het volledige projectplan voor de Pipedrive backfill van 18.774 ongesyncte Instantly contacts.

## Wat is er al gedaan

**Fase 1, taak 1 is af:** In `lib/services/instantly-pipedrive-sync.service.ts` is de methode `syncUnprocessedContactsToPipedrive()` (lijn ~1710) gefixt zodat `instantly_campaign_completed_at` en `instantly_removed_at` worden opgehaald uit de contacts tabel en doorgegeven als `campaignCompletedAt` in de leadData. Het veld "Einde Instantly campg. Start Pipedrive NIET AANKOMEN" wordt nu correct gevuld met de `instantly_removed_at` datum (27 feb 2026) in plaats van vandaag. Build is geslaagd.

## Wat nog moet gebeuren

### Fase 1 (vervolg): Code fixes

1. **Bounced contacts includeren** — `syncUnprocessedContactsToPipedrive()` sluit nu `email_bounced` uit op lijn ~1702 en ~1724 (`.not('instantly_status', 'eq', 'email_bounced')`). Voor deze backfill moeten bounced contacts WEL mee met Pipedrive status "Niet meer Benaderen". Maak dit configureerbaar via een parameter (bijv. `includeBounced: boolean`) zodat het standaard gedrag niet breekt.

2. **Postcode backfill** — ~6.978 van de 18.774 contacts hebben geen postcode op hun company → worden geblokkeerd door de postcode gatekeeper in `syncLeadToPipedrive()`. De postcode backfill service (`/api/cron/postcode-backfill`) draait al elke 2 minuten. Check hoeveel er inmiddels verrijkt zijn en of er nog extra actie nodig is.

### Fase 2: Test run

Draai een kleine test batch (10 contacts) via `syncUnprocessedContactsToPipedrive(10)` en verifieer in Pipedrive dat alle velden correct zijn gezet. Zie het projectplan voor de volledige checklist.

### Fase 3-5: Bulk sync, verificatie, opruiming

Zie projectplan.

## Key files

- `lib/services/instantly-pipedrive-sync.service.ts` — Hoofd sync service (~2700 regels). Methoden:
  - `syncUnprocessedContactsToPipedrive()` (lijn ~1684) — De repair methode
  - `syncLeadToPipedrive()` (lijn ~283) — De volledige sync flow per lead
  - `enrichLeadData()` (lijn ~2294) — Verrijking vanuit DB
  - `setOrganizationStartPipedriveDate()` (lijn ~2670) — Zet datum veld
  - `mapInstantlyStatusToEvent()` (lijn ~1822) — Status mapping
- `lib/pipedrive-client.ts` — Pipedrive API client met alle field IDs en enum mappings
- `lib/services/company-enrichment.service.ts` — Hoofddomein/subdomeinen bepaling via postcode
- `lib/constants/status-config.ts` — Gecentraliseerde status configuratie

## Database queries voor context

```sql
-- Hoeveel contacts zijn nog niet gesynct?
SELECT instantly_status, COUNT(*)
FROM contacts
WHERE instantly_synced = true AND pipedrive_synced = false AND instantly_removed_at IS NOT NULL
GROUP BY instantly_status ORDER BY count DESC;

-- Hoeveel hebben nu een postcode? (check of backfill al geholpen heeft)
SELECT c.postal_code IS NOT NULL as has_postal_code, COUNT(*)
FROM contacts co JOIN companies c ON co.company_id = c.id
WHERE co.instantly_synced = true AND co.pipedrive_synced = false AND co.instantly_removed_at IS NOT NULL
GROUP BY has_postal_code;
```
