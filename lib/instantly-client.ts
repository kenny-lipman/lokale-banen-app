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
  status?: number | string  // -1 = bounced, -2 = unsubscribed, -3 = skipped, 1 = active, 2 = paused, 3 = completed
  lead_status?: string
  interest_status?: number | string  // 1 = interested, -1 = not interested
  // Extended interest status with more granular values
  lt_interest_status?: number  // 0=OOO, 1=interested, 2=meeting_booked, 3=meeting_completed, 4=won, -1=not_interested, -2=wrong_person, -3=lost, -4=no_show
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
  // Timestamps for engagement tracking
  timestamp_last_reply?: string
  timestamp_last_open?: string
  timestamp_last_click?: string
  timestamp_last_interest_change?: string
  // Sequence tracking
  sequence_step?: number
  verification_status?: number
}

export interface InstantlyLeadListResponse {
  items: InstantlyLead[]
  next_starting_after?: string
  total_count?: number
}

// ============================================================================
// LEAD LABEL TYPES
// ============================================================================

export interface InstantlyLeadLabel {
  id: string
  label: string
  interest_status: number  // Auto-generated numeric value for this label
  interest_status_label: 'positive' | 'negative' | 'neutral'
  description?: string | null
  use_with_ai?: boolean | null
  timestamp_created?: string
  created_by?: string
  organization_id?: string
}

export interface InstantlyLeadLabelListResponse {
  items: InstantlyLeadLabel[]
  next_starting_after?: string
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
  tag_ids?: string  // Comma-separated tag IDs
}

export interface InstantlyCustomTag {
  id: string
  label: string
  description?: string
  timestamp_created?: string
  timestamp_updated?: string
  organization_id?: string
}

// Tag ID for "Algemene mailcampagnes" - only these campaigns should be synced
export const ALGEMENE_MAILCAMPAGNES_TAG_ID = '61f0db9c-f337-482c-8e87-e1fa6ededa72'

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
// EMAIL TYPES
// ============================================================================

export interface InstantlyEmail {
  id: string
  timestamp_created: string
  timestamp_email: string
  message_id?: string
  subject?: string
  to_address_email_list?: string
  from_address_email?: string
  cc_address_email_list?: string
  body?: {
    text?: string
    html?: string
  }
  email_type?: 'sent' | 'received'
  campaign_id?: string
  lead_email?: string
  eaccount?: string
  is_auto_reply?: number // 0 = false, 1 = true
  step?: number
  variant?: string
}

export interface InstantlyEmailListResponse {
  items: InstantlyEmail[]
  next_starting_after?: string
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

/**
 * All supported Instantly webhook event types
 * Based on Instantly API v2 /webhooks/event-types endpoint
 */
export type InstantlyWebhookEventType =
  // Engagement events
  | 'email_sent'
  | 'email_opened'
  | 'email_link_clicked'
  | 'email_bounced'
  // Reply & campaign events
  | 'reply_received'
  | 'lead_unsubscribed'
  | 'campaign_completed'
  // Interest events
  | 'lead_interested'
  | 'lead_not_interested'
  | 'lead_neutral'
  // Meeting events (high value)
  | 'lead_meeting_booked'
  | 'lead_meeting_completed'
  | 'lead_closed'
  // Special events
  | 'lead_out_of_office'
  | 'lead_wrong_person'
  | 'account_error'
  // Custom label events
  | 'custom_label_any_positive'
  | 'custom_label_any_negative'

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

