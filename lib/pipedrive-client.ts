import { createServiceRoleClient } from './supabase-server';

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_API_URL = process.env.PIPEDRIVE_API_URL || 'https://api.pipedrive.com/v1';
const PIPEDRIVE_API_V2_URL = process.env.PIPEDRIVE_API_V2_URL || 'https://lokalebanen.pipedrive.com/api/v2';

// Status prospect field ID for organizations
const STATUS_PROSPECT_FIELD_ID = 'e8a27f47529d2091399f063b834339316d7d852a';

// Hoofddomein field ID for organizations (platform name like "GroningseBanen")
const HOOFDDOMEIN_FIELD_ID = '7180a7123d1de658e8d1d642b8496802002ddc66';

// Subdomein field ID for organizations (multi-select: other platforms where company has vacancies)
const SUBDOMEIN_FIELD_ID = '2a8e7ff62fa14d0c69b48fb025d0bdf80c04a28c';

// Mapping of platform names to Pipedrive enum IDs for Hoofddomein field
const HOOFDDOMEIN_OPTIONS: Record<string, number> = {
  // Original platforms
  'AalsmeerseBanen': 88,
  'AlmeerseBanen': 89,
  'AlphenseBanen': 90,
  'ApeldoornseBanen': 91,
  'BarendrechtseBanen': 92,
  'BollenstreekseBanen': 93,
  'DelftseBanen': 94,
  'DrechtseBanen': 95,
  'GoudseBanen': 96,
  'HaagseBanen': 97,
  'HoekscheBanen': 98,
  'HoofddorpseBanen': 99,
  'LansingerlandseBanen': 100,
  'LeidseBanen': 101,
  'OosterhoutseBanen': 336,
  'SchiedamseBanen': 102,
  'VeghelseBanen': 103,
  'VoornseBanen': 104,
  'WestlandseBanen': 105,
  'WoerdenseBanen': 106,
  'ZoetermeerseBanen': 107,
  'ZundertseBanen': 108,
  'ZwolseBanen': 220,
  'AlkmaarseBanen': 221,
  'ZaanseBanen': 298,
  'TilburgseBanen': 299,
  'HaarlemseBanen': 300,
  'MaasluisseBanen': 338,
  'VlaardingseBanen': 339,
  // Newly added platforms
  'AchterhoekseBanen': 347,
  'AlmeloseBanen': 348,
  'AmersfoortseBanen': 349,
  'AmsterdamseBanen': 350,
  'ArnhemseBanen': 351,
  'AssenseBanen': 352,
  'BosscheBanen': 353,
  'BredaseBanen': 354,
  'DeventerseBanen': 355,
  'EindhovenseBanen': 356,
  'EmmeloordseBanen': 357,
  'EmmenseBanen': 358,
  'EnschedeseBanen': 359,
  'GroningseBanen': 360,
  'HarderwijkseBanen': 361,
  'HeerenveenseBanen': 362,
  'LeeuwardseBanen': 363,
  'MaastrichtseBanen': 364,
  'Nijmegensebanen': 365,
  'RotterdamseBanen': 366,
  'UtrechtseBanen': 367,
  'VenloseBanen': 368,
  'WeerterseBanen': 369,
  'ZeeuwseBanen': 370,
};

// Status prospect options (IDs from Pipedrive)
const STATUS_PROSPECT_OPTIONS = {
  BENADEREN: 302,
  KLANT: 303,
  NIET_MEER_BENADEREN: 304,
  OPNIEUW_BENADEREN: 305,
  IN_ONDERHANDELING: 322,
  // Instantly integration statuses
  IN_CAMPAGNE: 345,              // "In campagne Instantly"
  NIET_GEREAGEERD_INSTANTLY: 344 // "Niet gereageerd Instantly"
};

