import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-service'

// Helper function to convert JSON to CSV
function jsonToCsv(data: any[]): string {
  if (data.length === 0) return ''
  
  // Get all unique keys from all objects
  const allKeys = new Set<string>()
  data.forEach(obj => {
    Object.keys(obj).forEach(key => allKeys.add(key))
  })
  
  const headers = Array.from(allKeys)
  const csvHeaders = headers.join(',')
  
  const csvRows = data.map(obj => {
    return headers.map(header => {
      const value = obj[header]
      if (value === null || value === undefined) return ''
      if (typeof value === 'object') return JSON.stringify(value)
      if (typeof value === 'string' && value.includes(',')) return `"${value}"`
      return value
    }).join(',')
  })
  
  return [csvHeaders, ...csvRows].join('\n')
}

// Helper function to flatten nested objects for export
function flattenContactData(contacts: any[]): any[] {
  return contacts.map(contact => ({
    id: contact.id,
    name: contact.name,
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email,
    title: contact.title,
    phone: contact.phone,
    linkedin_url: contact.linkedin_url,
    qualification_status: contact.qualification_status,
    qualification_timestamp: contact.qualification_timestamp,
    qualified_by_user: contact.qualified_by_user,
    qualification_notes: contact.qualification_notes,
    is_key_contact: contact.is_key_contact,
    contact_priority: contact.contact_priority,
    email_status: contact.email_status,
    campaign_id: contact.campaign_id,
    campaign_name: contact.campaign_name,
    instantly_id: contact.instantly_id,
    company_id: contact.company_id,
    company_name: contact.companies?.name,
    company_website: contact.companies?.website,
    company_location: contact.companies?.location,
    company_qualification_status: contact.companies?.qualification_status,
    apollo_enriched_at: contact.companies?.apollo_enriched_at,
    apollo_contacts_count: contact.companies?.apollo_contacts_count,
    created_at: contact.created_at,
    last_touch: contact.last_touch
  }))
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const format = searchParams.get('format') || 'json' // json, csv
    const runId = searchParams.get('runId')
    const qualificationStatus = searchParams.get('qualification')
    const campaignId = searchParams.get('campaignId')
    const isKeyContact = searchParams.get('isKeyContact')
    const emailStatus = searchParams.get('emailStatus')
    const limit = parseInt(searchParams.get('limit') || '1000')
    const includeCompanyData = searchParams.get('includeCompany') !== 'false'
    
    // Validate format
    if (!['json', 'csv'].includes(format)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid format. Must be json or csv'
      }, { status: 400 })
    }
    
    // Validate limit
    if (limit > 10000) {
      return NextResponse.json({
        success: false,
        error: 'Limit cannot exceed 10,000 contacts'
      }, { status: 400 })
    }
    
    // Build base query
    let query = supabase
      .from('contacts')
      .select(`
        id,
        name,
        first_name,
        last_name,
        email,
        title,
        phone,
        linkedin_url,
        qualification_status,
        qualification_timestamp,
        qualified_by_user,
        qualification_notes,
        is_key_contact,
        contact_priority,
        email_status,
        campaign_id,
        campaign_name,
        instantly_id,
        company_id,
        created_at,
        last_touch,
        ${includeCompanyData ? 'companies(id, name, website, location, qualification_status, apollo_enriched_at, apollo_contacts_count)' : ''}
      `)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    // Apply filters
    if (runId) {
      // Get companies from this run
      const { data: runCompanies } = await supabase
        .from('job_postings')
        .select('companies!inner(id)')
        .eq('apify_run_id', runId)
      
      if (runCompanies && runCompanies.length > 0) {
        const companyIds = runCompanies.map(jp => jp.companies?.id).filter(Boolean)
        query = query.in('company_id', companyIds)
      } else {
        // No companies found for this run
        return NextResponse.json({
          success: true,
          data: [],
          message: 'No contacts found for the specified run'
        })
      }
    }
    
    if (qualificationStatus && qualificationStatus !== 'all') {
      if (qualificationStatus === 'pending') {
        query = query.in('qualification_status', ['pending', null])
      } else {
        query = query.eq('qualification_status', qualificationStatus)
      }
    }
    
    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }
    
    if (isKeyContact !== null) {
      query = query.eq('is_key_contact', isKeyContact === 'true')
    }
    
    if (emailStatus && emailStatus !== 'all') {
      if (emailStatus === 'pending') {
        query = query.in('email_status', ['pending', null])
      } else {
        query = query.eq('email_status', emailStatus)
      }
    }
    
    // Execute query
    const { data: contacts, error: contactsError } = await query
    
    if (contactsError) {
      console.error('Error fetching contacts for export:', contactsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch contacts'
      }, { status: 500 })
    }
    
    if (!contacts || contacts.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No contacts found matching the criteria'
      })
    }
    
    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0]
    const runSuffix = runId ? `_run_${runId}` : ''
    const qualificationSuffix = qualificationStatus && qualificationStatus !== 'all' ? `_${qualificationStatus}` : ''
    const filename = `contacts_export${runSuffix}${qualificationSuffix}_${timestamp}.${format}`
    
    if (format === 'csv') {
      // Flatten and convert to CSV
      const flattenedData = flattenContactData(contacts)
      const csvContent = jsonToCsv(flattenedData)
      
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-cache'
        }
      })
    } else {
      // Return JSON with metadata
      const exportData = {
        metadata: {
          exported_at: new Date().toISOString(),
          total_contacts: contacts.length,
          filters: {
            run_id: runId,
            qualification_status: qualificationStatus,
            campaign_id: campaignId,
            is_key_contact: isKeyContact,
            email_status: emailStatus
          },
          format,
          filename
        },
        contacts: includeCompanyData ? contacts : flattenContactData(contacts)
      }
      
      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-cache'
        }
      })
    }
    
  } catch (error) {
    console.error('Error exporting contacts:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}