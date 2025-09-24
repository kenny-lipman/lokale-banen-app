import { SupabaseClient } from '@supabase/supabase-js'

export interface BlocklistEntry {
  id: string
  type: 'email' | 'domain'
  value: string
  reason: string
  is_active: boolean
}

export interface ValidationResult {
  value: string
  is_valid: boolean
  is_blocked: boolean
  blocked_reason?: string
  blocked_by?: string
  validation_errors?: string[]
}

export class BlocklistValidationService {
  private supabase: SupabaseClient
  private blocklistCache: Map<string, BlocklistEntry> = new Map()
  private cacheTimestamp: number = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Validate an email address format
   */
  public validateEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.toLowerCase())
  }

  /**
   * Validate a domain format
   */
  public validateDomainFormat(domain: string): boolean {
    // Allow wildcard domains like *.example.com
    const domainRegex = /^(\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
    return domainRegex.test(domain.toLowerCase())
  }

  /**
   * Extract domain from an email address
   */
  public extractDomainFromEmail(email: string): string | null {
    const parts = email.toLowerCase().split('@')
    if (parts.length === 2) {
      return parts[1]
    }
    return null
  }

  /**
   * Refresh the blocklist cache from database
   */
  private async refreshCache(): Promise<void> {
    const now = Date.now()
    if (now - this.cacheTimestamp < this.CACHE_TTL) {
      return // Cache is still valid
    }

    try {
      const { data, error } = await this.supabase
        .from('blocklist_entries')
        .select('*')
        .eq('is_active', true)

      if (error) {
        console.error('Error fetching blocklist entries:', error)
        return
      }

      this.blocklistCache.clear()
      data?.forEach(entry => {
        const key = `${entry.type}:${entry.value.toLowerCase()}`
        this.blocklistCache.set(key, entry)
      })

      this.cacheTimestamp = now
    } catch (error) {
      console.error('Error refreshing blocklist cache:', error)
    }
  }

  /**
   * Check if a single email or domain is blocked
   */
  public async checkSingle(value: string): Promise<ValidationResult> {
    await this.refreshCache()

    const lowerValue = value.toLowerCase()
    const result: ValidationResult = {
      value,
      is_valid: true,
      is_blocked: false,
      validation_errors: []
    }

    // Determine if it's an email or domain
    const isEmail = this.validateEmailFormat(lowerValue)

    if (isEmail) {
      // Check if the email itself is blocked
      const emailKey = `email:${lowerValue}`
      if (this.blocklistCache.has(emailKey)) {
        const entry = this.blocklistCache.get(emailKey)!
        result.is_blocked = true
        result.blocked_reason = entry.reason
        result.blocked_by = entry.value
        return result
      }

      // Extract domain and check if it's blocked
      const domain = this.extractDomainFromEmail(lowerValue)
      if (domain) {
        const domainKey = `domain:${domain}`
        if (this.blocklistCache.has(domainKey)) {
          const entry = this.blocklistCache.get(domainKey)!
          result.is_blocked = true
          result.blocked_reason = entry.reason
          result.blocked_by = entry.value
          return result
        }

        // Check for wildcard domain matches
        for (const [key, entry] of this.blocklistCache) {
          if (entry.type === 'domain' && entry.value.startsWith('*.')) {
            const baseDomain = entry.value.substring(2)
            if (domain === baseDomain || domain.endsWith(`.${baseDomain}`)) {
              result.is_blocked = true
              result.blocked_reason = entry.reason
              result.blocked_by = entry.value
              return result
            }
          }
        }
      }
    } else if (this.validateDomainFormat(lowerValue)) {
      // It's a domain
      const domainKey = `domain:${lowerValue}`
      if (this.blocklistCache.has(domainKey)) {
        const entry = this.blocklistCache.get(domainKey)!
        result.is_blocked = true
        result.blocked_reason = entry.reason
        result.blocked_by = entry.value
        return result
      }

      // Check if this domain is covered by a wildcard
      for (const [key, entry] of this.blocklistCache) {
        if (entry.type === 'domain' && entry.value.startsWith('*.')) {
          const baseDomain = entry.value.substring(2)
          if (lowerValue === baseDomain || lowerValue.endsWith(`.${baseDomain}`)) {
            result.is_blocked = true
            result.blocked_reason = entry.reason
            result.blocked_by = entry.value
            return result
          }
        }
      }
    } else {
      // Invalid format
      result.is_valid = false
      result.validation_errors?.push('Invalid email or domain format')
    }

    return result
  }

  /**
   * Check multiple emails or domains in bulk
   */
  public async checkBulk(values: string[]): Promise<ValidationResult[]> {
    await this.refreshCache()
    return Promise.all(values.map(value => this.checkSingle(value)))
  }

  /**
   * Filter a list of emails/domains and return only non-blocked ones
   */
  public async filterAllowed(values: string[]): Promise<string[]> {
    const results = await this.checkBulk(values)
    return results
      .filter(r => r.is_valid && !r.is_blocked)
      .map(r => r.value)
  }

  /**
   * Get statistics about blocked entries
   */
  public async getBlockedStats(values: string[]): Promise<{
    total: number
    blocked: number
    allowed: number
    invalid: number
    blocked_by_email: number
    blocked_by_domain: number
  }> {
    const results = await this.checkBulk(values)

    const blocked_emails = results.filter(r =>
      r.is_blocked && this.validateEmailFormat(r.value)
    )

    const blocked_by_email = blocked_emails.filter(r =>
      r.blocked_by && this.validateEmailFormat(r.blocked_by)
    ).length

    const blocked_by_domain = blocked_emails.filter(r =>
      r.blocked_by && !this.validateEmailFormat(r.blocked_by!)
    ).length

    return {
      total: results.length,
      blocked: results.filter(r => r.is_blocked).length,
      allowed: results.filter(r => r.is_valid && !r.is_blocked).length,
      invalid: results.filter(r => !r.is_valid).length,
      blocked_by_email,
      blocked_by_domain
    }
  }

  /**
   * Clear the cache to force refresh on next check
   */
  public clearCache(): void {
    this.blocklistCache.clear()
    this.cacheTimestamp = 0
  }
}