// Subdomein options - mapping platform names to Pipedrive enum IDs
// Note: Subdomein is a multi-select (set) field with its own enum IDs
// These IDs are different from HOOFDDOMEIN_OPTIONS!
const SUBDOMEIN_OPTIONS: Record<string, number> = {
  'AalsmeerseBanen': 109,
  'AchterhoekseBanen': 388,
  'AlkmaarseBanen': 395,
  'AlmeerseBanen': 420,
  'AlmeloseBanen': 410,
  'AlphenseBanen': 373,
  'AmersfoortseBanen': 411,
  'AmsterdamseBanen': 419,
  'ApeldoornseBanen': 414,
  'ArnhemseBanen': 391,
  'AssenseBanen': 412,
  'BarendrechtseBanen': 112,
  'BollenstreekseBanen': 114,
  'BosscheBanen': 372,
  'BredaseBanen': 421,
  'DelftseBanen': 404,
  'DeventerseBanen': 377,
  'DrechtseBanen': 398,
  'EindhovenseBanen': 394,
  'EmmeloordseBanen': 402,
  'EmmenseBanen': 393,
  'EnschedeseBanen': 401,
  'GoudseBanen': 416,
  'GroningseBanen': 405,
  'HaagseBanen': 120,
  'HaarlemseBanen': 417,
  'HarderwijkseBanen': 409,
  'HeerenveenseBanen': 386,
  'HelderseBanen': 424, // May need to be added to Pipedrive
  'HoekscheBanen': 380,
  'HoofddorpseBanen': 422,
  'KerkraadseBanen': 425, // May need to be added to Pipedrive
  'LansingerlandseBanen': 123,
  'LeeuwardseBanen': 390,
  'LeidseBanen': 403,
  'MaasluisseBanen': 407,
  'MaastrichtseBanen': 385,
  'NijmegenseBanen': 381, // Note: using lowercase 's' variant ID
  'Nijmegensebanen': 381,
  'OosterhoutseBanen': 383,
  'RotterdamseBanen': 382,
  'SchiedamseBanen': 379,
  'TilburgseBanen': 387,
  'UtrechtseBanen': 374,
  'VenloseBanen': 375,
  'VlaardingeseBanen': 384,
  'VoornseBanen': 406,
  'WeerterseBanen': 415,
  'WestlandseBanen': 126,
  'WoerdenseBanen': 392,
  'ZaanseBanen': 397,
  'ZeeuwseBanen': 413,
  'ZoetermeerseBanen': 376,
  'ZwolseBanen': 423,
};

// Export for use in other modules
export { STATUS_PROSPECT_FIELD_ID, STATUS_PROSPECT_OPTIONS, HOOFDDOMEIN_FIELD_ID, SUBDOMEIN_FIELD_ID, HOOFDDOMEIN_OPTIONS, SUBDOMEIN_OPTIONS };

// Status labels for display/logging
export const STATUS_PROSPECT_LABELS: Record<string, string> = {
  BENADEREN: 'Benaderen',
  KLANT: 'Klant',
  NIET_MEER_BENADEREN: 'Niet meer Benaderen',
  OPNIEUW_BENADEREN: 'Opnieuw Benaderen',
  IN_ONDERHANDELING: 'In onderhandeling',
  IN_CAMPAGNE: 'In campagne Instantly',
  NIET_GEREAGEERD_INSTANTLY: 'Niet gereageerd Instantly'
};

// Protected statuses that should not be overwritten by Instantly sync
export const PROTECTED_STATUSES = [
  STATUS_PROSPECT_OPTIONS.KLANT,
  STATUS_PROSPECT_OPTIONS.IN_ONDERHANDELING
];

// Status priority for determining which status takes precedence
// Higher number = higher priority
export const STATUS_PRIORITY: Record<number, number> = {
  [STATUS_PROSPECT_OPTIONS.KLANT]: 100,
  [STATUS_PROSPECT_OPTIONS.IN_ONDERHANDELING]: 90,
  [STATUS_PROSPECT_OPTIONS.BENADEREN]: 80,
  [STATUS_PROSPECT_OPTIONS.IN_CAMPAGNE]: 50,
  [STATUS_PROSPECT_OPTIONS.NIET_GEREAGEERD_INSTANTLY]: 40,
  [STATUS_PROSPECT_OPTIONS.OPNIEUW_BENADEREN]: 30,
  [STATUS_PROSPECT_OPTIONS.NIET_MEER_BENADEREN]: 10
};

export interface PipedriveOrganization {
  id?: number;
  name: string;
  owner_id?: number;
  visible_to?: number;
  address?: {
    value?: string;
    country?: string;
    admin_area_level_1?: string;
    admin_area_level_2?: string;
    locality?: string;
    sublocality?: string;
    route?: string;
    street_number?: string;
    postal_code?: string;
  };
  custom_fields?: {
    [key: string]: any;
  };
  [key: string]: any; // For other fields
}

export interface PipedrivePerson {
  id?: number;
  name: string;
  org_id?: number;
  owner_id?: number;
  email?: Array<{ value: string; primary?: boolean }>;
  phone?: Array<{ value: string; primary?: boolean }>;
  visible_to?: number;
  [key: string]: any; // For custom fields
}

export class PipedriveClient {
  private apiKey: string;
  private baseUrl: string;
  private baseUrlV2: string;

