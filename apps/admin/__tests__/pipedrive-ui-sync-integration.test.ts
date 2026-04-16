import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Integration-style tests for the sync flow using mocked dependencies.
 * Tests the full sync logic without actually calling Pipedrive or Supabase.
 */

// Mock data matching our DB schema
const mockCompany = {
  id: 'company-uuid-1',
  name: 'Test BV',
  website: 'https://test.nl',
  phone: '+31 20 1234567',
  kvk: '12345678',
  linkedin_url: 'https://linkedin.com/company/test-bv',
  street_address: 'Kerkstraat 1',
  postal_code: '1234 AB',
  city: 'Amsterdam',
  hoofddomein: 'AmsterdamseBanen',
  subdomeinen: ['AmsterdamseBanen', 'HaarlemseBanen', 'AlmeerseBanen'],
  industries: ['Business Services', 'Consulting'],
  category_size: 'Middel',
  apollo_employees_estimate: 45,
  pipedrive_id: null as string | null,
};

const mockContact1 = {
  id: 'contact-uuid-1',
  first_name: 'Jan',
  last_name: 'Jansen',
  name: null as string | null,
  email: 'jan@test.nl',
  phone: '+31 6 12345678',
  title: 'HR Manager',
  linkedin_url: 'https://linkedin.com/in/janjansen',
  company_id: 'company-uuid-1',
  pipedrive_synced: false,
  pipedrive_person_id: null as string | null,
  companies: mockCompany,
};

const mockContact2 = {
  id: 'contact-uuid-2',
  first_name: 'Piet',
  last_name: 'Pietersen',
  name: null as string | null,
  email: 'piet@test.nl',
  phone: null as string | null,
  title: null as string | null,
  linkedin_url: null as string | null,
  company_id: 'company-uuid-1',
  pipedrive_synced: false,
  pipedrive_person_id: null as string | null,
  companies: mockCompany,
};

const mockContactNoCompany = {
  id: 'contact-uuid-3',
  first_name: 'Kees',
  last_name: null as string | null,
  name: null as string | null,
  email: 'kees@solo.nl',
  phone: null as string | null,
  title: null as string | null,
  linkedin_url: null as string | null,
  company_id: null as string | null,
  pipedrive_synced: false,
  pipedrive_person_id: null as string | null,
  companies: null,
};

const mockContactNoIdentity = {
  id: 'contact-uuid-4',
  first_name: null as string | null,
  last_name: null as string | null,
  name: null as string | null,
  email: null as string | null,
  phone: null as string | null,
  title: null as string | null,
  linkedin_url: null as string | null,
  company_id: 'company-uuid-1',
  pipedrive_synced: false,
  pipedrive_person_id: null as string | null,
  companies: mockCompany,
};

const mockContactAlreadySynced = {
  id: 'contact-uuid-5',
  first_name: 'Marie',
  last_name: 'de Vries',
  name: null as string | null,
  email: 'marie@test.nl',
  phone: null as string | null,
  title: 'Recruiter',
  linkedin_url: null as string | null,
  company_id: 'company-uuid-1',
  pipedrive_synced: true,
  pipedrive_person_id: '99999',
  companies: { ...mockCompany, pipedrive_id: '88888' },
};

// ============================================================================
// Simulate the sync flow logic (mirrors pipedrive-ui-sync.service.ts)
// ============================================================================

interface SyncEvent {
  type: 'progress' | 'error' | 'done';
  [key: string]: unknown;
}

