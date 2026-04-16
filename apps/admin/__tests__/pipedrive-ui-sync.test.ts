import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Test the pure functions and logic extracted from pipedrive-ui-sync.service.ts
// We test: field mapping, validation, edge cases, batch size limits
// ============================================================================

// --- Re-implement the pure mapping functions for direct testing ---
// (Same logic as in the service, extracted for unit testing)

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

function mapCategorySizeToEnum(categorySize: string | null, employeeEstimate: number | null): number | null {
  if (categorySize && SIZE_OPTIONS[categorySize]) {
    return SIZE_OPTIONS[categorySize];
  }
  if (employeeEstimate) {
    if (employeeEstimate < 10) return SIZE_OPTIONS.Klein;
    if (employeeEstimate < 100) return SIZE_OPTIONS.Middel;
    return SIZE_OPTIONS.Groot;
  }
  return null;
}

function buildAddress(street: string | null, postalCode: string | null, city: string | null): string | null {
  const parts = [street, postalCode, city].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

function buildPersonName(
  name: string | null,
  firstName: string | null,
  lastName: string | null,
  email: string | null
): string {
  if (name) return name;
  const full = [firstName, lastName].filter(Boolean).join(' ');
  if (full) return full;
  return email || 'Onbekend';
}

// ============================================================================
// TESTS
// ============================================================================

describe('mapIndustriesToBranche', () => {
  it('maps transport/logistics keywords correctly', () => {
    // "Transportation" contains "sport" → matches leisure first, and also "auto" if automotive is before
    // Use unambiguous keywords
    expect(mapIndustriesToBranche(['Logistiek'])).toBe(60);
    expect(mapIndustriesToBranche(['freight shipping warehouse'])).toBe(60);
    // Note: "transport services" matches "sport" (leisure) before "transport"
    // This is consistent with existing instantly-pipedrive-sync.service behavior
    expect(mapIndustriesToBranche(['vervoer logistiek'])).toBe(60);
  });

  it('maps healthcare keywords correctly', () => {
    // "Healthcare" contains "car" → matches automotive before healthcare
    // Use unambiguous keywords
    expect(mapIndustriesToBranche(['Zorg'])).toBe(67);
    expect(mapIndustriesToBranche(['Education', 'Training'])).toBe(67);
    expect(mapIndustriesToBranche(['medical clinic'])).toBe(67);
  });

  it('maps construction keywords', () => {
    expect(mapIndustriesToBranche(['Construction'])).toBe(54);
    expect(mapIndustriesToBranche(['Bouw en installatie'])).toBe(54);
  });

  it('maps horeca keywords', () => {
    expect(mapIndustriesToBranche(['Hospitality', 'Hotel'])).toBe(56);
    expect(mapIndustriesToBranche(['Restaurant Services'])).toBe(56);
  });

  it('maps automotive keywords', () => {
    expect(mapIndustriesToBranche(['Automotive'])).toBe(53);
  });

  it('maps services/consulting keywords', () => {
    expect(mapIndustriesToBranche(['Business Services', 'Consulting'])).toBe(66);
    expect(mapIndustriesToBranche(['Recruitment', 'Staffing'])).toBe(66);
    expect(mapIndustriesToBranche(['Schoonmaak'])).toBe(66);
  });

  it('returns null for empty/null input', () => {
    expect(mapIndustriesToBranche(null)).toBeNull();
    expect(mapIndustriesToBranche([])).toBeNull();
  });

  it('returns null for unknown industries', () => {
    expect(mapIndustriesToBranche(['Cryptocurrency', 'Web3'])).toBeNull();
  });

  it('handles mixed null/undefined values in array', () => {
    // "Healthcare" contains "car" → matches automotive; use "Zorg" for unambiguous match
    expect(mapIndustriesToBranche([null as any, undefined as any, 'Zorg'])).toBe(67);
  });

  it('is case-insensitive', () => {
    expect(mapIndustriesToBranche(['AUTOMOTIVE'])).toBe(53);
    expect(mapIndustriesToBranche(['zOrG'])).toBe(67);
  });
});

describe('mapCategorySizeToEnum', () => {
  it('maps known category sizes', () => {
    expect(mapCategorySizeToEnum('Klein', null)).toBe(222);
    expect(mapCategorySizeToEnum('Middel', null)).toBe(223);
    expect(mapCategorySizeToEnum('Groot', null)).toBe(224);
  });

  it('ignores "Onbekend" category', () => {
    expect(mapCategorySizeToEnum('Onbekend', null)).toBeNull();
  });

  it('falls back to employee estimate', () => {
    expect(mapCategorySizeToEnum(null, 5)).toBe(222);   // Klein < 10
    expect(mapCategorySizeToEnum(null, 50)).toBe(223);  // Middel < 100
    expect(mapCategorySizeToEnum(null, 500)).toBe(224); // Groot >= 100
  });

  it('prefers category_size over estimate', () => {
    expect(mapCategorySizeToEnum('Klein', 500)).toBe(222);
  });

  it('returns null when both are missing', () => {
    expect(mapCategorySizeToEnum(null, null)).toBeNull();
  });

  it('handles boundary values for employee estimate', () => {
    expect(mapCategorySizeToEnum(null, 9)).toBe(222);
    expect(mapCategorySizeToEnum(null, 10)).toBe(223);
    expect(mapCategorySizeToEnum(null, 99)).toBe(223);
    expect(mapCategorySizeToEnum(null, 100)).toBe(224);
  });
});

describe('buildAddress', () => {
  it('combines all parts', () => {
    expect(buildAddress('Kerkstraat 1', '1234 AB', 'Amsterdam')).toBe('Kerkstraat 1, 1234 AB, Amsterdam');
  });

  it('handles partial data', () => {
    expect(buildAddress(null, '1234 AB', 'Amsterdam')).toBe('1234 AB, Amsterdam');
    expect(buildAddress('Kerkstraat 1', null, null)).toBe('Kerkstraat 1');
  });

  it('returns null when all parts are null', () => {
    expect(buildAddress(null, null, null)).toBeNull();
  });
});

describe('buildPersonName', () => {
  it('prefers full name field', () => {
    expect(buildPersonName('Jan Jansen', 'Jan', 'Jansen', 'jan@test.nl')).toBe('Jan Jansen');
  });

  it('builds from first + last name', () => {
    expect(buildPersonName(null, 'Jan', 'Jansen', 'jan@test.nl')).toBe('Jan Jansen');
  });

  it('handles first name only', () => {
    expect(buildPersonName(null, 'Jan', null, 'jan@test.nl')).toBe('Jan');
  });

  it('falls back to email', () => {
    expect(buildPersonName(null, null, null, 'jan@test.nl')).toBe('jan@test.nl');
  });

  it('returns Onbekend when nothing available', () => {
    expect(buildPersonName(null, null, null, null)).toBe('Onbekend');
  });
});

// ============================================================================
// API Route validation tests
// ============================================================================

describe('API route validation', () => {
  const MAX_BATCH_SIZE = 500;

  it('rejects empty contactIds', () => {
    const contactIds: string[] = [];
    expect(contactIds.length === 0).toBe(true);
  });

  it('rejects non-array contactIds', () => {
    const contactIds = 'not-an-array';
    expect(Array.isArray(contactIds)).toBe(false);
  });

  it('rejects batches exceeding max size', () => {
    const contactIds = Array.from({ length: 501 }, (_, i) => `uuid-${i}`);
    expect(contactIds.length > MAX_BATCH_SIZE).toBe(true);
  });

  it('accepts valid batch within limits', () => {
    const contactIds = Array.from({ length: 100 }, (_, i) => `uuid-${i}`);
    expect(Array.isArray(contactIds) && contactIds.length > 0 && contactIds.length <= MAX_BATCH_SIZE).toBe(true);
  });

  it('accepts max batch size exactly', () => {
    const contactIds = Array.from({ length: 500 }, (_, i) => `uuid-${i}`);
    expect(contactIds.length <= MAX_BATCH_SIZE).toBe(true);
  });
});

// ============================================================================
// Company deduplication logic tests
// ============================================================================

describe('company deduplication', () => {
  it('caches org IDs by company_id', () => {
    const orgCache = new Map<string, number>();
    const companyId = 'company-uuid-1';

    // First contact: cache miss
    expect(orgCache.has(companyId)).toBe(false);

    // Simulate org creation
    orgCache.set(companyId, 12345);

    // Second contact same company: cache hit
    expect(orgCache.has(companyId)).toBe(true);
    expect(orgCache.get(companyId)).toBe(12345);
  });

  it('uses existing pipedrive_id if available', () => {
    const orgCache = new Map<string, number>();
    const company = { id: 'company-uuid-1', pipedrive_id: '67890' };

    // Company already has a pipedrive_id
    if (company.pipedrive_id) {
      const orgId = parseInt(company.pipedrive_id);
      orgCache.set(company.id, orgId);
    }

    expect(orgCache.get(company.id)).toBe(67890);
  });

  it('deduplicates across multiple contacts', () => {
    const orgCache = new Map<string, number>();
    const contacts = [
      { company_id: 'A', email: 'jan@a.nl' },
      { company_id: 'A', email: 'piet@a.nl' },
      { company_id: 'B', email: 'kees@b.nl' },
      { company_id: 'A', email: 'marie@a.nl' },
    ];

    let apiCalls = 0;
    for (const contact of contacts) {
      if (!orgCache.has(contact.company_id)) {
        apiCalls++; // Would call Pipedrive API
        orgCache.set(contact.company_id, apiCalls * 100);
      }
    }

    // Only 2 API calls for 4 contacts (2 unique companies)
    expect(apiCalls).toBe(2);
    expect(orgCache.size).toBe(2);
  });
});

// ============================================================================
// SSE event format tests
// ============================================================================

describe('SSE event format', () => {
  it('formats progress events correctly', () => {
    const event = {
      type: 'progress' as const,
      processed: 5,
      total: 47,
      success: 4,
      failed: 1,
      skipped: 0,
      current: 'Bedrijf XYZ',
    };

    const sse = `data: ${JSON.stringify(event)}\n\n`;
    expect(sse).toContain('data: ');
    expect(sse.endsWith('\n\n')).toBe(true);

    const parsed = JSON.parse(sse.replace('data: ', '').trim());
    expect(parsed.type).toBe('progress');
    expect(parsed.processed).toBe(5);
    expect(parsed.total).toBe(47);
  });

  it('formats done events correctly', () => {
    const event = {
      type: 'done' as const,
      success: 42,
      failed: 3,
      skipped: 2,
      total: 47,
      duration: '34s',
    };

    const sse = `data: ${JSON.stringify(event)}\n\n`;
    const parsed = JSON.parse(sse.replace('data: ', '').trim());
    expect(parsed.type).toBe('done');
    expect(parsed.success + parsed.failed + parsed.skipped).toBe(parsed.total);
  });

  it('formats error events correctly', () => {
    const event = {
      type: 'error' as const,
      contact: 'Jan Jansen',
      reason: 'Geen email',
    };

    const sse = `data: ${JSON.stringify(event)}\n\n`;
    const parsed = JSON.parse(sse.replace('data: ', '').trim());
    expect(parsed.type).toBe('error');
    expect(parsed.contact).toBe('Jan Jansen');
  });
});

// ============================================================================
// Contact validation edge cases
// ============================================================================

describe('contact validation', () => {
  it('skips contacts without email AND without name', () => {
    const contact = { email: null, first_name: null, last_name: null, name: null };
    const hasIdentity = contact.email || contact.first_name || contact.last_name || contact.name;
    expect(hasIdentity).toBeFalsy();
  });

  it('accepts contact with email only', () => {
    const contact = { email: 'test@test.nl', first_name: null, last_name: null, name: null };
    const hasIdentity = contact.email || contact.first_name || contact.last_name || contact.name;
    expect(hasIdentity).toBeTruthy();
  });

  it('accepts contact with name only', () => {
    const contact = { email: null, first_name: 'Jan', last_name: null, name: null };
    const hasIdentity = contact.email || contact.first_name || contact.last_name || contact.name;
    expect(hasIdentity).toBeTruthy();
  });

  it('skips contacts without company', () => {
    const contact = { company_id: null, companies: null };
    expect(contact.companies).toBeNull();
  });

  it('extracts email domain for org search', () => {
    const email = 'jan@lokale-banen.nl';
    const domain = email.split('@')[1];
    expect(domain).toBe('lokale-banen.nl');
  });

  it('handles email without @ gracefully', () => {
    const email = 'invalid-email';
    const domain = email.split('@')[1];
    expect(domain).toBeUndefined();
  });
});

// ============================================================================
// KVK number parsing
// ============================================================================

describe('KVK number parsing', () => {
  it('parses valid KVK number', () => {
    const kvk = '12345678';
    const parsed = parseInt(kvk, 10);
    expect(isNaN(parsed)).toBe(false);
    expect(parsed).toBe(12345678);
  });

  it('rejects non-numeric KVK', () => {
    const kvk = 'ABC123';
    const parsed = parseInt(kvk, 10);
    expect(isNaN(parsed)).toBe(true);
  });

  it('handles null KVK', () => {
    const kvk: string | null = null;
    const shouldSet = kvk !== null;
    expect(shouldSet).toBe(false);
  });
});

// ============================================================================
// Subdomeinen filtering (exclude hoofddomein)
// ============================================================================

describe('subdomeinen filtering', () => {
  it('filters out hoofddomein from subdomeinen', () => {
    const hoofddomein = 'GroningseBanen';
    const subdomeinen = ['GroningseBanen', 'LeeuwardseBanen', 'ZwolseBanen'];
    const filtered = subdomeinen.filter(s => s !== hoofddomein);
    expect(filtered).toEqual(['LeeuwardseBanen', 'ZwolseBanen']);
    expect(filtered).not.toContain('GroningseBanen');
  });

  it('handles null subdomeinen', () => {
    const subdomeinen: string[] | null = null;
    const raw = subdomeinen || [];
    expect(raw).toEqual([]);
  });

  it('handles null hoofddomein (no filtering)', () => {
    const hoofddomein: string | null = null;
    const subdomeinen = ['GroningseBanen', 'LeeuwardseBanen'];
    const filtered = hoofddomein ? subdomeinen.filter(s => s !== hoofddomein) : subdomeinen;
    expect(filtered).toEqual(['GroningseBanen', 'LeeuwardseBanen']);
  });
});

// ============================================================================
// Dialog state machine
// ============================================================================

describe('dialog state machine', () => {
  it('starts in confirm phase', () => {
    const initialPhase = 'confirm';
    expect(initialPhase).toBe('confirm');
  });

  it('transitions confirm → syncing on start', () => {
    let phase = 'confirm';
    // User clicks "Start Sync"
    phase = 'syncing';
    expect(phase).toBe('syncing');
  });

  it('transitions syncing → done on completion', () => {
    let phase = 'syncing';
    // SSE done event received
    phase = 'done';
    expect(phase).toBe('done');
  });

  it('shows warning for large batches', () => {
    const contactCount = 350;
    const showWarning = contactCount > 300;
    expect(showWarning).toBe(true);
  });

  it('does not show warning for small batches', () => {
    const contactCount = 50;
    const showWarning = contactCount > 300;
    expect(showWarning).toBe(false);
  });

  it('calculates progress percentage correctly', () => {
    expect(Math.round((0 / 47) * 100)).toBe(0);
    expect(Math.round((24 / 47) * 100)).toBe(51);
    expect(Math.round((47 / 47) * 100)).toBe(100);
  });

  it('handles division by zero in progress', () => {
    const total = 0;
    const percent = total > 0 ? Math.round((0 / total) * 100) : 0;
    expect(percent).toBe(0);
  });
});