  constructor() {
    if (!PIPEDRIVE_API_KEY) {
      throw new Error('PIPEDRIVE_API_KEY is not configured');
    }
    this.apiKey = PIPEDRIVE_API_KEY;
    this.baseUrl = PIPEDRIVE_API_URL;
    this.baseUrlV2 = PIPEDRIVE_API_V2_URL;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make an API request to Pipedrive V1 with exponential backoff retry
   */
  private async request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    data?: any,
    retryCount: number = 0
  ) {
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 1000;

    const url = `${this.baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_token=${this.apiKey}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      // Handle rate limits with exponential backoff
      if (response.status === 429) {
        if (retryCount >= MAX_RETRIES) {
          throw new Error(`Pipedrive API rate limit exceeded after ${MAX_RETRIES} retries`);
        }

        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount);
        console.log(`⏳ Rate limited by Pipedrive API, waiting ${delayMs}ms before retry ${retryCount + 1}/${MAX_RETRIES}...`);
        await this.delay(delayMs);

        return this.request(method, endpoint, data, retryCount + 1);
      }

      // Handle server errors (5xx) with retry
      if (response.status >= 500 && response.status < 600) {
        if (retryCount >= MAX_RETRIES) {
          throw new Error(`Pipedrive API server error ${response.status} after ${MAX_RETRIES} retries`);
        }

        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount);
        console.log(`⏳ Server error from Pipedrive API (${response.status}), waiting ${delayMs}ms before retry ${retryCount + 1}/${MAX_RETRIES}...`);
        await this.delay(delayMs);

        return this.request(method, endpoint, data, retryCount + 1);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error Response:`, errorText.substring(0, 500));
        throw new Error(`Pipedrive API error: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      let result;

      try {
        result = JSON.parse(responseText);
      } catch (parseError: any) {
        console.error(`❌ JSON Parse Error. Response text:`, responseText.substring(0, 500));
        throw new Error(`Invalid JSON response from Pipedrive API: ${parseError.message}`);
      }

      if (!result.success) {
        throw new Error(result.error || 'Pipedrive API request failed');
      }

      return result.data;
    } catch (error) {
      // Handle network errors with retry
      if (error instanceof TypeError && error.message.includes('fetch')) {
        if (retryCount >= MAX_RETRIES) {
          throw new Error(`Network error connecting to Pipedrive API after ${MAX_RETRIES} retries: ${error.message}`);
        }

        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount);
        console.log(`⏳ Network error, waiting ${delayMs}ms before retry ${retryCount + 1}/${MAX_RETRIES}...`);
        await this.delay(delayMs);

        return this.request(method, endpoint, data, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Make an API request to Pipedrive V2 with exponential backoff retry
   */
  private async requestV2(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    data?: any,
    retryCount: number = 0
  ) {
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 1000;

    const url = `${this.baseUrlV2}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_token=${this.apiKey}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      // Handle rate limits with exponential backoff
      if (response.status === 429) {
        if (retryCount >= MAX_RETRIES) {
          throw new Error(`Pipedrive V2 API rate limit exceeded after ${MAX_RETRIES} retries`);
        }

        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount);
        console.log(`⏳ Rate limited by Pipedrive V2 API, waiting ${delayMs}ms before retry ${retryCount + 1}/${MAX_RETRIES}...`);
        await this.delay(delayMs);

        return this.requestV2(method, endpoint, data, retryCount + 1);
      }

      // Handle server errors (5xx) with retry
      if (response.status >= 500 && response.status < 600) {
        if (retryCount >= MAX_RETRIES) {
          throw new Error(`Pipedrive V2 API server error ${response.status} after ${MAX_RETRIES} retries`);
        }

        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount);
        console.log(`⏳ Server error from Pipedrive V2 API (${response.status}), waiting ${delayMs}ms before retry ${retryCount + 1}/${MAX_RETRIES}...`);
        await this.delay(delayMs);

        return this.requestV2(method, endpoint, data, retryCount + 1);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ V2 API Error Response:`, errorText.substring(0, 500));
        throw new Error(`Pipedrive V2 API error: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      let result;

      try {
        result = JSON.parse(responseText);
      } catch (parseError: any) {
        console.error(`❌ V2 JSON Parse Error. Response text:`, responseText.substring(0, 500));
        throw new Error(`Invalid JSON response from Pipedrive V2 API: ${parseError.message}`);
      }

      if (!result.success) {
        throw new Error(result.error || 'Pipedrive V2 API request failed');
      }