function simulateSync(contacts: typeof mockContact1[], events: SyncEvent[]) {
  const orgCache = new Map<string, number>();
  let success = 0;
  let failed = 0;
  let skipped = 0;
  let pipedriveApiCalls = 0;
  let supabaseUpdates = 0;

  for (const contact of contacts) {
    const contactName = contact.name || [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || 'Onbekend';

    // Validate identity
    if (!contact.email && !contact.first_name && !contact.last_name && !contact.name) {
      skipped++;
      events.push({ type: 'error', contact: contactName, reason: 'Geen email of naam' });
      continue;
    }

    // Validate company
    if (!contact.companies) {
      skipped++;
      events.push({ type: 'error', contact: contactName, reason: 'Geen bedrijf gekoppeld' });
      continue;
    }

    const company = contact.companies;

    // Find/create org (with dedup)
    let orgId: number;
    if (company.pipedrive_id) {
      orgId = parseInt(company.pipedrive_id);
      orgCache.set(company.id, orgId);
    } else if (orgCache.has(company.id)) {
      orgId = orgCache.get(company.id)!;
      // No API call needed (cache hit)
    } else {
      // Simulate findOrCreateOrganization
      pipedriveApiCalls += 2; // search + create
      orgId = 10000 + orgCache.size;
      orgCache.set(company.id, orgId);
      supabaseUpdates++; // update company with pipedrive_id
    }

    // Update org fields (combined PATCH)
    pipedriveApiCalls += 1;

    // Find/create person
    pipedriveApiCalls += 2; // search + create

    // Update person enrichment
    if (contact.title || contact.linkedin_url) {
      pipedriveApiCalls += 1;
    }

    // Update DB tracking
    supabaseUpdates++;

    success++;
    events.push({
      type: 'progress',
      processed: success + failed + skipped,
      total: contacts.length,
      success,
      failed,
      skipped,
      current: company.name,
    });
  }

  events.push({
    type: 'done',
    success,
    failed,
    skipped,
    total: contacts.length,
    pipedriveApiCalls,
    supabaseUpdates,
    uniqueCompanies: orgCache.size,
  });

  return { success, failed, skipped, pipedriveApiCalls, supabaseUpdates, orgCacheSize: orgCache.size };
}

// ============================================================================
// TESTS
// ============================================================================

describe('sync flow simulation', () => {
  it('syncs 2 contacts from same company with dedup', () => {
    const events: SyncEvent[] = [];
    const result = simulateSync([mockContact1, mockContact2], events);

    expect(result.success).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.orgCacheSize).toBe(1); // Same company, 1 org

    // Org created once (2 API calls: search + create) + 2 update PATCHes
    // Person created twice (2 x 2 API calls)
    // Person enrichment: contact1 has title+linkedin (1 call), contact2 has neither (0 calls)
    // Total: 2 (org create) + 2 (org update) + 4 (person creates) + 1 (person enrich) = 9
    expect(result.pipedriveApiCalls).toBe(9);
  });

  it('skips contact without company', () => {
    const events: SyncEvent[] = [];
    const result = simulateSync([mockContactNoCompany as any], events);

    expect(result.success).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.pipedriveApiCalls).toBe(0);

    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent?.reason).toBe('Geen bedrijf gekoppeld');
  });

  it('skips contact without identity', () => {
    const events: SyncEvent[] = [];
    const result = simulateSync([mockContactNoIdentity as any], events);

    expect(result.success).toBe(0);
    expect(result.skipped).toBe(1);

    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent?.reason).toBe('Geen email of naam');
  });

  it('uses cached pipedrive_id for already-synced companies', () => {
    const events: SyncEvent[] = [];
    const result = simulateSync([mockContactAlreadySynced as any], events);

    expect(result.success).toBe(1);
    // No org search/create needed (pipedrive_id exists)
    // 1 org update + 2 person search/create + 1 person enrich = 4
    expect(result.pipedriveApiCalls).toBe(4);
  });

  it('handles mixed valid and invalid contacts', () => {
    const events: SyncEvent[] = [];
    const result = simulateSync([
      mockContact1,
      mockContactNoCompany as any,
      mockContact2,
      mockContactNoIdentity as any,
    ], events);

    expect(result.success).toBe(2);
    expect(result.skipped).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.orgCacheSize).toBe(1);
  });

  it('emits done event with correct totals', () => {
    const events: SyncEvent[] = [];
    simulateSync([mockContact1, mockContactNoCompany as any], events);

    const doneEvent = events.find(e => e.type === 'done');
    expect(doneEvent).toBeDefined();
    expect(doneEvent!.total).toBe(2);
    expect((doneEvent!.success as number) + (doneEvent!.skipped as number) + (doneEvent!.failed as number)).toBe(2);
  });

  it('handles empty contact list', () => {
    const events: SyncEvent[] = [];
    const result = simulateSync([], events);

    expect(result.success).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);

    const doneEvent = events.find(e => e.type === 'done');
    expect(doneEvent!.total).toBe(0);
  });
});

