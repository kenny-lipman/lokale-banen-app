# Implementatieplan: Edge Cases Instantly → Pipedrive Sync

## Overzicht

Dit document beschrijft de edge cases die geïmplementeerd moeten worden voor een robuuste Instantly → Pipedrive synchronisatie.

---

## 1. Freemail Domein Detectie

### Probleem
Leads met gmail.com, hotmail.com etc. worden gekoppeld aan organisaties met de naam "gmail.com", wat incorrect is.

### Oplossing
- Maak een lijst van bekende freemail domeinen
- Bij freemail: maak GEEN organisatie aan, alleen een Person zonder org_id
- Of: maak een speciale "Freemail Contacts" organisatie aan

### Bestanden te wijzigen
- `lib/services/instantly-pipedrive-sync.service.ts`
  - Nieuwe functie: `isFreemailDomain(domain: string): boolean`
  - Aanpassing in `syncLeadToPipedrive()`: skip org creation voor freemail

### Impact
- Laag risico
- Geen bestaande data affected

---

## 2. Email Validatie

### Probleem
Ongeldige email adressen kunnen de sync laten falen of corrupte data creëren.

### Oplossing
- Valideer email format voordat sync start
- Log en skip ongeldige emails

### Bestanden te wijzigen
- `lib/services/instantly-pipedrive-sync.service.ts`
  - Nieuwe functie: `isValidEmail(email: string): boolean`
  - Aanpassing in `syncLeadToPipedrive()`: early return bij invalid email

### Impact
- Laag risico
- Voorkomt errors

---

## 3. Exponential Backoff voor Rate Limits

### Probleem
Bij grote backfills kunnen we rate limits van Instantly en Pipedrive raken.

### Oplossing
- Implementeer retry met exponential backoff
- Detecteer 429 responses en wacht automatisch

### Bestanden te wijzigen
- `lib/instantly-client.ts`
  - Nieuwe functie: `withRetry<T>(fn: () => Promise<T>, maxRetries: number): Promise<T>`
  - Aanpassing in `makeRequest()`: wrap met retry logic
- `lib/pipedrive-client.ts`
  - Zelfde retry logic toevoegen

### Impact
- Medium risico (wijzigt API calls)
- Verbetert betrouwbaarheid significant

---

## 4. Verbeterde Organisation Matching

### Probleem
Duplicate organisaties kunnen ontstaan of verkeerde matches.

### Oplossing
- Zoek eerst op exacte naam match
- Dan op email domein in organisatie custom fields
- Als meerdere matches: neem meest recente of met meeste activiteit

### Bestanden te wijzigen
- `lib/pipedrive-client.ts`
  - Nieuwe functie: `findOrganizationByEmailDomain(domain: string): Promise<Organization | null>`
  - Aanpassing in `findOrCreateOrganization()`: betere matching strategie

### Impact
- Medium risico
- Kan bestaande matching beïnvloeden

---

## 5. Sync Transaction/Cleanup

### Probleem
Als deel van sync faalt (bijv. org created maar person niet), blijft partial state achter.

### Oplossing
- Log elke stap met status
- Bij falen: markeer sync als "partial_failure"
- Retry logic voor gefaalde syncs

### Bestanden te wijzigen
- `lib/services/instantly-pipedrive-sync.service.ts`
  - Nieuwe interface: `SyncStep` met status
  - Aanpassing in `syncLeadToPipedrive()`: track elke stap
  - Database: voeg `sync_steps` JSON kolom toe aan instantly_pipedrive_syncs

### Impact
- Medium risico
- Database migratie nodig

---

## 6. Email Activity Retry

### Probleem
Als email history fetchen faalt, worden geen activities gelogd.

### Oplossing
- Queue gefaalde email fetches voor later
- Retry bij volgende sync of via cron

### Bestanden te wijzigen
- `lib/services/instantly-pipedrive-sync.service.ts`
  - Aanpassing in `logEmailActivities()`: queue failed attempts
  - Database: voeg `email_activities_synced` boolean toe

### Impact
- Laag risico
- Verbetert data completeness

---

## Implementatie Volgorde

### Fase 1: Quick Wins (Laag risico, hoge waarde)
1. Email Validatie
2. Freemail Domein Detectie

### Fase 2: Robustness (Medium risico)
3. Exponential Backoff
4. Email Activity Retry

### Fase 3: Advanced (Optioneel)
5. Verbeterde Organisation Matching
6. Sync Transaction/Cleanup

---

## Geschatte Tijdsinvestering

| Item | Tijd |
|------|------|
| Email Validatie | 15 min |
| Freemail Detectie | 20 min |
| Exponential Backoff | 30 min |
| Email Activity Retry | 20 min |
| Organisation Matching | 45 min |
| Sync Transaction | 60 min |
| **Totaal Fase 1+2** | **~1.5 uur** |

---

## Testplan

Na elke implementatie:
1. Unit test voor nieuwe functie
2. Test backfill script met 1 lead
3. Test webhook endpoint
4. Verify in Pipedrive UI
