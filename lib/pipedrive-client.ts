import { createServiceRoleClient } from './supabase-server';

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_API_URL = process.env.PIPEDRIVE_API_URL || 'https://api.pipedrive.com/v1';
const PIPEDRIVE_API_V2_URL = process.env.PIPEDRIVE_API_V2_URL || 'https://lokalebanen.pipedrive.com/api/v2';

// Status prospect field ID for organizations
const STATUS_PROSPECT_FIELD_ID = 'e8a27f47529d2091399f063b834339316d7d852a';

// Status prospect options
const STATUS_PROSPECT_OPTIONS = {
  BENADEREN: 302,
  KLANT: 303,
  NIET_MEER_BENADEREN: 304,
  OPNIEUW_BENADEREN: 305,
  IN_ONDERHANDELING: 322
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

  /**
   * Make an API request to Pipedrive V1
   */
  private async request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ) {
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

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error Response:`, errorText.substring(0, 500));
      throw new Error(`Pipedrive API error: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`❌ JSON Parse Error. Response text:`, responseText.substring(0, 500));
      throw new Error(`Invalid JSON response from Pipedrive API: ${parseError.message}`);
    }

    if (!result.success) {
      throw new Error(result.error || 'Pipedrive API request failed');
    }

    return result.data;
  }

  /**
   * Make an API request to Pipedrive V2
   */
  private async requestV2(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    data?: any
  ) {
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

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ V2 API Error Response:`, errorText.substring(0, 500));
      throw new Error(`Pipedrive V2 API error: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`❌ V2 JSON Parse Error. Response text:`, responseText.substring(0, 500));
      throw new Error(`Invalid JSON response from Pipedrive V2 API: ${parseError.message}`);
    }

    if (!result.success) {
      throw new Error(result.error || 'Pipedrive V2 API request failed');
    }

    return result.data;
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
}

export const pipedriveClient = new PipedriveClient();