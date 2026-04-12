/**
 * MailerLite API Client
 *
 * Handles all communication with the MailerLite API.
 * Pattern: same as pipedrive-client.ts (class, private request with retry/backoff, singleton)
 *
 * Base URL: https://connect.mailerlite.com/api
 * Auth: Bearer token
 * Rate limit: 120 req/min
 */

const MAILERLITE_API_KEY = process.env.MAILER_LITE_API_KEY;
const MAILERLITE_BASE_URL = 'https://connect.mailerlite.com/api';

export class MailerLiteRateLimitError extends Error {
  constructor(retryAfterSeconds: number) {
    super(`MailerLite API rate limit reached (retry-after: ${retryAfterSeconds}s)`);
    this.name = 'MailerLiteRateLimitError';
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface MailerLiteSubscriber {
  id: string;
  email: string;
  status: string;
  fields: Record<string, string | null>;
  groups: Array<{ id: string; name: string }>;
  created_at: string;
  updated_at: string;
}

export interface MailerLiteGroup {
  id: string;
  name: string;
  active_count: number;
  sent_count: number;
  opens_count: number;
  clicks_count: number;
  unsubscribed_count: number;
  created_at: string;
}

export interface MailerLiteField {
  id: string;
  name: string;
  key: string;
  type: string;
}

export interface MailerLiteWebhook {
  id: string;
  url: string;
  events: Array<{ type: string }>;
  enabled: boolean;
}

export interface CreateSubscriberParams {
  email: string;
  fields?: Record<string, string | number | null>;
  groups?: string[];
  status?: 'active' | 'unsubscribed' | 'unconfirmed' | 'bounced' | 'junk';
}

// ============================================================================
// CLIENT
// ============================================================================

export class MailerLiteClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    if (!MAILERLITE_API_KEY) {
      throw new Error('MAILER_LITE_API_KEY is not configured');
    }
    this.apiKey = MAILERLITE_API_KEY;
    this.baseUrl = MAILERLITE_BASE_URL;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make an API request to MailerLite with exponential backoff retry
   */
  private async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    retryCount: number = 0
  ): Promise<T> {
    const MAX_RETRIES = 3;
    const RATE_LIMIT_MAX_RETRIES = 5;
    const BASE_DELAY_MS = 1000;

    const url = `${this.baseUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      // Handle rate limits (120 req/min)
      if (response.status === 429) {
        if (retryCount >= RATE_LIMIT_MAX_RETRIES) {
          throw new MailerLiteRateLimitError(0);
        }

        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 0;

        if (retryAfterSeconds > 300) {
          throw new MailerLiteRateLimitError(retryAfterSeconds);
        }

        const delayMs = retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : Math.min(2000 * Math.pow(2, retryCount), 30000);
        console.log(`⏳ Rate limited by MailerLite API, waiting ${delayMs}ms before retry ${retryCount + 1}/${RATE_LIMIT_MAX_RETRIES}...`);
        await this.delay(delayMs);

        return this.request<T>(method, endpoint, data, retryCount + 1);
      }

      // Handle server errors (5xx) with retry
      if (response.status >= 500 && response.status < 600) {
        if (retryCount >= MAX_RETRIES) {
          throw new Error(`MailerLite API server error ${response.status} after ${MAX_RETRIES} retries`);
        }

        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount);
        console.log(`⏳ Server error from MailerLite API (${response.status}), waiting ${delayMs}ms before retry ${retryCount + 1}/${MAX_RETRIES}...`);
        await this.delay(delayMs);

        return this.request<T>(method, endpoint, data, retryCount + 1);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ MailerLite API Error Response (${response.status}):`, errorText.substring(0, 500));
        throw new Error(`MailerLite API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
      }

      // 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      const responseText = await response.text();
      try {
        return JSON.parse(responseText);
      } catch (parseError: any) {
        console.error(`❌ MailerLite JSON Parse Error. Response:`, responseText.substring(0, 500));
        throw new Error(`Invalid JSON response from MailerLite API: ${parseError.message}`);
      }
    } catch (error) {
      // Handle network errors with retry
      if (error instanceof TypeError && error.message.includes('fetch')) {
        if (retryCount >= MAX_RETRIES) {
          throw new Error(`Network error connecting to MailerLite API after ${MAX_RETRIES} retries: ${error.message}`);
        }

        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount);
        console.log(`⏳ Network error, waiting ${delayMs}ms before retry ${retryCount + 1}/${MAX_RETRIES}...`);
        await this.delay(delayMs);

        return this.request<T>(method, endpoint, data, retryCount + 1);
      }

      throw error;
    }
  }

  // ============================================================================
  // SUBSCRIBERS
  // ============================================================================

  /**
   * Create or update a subscriber (upsert by email)
   */
  async createOrUpdateSubscriber(params: CreateSubscriberParams): Promise<{ data: MailerLiteSubscriber }> {
    return this.request<{ data: MailerLiteSubscriber }>('POST', '/subscribers', params);
  }

  /**
   * Get a subscriber by email
   */
  async getSubscriber(email: string): Promise<{ data: MailerLiteSubscriber } | null> {
    try {
      return await this.request<{ data: MailerLiteSubscriber }>('GET', `/subscribers/${encodeURIComponent(email)}`);
    } catch (error: any) {
      if (error.message?.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  // ============================================================================
  // GROUPS
  // ============================================================================

  /**
   * List all groups with pagination
   */
  async listGroups(limit: number = 100): Promise<MailerLiteGroup[]> {
    const allGroups: MailerLiteGroup[] = [];
    let cursor: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (cursor) {
        params.set('cursor', cursor);
      }

      const result = await this.request<{
        data: MailerLiteGroup[];
        meta: { next_cursor: string | null };
      }>('GET', `/groups?${params.toString()}`);

      allGroups.push(...result.data);

      if (result.meta?.next_cursor) {
        cursor = result.meta.next_cursor;
      } else {
        hasMore = false;
      }
    }

    return allGroups;
  }

  /**
   * Create a new group
   */
  async createGroup(name: string): Promise<{ data: MailerLiteGroup }> {
    return this.request<{ data: MailerLiteGroup }>('POST', '/groups', { name });
  }

  // ============================================================================
  // FIELDS
  // ============================================================================

  /**
   * List all custom fields
   */
  async listFields(): Promise<MailerLiteField[]> {
    const result = await this.request<{ data: MailerLiteField[] }>('GET', '/fields');
    return result.data;
  }

  /**
   * Create a custom field
   */
  async createField(name: string, type: 'text' | 'number' | 'date'): Promise<{ data: MailerLiteField }> {
    return this.request<{ data: MailerLiteField }>('POST', '/fields', { name, type });
  }

  // ============================================================================
  // WEBHOOKS
  // ============================================================================

  /**
   * List all webhooks
   */
  async listWebhooks(): Promise<MailerLiteWebhook[]> {
    const result = await this.request<{ data: MailerLiteWebhook[] }>('GET', '/webhooks');
    return result.data;
  }

  /**
   * Create a webhook
   */
  async createWebhook(url: string, events: string[]): Promise<{ data: MailerLiteWebhook }> {
    return this.request<{ data: MailerLiteWebhook }>('POST', '/webhooks', {
      url,
      events,
    });
  }
}

// Singleton - only instantiate if API key is configured
let _mailerliteClient: MailerLiteClient | null = null;

export function getMailerLiteClient(): MailerLiteClient {
  if (!_mailerliteClient) {
    _mailerliteClient = new MailerLiteClient();
  }
  return _mailerliteClient;
}

// Lazy singleton export (won't throw if env var missing at import time)
export const mailerliteClient = MAILERLITE_API_KEY ? new MailerLiteClient() : null;
