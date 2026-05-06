import { createClient } from "@/lib/supabase"
import { apolloStatusService } from "@/lib/apollo-status-service"
import { cacheService, CacheService } from "@/lib/cache-service"
import { performanceMonitor } from "@/lib/performance-monitoring"

export interface ApolloEnrichmentResult {
  company_id: string
  batch_id: string
  success: boolean
  contacts_found: number
  enrichment_data?: {
    contacts: Array<{
      name: string
      email: string
      title: string
      phone?: string
      linkedin?: string
    }>
    company_info?: {
      employee_count?: number
      industry?: string
      technologies?: string[]
      social_profiles?: Record<string, string>
    }
  }
  error_message?: string
}

export interface CompanyDataUpdate {
  apollo_enriched_at: string
  apollo_contacts_count: number
  apollo_enrichment_data: any
  enrichment_status: 'completed' | 'failed'
}

export class CompanyEnrichmentService {
  private get client() {
    return createClient()
  }

  /**
   * Process Apollo webhook result and update company data
   */
  async processEnrichmentResult(result: ApolloEnrichmentResult): Promise<{
    success: boolean
    updated_records: number
    error?: string
  }> {
    return performanceMonitor.timeFunction(
      'company_enrichment_service.processEnrichmentResult',
      async () => {
        const { company_id, batch_id, success, contacts_found, enrichment_data, error_message } = result

        try {
          // process_enrichment_completion RPC no longer exists in DB — handled inline
          if (success && enrichment_data?.contacts) {
            // Insert or update contacts
            await this.upsertContacts(company_id, enrichment_data.contacts)
          }

          // Clear relevant caches
          apolloStatusService.clearCache(batch_id)
          cacheService.delete(CacheService.getCompanyKey(company_id))

          // Record performance metrics
          performanceMonitor.recordMetric({
            name: 'enrichment_processed',
            value: 1,
            unit: 'count',
            tags: {
              success: success.toString(),
              contacts_found: contacts_found.toString(),
              batch_id
            }
          })

          return {
            success: true,
            updated_records: success ? 1 : 0
          }

        } catch (error) {
          console.error('Error processing enrichment result:', error)
          
          // Record error metric
          performanceMonitor.recordMetric({
            name: 'enrichment_processing_error',
            value: 1,
            unit: 'count',
            tags: { batch_id, company_id }
          })

          return {
            success: false,
            updated_records: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      },
      { company_id: result.company_id, batch_id: result.batch_id }
    )
  }

  /**
   * Insert or update contacts from enrichment data
   */
  private async upsertContacts(
    companyId: string, 
    contacts: Array<{
      name: string
      email: string
      title: string
      phone?: string
      linkedin?: string
    }>
  ): Promise<void> {
    try {
      const contactsToInsert = contacts.map(contact => ({
        company_id: companyId,
        name: contact.name,
        first_name: contact.name.split(' ')[0] || '',
        last_name: contact.name.split(' ').slice(1).join(' ') || '',
        email: contact.email,
        title: contact.title,
        phone: contact.phone || null,
        linkedin_profile: contact.linkedin || null,
        source: 'apollo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      // Use upsert to handle duplicates
      const { error } = await this.client
        .from('contacts')
        .upsert(contactsToInsert, {
          onConflict: 'company_id,email', // Assuming composite unique constraint
          ignoreDuplicates: false
        })

      if (error) {
        console.error('Error upserting contacts:', error)
        throw error
      }

      console.log(`Upserted ${contactsToInsert.length} contacts for company ${companyId}`)

    } catch (error) {
      console.error('Error in upsertContacts:', error)
      throw error
    }
  }

  /**
   * Get enrichment status for multiple companies
   */
  async getBatchEnrichmentStatus(companyIds: string[]): Promise<Record<string, {
    status: string
    contacts_count: number
    enriched_at: string | null
  }>> {
    try {
      const { data, error } = await this.client
        .from('companies')
        .select('id, apollo_enriched_at, apollo_contacts_count, enrichment_status')
        .in('id', companyIds)

      if (error) throw error

      const result: Record<string, any> = {}
      data?.forEach(company => {
        result[company.id] = {
          status: company.enrichment_status || 'pending',
          contacts_count: company.apollo_contacts_count || 0,
          enriched_at: company.apollo_enriched_at
        }
      })

      return result

    } catch (error) {
      console.error('Error getting batch enrichment status:', error)
      throw error
    }
  }

  /**
   * Validate enrichment data before processing
   */
  validateEnrichmentData(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!data.company_id) {
      errors.push('Missing company_id')
    }

    if (!data.batch_id) {
      errors.push('Missing batch_id')
    }

    if (typeof data.success !== 'boolean') {
      errors.push('Missing or invalid success flag')
    }

    if (data.success && !data.contacts_found) {
      errors.push('Success=true but no contacts_found specified')
    }

    if (data.enrichment_data?.contacts && !Array.isArray(data.enrichment_data.contacts)) {
      errors.push('enrichment_data.contacts must be an array')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

// Export singleton instance
export const companyEnrichmentService = new CompanyEnrichmentService()