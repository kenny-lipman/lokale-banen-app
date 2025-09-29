/**
 * Instantly.ai API Client
 * Handles blocklist operations with the Instantly.ai API v2
 */

import { getInstantlyConfigValidated } from './api-config'

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
}

// Export singleton instance
export const instantlyClient = new InstantlyClient()