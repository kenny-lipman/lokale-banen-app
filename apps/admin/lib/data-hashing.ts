/**
 * Data change detection utilities
 * Provides efficient content hashing and comparison to prevent unnecessary UI updates
 */

export interface DataSnapshot {
  companiesCount: number
  jobsCount: number
  enrichmentStatus: string
  lastUpdate: string
  hash: string
}

/**
 * Generate a simple hash for data comparison
 * @param data - The data object to hash
 * @returns A 16-character hash string
 */
export function generateDataHash(data: any): string {
  try {
    // Extract key fields for comparison
    const keyData = {
      companiesCount: data.total_companies || data.companiesCount || 0,
      jobsCount: data.total_jobs || data.jobsCount || 0,
      enrichmentStatus: data.status || data.enrichmentStatus || '',
      lastUpdate: data.updated_at || data.lastUpdate || ''
    }
    
    // Convert to string and create hash
    const dataString = JSON.stringify(keyData)
    return btoa(dataString).slice(0, 16) // Simple base64 hash, first 16 chars
  } catch (error) {
    console.error('Error generating data hash:', error)
    return Date.now().toString(36) // Fallback hash
  }
}

/**
 * Create a data snapshot with hash for change detection
 * @param data - The data object to snapshot
 * @returns DataSnapshot with hash
 */
export function createDataSnapshot(data: any): DataSnapshot {
  const hash = generateDataHash(data)
  
  return {
    companiesCount: data.total_companies || data.companiesCount || 0,
    jobsCount: data.total_jobs || data.jobsCount || 0,
    enrichmentStatus: data.status || data.enrichmentStatus || '',
    lastUpdate: data.updated_at || data.lastUpdate || '',
    hash
  }
}

/**
 * Check if data has changed by comparing hashes
 * @param currentSnapshot - Current data snapshot
 * @param newData - New data to compare
 * @returns True if data has changed, false otherwise
 */
export function hasDataChanged(currentSnapshot: DataSnapshot | null, newData: any): boolean {
  if (!currentSnapshot) {
    return true // No previous data, consider it changed
  }
  
  const newHash = generateDataHash(newData)
  return newHash !== currentSnapshot.hash
}

/**
 * Get detailed change information
 * @param currentSnapshot - Current data snapshot
 * @param newData - New data to compare
 * @returns Object with change details
 */
export function getChangeDetails(currentSnapshot: DataSnapshot | null, newData: any) {
  if (!currentSnapshot) {
    return {
      hasChanged: true,
      changes: ['initial_data'],
      newSnapshot: createDataSnapshot(newData)
    }
  }
  
  const newSnapshot = createDataSnapshot(newData)
  const changes: string[] = []
  
  if (newSnapshot.companiesCount !== currentSnapshot.companiesCount) {
    changes.push('companies_count')
  }
  
  if (newSnapshot.jobsCount !== currentSnapshot.jobsCount) {
    changes.push('jobs_count')
  }
  
  if (newSnapshot.enrichmentStatus !== currentSnapshot.enrichmentStatus) {
    changes.push('enrichment_status')
  }
  
  if (newSnapshot.lastUpdate !== currentSnapshot.lastUpdate) {
    changes.push('last_update')
  }
  
  return {
    hasChanged: changes.length > 0,
    changes,
    newSnapshot,
    previousSnapshot: currentSnapshot
  }
}

/**
 * Optimized hash generation for large datasets
 * @param data - Large data object
 * @param fields - Specific fields to include in hash
 * @returns Hash string
 */
export function generateOptimizedHash(data: any, fields: string[] = []): string {
  try {
    // If specific fields are provided, only hash those
    if (fields.length > 0) {
      const filteredData: any = {}
      fields.forEach(field => {
        if (data.hasOwnProperty(field)) {
          filteredData[field] = data[field]
        }
      })
      return generateDataHash(filteredData)
    }
    
    // Otherwise, use default hash generation
    return generateDataHash(data)
  } catch (error) {
    console.error('Error generating optimized hash:', error)
    return Date.now().toString(36)
  }
}

/**
 * Batch hash generation for multiple data objects
 * @param dataArray - Array of data objects
 * @returns Array of hashes
 */
export function generateBatchHashes(dataArray: any[]): string[] {
  return dataArray.map(data => generateDataHash(data))
}

/**
 * Compare two arrays of data for changes
 * @param currentData - Current data array
 * @param newData - New data array
 * @returns Object with change information
 */
export function compareDataArrays(currentData: any[], newData: any[]): {
  hasChanged: boolean
  added: number
  removed: number
  modified: number
  changes: string[]
} {
  const currentHashes = generateBatchHashes(currentData)
  const newHashes = generateBatchHashes(newData)
  
  const currentSet = new Set(currentHashes)
  const newSet = new Set(newHashes)
  
  const added = newHashes.filter(hash => !currentSet.has(hash)).length
  const removed = currentHashes.filter(hash => !newSet.has(hash)).length
  const modified = Math.min(added, removed) // Simplified modification detection
  
  return {
    hasChanged: added > 0 || removed > 0,
    added,
    removed,
    modified,
    changes: [
      ...(added > 0 ? [`${added} items added`] : []),
      ...(removed > 0 ? [`${removed} items removed`] : []),
      ...(modified > 0 ? [`${modified} items modified`] : [])
    ]
  }
} 