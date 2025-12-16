/**
 * Instantly.ai API Client
 * Handles blocklist operations, leads, campaigns and webhooks with the Instantly.ai API v2
 */

import { getInstantlyConfigValidated } from './api-config'

// ============================================================================
// BLOCKLIST TYPES
// ============================================================================

interface InstantlyBlocklistEntry {
  id?: string
  bl_value: string
  is_domain?: boolean
  timestamp_created?: string
  organization_id?: string
}

interface InstantlyResponse<T> {
  data?: T
  error?: string
}

interface InstantlyListResponse {
  data: InstantlyBlocklistEntry[]
  pagination?: {
    total: number
    limit: number
    starting_after?: string
  }
}

// ============================================================================
// LEAD TYPES
// ============================================================================

export interface InstantlyLead {
  id: string
  email: string
  first_name?: string
  last_name?: string
  company_name?: string
  website?: string
  phone?: string
  status?: number | string  // -1 = bounced, 0 = not started, 1 = in progress, 2 = paused, 3 = completed
  lead_status?: string
  interest_status?: number | string  // 1 = interested, -1 = not interested
  campaign?: string
  campaign_id?: string
  list_id?: string
  timestamp_created?: string
  timestamp_updated?: string
  personalization?: Record<string, any>
  variables?: Record<string, any>
  // Reply tracking fields
  email_reply_count?: number
  email_open_count?: number
  email_click_count?: number
}

export interface InstantlyLeadListResponse {
  items: InstantlyLead[]
  next_starting_after?: string
  total_count?: number
}

// ============================================================================
// CAMPAIGN TYPES
// ============================================================================

export interface InstantlyCampaign {
  id: string
  name: string
  status: string
  timestamp_created?: string
  timestamp_updated?: string
}

export interface InstantlyCampaignAnalytics {
  campaign_id: string
  campaign_name: string
  leads_count: number
  contacted_count: number
  emails_sent_count: number
  open_count: number
  reply_count: number
  bounced_count: number
  unsubscribed_count: number
  completed_count: number
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface InstantlyWebhook {
  id: string
  webhook_url: string
  event_type: string
  status?: string
  timestamp_created?: string
}

export type InstantlyWebhookEventType =
  | 'all_events'
  | 'email_sent'
  | 'email_opened'
  | 'reply_received'
  | 'auto_reply_received'
  | 'link_clicked'
  | 'email_bounced'
  | 'lead_unsubscribed'
  | 'campaign_completed'
  | 'account_error'
  | 'lead_interested'
  | 'lead_not_interested'
  | 'lead_neutral'
  | 'lead_meeting_booked'
  | 'lead_meeting_completed'
  | 'lead_closed'
  | 'lead_out_of_office'
  | 'lead_wrong_person'

export interface InstantlyWebhookPayload {
  timestamp: string
  event_type: InstantlyWebhookEventType | string
  workspace: string
  campaign_id: string
  campaign_name: string
  lead_email?: string
  email_account?: string
  step?: number
  variant?: number
  is_first?: boolean
  unibox_url?: string
}

export class InstantlyClient {
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor() {
    const config = getInstantlyConfigValidated()
    this.apiKey = config.apiKey
    this.baseUrl = `${config.baseUrl}/api/v2`
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    // Only add Content-Type header for requests with a body
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.apiKey}`,
      ...options.headers,
    }

    // Add Content-Type only if there's a body and it's not a DELETE request
    if (options.body && options.method !== 'DELETE') {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (response.status === 429) {
      // Rate limit hit - wait and retry once
      await this.delay(2000)
      const retryResponse = await fetch(url, {
        ...options,
        headers,
      })

      if (!retryResponse.ok) {
        throw new Error(`Instantly API error after retry: ${retryResponse.status} ${retryResponse.statusText}`)
      }

      return retryResponse.json()
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Instantly API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return response.json()
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  private isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/
    return domainRegex.test(domain)
  }

  /**
   * Sanitize email/domain for Instantly API
   */
  private sanitizeBlocklistValue(value: string): string {
    // Remove any non-ASCII characters and normalize the string
    return value
      .toLowerCase()
      .trim()
      .normalize('NFD') // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
      .replace(/[^\x00-\x7F]/g, '') // Remove any remaining non-ASCII characters
      .replace(/\s+/g, '') // Remove any whitespace within the email
  }

  /**
   * Add an email or domain to the blocklist
   */
  async addToBlocklist(blValue: string): Promise<InstantlyBlocklistEntry> {
    const cleanValue = blValue.trim().toLowerCase()

    if (!this.isValidEmail(cleanValue) && !this.isValidDomain(cleanValue)) {
      throw new Error(`Invalid email or domain format: ${cleanValue}`)
    }

    // Back to original format as per API docs
    // The issue might be with the API endpoint or authentication
    const requestBody = {
      bl_value: cleanValue
    }

    console.log('Sending to Instantly API:', {
      endpoint: '/block-lists-entries',
      method: 'POST',
      body: requestBody,
      headers: {
        'Authorization': 'Bearer [hidden]',
        'Content-Type': 'application/json'
      }
    })

    try {
      const response = await this.makeRequest<InstantlyBlocklistEntry>('/block-lists-entries', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      })
      console.log('Successfully added to blocklist:', cleanValue)
      return response
    } catch (error) {
      console.error('Failed to add to blocklist:', {
        value: cleanValue,
        error: error instanceof Error ? error.message : error,
        requestBody
      })
      throw error
    }
  }

  /**
   * Get blocklist entries with optional search
   */
  async getBlocklist(params: {
    search?: string
    limit?: number
    domains_only?: boolean
    starting_after?: string
  } = {}): Promise<InstantlyListResponse> {
    const searchParams = new URLSearchParams()

    if (params.search) searchParams.set('search', params.search)
    if (params.limit) searchParams.set('limit', params.limit.toString())
    if (params.domains_only) searchParams.set('domains_only', 'true')
    if (params.starting_after) searchParams.set('starting_after', params.starting_after)

    const endpoint = `/block-lists-entries${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    const response = await this.makeRequest<any>(endpoint)

    // Handle the response format from Instantly API v2
    // The API returns { items: [...], next_starting_after: ... } instead of { data: [...] }
    if (response.items) {
      return {
        data: response.items,
        pagination: {
          total: response.items.length,
          limit: params.limit || 100,
          starting_after: response.next_starting_after
        }
      }
    }

    return response as InstantlyListResponse
  }