  /**
   * Make API request with exponential backoff retry for rate limits and transient errors
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    const MAX_RETRIES = 3
    const BASE_DELAY_MS = 1000
    const TIMEOUT_MS = 30000 // 30 second timeout

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

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })

      // Handle rate limits with exponential backoff
      if (response.status === 429) {
        if (retryCount >= MAX_RETRIES) {
          throw new Error(`Instantly API rate limit exceeded after ${MAX_RETRIES} retries`)
        }

        // Calculate delay with exponential backoff: 1s, 2s, 4s
        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount)
        console.log(`⏳ Rate limited by Instantly API, waiting ${delayMs}ms before retry ${retryCount + 1}/${MAX_RETRIES}...`)
        await this.delay(delayMs)

        return this.makeRequest<T>(endpoint, options, retryCount + 1)
      }

      // Handle server errors (5xx) with retry
      if (response.status >= 500 && response.status < 600) {
        if (retryCount >= MAX_RETRIES) {
          throw new Error(`Instantly API server error ${response.status} after ${MAX_RETRIES} retries`)
        }

        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount)
        console.log(`⏳ Server error from Instantly API (${response.status}), waiting ${delayMs}ms before retry ${retryCount + 1}/${MAX_RETRIES}...`)
        await this.delay(delayMs)

        return this.makeRequest<T>(endpoint, options, retryCount + 1)
      }

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Instantly API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      // Handle timeout/abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        if (retryCount >= MAX_RETRIES) {
          throw new Error(`Instantly API timeout after ${TIMEOUT_MS}ms (${MAX_RETRIES} retries)`)
        }

        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount)
        console.log(`⏳ Request timeout, waiting ${delayMs}ms before retry ${retryCount + 1}/${MAX_RETRIES}...`)
        await this.delay(delayMs)

        return this.makeRequest<T>(endpoint, options, retryCount + 1)
      }

      // Handle network errors with retry
      if (error instanceof TypeError && error.message.includes('fetch')) {
        if (retryCount >= MAX_RETRIES) {
          throw new Error(`Network error connecting to Instantly API after ${MAX_RETRIES} retries: ${error.message}`)
        }

        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount)
        console.log(`⏳ Network error, waiting ${delayMs}ms before retry ${retryCount + 1}/${MAX_RETRIES}...`)
        await this.delay(delayMs)

        return this.makeRequest<T>(endpoint, options, retryCount + 1)
      }

      throw error
    }
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
   * Lead status filter values for Instantly API
   * See: https://developer.instantly.ai/api/v2/lead/listleads
   */
  static readonly LEAD_STATUS_FILTER = {
    ACTIVE: 'FILTER_VAL_ACTIVE',
    PAUSED: 'FILTER_VAL_PAUSED',
    COMPLETED: 'FILTER_VAL_COMPLETED',
    NOT_YET_CONTACTED: 'FILTER_VAL_NOT_YET_CONTACTED',
  } as const

