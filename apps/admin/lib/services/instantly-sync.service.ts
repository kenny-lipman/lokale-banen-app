export interface InstantlyBlocklistSyncResult {
  success: boolean;
  message?: string;
  error?: string;
  sync_timestamp: Date;
}

export interface InstantlyBlocklistEntry {
  email: string;
  reason?: string;
  status: 'blocked' | 'active';
}

export interface InstantlySuppressionListItem {
  email: string;
  reason?: string;
  created_at?: string;
  updated_at?: string;
}

export class InstantlyBlocklistService {
  private readonly apiUrl = 'https://api.instantly.ai/api/v1';
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.INSTANTLY_API_KEY || '';

    if (!this.apiKey) {
      console.warn('Instantly API key not configured. Set INSTANTLY_API_KEY environment variable.');
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
    data?: any
  ): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;

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
        throw new Error(`Instantly API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Instantly API request failed:', error);
      throw error;
    }
  }

  async addToSuppressionList(email: string, reason?: string): Promise<InstantlyBlocklistSyncResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Instantly API key not configured',
        sync_timestamp: new Date()
      };
    }

    try {
      const data = {
        emails: [{ email, reason: reason || 'Blocked via Lokale-Banen' }]
      };

      await this.makeRequest('/suppressions/add', 'POST', data);

      return {
        success: true,
        message: `Successfully added ${email} to Instantly suppression list`,
        sync_timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        sync_timestamp: new Date()
      };
    }
  }

  async removeFromSuppressionList(email: string): Promise<InstantlyBlocklistSyncResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Instantly API key not configured',
        sync_timestamp: new Date()
      };
    }

    try {
      const data = {
        emails: [email]
      };

      await this.makeRequest('/suppressions/remove', 'POST', data);

      return {
        success: true,
        message: `Successfully removed ${email} from Instantly suppression list`,
        sync_timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        sync_timestamp: new Date()
      };
    }
  }

  async bulkAddToSuppressionList(entries: InstantlyBlocklistEntry[]): Promise<InstantlyBlocklistSyncResult[]> {
    if (!this.apiKey) {
      return entries.map(() => ({
        success: false,
        error: 'Instantly API key not configured',
        sync_timestamp: new Date()
      }));
    }

    try {
      const emailsToAdd = entries
        .filter(entry => entry.status === 'blocked')
        .map(entry => ({
          email: entry.email,
          reason: entry.reason || 'Blocked via Lokale-Banen'
        }));

      if (emailsToAdd.length === 0) {
        return [{
          success: true,
          message: 'No emails to add to suppression list',
          sync_timestamp: new Date()
        }];
      }

      const data = { emails: emailsToAdd };
      await this.makeRequest('/suppressions/add', 'POST', data);

      return emailsToAdd.map(item => ({
        success: true,
        message: `Successfully added ${item.email} to Instantly suppression list`,
        sync_timestamp: new Date()
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return entries.map(() => ({
        success: false,
        error: errorMessage,
        sync_timestamp: new Date()
      }));
    }
  }

  async getSuppressionList(): Promise<InstantlySuppressionListItem[]> {
    if (!this.apiKey) {
      console.warn('Instantly API key not configured');
      return [];
    }

    try {
      const response = await this.makeRequest<{ suppressions: InstantlySuppressionListItem[] }>('/suppressions');
      return response.suppressions || [];
    } catch (error) {
      console.error('Failed to fetch Instantly suppression list:', error);
      return [];
    }
  }

  async isEmailSuppressed(email: string): Promise<boolean> {
    try {
      const suppressionList = await this.getSuppressionList();
      return suppressionList.some(item => item.email.toLowerCase() === email.toLowerCase());
    } catch (error) {
      console.error('Failed to check email suppression status:', error);
      return false;
    }
  }

  async syncBlocklistEntry(entry: {
    type: 'email' | 'domain';
    value: string;
    reason: string;
    is_active: boolean;
  }): Promise<InstantlyBlocklistSyncResult> {
    if (entry.type === 'domain') {
      return {
        success: false,
        error: 'Instantly API does not support domain-level suppression',
        sync_timestamp: new Date()
      };
    }

    if (entry.is_active) {
      return await this.addToSuppressionList(entry.value, entry.reason);
    } else {
      return await this.removeFromSuppressionList(entry.value);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      await this.makeRequest('/suppressions');
      return true;
    } catch (error) {
      console.error('Instantly API connection test failed:', error);
      return false;
    }
  }
}

export const instantlyService = new InstantlyBlocklistService();