import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

interface EnrichCompanyRequest {
  companyId: string
  website?: string
  name?: string
}

interface BulkEnrichRequest {
  companyIds: string[]
}

// Rate limiting configuration
const RATE_LIMIT = {
  requests_per_minute: 10,
  requests_per_hour: 100,
  concurrent_requests: 3
}

// In-memory rate limiting (in production, use Redis or database)
const rateLimitStore = new Map<string, { requests: number, resetTime: number }>()

function checkRateLimit(userId: string): { allowed: boolean, retryAfter?: number } {
  const now = Date.now()
  const windowStart = Math.floor(now / 60000) * 60000 // 1-minute windows
  const key = `${userId}:${windowStart}`
  
  const current = rateLimitStore.get(key) || { requests: 0, resetTime: windowStart + 60000 }
  
  if (current.requests >= RATE_LIMIT.requests_per_minute) {
    return { allowed: false, retryAfter: Math.ceil((current.resetTime - now) / 1000) }
  }
  
  rateLimitStore.set(key, { ...current, requests: current.requests + 1 })
  
  // Clean up old entries
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetTime < now - 60000) {
      rateLimitStore.delete(k)
    }
  }
  
  return { allowed: true }
}

async function enrichWithApollo(company: any): Promise<any> {
  // Mock Apollo API integration for now - replace with actual Apollo API calls
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  
  // Simulate API call delay
  await delay(1000 + Math.random() * 2000)
  
  // Simulate random success/failure
  if (Math.random() < 0.1) { // 10% failure rate for testing
    throw new Error('Apollo API rate limit exceeded')
  }
  
  // Mock enriched data
  const mockContacts = [
    {
      name: `John Doe - ${company.name}`,
      email: `john@${company.website?.replace('https://', '').replace('http://', '').split('/')[0] || 'company.com'}`,
      title: 'CEO',
      linkedin_url: 'https://linkedin.com/in/johndoe',
      phone: '+31-6-12345678'
    },
    {
      name: `Jane Smith - ${company.name}`,
      email: `jane@${company.website?.replace('https://', '').replace('http://', '').split('/')[0] || 'company.com'}`,
      title: 'Operations Manager',
      linkedin_url: 'https://linkedin.com/in/janesmith',
      phone: '+31-6-87654321'
    }
  ]
  
  return {
    contacts: mockContacts,
    organization: {
      employees: Math.floor(Math.random() * 500) + 10,
      industry: 'Logistics',
      founded_year: 2000 + Math.floor(Math.random() * 20),
      description: `${company.name} is a leading company in the logistics industry.`
    }
  }
}

