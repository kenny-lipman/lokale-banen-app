/**
 * Pipedrive UI Sync Service
 *
 * Handles syncing selected contacts from the admin UI to Pipedrive.
 * Independent from Instantly — syncs directly from DB to Pipedrive.
 *
 * Uses the same PipedriveClient and field mappings as the Instantly sync,
 * but with a simpler flow: fetch contact+company → create/update org → create/update person.
 */

import { createServiceRoleClient } from '../supabase-server';
import {
  getPipedriveClient,
  PipedriveDailyLimitError,
  STATUS_PROSPECT_FIELD_ID,
  STATUS_PROSPECT_OPTIONS,
  HOOFDDOMEIN_FIELD_ID,
  HOOFDDOMEIN_OPTIONS,
  SUBDOMEIN_FIELD_ID,
  SUBDOMEIN_OPTIONS,
} from '../pipedrive-client';

// Pipedrive custom field IDs (same as in instantly-pipedrive-sync.service.ts)
const PIPEDRIVE_FIELDS = {
  ORGANIZATION_WEBSITE: '79f6688e77fed7099077425e7f956d52aaa9defb',
  ORGANIZATION_PHONE: 'f249147e63f82da820824528364fe2cc8fb86482',
  ORGANIZATION_KVK: '1e887677c33f2cd084eb85a4bf421b657e7ba154',
  ORGANIZATION_BRANCHE: '75a7b46357970b58a7c5f9763ddcd23a5806e108',
  ORGANIZATION_SIZE: 'f68e60517a23efa9a0d9defa762c534bb7cbfc46',
  ORGANIZATION_START_PIPEDRIVE_DATE: 'ea203acb05edaece965736651111cb1aefe83f3b',
  PERSON_FUNCTIE: 'eff8a3361f8ec8bc1c3edc57b170019bdf9d99f3',
  PERSON_LINKEDIN: '275274fd29282c0679a1e84e7cef010dba5513b0',
};

const SIZE_OPTIONS: Record<string, number> = {
  Klein: 222,
  Middel: 223,
  Groot: 224,
};

const BRANCHE_KEYWORD_MAPPINGS: Array<{ keywords: string[]; branche: number }> = [
  { keywords: ['automotive', 'car', 'vehicle', 'auto'], branche: 53 },
  { keywords: ['construction', 'bouw', 'building', 'architect'], branche: 54 },
  { keywords: ['retail', 'wholesale', 'detailhandel', 'groothandel', 'shop', 'store', 'winkel'], branche: 55 },
  { keywords: ['hotel', 'restaurant', 'horeca', 'tourism', 'toerisme', 'hospitality', 'catering'], branche: 56 },
  { keywords: ['manufacturing', 'industrial', 'productie', 'industrie', 'factory', 'fabriek'], branche: 58 },
  { keywords: ['leisure', 'entertainment', 'recreation', 'sport', 'fitness', 'gaming'], branche: 59 },
  { keywords: ['logistics', 'transport', 'shipping', 'freight', 'warehouse', 'logistiek', 'vervoer'], branche: 60 },
  { keywords: ['government', 'overheid', 'gemeente', 'public sector', 'municipality'], branche: 61 },
  { keywords: ['agriculture', 'tuinbouw', 'horticulture', 'farming', 'plants', 'greenhouse', 'sierteelt', 'kwekerij'], branche: 62 },
  { keywords: ['food', 'voedsel', 'beverage', 'bakery', 'bakkerij', 'grocery', 'supermarket'], branche: 64 },
  { keywords: ['consulting', 'services', 'dienstverlening', 'advisory', 'accounting', 'legal', 'hr', 'recruitment', 'staffing', 'cleaning', 'schoonmaak'], branche: 66 },
  { keywords: ['healthcare', 'medical', 'zorg', 'hospital', 'clinic', 'education', 'onderwijs', 'school', 'university', 'training'], branche: 67 },
];

function mapIndustriesToBranche(industries: string[] | null): number | null {
  if (!industries || industries.length === 0) return null;
  const valid = industries.filter((i): i is string => typeof i === 'string');
  if (valid.length === 0) return null;
  const joined = valid.map(i => i.toLowerCase()).join(' ');
  for (const mapping of BRANCHE_KEYWORD_MAPPINGS) {
    if (mapping.keywords.some(kw => joined.includes(kw))) return mapping.branche;
  }
  return null;
}

export interface SyncProgressEvent {
  type: 'progress';
  processed: number;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  current: string;
}

export interface SyncErrorEvent {
  type: 'error';
  contact: string;
  reason: string;
}

export interface SyncDoneEvent {
  type: 'done';
  success: number;
  failed: number;
  skipped: number;
  total: number;
  duration: string;
}

