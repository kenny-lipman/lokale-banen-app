/**
 * Instantly.ai API Client
 * Handles blocklist operations with the Instantly.ai API v2
 */

import { getInstantlyConfig } from './api-config'

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
    const config = getInstantlyConfig()
    this.apiKey = config.apiKey
    this.baseUrl = `${config.baseUrl}/api/v2`
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (response.status === 429) {
      // Rate limit hit - wait and retry once
      await this.delay(2000)
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
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
   * Add an email or domain to the blocklist
   */
  async addToBlocklist(blValue: string): Promise<InstantlyBlocklistEntry> {
    if (!this.isValidEmail(blValue) && !this.isValidDomain(blValue)) {
      throw new Error(`Invalid email or domain format: ${blValue}`)
    }

    const response = await this.makeRequest<InstantlyBlocklistEntry>('/block-lists-entries', {
      method: 'POST',
      body: JSON.stringify({ bl_value: blValue }),
    })

    return response
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
    return this.makeRequest<InstantlyListResponse>(endpoint)
  }

  /**
   * Check if an email or domain is already in the blocklist
   */
  async isBlocked(blValue: string): Promise<boolean> {
    try {
      const response = await this.getBlocklist({ search: blValue, limit: 1 })
      return response.data.some(entry => entry.bl_value === blValue)
    } catch (error) {
      console.error('Error checking if blocked:', error)
      return false
    }
  }

  /**
   * Add multiple entries to blocklist with rate limiting
   */
  async addMultipleToBlocklist(blValues: string[]): Promise<{
    success: InstantlyBlocklistEntry[]
    failed: { value: string; error: string }[]
  }> {
    const success: InstantlyBlocklistEntry[] = []
    const failed: { value: string; error: string }[] = []

    for (const blValue of blValues) {
      try {
        // Check if already exists to avoid duplicates
        const isAlreadyBlocked = await this.isBlocked(blValue)
        if (isAlreadyBlocked) {
          console.log(`Skipping ${blValue} - already in blocklist`)
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

    return { success, failed }
  }
}

// Export singleton instance
export const instantlyClient = new InstantlyClient()