// Single company enrichment
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user from session
    // Skip authentication for now
    // TODO: Implement proper authentication later

    // Skip rate limiting for now
    // TODO: Implement proper rate limiting later

    const body: EnrichCompanyRequest = await request.json()
    const { companyId, website, name } = body

    // Validate input
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 }
      )
    }

    // Get company details
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, website, enrichment_status, apollo_enriched_at')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }

    // Check if recently enriched (within last 24 hours)
    const lastEnriched = company.apollo_enriched_at ? new Date(company.apollo_enriched_at) : null
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    if (lastEnriched && lastEnriched > twentyFourHoursAgo) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Company was enriched recently. Please wait 24 hours before re-enriching.',
          lastEnriched: lastEnriched.toISOString()
        },
        { status: 409 }
      )
    }

    // Mark as enriching
    await supabase
      .from('companies')
      .update({
        enrichment_status: 'processing',
        enrichment_started_at: new Date().toISOString()
      })
      .eq('id', companyId)

    try {
      // Call Apollo API (mocked for now)
      const enrichmentData = await enrichWithApollo({
        ...company,
        website: website || company.website,
        name: name || company.name
      })

      // Save contacts to database
      const contactsToInsert = enrichmentData.contacts.map((contact: any) => ({
        id: crypto.randomUUID(),
        name: contact.name,
        email: contact.email,
        title: contact.title,
        linkedin_url: contact.linkedin_url,
        phone: contact.phone,
        company_id: companyId,
        created_at: new Date().toISOString()
      }))

      // Insert contacts
      const { error: contactsError } = await supabase
        .from('contacts')
        .insert(contactsToInsert)

      if (contactsError) {
        console.error('Error inserting contacts:', contactsError)
        // Continue with company update even if contacts fail
      }

      // Update company with enrichment data
      const { data: updatedCompany, error: updateError } = await supabase
        .from('companies')
        .update({
          enrichment_status: 'completed',
          apollo_enriched_at: new Date().toISOString(),
          enrichment_completed_at: new Date().toISOString(),
          apollo_contacts_count: enrichmentData.contacts.length,
          apollo_enrichment_data: enrichmentData,
          enrichment_error_message: null
        })
        .eq('id', companyId)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating company:', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to save enrichment data' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          company: updatedCompany,
          contacts_added: enrichmentData.contacts.length,
          enrichment_data: enrichmentData,
          message: `Successfully enriched ${company.name} with ${enrichmentData.contacts.length} contacts`
        }
      })

    } catch (enrichmentError: any) {
      console.error('Apollo enrichment failed:', enrichmentError)
      
      // Mark as failed
      await supabase
        .from('companies')
        .update({
          enrichment_status: 'failed',
          enrichment_completed_at: new Date().toISOString(),
          enrichment_error_message: enrichmentError.message
        })
        .eq('id', companyId)

      return NextResponse.json(
        { 
          success: false, 
          error: 'Enrichment failed',
          details: enrichmentError.message 
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error in Apollo enrichment:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Bulk enrichment
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user from session
    // Skip authentication for now
    // TODO: Implement proper authentication later

    const body: BulkEnrichRequest = await request.json()
    const { companyIds } = body

    // Validate input
    if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Company IDs array is required' },
        { status: 400 }
      )
    }

    // Limit bulk operations
    if (companyIds.length > 20) {
      return NextResponse.json(
        { success: false, error: 'Maximum 20 companies can be enriched at once' },
        { status: 400 }
      )
    }

    // Create enrichment batch record
    const batchId = crypto.randomUUID()
    const { error: batchError } = await supabase
      .from('enrichment_batches')
      .insert({
        id: batchId,
        batch_id: `batch_${Date.now()}`,
        status: 'processing',
        total_companies: companyIds.length,
        started_at: new Date().toISOString()
      })

    if (batchError) {
      console.error('Error creating enrichment batch:', batchError)
      return NextResponse.json(
        { success: false, error: 'Failed to create enrichment batch' },
        { status: 500 }
      )
    }

    // Queue enrichment jobs (for now, we'll process them immediately)
    // In production, this should be handled by a background job queue
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[]
    }

    for (const companyId of companyIds) {
      try {
        // Skip rate limiting for now
        // TODO: Implement proper rate limiting later

        // Make individual enrichment call
        const enrichResponse = await fetch(
          `${request.nextUrl.origin}/api/otis/apollo/enrich`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': request.headers.get('Authorization') || ''
            },
            body: JSON.stringify({ companyId })
          }
        )

        if (enrichResponse.ok) {
          results.success++
        } else {
          results.failed++
          const errorData = await enrichResponse.json()
          results.errors.push(`Company ${companyId}: ${errorData.error}`)
        }

        // Small delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error: any) {
        results.failed++
        results.errors.push(`Company ${companyId}: ${error.message}`)
      }
    }

    // Update batch status
    await supabase
      .from('enrichment_batches')
      .update({
        status: 'completed',
        completed_companies: results.success,
        failed_companies: results.failed,
        completed_at: new Date().toISOString()
      })
      .eq('id', batchId)

    return NextResponse.json({
      success: true,
      data: {
        batch_id: batchId,
        total_processed: companyIds.length,
        successful: results.success,
        failed: results.failed,
        errors: results.errors.slice(0, 10), // Limit error messages
        message: `Bulk enrichment completed: ${results.success} successful, ${results.failed} failed`
      }
    })

  } catch (error) {
    console.error('Error in bulk Apollo enrichment:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}