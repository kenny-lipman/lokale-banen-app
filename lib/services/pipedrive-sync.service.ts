export interface PipedriveBlocklistSyncResult {
  success: boolean;
  message?: string;
  error?: string;
  sync_timestamp: Date;
  person_id?: number;
}

export interface PipedriveBlocklistEntry {
  email: string;
  reason?: string;
  status: 'blocked' | 'active';
}

export interface PipedrivePerson {
  id: number;
  name: string;
  email: Array<{ value: string; primary: boolean }>;
  phone: Array<{ value: string; primary: boolean }>;
  custom_fields?: Record<string, any>;
}

export interface PipedriveCustomField {
  id: number;
  key: string;
  name: string;
  field_type: string;
  options?: Array<{ id: number; label: string }>;
}

export class PipedriveBlocklistService {
  private readonly apiUrl = 'https://api.pipedrive.com/v1';
  private readonly apiKey: string;
  private blocklistFieldKey: string | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PIPEDRIVE_API_TOKEN || '';

    if (!this.apiKey) {
      console.warn('Pipedrive API token not configured. Set PIPEDRIVE_API_TOKEN environment variable.');
    }
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    params?: Record<string, string>
  ): Promise<T> {
    let url = `${this.apiUrl}${endpoint}?api_token=${this.apiKey}`;

    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `&${searchParams.toString()}`;
    }

    const config: RequestInit = {
      method,
      headers: this.headers,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pipedrive API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Pipedrive API request failed:', error);
      throw error;
    }
  }

  private async getOrCreateBlocklistField(): Promise<string | null> {
    if (this.blocklistFieldKey) {
      return this.blocklistFieldKey;
    }

    try {
      const response = await this.makeRequest<{ data: PipedriveCustomField[] }>('/personFields');
      const existingField = response.data.find(field =>
        field.key === 'blocklist_status' || field.name === 'Blocklist Status'
      );

      if (existingField) {
        this.blocklistFieldKey = existingField.key;
        return this.blocklistFieldKey;
      }

      const newFieldData = {
        name: 'Blocklist Status',
        field_type: 'enum',
        options: [
          { label: 'Active' },
          { label: 'Blocked' }
        ]
      };

      const createResponse = await this.makeRequest<{ data: PipedriveCustomField }>(
        '/personFields',
        'POST',
        newFieldData
      );

      this.blocklistFieldKey = createResponse.data.key;
      return this.blocklistFieldKey;
    } catch (error) {
      console.error('Failed to get or create blocklist field:', error);
      return null;
    }
  }

  async findPersonByEmail(email: string): Promise<PipedrivePerson | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await this.makeRequest<{ data: PipedrivePerson[] }>(
        '/persons/search',
        'GET',
        undefined,
        { term: email, fields: 'email' }
      );

      const person = response.data?.find(p =>
        p.email?.some(e => e.value.toLowerCase() === email.toLowerCase())
      );

      return person || null;
    } catch (error) {
      console.error('Failed to find person by email:', error);
      return null;
    }
  }

  async updatePersonBlocklistStatus(
    personId: number,
    status: 'blocked' | 'active',
    reason?: string
  ): Promise<PipedriveBlocklistSyncResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Pipedrive API token not configured',
        sync_timestamp: new Date()
      };
    }

    try {
      const fieldKey = await this.getOrCreateBlocklistField();
      if (!fieldKey) {
        return {
          success: false,
          error: 'Failed to create or access blocklist field in Pipedrive',
          sync_timestamp: new Date(),
          person_id: personId
        };
      }

      const updateData: any = {
        [fieldKey]: status === 'blocked' ? 'Blocked' : 'Active'
      };

      if (reason) {
        updateData['blocklist_reason'] = reason;
      }

      await this.makeRequest(`/persons/${personId}`, 'PUT', updateData);

      return {
        success: true,
        message: `Successfully updated person ${personId} blocklist status to ${status}`,
        sync_timestamp: new Date(),
        person_id: personId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        sync_timestamp: new Date(),
        person_id: personId
      };
    }
  }

  async blockPersonByEmail(email: string, reason?: string): Promise<PipedriveBlocklistSyncResult> {
    try {
      const person = await this.findPersonByEmail(email);

      if (!person) {
        return {
          success: false,
          error: `Person with email ${email} not found in Pipedrive`,
          sync_timestamp: new Date()
        };
      }

      return await this.updatePersonBlocklistStatus(person.id, 'blocked', reason);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        sync_timestamp: new Date()
      };
    }
  }

  async unblockPersonByEmail(email: string): Promise<PipedriveBlocklistSyncResult> {
    try {
      const person = await this.findPersonByEmail(email);

      if (!person) {
        return {
          success: false,
          error: `Person with email ${email} not found in Pipedrive`,
          sync_timestamp: new Date()
        };
      }

      return await this.updatePersonBlocklistStatus(person.id, 'active');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        sync_timestamp: new Date()
      };
    }
  }

  async bulkUpdateBlocklistStatus(entries: PipedriveBlocklistEntry[]): Promise<PipedriveBlocklistSyncResult[]> {
    if (!this.apiKey) {
      return entries.map(() => ({
        success: false,
        error: 'Pipedrive API token not configured',
        sync_timestamp: new Date()
      }));
    }

    const results: PipedriveBlocklistSyncResult[] = [];

    for (const entry of entries) {
      try {
        let result: PipedriveBlocklistSyncResult;

        if (entry.status === 'blocked') {
          result = await this.blockPersonByEmail(entry.email, entry.reason);
        } else {
          result = await this.unblockPersonByEmail(entry.email);
        }

        results.push(result);

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          sync_timestamp: new Date()
        });
      }
    }

    return results;
  }

  async getBlockedPersons(): Promise<PipedrivePerson[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const fieldKey = await this.getOrCreateBlocklistField();
      if (!fieldKey) {
        return [];
      }

      const response = await this.makeRequest<{ data: PipedrivePerson[] }>('/persons', 'GET', undefined, {
        limit: '500'
      });

      const blockedPersons = response.data?.filter(person =>
        person.custom_fields?.[fieldKey] === 'Blocked'
      ) || [];

      return blockedPersons;
    } catch (error) {
      console.error('Failed to fetch blocked persons:', error);
      return [];
    }
  }

  async isPersonBlocked(email: string): Promise<boolean> {
    try {
      const person = await this.findPersonByEmail(email);
      if (!person) {
        return false;
      }

      const fieldKey = await this.getOrCreateBlocklistField();
      if (!fieldKey) {
        return false;
      }

      return person.custom_fields?.[fieldKey] === 'Blocked';
    } catch (error) {
      console.error('Failed to check person blocklist status:', error);
      return false;
    }
  }

  async syncBlocklistEntry(entry: {
    type: 'email' | 'domain';
    value: string;
    reason: string;
    is_active: boolean;
  }): Promise<PipedriveBlocklistSyncResult> {
    if (entry.type === 'domain') {
      return {
        success: false,
        error: 'Domain-level blocking requires custom implementation in Pipedrive',
        sync_timestamp: new Date()
      };
    }

    if (entry.is_active) {
      return await this.blockPersonByEmail(entry.value, entry.reason);
    } else {
      return await this.unblockPersonByEmail(entry.value);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      await this.makeRequest('/users/me');
      return true;
    } catch (error) {
      console.error('Pipedrive API connection test failed:', error);
      return false;
    }
  }

  async createNote(personId: number, content: string): Promise<boolean> {
    try {
      await this.makeRequest('/notes', 'POST', {
        person_id: personId,
        content: content
      });
      return true;
    } catch (error) {
      console.error('Failed to create note:', error);
      return false;
    }
  }
}

export const pipedriveService = new PipedriveBlocklistService();