  /**
   * Get blocklist entry ID by value
   */
  async getBlocklistEntryId(blValue: string): Promise<string | null> {
    try {
      const cleanValue = blValue.trim().toLowerCase()
      const response = await this.getBlocklist({ search: cleanValue, limit: 1 })
      const entry = response.data.find(entry => entry.bl_value === cleanValue)
      return entry?.id || null
    } catch (error) {
      console.error('Error getting blocklist entry ID:', error)
      return null
    }
  }

  /**
   * Check if an email or domain is already in the blocklist
   */
  async isBlocked(blValue: string): Promise<boolean> {
    try {
      const cleanValue = blValue.trim().toLowerCase()
      const response = await this.getBlocklist({ search: cleanValue, limit: 1 })
      return response.data.some(entry => entry.bl_value === cleanValue)
    } catch (error) {
      console.error('Error checking if blocked:', error)
      return false
    }
  }

  /**
   * Delete an entry from the blocklist using Instantly ID
   */
  async deleteFromBlocklistByInstantlyId(instantlyId: string): Promise<boolean> {
    try {
      console.log(`Deleting entry from Instantly using ID: ${instantlyId}`)

      await this.makeRequest(`/block-lists-entries/${instantlyId}`, {
        method: 'DELETE',
      })

      console.log(`Successfully deleted entry from Instantly blocklist using ID ${instantlyId}`)
      return true
    } catch (error) {
      console.error('Failed to delete from blocklist:', {
        instantlyId,
        error: error instanceof Error ? error.message : error
      })
      throw error
    }
  }

  /**
   * Delete an entry from the blocklist by value (legacy method)
   */
  async deleteFromBlocklist(blValue: string): Promise<boolean> {
    try {
      const cleanValue = blValue.trim().toLowerCase()

      // First get the entry ID from Instantly
      const entryId = await this.getBlocklistEntryId(cleanValue)

      if (!entryId) {
        console.log(`Entry ${cleanValue} not found in Instantly blocklist`)
        return true // Consider it a success if it's not there
      }

      return await this.deleteFromBlocklistByInstantlyId(entryId)
    } catch (error) {
      console.error('Failed to delete from blocklist:', {
        value: blValue,
        error: error instanceof Error ? error.message : error
      })
      throw error
    }
  }

