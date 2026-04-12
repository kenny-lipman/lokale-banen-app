export interface CacheEntry<T> {
  data: T
  expires: number
  hits: number
  created: number
}

export interface CacheStats {
  totalEntries: number
  hitRate: number
  totalHits: number
  totalMisses: number
  memoryUsage: number
}

export class CacheService {
  private cache = new Map<string, CacheEntry<any>>()
  private stats = {
    hits: 0,
    misses: 0
  }
  
  // Cache TTL configurations (in milliseconds)
  private readonly TTL_CONFIG = {
    enrichment_completed: 300000, // 5 minutes for completed enrichments
    enrichment_active: 10000,     // 10 seconds for active enrichments
    company_data: 600000,         // 10 minutes for company data
    batch_status: 30000,          // 30 seconds for batch status
    default: 60000                // 1 minute default
  }

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.stats.misses++
      return null
    }
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }
    
    entry.hits++
    this.stats.hits++
    return entry.data
  }

  /**
   * Set cached data with TTL
   */
  set<T>(key: string, data: T, ttlType: keyof typeof this.TTL_CONFIG = 'default'): void {
    const ttl = this.TTL_CONFIG[ttlType]
    const entry: CacheEntry<T> = {
      data,
      expires: Date.now() + ttl,
      hits: 0,
      created: Date.now()
    }
    
    this.cache.set(key, entry)
  }

  /**
   * Set cached data with custom TTL
   */
  setWithTTL<T>(key: string, data: T, ttl: number): void {
    const entry: CacheEntry<T> = {
      data,
      expires: Date.now() + ttl,
      hits: 0,
      created: Date.now()
    }
    
    this.cache.set(key, entry)
  }

  /**
   * Delete cached data
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return false
    }
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key)
      return false
    }
    
    return true
  }

  /**
   * Clear expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let cleaned = 0
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key)
        cleaned++
      }
    }
    
    return cleaned
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.stats.hits = 0
    this.stats.misses = 0
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0
    
    // Estimate memory usage (rough calculation)
    let memoryUsage = 0
    for (const [key, entry] of this.cache.entries()) {
      memoryUsage += key.length * 2 // String key
      memoryUsage += JSON.stringify(entry.data).length * 2 // Data size estimate
      memoryUsage += 64 // Entry overhead
    }
    
    return {
      totalEntries: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      memoryUsage
    }
  }

  /**
   * Get cache entries for debugging
   */
  getEntries(): Array<{key: string, entry: CacheEntry<any>}> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      entry
    }))
  }

  /**
   * Cache warming for frequently accessed data
   */
  warmCache(warmingData: Array<{key: string, data: any, ttlType?: keyof typeof this.TTL_CONFIG}>): void {
    warmingData.forEach(({ key, data, ttlType = 'default' }) => {
      this.set(key, data, ttlType)
    })
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string, 
    fetchFn: () => Promise<T>, 
    ttlType: keyof typeof this.TTL_CONFIG = 'default'
  ): Promise<T> {
    const cached = this.get<T>(key)
    
    if (cached !== null) {
      return cached
    }
    
    const data = await fetchFn()
    this.set(key, data, ttlType)
    return data
  }

  /**
   * Increment a counter in cache (useful for rate limiting)
   */
  increment(key: string, ttl: number = 60000): number {
    const current = this.get<number>(key) || 0
    const newValue = current + 1
    this.setWithTTL(key, newValue, ttl)
    return newValue
  }

  /**
   * Set cache entry that expires at a specific time
   */
  setExpiresAt<T>(key: string, data: T, expiresAt: Date): void {
    const entry: CacheEntry<T> = {
      data,
      expires: expiresAt.getTime(),
      hits: 0,
      created: Date.now()
    }
    
    this.cache.set(key, entry)
  }

  /**
   * Get cache key for enrichment batch
   */
  static getBatchKey(batchId: string): string {
    return `batch:${batchId}`
  }

  /**
   * Get cache key for company data
   */
  static getCompanyKey(companyId: string): string {
    return `company:${companyId}`
  }

  /**
   * Get cache key for status data
   */
  static getStatusKey(batchId: string, lightweight: boolean = false): string {
    return `status:${batchId}${lightweight ? ':light' : ''}`
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidateByPattern(pattern: string): number {
    let invalidated = 0
    const keysToDelete: string[] = []

    for (const [key] of this.cache.entries()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key)
      invalidated++
    })

    return invalidated
  }

  /**
   * Invalidate all contact-related caches for a specific run
   */
  invalidateContactCaches(runId: string): number {
    return this.invalidateByPattern(`contacts_by_company:${runId}`)
  }
}

// Export singleton instance
export const cacheService = new CacheService()

// Auto cleanup every 5 minutes
setInterval(() => {
  const cleaned = cacheService.cleanup()
  if (cleaned > 0) {
    console.log(`Cache cleanup: removed ${cleaned} expired entries`)
  }
}, 300000)