  /**
   * List leads with optional filters
   * @param options - Filter options including campaign_id, limit, starting_after, lead_status_filter
   */
  async listLeads(options: {
    campaign_id?: string
    list_id?: string
    limit?: number
    starting_after?: string
    email?: string
    lead_status_filter?: string // e.g. 'FILTER_VAL_COMPLETED'
  } = {}): Promise<InstantlyLeadListResponse> {
    const requestBody: Record<string, any> = {}

    if (options.campaign_id) requestBody.campaign_id = options.campaign_id
    if (options.list_id) requestBody.list_id = options.list_id
    if (options.limit) requestBody.limit = options.limit
    if (options.starting_after) requestBody.starting_after = options.starting_after
    if (options.email) requestBody.email = options.email
    if (options.lead_status_filter) requestBody.lead_status_filter = options.lead_status_filter

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
   * @param options - Additional options like limit, lead_status_filter, maxLeads, and filter function
   */
  async listLeadsByCampaign(
    campaignId: string,
    options: {
      limit?: number
      lead_status_filter?: string
      maxLeads?: number
      filterFn?: (lead: InstantlyLead) => boolean
    } = {}
  ): Promise<InstantlyLead[]> {
    const allLeads: InstantlyLead[] = []
    let startingAfter: string | undefined
    const limit = options.limit || 100
    const maxLeads = options.maxLeads || Infinity
    let pageCount = 0
    let totalFetched = 0

    do {
      pageCount++
      console.log(`      📄 Page ${pageCount}: fetching...`)

      const response = await this.listLeads({
        campaign_id: campaignId,
        limit,
        starting_after: startingAfter,
        lead_status_filter: options.lead_status_filter,
      })

      totalFetched += response.items.length

      // Apply filter if provided, otherwise add all
      if (options.filterFn) {
        const eligibleFromPage = response.items.filter(options.filterFn)
        console.log(`      📄 Page ${pageCount}: ${response.items.length} fetched, ${eligibleFromPage.length} eligible`)

        // Only add as many as we need to reach maxLeads
        const remainingSlots = maxLeads - allLeads.length
        const leadsToAdd = eligibleFromPage.slice(0, remainingSlots)
        allLeads.push(...leadsToAdd)
      } else {
        // Only add as many as we need to reach maxLeads
        const remainingSlots = maxLeads - allLeads.length
        const leadsToAdd = response.items.slice(0, remainingSlots)
        allLeads.push(...leadsToAdd)
      }

      // Stop if we have enough leads
      if (allLeads.length >= maxLeads) {
        console.log(`      ✅ Reached target of ${maxLeads} eligible leads, stopping pagination`)
        break
      }

      startingAfter = response.next_starting_after

      // Rate limiting: Instantly API official 100 req/10sec, 600 req/min
      // Using 500ms delay = 2 req/sec to be safe
      if (startingAfter) {
        await this.delay(500)
      }
    } while (startingAfter)

    console.log(`      ✅ Done: ${allLeads.length} eligible leads from ${totalFetched} total (${pageCount} pages)`)
    return allLeads
  }

  /**
   * Create a new lead in Instantly
   * @param leadData - The lead data to create
   */
  async createLead(leadData: {
    campaign: string
    email: string
    first_name?: string
    last_name?: string
    company_name?: string
    website?: string
    phone?: string
    linkedIn?: string
    company_size?: string
    jobTitle?: string
    personalization?: string
    lt_interest_status?: number
    assigned_to?: string
    skip_if_in_workspace?: boolean
    skip_if_in_campaign?: boolean
    skip_if_in_list?: boolean
    custom_variables?: Record<string, string>
  }): Promise<{ success: boolean; leadId?: string; error?: string; skipped?: boolean }> {
    try {
      const response = await this.makeRequest<any>('/leads', {
        method: 'POST',
        body: JSON.stringify(leadData),
      })

      // Check if the lead was skipped due to duplicate
      if (response.skipped || response.status === 'skipped') {
        return {
          success: true,
          skipped: true,
          leadId: response.id || response.lead_id
        }
      }

      return {
        success: true,
        leadId: response.id || response.lead_id,
        skipped: false
      }
    } catch (error) {
      console.error('Error creating lead:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
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
   * Delete a lead from Instantly by ID
   * Use this after syncing to Pipedrive to remove the lead from Instantly
   * @param leadId - The lead's unique identifier (UUID)
   * @returns The deleted lead object
   */
  async deleteLead(leadId: string): Promise<InstantlyLead | null> {
    try {
      const response = await this.makeRequest<InstantlyLead>(`/leads/${leadId}`, {
        method: 'DELETE',
      })
      console.log(`🗑️ Successfully deleted lead ${leadId} from Instantly`)
      return response
    } catch (error) {
      console.error(`Failed to delete lead ${leadId}:`, error)
      throw error
    }
  }

  /**
   * Delete a lead from Instantly by email
   * Finds the lead by email first, then deletes it
   * @param email - The lead's email address
   * @param campaignId - Optional campaign ID to find the specific lead
   * @returns The deleted lead object or null if not found
   */
  async deleteLeadByEmail(email: string, campaignId?: string): Promise<InstantlyLead | null> {
    try {
      const lead = await this.getLeadByEmail(email, campaignId)

      if (!lead || !lead.id) {
        console.log(`Lead with email ${email} not found in Instantly`)
        return null
      }

      return await this.deleteLead(lead.id)
    } catch (error) {
      console.error(`Failed to delete lead by email ${email}:`, error)
      throw error
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
  // LEAD LABEL METHODS
  // ============================================================================

  /**
   * List all lead labels for the organization
   * Custom labels have interest_status values outside the standard range (-4 to 4)
   * @returns Array of lead labels with their interest_status mappings
   */
  async listLeadLabels(): Promise<InstantlyLeadLabel[]> {
    const allLabels: InstantlyLeadLabel[] = []
    let startingAfter: string | undefined

    do {
      const params = new URLSearchParams()
      params.set('limit', '100')
      if (startingAfter) params.set('starting_after', startingAfter)

      const response = await this.makeRequest<InstantlyLeadLabelListResponse>(
        `/lead-labels?${params.toString()}`
      )

      allLabels.push(...(response.items || []))
      startingAfter = response.next_starting_after

      // Rate limiting between pagination requests
      if (startingAfter) {
        await this.delay(100)
      }
    } while (startingAfter)

    return allLabels
  }

  /**
   * Get a specific lead label by ID
   * @param labelId - The label's unique identifier
   */
  async getLeadLabel(labelId: string): Promise<InstantlyLeadLabel | null> {
    try {
      return await this.makeRequest<InstantlyLeadLabel>(`/lead-labels/${labelId}`)
    } catch (error) {
      console.error('Error getting lead label:', error)
      return null
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

  /**
   * List campaigns filtered by tag ID
   * @param tagId - The custom tag ID to filter by
   */
  async listCampaignsByTag(tagId: string): Promise<InstantlyCampaign[]> {
    const allCampaigns: InstantlyCampaign[] = []
    let startingAfter: string | undefined = undefined

    do {
      let url = `/campaigns?tag_ids=${tagId}&limit=100`
      if (startingAfter) {
        url += `&starting_after=${startingAfter}`
      }

      const response = await this.makeRequest<any>(url)
      const campaigns = response.items || []
      allCampaigns.push(...campaigns)

      if (!response.next_starting_after || campaigns.length < 100) {
        break
      }
      startingAfter = response.next_starting_after

      // Safety limit
      if (allCampaigns.length >= 500) {
        console.warn('Reached maximum campaign limit of 500')
        break
      }

      await this.delay(100)
    } while (true)

    return allCampaigns
  }

  /**
   * List campaigns that have the "Algemene mailcampagnes" tag
   * These are the only campaigns that should be synced to Pipedrive
   */
  async listAlgemeneCampagnes(): Promise<InstantlyCampaign[]> {
    return this.listCampaignsByTag(ALGEMENE_MAILCAMPAGNES_TAG_ID)
  }

  /**
   * Check if a campaign has the "Algemene mailcampagnes" tag
   * @param campaignId - The campaign ID to check
   */
  async isCampaignAlgemene(campaignId: string): Promise<boolean> {
    const campaign = await this.getCampaign(campaignId)
    if (!campaign || !campaign.tag_ids) return false

    // tag_ids is a comma-separated string of tag IDs
    const tagIds = campaign.tag_ids.split(',').map(id => id.trim())
    return tagIds.includes(ALGEMENE_MAILCAMPAGNES_TAG_ID)
  }

  /**
   * List all custom tags in the organization
   */
  async listCustomTags(): Promise<InstantlyCustomTag[]> {
    const allTags: InstantlyCustomTag[] = []
    let startingAfter: string | undefined = undefined

    do {
      let url = `/custom-tags?limit=100`
      if (startingAfter) {
        url += `&starting_after=${startingAfter}`
      }

      const response = await this.makeRequest<any>(url)
      const tags = response.items || []
      allTags.push(...tags)

      if (!response.next_starting_after || tags.length < 100) {
        break
      }
      startingAfter = response.next_starting_after

      await this.delay(100)
    } while (true)

    return allTags
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
      // Instantly API v2 uses 'target_hook_url' instead of 'webhook_url'
      const response = await this.makeRequest<InstantlyWebhook>('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          target_hook_url: webhookUrl,
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

  // ============================================================================
  // EMAIL METHODS
  // ============================================================================

  /**
   * List emails with optional filters
   * @param options - Filter options including lead email, campaign_id, email_type
   */
  async listEmails(options: {
    lead?: string // Lead email address
    campaign_id?: string
    email_type?: 'sent' | 'received'
    limit?: number
    starting_after?: string
  } = {}): Promise<InstantlyEmailListResponse> {
    const searchParams = new URLSearchParams()

    if (options.lead) searchParams.set('lead', options.lead.toLowerCase().trim())
    if (options.campaign_id) searchParams.set('campaign_id', options.campaign_id)
    if (options.email_type) searchParams.set('email_type', options.email_type)
    if (options.limit) searchParams.set('limit', options.limit.toString())
    if (options.starting_after) searchParams.set('starting_after', options.starting_after)

    const endpoint = `/emails${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    const response = await this.makeRequest<any>(endpoint)

    return {
      items: response.items || [],
      next_starting_after: response.next_starting_after
    }
  }

  /**
   * Get all emails for a specific lead (sent and received)
   * @param leadEmail - The lead's email address
   * @param campaignId - Optional campaign ID to filter by
   */
  async getLeadEmailHistory(
    leadEmail: string,
    campaignId?: string
  ): Promise<InstantlyEmail[]> {
    const allEmails: InstantlyEmail[] = []
    let startingAfter: string | undefined
    const limit = 50

    do {
      const response = await this.listEmails({
        lead: leadEmail,
        campaign_id: campaignId,
        limit,
        starting_after: startingAfter
      })

      allEmails.push(...response.items)
      startingAfter = response.next_starting_after

      // Rate limiting: Emails endpoint has stricter limit (20 req/min observed)
      // Using 3.5 second delay to stay safe
      if (startingAfter) {
        await this.delay(3500)
      }
    } while (startingAfter)

    // Sort by timestamp (oldest first)
    return allEmails.sort((a, b) =>
      new Date(a.timestamp_email).getTime() - new Date(b.timestamp_email).getTime()
    )
  }

  /**
   * Get a summary of email conversation for a lead
   * @param leadEmail - The lead's email address
   * @param campaignId - Optional campaign ID
   * @returns Formatted summary of the email conversation
   */
  async getLeadEmailSummary(
    leadEmail: string,
    campaignId?: string
  ): Promise<{
    totalEmails: number
    sentCount: number
    receivedCount: number
    emails: Array<{
      type: 'sent' | 'received'
      date: string
      subject: string
      preview: string
    }>
  }> {
    const emails = await this.getLeadEmailHistory(leadEmail, campaignId)

    let sentCount = 0
    let receivedCount = 0

    const emailSummaries = emails.map(email => {
      // Determine if sent or received based on to_address
      const isSent = email.to_address_email_list?.toLowerCase().includes(leadEmail.toLowerCase())
        || email.email_type === 'sent'
      const isReceived = !isSent || email.email_type === 'received'

      if (isSent && !isReceived) {
        sentCount++
      } else {
        receivedCount++
      }

      // Get preview (first 200 chars of body)
      const bodyText = email.body?.text || ''
      const preview = bodyText.substring(0, 200).replace(/\n/g, ' ').trim()

      return {
        type: (isReceived ? 'received' : 'sent') as 'sent' | 'received',
        date: email.timestamp_email,
        subject: email.subject || '(geen onderwerp)',
        preview: preview + (bodyText.length > 200 ? '...' : '')
      }
    })

    return {
      totalEmails: emails.length,
      sentCount,
      receivedCount,
      emails: emailSummaries
    }
  }
}

// Export singleton instance
export const instantlyClient = new InstantlyClient()