  /**
   * Add multiple entries to blocklist with rate limiting
   */
  async addMultipleToBlocklist(blValues: string[]): Promise<{
    success: InstantlyBlocklistEntry[]
    failed: { value: string; error: string }[]
    alreadyExists: string[]
  }> {
    const success: InstantlyBlocklistEntry[] = []
    const failed: { value: string; error: string }[] = []
    const alreadyExists: string[] = []

    for (const blValue of blValues) {
      try {
        // Check if already exists to avoid duplicates
        const isAlreadyBlocked = await this.isBlocked(blValue)
        if (isAlreadyBlocked) {
          console.log(`${blValue} already exists in Instantly blocklist`)
          alreadyExists.push(blValue)
          continue
        }

        const result = await this.addToBlocklist(blValue)
        success.push(result)

        // Rate limiting: wait 100ms between requests
        await this.delay(100)
      } catch (error) {
        failed.push({
          value: blValue,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return { success, failed, alreadyExists }
  }

  // ============================================================================
  // LEAD METHODS
  // ============================================================================

  /**
   * List leads with optional filters
   * @param options - Filter options including campaign_id, limit, starting_after
   */
  async listLeads(options: {
    campaign_id?: string
    list_id?: string
    limit?: number
    starting_after?: string
    email?: string
  } = {}): Promise<InstantlyLeadListResponse> {
    const requestBody: Record<string, any> = {}

    if (options.campaign_id) requestBody.campaign_id = options.campaign_id
    if (options.list_id) requestBody.list_id = options.list_id
    if (options.limit) requestBody.limit = options.limit
    if (options.starting_after) requestBody.starting_after = options.starting_after
    if (options.email) requestBody.email = options.email

    const response = await this.makeRequest<any>('/leads/list', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    return {
      items: response.items || response.leads || [],
      next_starting_after: response.next_starting_after,
      total_count: response.total_count
    }
  }

  /**
   * List all leads for a specific campaign with pagination
   * @param campaignId - The campaign ID to filter by
   * @param options - Additional options like limit
   */
  async listLeadsByCampaign(
    campaignId: string,
    options: { limit?: number } = {}
  ): Promise<InstantlyLead[]> {
    const allLeads: InstantlyLead[] = []
    let startingAfter: string | undefined
    const limit = options.limit || 100

    do {
      const response = await this.listLeads({
        campaign_id: campaignId,
        limit,
        starting_after: startingAfter
      })

      allLeads.push(...response.items)
      startingAfter = response.next_starting_after

      // Rate limiting between pagination requests
      if (startingAfter) {
        await this.delay(100)
      }
    } while (startingAfter)

    return allLeads
  }

  /**
   * Get a specific lead by email
   * @param email - The lead's email address
   * @param campaignId - Optional campaign ID to search within
   */
  async getLeadByEmail(email: string, campaignId?: string): Promise<InstantlyLead | null> {
    try {
      const response = await this.listLeads({
        email: email.toLowerCase().trim(),
        campaign_id: campaignId,
        limit: 1
      })

      return response.items[0] || null
    } catch (error) {
      console.error('Error getting lead by email:', error)
      return null
    }
  }

  /**
   * Search campaigns by lead email to find all campaigns a lead is in
   * @param email - The lead's email address
   */
  async searchCampaignsByLeadEmail(email: string): Promise<InstantlyCampaign[]> {
    try {
      const response = await this.makeRequest<any>('/campaigns/search-by-contact', {
        method: 'POST',
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })

      return response.items || response.campaigns || []
    } catch (error) {
      console.error('Error searching campaigns by lead email:', error)
      return []
    }
  }

  // ============================================================================
  // CAMPAIGN METHODS
  // ============================================================================

  /**
   * List all campaigns
   */
  async listCampaigns(): Promise<InstantlyCampaign[]> {
    const allCampaigns: InstantlyCampaign[] = []
    let skip = 0
    const limit = 100

    do {
      const response = await this.makeRequest<any>(`/campaigns?skip=${skip}&limit=${limit}`)
      const campaigns = response.items || []
      allCampaigns.push(...campaigns)

      if (campaigns.length < limit) {
        break
      }
      skip += limit

      // Safety limit
      if (skip >= 1000) {
        console.warn('Reached maximum campaign limit of 1000')
        break
      }

      await this.delay(100)
    } while (true)

    return allCampaigns
  }

  /**
   * Get campaign by ID
   * @param campaignId - The campaign ID
   */
  async getCampaign(campaignId: string): Promise<InstantlyCampaign | null> {
    try {
      const response = await this.makeRequest<InstantlyCampaign>(`/campaigns/${campaignId}`)
      return response
    } catch (error) {
      console.error('Error getting campaign:', error)
      return null
    }
  }

  /**
   * Get campaign analytics
   * @param campaignId - The campaign ID
   */
  async getCampaignAnalytics(campaignId: string): Promise<InstantlyCampaignAnalytics | null> {
    try {
      const response = await this.makeRequest<any>(`/campaigns/${campaignId}/analytics`)
      return response
    } catch (error) {
      console.error('Error getting campaign analytics:', error)
      return null
    }
  }

  // ============================================================================
  // WEBHOOK METHODS
  // ============================================================================

  /**
   * List all configured webhooks
   */
  async listWebhooks(): Promise<InstantlyWebhook[]> {
    try {
      const response = await this.makeRequest<any>('/webhooks')
      return response.items || response.webhooks || []
    } catch (error) {
      console.error('Error listing webhooks:', error)
      return []
    }
  }

  /**
   * Create a new webhook
   * @param webhookUrl - The URL to send webhook events to
   * @param eventType - The event type to subscribe to
   */
  async createWebhook(
    webhookUrl: string,
    eventType: InstantlyWebhookEventType
  ): Promise<InstantlyWebhook | null> {
    try {
      const response = await this.makeRequest<InstantlyWebhook>('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          webhook_url: webhookUrl,
          event_type: eventType
        }),
      })
      console.log(`Successfully created webhook for event: ${eventType}`)
      return response
    } catch (error) {
      console.error('Error creating webhook:', error)
      return null
    }
  }

  /**
   * Create multiple webhooks for different event types
   * @param webhookUrl - The URL to send webhook events to
   * @param eventTypes - Array of event types to subscribe to
   */
  async createWebhooks(
    webhookUrl: string,
    eventTypes: InstantlyWebhookEventType[]
  ): Promise<{ success: InstantlyWebhook[]; failed: string[] }> {
    const success: InstantlyWebhook[] = []
    const failed: string[] = []

    for (const eventType of eventTypes) {
      const webhook = await this.createWebhook(webhookUrl, eventType)
      if (webhook) {
        success.push(webhook)
      } else {
        failed.push(eventType)
      }
      await this.delay(100)
    }

    return { success, failed }
  }

  /**
   * Delete a webhook by ID
   * @param webhookId - The webhook ID to delete
   */
  async deleteWebhook(webhookId: string): Promise<boolean> {
    try {
      await this.makeRequest(`/webhooks/${webhookId}`, {
        method: 'DELETE',
      })
      console.log(`Successfully deleted webhook: ${webhookId}`)
      return true
    } catch (error) {
      console.error('Error deleting webhook:', error)
      return false
    }
  }

  /**
   * Test a webhook by ID
   * @param webhookId - The webhook ID to test
   */
  async testWebhook(webhookId: string): Promise<boolean> {
    try {
      await this.makeRequest(`/webhooks/${webhookId}/test`, {
        method: 'POST',
      })
      console.log(`Successfully tested webhook: ${webhookId}`)
      return true
    } catch (error) {
      console.error('Error testing webhook:', error)
      return false
    }
  }

  /**
   * Get available webhook event types
   */
  async getWebhookEventTypes(): Promise<string[]> {
    try {
      const response = await this.makeRequest<any>('/webhooks/event-types')
      return response.event_types || response.items || []
    } catch (error) {
      console.error('Error getting webhook event types:', error)
      return []
    }
  }
}

// Export singleton instance
export const instantlyClient = new InstantlyClient()