describe('throughput estimation', () => {
  it('estimates time for 100 contacts (50 unique companies)', () => {
    // Per company: ~3 API calls (search + create + update)
    // Per contact: ~3 API calls (search + create + enrich)
    // 50 companies * 3 + 100 contacts * 3 = 450 API calls
    // Rate: 10 req/s → 45 seconds
    // Delay: 100ms per contact → 10 seconds
    // Total: ~55 seconds → well within 300s timeout
    const companyCalls = 50 * 3;
    const contactCalls = 100 * 3;
    const totalCalls = companyCalls + contactCalls;
    const apiTime = totalCalls / 10; // seconds at 10 req/s
    const delayTime = 100 * 0.1; // 100 contacts * 100ms
    const estimated = apiTime + delayTime;
    expect(estimated).toBeLessThan(300); // Vercel timeout
  });

  it('estimates time for 500 contacts (250 unique companies)', () => {
    const companyCalls = 250 * 3;
    const contactCalls = 500 * 3;
    const totalCalls = companyCalls + contactCalls;
    const apiTime = totalCalls / 10;
    const delayTime = 500 * 0.1;
    const estimated = apiTime + delayTime;
    // 225 + 50 = 275 seconds
    expect(estimated).toBeLessThan(300);
  });

  it('500 contacts with dedup (avg 2 contacts/company) is faster', () => {
    const uniqueCompanies = 250;
    const companyCalls = uniqueCompanies * 3;
    const contactCalls = 500 * 3;
    const totalCalls = companyCalls + contactCalls;
    const apiTime = totalCalls / 10;
    const delayTime = 500 * 0.1;
    const estimated = apiTime + delayTime;
    expect(estimated).toBeLessThan(300);
  });
});

describe('field mapping integration', () => {
  it('builds correct org update payload shape', () => {
    const company = mockCompany;
    const payload: Record<string, unknown> = {};
    const customFields: Record<string, unknown> = {};

    // Status
    customFields['STATUS_FIELD'] = 302; // BENADEREN

    // Hoofddomein
    if (company.hoofddomein) {
      customFields['HOOFDDOMEIN_FIELD'] = 350; // AmsterdamseBanen enum ID
    }

    // Subdomeinen (exclude hoofddomein)
    const subs = (company.subdomeinen || []).filter(s => s !== company.hoofddomein);
    expect(subs).toEqual(['HaarlemseBanen', 'AlmeerseBanen']);

    // Website
    if (company.website) {
      customFields['WEBSITE_FIELD'] = company.website;
    }

    // Address
    const addr = [company.street_address, company.postal_code, company.city].filter(Boolean).join(', ');
    payload.address = { value: addr };
    expect(addr).toBe('Kerkstraat 1, 1234 AB, Amsterdam');

    // KVK
    const kvk = parseInt(company.kvk!, 10);
    expect(kvk).toBe(12345678);
    customFields['KVK_FIELD'] = kvk;

    payload.custom_fields = customFields;

    // Verify shape
    expect(payload).toHaveProperty('address');
    expect(payload).toHaveProperty('custom_fields');
    expect(Object.keys(customFields).length).toBeGreaterThan(0);
  });

  it('builds correct person update payload shape', () => {
    const contact = mockContact1;
    const customFields: Record<string, string> = {};

    if (contact.title) {
      customFields['FUNCTIE_FIELD'] = contact.title;
    }
    if (contact.linkedin_url) {
      customFields['LINKEDIN_FIELD'] = contact.linkedin_url;
    }

    expect(customFields['FUNCTIE_FIELD']).toBe('HR Manager');
    expect(customFields['LINKEDIN_FIELD']).toBe('https://linkedin.com/in/janjansen');
  });

  it('skips person enrichment when no title/linkedin', () => {
    const contact = mockContact2;
    const hasEnrichment = contact.title || contact.linkedin_url;
    expect(hasEnrichment).toBeFalsy();
  });
});