      return result.data;
    } catch (error) {
      // Handle network errors with retry
      if (error instanceof TypeError && error.message.includes('fetch')) {
        if (retryCount >= MAX_RETRIES) {
          throw new Error(`Network error connecting to Pipedrive V2 API after ${MAX_RETRIES} retries: ${error.message}`);
        }

        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount);
        console.log(`⏳ Network error, waiting ${delayMs}ms before retry ${retryCount + 1}/${MAX_RETRIES}...`);
        await this.delay(delayMs);

        return this.requestV2(method, endpoint, data, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Search for an organization by name or domain
   */
  async searchOrganization(name: string): Promise<any[]> {
    try {
      const searchTerm = encodeURIComponent(name);
      const data = await this.request('GET', `/organizations/search?term=${searchTerm}&fields=name`);
      return data?.items || [];
    } catch (error) {
      console.error('Error searching organization:', error);
      return [];
    }
  }

  /**
   * Create a new organization in Pipedrive
   */
  async createOrganization(org: PipedriveOrganization): Promise<any> {
    const data = await this.request('POST', '/organizations', org);
    return data;
  }

  /**
   * Update an organization in Pipedrive
   */
  async updateOrganization(id: number, updates: Partial<PipedriveOrganization>): Promise<any> {
    console.log(`📝 PATCH /organizations/${id} with payload:`, JSON.stringify(updates, null, 2));
    const data = await this.request('PATCH', `/organizations/${id}`, updates);
    return data;
  }

  /**
   * Get an organization by ID
   */
  async getOrganization(id: number): Promise<any> {
    const data = await this.request('GET', `/organizations/${id}`);
    return data;
  }

  /**
   * Search for a person by email (V2 API)
   */
  async searchPersonByEmail(email: string): Promise<any[]> {
    try {
      const searchTerm = encodeURIComponent(email);
      // V2 API: search by term with optional limit
      const data = await this.requestV2('GET', `/persons/search?term=${searchTerm}&limit=5`);
      return data?.items || [];
    } catch (error) {
      console.error('Error searching person:', error);
      return [];
    }
  }

  /**
   * Create a new person in Pipedrive (V2 API)
   */
  async createPerson(person: PipedrivePerson): Promise<any> {
    // V2 API uses 'emails' instead of 'email'
    const v2PersonData: any = {
      name: person.name,
      org_id: person.org_id,
      visible_to: person.visible_to
    };

    // Convert email to emails format for V2 API
    if (person.email && Array.isArray(person.email)) {
      v2PersonData.emails = person.email.map(e => ({
        value: e.value,
        primary: e.primary || false
      }));
    }

    // Add phone if present
    if (person.phone && Array.isArray(person.phone)) {
      v2PersonData.phones = person.phone.map(p => ({
        value: p.value,
        primary: p.primary || false
      }));
    }

    const data = await this.requestV2('POST', '/persons', v2PersonData);
    return data;
  }

  /**
   * Update a person in Pipedrive (V2 API)
   */
  async updatePerson(id: number, updates: Partial<PipedrivePerson>): Promise<any> {
    // V2 API uses 'emails' instead of 'email'
    const v2Updates: any = { ...updates };

    // Convert email to emails format for V2 API if present
    if (updates.email && Array.isArray(updates.email)) {
      v2Updates.emails = updates.email.map(e => ({
        value: e.value,
        primary: e.primary || false
      }));
      delete v2Updates.email;
    }

    // Convert phone to phones format for V2 API if present
    if (updates.phone && Array.isArray(updates.phone)) {
      v2Updates.phones = updates.phone.map(p => ({
        value: p.value,
        primary: p.primary || false
      }));
      delete v2Updates.phone;
    }

    const data = await this.requestV2('PATCH', `/persons/${id}`, v2Updates);
    return data;
  }

  /**
   * Get a person by ID (V2 API)
   */
  async getPerson(id: number): Promise<any> {
    const data = await this.requestV2('GET', `/persons/${id}`);
    return data;
  }

  /**
   * Block an organization in Pipedrive
   */
  async blockOrganization(organizationId: number): Promise<any> {
    const updates = {
      custom_fields: {
        [STATUS_PROSPECT_FIELD_ID]: STATUS_PROSPECT_OPTIONS.NIET_MEER_BENADEREN
      }
    };
    return await this.updateOrganization(organizationId, updates);
  }

  /**
   * Unblock an organization in Pipedrive
   */
  async unblockOrganization(organizationId: number): Promise<any> {
    const updates = {
      custom_fields: {
        [STATUS_PROSPECT_FIELD_ID]: STATUS_PROSPECT_OPTIONS.BENADEREN
      }
    };
    return await this.updateOrganization(organizationId, updates);
  }

  /**
   * Block a person in Pipedrive
   * NOTE: Status prospect field is only available at organization level, not person level
   * For persons, we can only add a note indicating they are blocked
   */
  async blockPerson(personId: number): Promise<any> {
    // Status prospect field is not available for persons, only organizations
    // We'll return success but log that blocking is not available at person level
    return { success: true, message: 'Person-level blocking not available in Pipedrive, note will be added' };
  }

  /**
   * Unblock a person in Pipedrive
   * NOTE: Status prospect field is only available at organization level, not person level
   */
  async unblockPerson(personId: number): Promise<any> {
    // Status prospect field is not available for persons, only organizations
    return { success: true, message: 'Person-level unblocking not available in Pipedrive' };
  }

  /**
   * Find or create a person by email address
   */
  async findOrCreatePersonByEmail(email: string, organizationId?: number): Promise<number | null> {
    try {
      // First, search for existing person by email
      const existingPersons = await this.searchPersonByEmail(email);

      if (existingPersons.length > 0) {
        const personId = existingPersons[0].item.id;
        return personId;
      }

      // Create new person with correct format for V2 API
      const personData: PipedrivePerson = {
        name: email, // Use email as name since we don't have a name
        email: [{ value: email, primary: true }], // This will be converted to 'emails' in createPerson
        org_id: organizationId,
        visible_to: 3 // Visible to all users
      };

      const newPerson = await this.createPerson(personData);
      const personId = newPerson.id;

      return personId;

    } catch (error) {
      console.error(`Error finding/creating person for email ${email}:`, error);
      return null;
    }
  }

  /**
   * Add a note to an organization (using V1 API - notes endpoint is not available in V2)
   */
  async addOrganizationNote(organizationId: number, content: string): Promise<any> {
    // IMPORTANT: Notes endpoint must use V1 API with explicit URL
    const v1BaseUrl = 'https://api.pipedrive.com/v1';
    const url = `${v1BaseUrl}/notes?api_token=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        content,
        org_id: organizationId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ V1 Notes API Error Response:`, errorText.substring(0, 500));
      throw new Error(`Notes API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Add a note to a person (using V1 API - notes endpoint is not available in V2)
   */
  async addPersonNote(personId: number, content: string): Promise<any> {
    // IMPORTANT: Notes endpoint must use V1 API with explicit URL
    const v1BaseUrl = 'https://api.pipedrive.com/v1';
    const url = `${v1BaseUrl}/notes?api_token=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        content,
        person_id: personId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ V1 Notes API Error Response:`, errorText.substring(0, 500));
      throw new Error(`Notes API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * List notes for an organization (V1 API)
   */
  async listOrganizationNotes(organizationId: number): Promise<any[]> {
    const v1BaseUrl = 'https://api.pipedrive.com/v1';
    const url = `${v1BaseUrl}/organizations/${organizationId}/notes?api_token=${this.apiKey}&sort=add_time DESC&start=0&limit=50`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ V1 Notes List API Error:`, errorText.substring(0, 500));
      throw new Error(`Notes List API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || [];
  }

  /**
   * Update a note's content (V1 API)
   */
  async updateNote(noteId: number, content: string): Promise<any> {
    const v1BaseUrl = 'https://api.pipedrive.com/v1';
    const url = `${v1BaseUrl}/notes/${noteId}?api_token=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ V1 Notes Update API Error:`, errorText.substring(0, 500));
      throw new Error(`Notes Update API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Add an activity (email, call, meeting, etc.) to Pipedrive
   * @param activity - The activity data
   */
  async addActivity(activity: {
    subject: string;
    type?: string; // 'email', 'call', 'meeting', 'task', etc.
    done?: boolean;
    due_date?: string; // YYYY-MM-DD
    due_time?: string; // HH:MM
    duration?: string; // HH:MM
    org_id?: number;
    person_id?: number;
    deal_id?: number;
    note?: string;
    public_description?: string;
  }): Promise<any> {
    // Activities endpoint uses V1 API
    const v1BaseUrl = 'https://api.pipedrive.com/v1';
    const url = `${v1BaseUrl}/activities?api_token=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        ...activity,
        done: activity.done ?? true // Default to done/completed
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Activities API Error Response:`, errorText.substring(0, 500));
      throw new Error(`Activities API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Add an email activity to Pipedrive
   * @param orgId - Organization ID
   * @param personId - Person ID
   * @param email - Email details
   */
  async addEmailActivity(
    orgId: number,
    personId: number,
    email: {
      subject: string;
      body?: string;
      date: string; // ISO date string
      direction: 'sent' | 'received';
    }
  ): Promise<any> {
    const directionLabel = email.direction === 'sent' ? '➡️ Verzonden' : '⬅️ Ontvangen';
    const emailDate = new Date(email.date);
    const dueDate = emailDate.toISOString().split('T')[0];
    const dueTime = emailDate.toTimeString().substring(0, 5);

    return this.addActivity({
      subject: `${directionLabel}: ${email.subject}`,
      type: 'email',
      done: true,
      due_date: dueDate,
      due_time: dueTime,
      org_id: orgId,
      person_id: personId,
      note: email.body?.substring(0, 2000) || '', // Pipedrive has a limit
      public_description: `Email ${email.direction === 'sent' ? 'verzonden naar' : 'ontvangen van'} contact via Instantly campagne`
    });
  }

  /**
   * Sync a company to Pipedrive (create or update)
   */
  async syncCompanyToPipedrive(companyId: string): Promise<number | null> {
    const supabase = createServiceRoleClient()

    try {
      // Get company from Supabase
      const { data: company, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (error || !company) {
        throw new Error('Company not found');
      }

      let pipedriveId: number;

      if (company.pipedrive_id) {
        // Company already has Pipedrive ID, just return it
        pipedriveId = parseInt(company.pipedrive_id);
      } else {
        // Search for existing organization
        const existingOrgs = await this.searchOrganization(company.name);

        if (existingOrgs.length > 0) {
          // Use first match
          pipedriveId = existingOrgs[0].item.id;
        } else {
          // Create new organization
          const newOrg = await this.createOrganization({
            name: company.name,
            owner_id: 22971285
          });
          pipedriveId = newOrg.id;
        }

        // Update company with Pipedrive ID
        const updateResult = await supabase
          .from('companies')
          .update({
            pipedrive_id: pipedriveId.toString(),
            pipedrive_synced: true,
            pipedrive_synced_at: new Date().toISOString()
          })
          .eq('id', companyId);

        if (updateResult.error) {
          console.log(`❌ Failed to update company:`, updateResult.error)
        } else {
          console.log(`✅ Successfully updated company with Pipedrive ID`)
        }
      }

      return pipedriveId;
    } catch (error) {
      console.error('Error syncing company to Pipedrive:', error);
      return null;
    }
  }

  /**
   * Sync a contact to Pipedrive (create or update)
   */
  async syncContactToPipedrive(contactId: string): Promise<number | null> {
    const supabase = createServiceRoleClient()

    try {
      // Get contact from Supabase
      const { data: contact, error } = await supabase
        .from('contacts')
        .select('*, companies(*)')
        .eq('id', contactId)
        .single();

      if (error || !contact) {
        throw new Error('Contact not found');
      }

      let pipedrivePersonId: number;

      if (contact.pipedrive_person_id) {
        // Contact already has Pipedrive ID
        pipedrivePersonId = parseInt(contact.pipedrive_person_id);
      } else {
        // Ensure company is synced first
        let orgId: number | null = null;
        if (contact.company_id) {
          orgId = await this.syncCompanyToPipedrive(contact.company_id);
        }

        // Search for existing person
        const existingPersons = contact.email ?
          await this.searchPersonByEmail(contact.email) : [];

        if (existingPersons.length > 0) {
          // Use first match
          pipedrivePersonId = existingPersons[0].item.id;
        } else {
          // Create new person
          const personData: PipedrivePerson = {
            name: contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
            org_id: orgId || undefined,
            visible_to: 3 // Visible to all users
          };

          if (contact.email) {
            personData.email = [{ value: contact.email, primary: true }];
          }

          if (contact.phone) {
            personData.phone = [{ value: contact.phone, primary: true }];
          }

          const newPerson = await this.createPerson(personData);
          pipedrivePersonId = newPerson.id;
        }

        // Update contact with Pipedrive ID
        await supabase
          .from('contacts')
          .update({
            pipedrive_person_id: pipedrivePersonId.toString(),
            pipedrive_synced: true,
            pipedrive_synced_at: new Date().toISOString()
          })
          .eq('id', contactId);
      }

      return pipedrivePersonId;
    } catch (error) {
      console.error('Error syncing contact to Pipedrive:', error);
      return null;
    }
  }

  // ============================================================================
  // INSTANTLY INTEGRATION METHODS
  // ============================================================================

  /**
   * Get the current status prospect value for an organization
   * @param orgId - The Pipedrive organization ID
   * @returns The current status prospect ID or null
   */
  async getOrganizationStatusProspect(orgId: number): Promise<number | null> {
    try {
      const org = await this.getOrganization(orgId);
      if (!org) return null;

      // The custom field value is stored directly on the org object
      const statusValue = org[STATUS_PROSPECT_FIELD_ID];
      return statusValue ? parseInt(statusValue) : null;
    } catch (error) {
      console.error(`Error getting status prospect for org ${orgId}:`, error);
      return null;
    }
  }

  /**
   * Check if an organization has a protected status that should not be overwritten
   * @param orgId - The Pipedrive organization ID
   */
  async hasProtectedStatus(orgId: number): Promise<boolean> {
    const currentStatus = await this.getOrganizationStatusProspect(orgId);
    if (!currentStatus) return false;
    return PROTECTED_STATUSES.includes(currentStatus);
  }

  /**
   * Set the status prospect for an organization
   * @param orgId - The Pipedrive organization ID
   * @param statusKey - The status key (e.g., 'BENADEREN', 'IN_CAMPAGNE')
   * @param force - Force update even if current status has higher priority
   */
  async setOrganizationStatusProspect(
    orgId: number,
    statusKey: keyof typeof STATUS_PROSPECT_OPTIONS,
    force: boolean = false
  ): Promise<{ success: boolean; skipped: boolean; reason?: string }> {
    try {
      const newStatusId = STATUS_PROSPECT_OPTIONS[statusKey];

      if (!newStatusId || newStatusId === 0) {
        return {
          success: false,
          skipped: true,
          reason: `Status ${statusKey} has no valid ID configured`
        };
      }

      // Get current status
      const currentStatus = await this.getOrganizationStatusProspect(orgId);

      // Check if current status is protected
      if (!force && currentStatus && PROTECTED_STATUSES.includes(currentStatus)) {
        const currentLabel = Object.entries(STATUS_PROSPECT_OPTIONS)
          .find(([_, id]) => id === currentStatus)?.[0] || 'Unknown';
        return {
          success: false,
          skipped: true,
          reason: `Organization has protected status: ${currentLabel}`
        };
      }

      // Check priority (higher priority status wins)
      if (!force && currentStatus) {
        const currentPriority = STATUS_PRIORITY[currentStatus] || 0;
        const newPriority = STATUS_PRIORITY[newStatusId] || 0;

        if (currentPriority > newPriority) {
          const currentLabel = Object.entries(STATUS_PROSPECT_OPTIONS)
            .find(([_, id]) => id === currentStatus)?.[0] || 'Unknown';
          return {
            success: false,
            skipped: true,
            reason: `Current status ${currentLabel} has higher priority`
          };
        }
      }

      // Update the status
      await this.updateOrganization(orgId, {
        custom_fields: {
          [STATUS_PROSPECT_FIELD_ID]: newStatusId
        }
      });

      console.log(`✅ Set status prospect for org ${orgId} to ${statusKey} (${newStatusId})`);
      return { success: true, skipped: false };
    } catch (error) {
      console.error(`Error setting status prospect for org ${orgId}:`, error);
      return {
        success: false,
        skipped: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Search for an organization by email domain
   * @param domain - The email domain (e.g., 'acme.nl')
   */
  async searchOrganizationByDomain(domain: string): Promise<any[]> {
    try {
      // Clean the domain
      const cleanDomain = domain.toLowerCase().trim().replace(/^@/, '');

      // Search in notes, custom fields, and name
      const searchTerm = encodeURIComponent(cleanDomain);
      const data = await this.request(
        'GET',
        `/organizations/search?term=${searchTerm}&fields=notes,custom_fields,name`
      );
      return data?.items || [];
    } catch (error) {
      console.error('Error searching organization by domain:', error);
      return [];
    }
  }

  /**
   * Find or create an organization
   * First searches by name, then by domain, then creates if not found
   * @param companyName - The company name
   * @param emailDomain - Optional email domain for fallback search
   */
  async findOrCreateOrganization(
    companyName: string | undefined,
    emailDomain?: string
  ): Promise<{ id: number; name: string; created: boolean } | null> {
    try {
      // Strategy 1: Search by company name
      if (companyName && companyName.trim()) {
        const byName = await this.searchOrganization(companyName.trim());
        if (byName.length > 0) {
          const org = byName[0].item;
          return { id: org.id, name: org.name, created: false };
        }
      }

      // Strategy 2: Search by email domain
      if (emailDomain) {
        const domain = emailDomain.replace(/^@/, '');
        // Extract company name from domain (e.g., 'acme' from 'acme.nl')
        const domainParts = domain.split('.');
        if (domainParts.length >= 2) {
          const domainName = domainParts[0];
          const byDomain = await this.searchOrganization(domainName);
          if (byDomain.length > 0) {
            const org = byDomain[0].item;
            return { id: org.id, name: org.name, created: false };
          }
        }
      }

      // Strategy 3: Create new organization
      const orgName = companyName?.trim() || (emailDomain ? emailDomain.replace(/^@/, '') : null);

      if (!orgName) {
        console.error('Cannot create organization: no name or domain provided');
        return null;
      }

      const newOrg = await this.createOrganization({
        name: orgName,
        owner_id: 22971285 // Default owner
      });

      console.log(`✅ Created new organization: ${orgName} (ID: ${newOrg.id})`);
      return { id: newOrg.id, name: orgName, created: true };
    } catch (error) {
      console.error('Error finding/creating organization:', error);
      return null;
    }
  }

  /**
   * Find or create a person, with improved name handling
   * @param email - The person's email
   * @param name - The person's name (optional)
   * @param orgId - The organization ID to link to (optional)
   */
  async findOrCreatePersonAdvanced(
    email: string,
    name?: string,
    orgId?: number
  ): Promise<{ id: number; created: boolean } | null> {
    try {
      const cleanEmail = email.toLowerCase().trim();

      // Search for existing person by email
      const existingPersons = await this.searchPersonByEmail(cleanEmail);

      if (existingPersons.length > 0) {
        const person = existingPersons[0].item;

        // If person exists but has no org, and we have an org, link them
        if (orgId && !person.org_id) {
          await this.updatePerson(person.id, { org_id: orgId });
          console.log(`🔗 Linked existing person ${person.id} to org ${orgId}`);
        }

        return { id: person.id, created: false };
      }

      // Create new person
      const personName = name?.trim() || cleanEmail;
      const personData: PipedrivePerson = {
        name: personName,
        email: [{ value: cleanEmail, primary: true }],
        org_id: orgId,
        visible_to: 3 // Visible to all users
      };

      const newPerson = await this.createPerson(personData);
      console.log(`✅ Created new person: ${personName} (ID: ${newPerson.id})`);

      return { id: newPerson.id, created: true };
    } catch (error) {
      console.error(`Error finding/creating person for ${email}:`, error);
      return null;
    }
  }

  /**
   * Extract domain from email address
   */
  static extractDomainFromEmail(email: string): string | null {
    const parts = email.toLowerCase().trim().split('@');
    return parts.length === 2 ? parts[1] : null;
  }

  /**
   * Set the Hoofddomein (platform name) for an organization
   * @param orgId - The Pipedrive organization ID
   * @param platformName - The platform name (e.g., "GroningseBanen")
   */
  async setOrganizationHoofddomein(
    orgId: number,
    platformName: string
  ): Promise<{ success: boolean; reason?: string }> {
    try {
      // Look up the enum ID for this platform name
      const enumId = HOOFDDOMEIN_OPTIONS[platformName];

      if (!enumId) {
        console.warn(`⚠️ Platform "${platformName}" not found in Pipedrive Hoofddomein options, skipping`);
        return {
          success: false,
          reason: `Platform "${platformName}" not configured in Pipedrive Hoofddomein field`
        };
      }

      await this.updateOrganization(orgId, {
        custom_fields: {
          [HOOFDDOMEIN_FIELD_ID]: enumId
        }
      });

      console.log(`✅ Set Hoofddomein for org ${orgId} to ${platformName} (enum ID: ${enumId})`);
      return { success: true };
    } catch (error) {
      console.error(`Error setting Hoofddomein for org ${orgId}:`, error);
      return {
        success: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the list of supported Hoofddomein options
   */
  static getSupportedHoofddomeinPlatforms(): string[] {
    return Object.keys(HOOFDDOMEIN_OPTIONS);
  }

  /**
   * Set the Subdomein (other platforms) for an organization.
   * Subdomein is a multi-select field containing platforms where the company
   * has job postings, excluding the Hoofddomein (headquarters platform).
   *
   * @param orgId - The Pipedrive organization ID
   * @param platformNames - Array of platform names (e.g., ["GroningseBanen", "LeeuwardseBanen"])
   */
  async setOrganizationSubdomein(
    orgId: number,
    platformNames: string[]
  ): Promise<{ success: boolean; reason?: string }> {
    try {
      if (!SUBDOMEIN_FIELD_ID) {
        console.warn(`⚠️ SUBDOMEIN_FIELD_ID is not configured, skipping Subdomein update`);
        return {
          success: false,
          reason: 'SUBDOMEIN_FIELD_ID is not configured in pipedrive-client.ts'
        };
      }

      if (!platformNames || platformNames.length === 0) {
        console.log(`📍 No subdomeinen to set for org ${orgId}`);
        return { success: true };
      }

      // Look up the enum IDs for each platform name
      const enumIds: number[] = [];
      const notFound: string[] = [];

      for (const platform of platformNames) {
        const enumId = SUBDOMEIN_OPTIONS[platform];
        if (enumId) {
          enumIds.push(enumId);
        } else {
          notFound.push(platform);
        }
      }

      if (notFound.length > 0) {
        console.warn(`⚠️ Platforms not found in Subdomein options: ${notFound.join(', ')}`);
      }

      if (enumIds.length === 0) {
        return {
          success: false,
          reason: `None of the platforms [${platformNames.join(', ')}] are configured in Pipedrive Subdomein field`
        };
      }

      // For multi-select fields, Pipedrive expects an array of enum IDs
      await this.updateOrganization(orgId, {
        custom_fields: {
          [SUBDOMEIN_FIELD_ID]: enumIds
        }
      });

      console.log(`✅ Set Subdomein for org ${orgId} to [${platformNames.filter(p => SUBDOMEIN_OPTIONS[p]).join(', ')}] (enum IDs: ${enumIds.join(', ')})`);
      return { success: true };
    } catch (error) {
      console.error(`Error setting Subdomein for org ${orgId}:`, error);
      return {
        success: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Find a field by name in organization fields
   * Useful for discovering field IDs
   */
  async findOrganizationFieldByName(fieldName: string): Promise<{
    id: number;
    key: string;
    name: string;
    options?: Array<{ id: number; label: string }>;
  } | null> {
    try {
      const fields = await this.listOrganizationFields();
      const field = fields.find((f: any) =>
        f.name.toLowerCase().includes(fieldName.toLowerCase())
      );

      if (!field) {
        console.log(`📍 Field "${fieldName}" not found in organization fields`);
        return null;
      }

      console.log(`📍 Found field "${field.name}" (key: ${field.key}, id: ${field.id})`);
      return {
        id: field.id,
        key: field.key,
        name: field.name,
        options: field.options
      };
    } catch (error) {
      console.error(`Error finding field by name "${fieldName}":`, error);
      return null;
    }
  }

  /**
   * List all organization fields (useful for finding field IDs)
   */
  async listOrganizationFields(): Promise<any[]> {
    try {
      const data = await this.request('GET', '/organizationFields');
      return data || [];
    } catch (error) {
      console.error('Error listing organization fields:', error);
      return [];
    }
  }
}

export const pipedriveClient = new PipedriveClient();