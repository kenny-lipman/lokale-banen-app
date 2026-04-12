/**
 * Import Validation Service
 * Validates parsed blocklist entries before database import
 */

import { createServiceRoleClient } from '../supabase-server'

interface ValidationEntry {
  type: 'email' | 'domain'
  value: string
  reason: string
  row: number
}

interface ValidationError {
  row: number
  field: string
  message: string
  severity: 'error' | 'warning'
}

interface ValidationResult {
  validEntries: ValidationEntry[]
  errors: ValidationError[]
  duplicatesWithinFile: Array<{
    value: string
    rows: number[]
  }>
  duplicatesWithDatabase: Array<{
    value: string
    row: number
  }>
  summary: {
    totalEntries: number
    validEntries: number
    errors: number
    warnings: number
  }
}

export class ImportValidationService {
  /**
   * Validate array of parsed entries
   */
  async validateEntries(entries: ValidationEntry[]): Promise<ValidationResult> {
    const validEntries: ValidationEntry[] = []
    const errors: ValidationError[] = []

    // Step 1: Basic field validation
    for (const entry of entries) {
      const entryErrors = this.validateEntry(entry)
      if (entryErrors.length === 0) {
        validEntries.push(entry)
      } else {
        errors.push(...entryErrors)
      }
    }

    // Step 2: Check for duplicates within file
    const duplicatesWithinFile = this.findDuplicatesWithinFile(entries)

    // Step 3: Check for duplicates with database
    const duplicatesWithDatabase = await this.findDuplicatesWithDatabase(validEntries)

    // Add duplicate warnings
    duplicatesWithinFile.forEach(duplicate => {
      duplicate.rows.forEach(row => {
        errors.push({
          row,
          field: 'value',
          message: `Duplicate entry within file: ${duplicate.value} appears multiple times`,
          severity: 'warning'
        })
      })
    })

    duplicatesWithDatabase.forEach(duplicate => {
      errors.push({
        row: duplicate.row,
        field: 'value',
        message: `Entry already exists in database: ${duplicate.value}`,
        severity: 'warning'
      })
    })

    // Generate summary
    const errorCount = errors.filter(e => e.severity === 'error').length
    const warningCount = errors.filter(e => e.severity === 'warning').length

    return {
      validEntries,
      errors,
      duplicatesWithinFile,
      duplicatesWithDatabase,
      summary: {
        totalEntries: entries.length,
        validEntries: validEntries.length,
        errors: errorCount,
        warnings: warningCount
      }
    }
  }

  /**
   * Validate individual entry
   */
  private validateEntry(entry: ValidationEntry): ValidationError[] {
    const errors: ValidationError[] = []

    // Validate type
    if (!entry.type || (entry.type !== 'email' && entry.type !== 'domain')) {
      errors.push({
        row: entry.row,
        field: 'type',
        message: 'Type must be either "email" or "domain"',
        severity: 'error'
      })
    }

    // Validate value
    if (!entry.value || entry.value.trim().length === 0) {
      errors.push({
        row: entry.row,
        field: 'value',
        message: 'Value is required',
        severity: 'error'
      })
    } else {
      // Format-specific validation
      if (entry.type === 'email') {
        if (!this.isValidEmail(entry.value)) {
          errors.push({
            row: entry.row,
            field: 'value',
            message: `Invalid email format: ${entry.value}`,
            severity: 'error'
          })
        }
      } else if (entry.type === 'domain') {
        if (!this.isValidDomain(entry.value)) {
          errors.push({
            row: entry.row,
            field: 'value',
            message: `Invalid domain format: ${entry.value}`,
            severity: 'error'
          })
        }
      }
    }

    // Validate reason
    if (!entry.reason || entry.reason.trim().length === 0) {
      errors.push({
        row: entry.row,
        field: 'reason',
        message: 'Reason is required',
        severity: 'warning' // Warning, not error, as we can provide default
      })
    }

    return errors
  }

  /**
   * Find duplicates within the file
   */
  private findDuplicatesWithinFile(entries: ValidationEntry[]): Array<{ value: string; rows: number[] }> {
    const valueMap = new Map<string, number[]>()

    entries.forEach(entry => {
      const key = `${entry.type}:${entry.value}`
      if (!valueMap.has(key)) {
        valueMap.set(key, [])
      }
      valueMap.get(key)!.push(entry.row)
    })

    // Find entries that appear multiple times
    return Array.from(valueMap.entries())
      .filter(([_, rows]) => rows.length > 1)
      .map(([key, rows]) => ({
        value: key.split(':')[1], // Remove type prefix
        rows
      }))
  }

  /**
   * Find duplicates with existing database entries
   */
  private async findDuplicatesWithDatabase(entries: ValidationEntry[]): Promise<Array<{ value: string; row: number }>> {
    if (entries.length === 0) return []

    const supabase = createServiceRoleClient()
    const duplicates: Array<{ value: string; row: number }> = []

    // Check in batches to avoid large queries
    const batchSize = 100
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize)
      const values = batch.map(entry => entry.value)

      try {
        const { data: existingEntries, error } = await supabase
          .from('blocklist_entries')
          .select('type, value')
          .in('value', values)

        if (error) {
          console.error('Database check error:', error)
          continue // Skip this batch but continue processing
        }

        // Find matches
        batch.forEach(entry => {
          const exists = existingEntries?.some(existing =>
            existing.value === entry.value && existing.type === entry.type
          )

          if (exists) {
            duplicates.push({
              value: entry.value,
              row: entry.row
            })
          }
        })

      } catch (error) {
        console.error('Database validation error:', error)
        // Continue processing other batches
      }
    }

    return duplicates
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
  }

  /**
   * Validate domain format
   */
  private isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/
    return domainRegex.test(domain.trim())
  }

  /**
   * Filter out entries that failed validation (have errors, not warnings)
   */
  filterValidEntries(entries: ValidationEntry[], errors: ValidationError[]): ValidationEntry[] {
    const errorRows = new Set(errors.filter(e => e.severity === 'error').map(e => e.row))
    return entries.filter(entry => !errorRows.has(entry.row))
  }
}

// Export singleton instance
export const importValidationService = new ImportValidationService()