export type SyncEvent = SyncProgressEvent | SyncErrorEvent | SyncDoneEvent;

interface CompanyData {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  kvk: string | null;
  linkedin_url: string | null;
  street_address: string | null;
  postal_code: string | null;
  city: string | null;
  hoofddomein: string | null;
  subdomeinen: string[] | null;
  industries: string[] | null;
  category_size: string | null;
  apollo_employees_estimate: number | null;
  pipedrive_id: string | null;
}

interface ContactWithCompany {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  linkedin_url: string | null;
  company_id: string | null;
  pipedrive_synced: boolean | null;
  pipedrive_person_id: string | null;
  companies: CompanyData | null;
}

const DELAY_BETWEEN_CONTACTS_MS = 100;

export async function syncContactBatch(
  contactIds: string[],
  onEvent: (event: SyncEvent) => void
): Promise<void> {
  const startTime = Date.now();
  const supabase = createServiceRoleClient();
  const client = getPipedriveClient();

  let success = 0;
  let failed = 0;
  let skipped = 0;
  const total = contactIds.length;

  // 1. Fetch all contacts with company data
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select(`
      id, first_name, last_name, name, email, phone, title, linkedin_url,
      company_id, pipedrive_synced, pipedrive_person_id,
      companies (
        id, name, website, phone, kvk, linkedin_url,
        street_address, postal_code, city,
        hoofddomein, subdomeinen, industries, category_size,
        apollo_employees_estimate, pipedrive_id
      )
    `)
    .in('id', contactIds);

  if (error || !contacts) {
    onEvent({ type: 'error', contact: '-', reason: `Database fout: ${error?.message || 'Geen data'}` });
    onEvent({ type: 'done', success: 0, failed: total, skipped: 0, total, duration: '0s' });
    return;
  }

  // 2. Company dedup: group contacts by company, process each company once
  const orgCache = new Map<string, number>(); // company_id → pipedrive org id

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i] as unknown as ContactWithCompany;
    const contactName = contact.name || [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || 'Onbekend';

    try {
      // Validate: need email or name
      if (!contact.email && !contact.first_name && !contact.last_name && !contact.name) {
        skipped++;
        onEvent({ type: 'error', contact: contactName, reason: 'Geen email of naam' });
        emitProgress();
        continue;
      }

      // Validate: need company
      const company = contact.companies;
      if (!company) {
        skipped++;
        onEvent({ type: 'error', contact: contactName, reason: 'Geen bedrijf gekoppeld' });
        emitProgress();
        continue;
      }

      // 3. Find/create org (with dedup cache)
      let orgId: number;
      if (company.pipedrive_id) {
        orgId = parseInt(company.pipedrive_id);
        orgCache.set(company.id, orgId);
      } else if (orgCache.has(company.id)) {
        orgId = orgCache.get(company.id)!;
      } else {
        const emailDomain = contact.email?.split('@')[1];
        const orgResult = await client.findOrCreateOrganization(company.name, emailDomain);
        if (!orgResult) {
          failed++;
          onEvent({ type: 'error', contact: contactName, reason: 'Kon organisatie niet aanmaken in Pipedrive' });
          emitProgress();
          continue;
        }
        orgId = orgResult.id;
        orgCache.set(company.id, orgId);

        // Store pipedrive_id on company
        await supabase
          .from('companies')
          .update({
            pipedrive_id: orgId.toString(),
            pipedrive_synced: true,
            pipedrive_synced_at: new Date().toISOString(),
          })
          .eq('id', company.id);
      }

      // 4. Update org with combined PATCH (all custom fields at once)
      await updateOrganizationFields(client, orgId, company);

      // 5. Find/create person
      const personName = contact.name || [contact.first_name, contact.last_name].filter(Boolean).join(' ') || undefined;
      const personResult = await client.findOrCreatePersonAdvanced(
        contact.email || `${personName}@unknown`,
        personName,
        orgId
      );

      if (!personResult) {
        failed++;
        onEvent({ type: 'error', contact: contactName, reason: 'Kon persoon niet aanmaken in Pipedrive' });
        emitProgress();
        continue;
      }

      // 6. Update person custom fields
      await updatePersonFields(client, personResult.id, contact);

      // 7. Update DB tracking
      await supabase
        .from('contacts')
        .update({
          pipedrive_person_id: personResult.id.toString(),
          pipedrive_synced: true,
          pipedrive_synced_at: new Date().toISOString(),
        })
        .eq('id', contact.id);

      success++;
      emitProgress();

      // Rate limiting delay
      if (i < contacts.length - 1) {
        await delay(DELAY_BETWEEN_CONTACTS_MS);
      }
    } catch (err) {
      if (err instanceof PipedriveDailyLimitError) {
        failed += total - i;
        onEvent({ type: 'error', contact: contactName, reason: 'Pipedrive dagelijkse API limiet bereikt' });
        break;
      }
      failed++;
      const msg = err instanceof Error ? err.message : 'Onbekende fout';
      onEvent({ type: 'error', contact: contactName, reason: msg });
      emitProgress();
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  onEvent({ type: 'done', success, failed, skipped, total, duration: `${duration}s` });

  function emitProgress() {
    const processed = success + failed + skipped;
    const idx = Math.min(processed, (contacts?.length ?? 1) - 1);
    const currentContact = contacts?.[idx] as unknown as ContactWithCompany | undefined;
    const companyName = currentContact?.companies?.name || '';
    onEvent({ type: 'progress', processed, total, success, failed, skipped, current: companyName });
  }
}

async function updateOrganizationFields(
  client: ReturnType<typeof getPipedriveClient>,
  orgId: number,
  company: CompanyData
): Promise<void> {
  const customFields: Record<string, unknown> = {};
  const updates: Record<string, unknown> = {};

  // Status: BENADEREN (respects protected statuses via Pipedrive's own logic)
  customFields[STATUS_PROSPECT_FIELD_ID] = STATUS_PROSPECT_OPTIONS.BENADEREN;

  // Hoofddomein
  if (company.hoofddomein && HOOFDDOMEIN_OPTIONS[company.hoofddomein]) {
    customFields[HOOFDDOMEIN_FIELD_ID] = HOOFDDOMEIN_OPTIONS[company.hoofddomein];
  }

  // Subdomeinen (exclude hoofddomein)
  const rawSub = company.subdomeinen || [];
  const subs = company.hoofddomein ? rawSub.filter(s => s !== company.hoofddomein) : rawSub;
  if (subs.length > 0) {
    const enumIds = subs.map(p => SUBDOMEIN_OPTIONS[p]).filter(Boolean);
    if (enumIds.length > 0) {
      customFields[SUBDOMEIN_FIELD_ID] = enumIds;
    }
  }

  // Start Pipedrive date = today
  customFields[PIPEDRIVE_FIELDS.ORGANIZATION_START_PIPEDRIVE_DATE] = new Date().toISOString().split('T')[0];

  // Website
  if (company.website) {
    customFields[PIPEDRIVE_FIELDS.ORGANIZATION_WEBSITE] = company.website;
  }

  // Phone
  if (company.phone) {
    customFields[PIPEDRIVE_FIELDS.ORGANIZATION_PHONE] = company.phone;
  }

  // KVK
  if (company.kvk) {
    const kvkNum = parseInt(company.kvk, 10);
    if (!isNaN(kvkNum)) {
      customFields[PIPEDRIVE_FIELDS.ORGANIZATION_KVK] = kvkNum;
    }
  }

  // Bedrijfsgrootte: from category_size or apollo_employees_estimate
  if (company.category_size && SIZE_OPTIONS[company.category_size]) {
    customFields[PIPEDRIVE_FIELDS.ORGANIZATION_SIZE] = SIZE_OPTIONS[company.category_size];
  } else if (company.apollo_employees_estimate) {
    const count = company.apollo_employees_estimate;
    if (count < 10) customFields[PIPEDRIVE_FIELDS.ORGANIZATION_SIZE] = SIZE_OPTIONS.Klein;
    else if (count < 100) customFields[PIPEDRIVE_FIELDS.ORGANIZATION_SIZE] = SIZE_OPTIONS.Middel;
    else customFields[PIPEDRIVE_FIELDS.ORGANIZATION_SIZE] = SIZE_OPTIONS.Groot;
  }

  // Branche
  const branche = mapIndustriesToBranche(company.industries);
  if (branche) {
    customFields[PIPEDRIVE_FIELDS.ORGANIZATION_BRANCHE] = branche;
  }

  // Address
  if (company.street_address || company.city || company.postal_code) {
    const addr = [company.street_address, company.postal_code, company.city].filter(Boolean).join(', ');
    updates.address = { value: addr };
  }

  updates.custom_fields = customFields;
  await client.updateOrganization(orgId, updates);
}

async function updatePersonFields(
  client: ReturnType<typeof getPipedriveClient>,
  personId: number,
  contact: ContactWithCompany
): Promise<void> {
  if (!contact.title && !contact.linkedin_url) return;

  const customFields: Record<string, string> = {};
  if (contact.title) {
    customFields[PIPEDRIVE_FIELDS.PERSON_FUNCTIE] = contact.title;
  }
  if (contact.linkedin_url) {
    customFields[PIPEDRIVE_FIELDS.PERSON_LINKEDIN] = contact.linkedin_url;
  }

  await client.updatePerson(personId, { custom_fields: customFields } as any);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
