import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { RateLimiter, RateLimitUtils } from '@/middleware/rate-limiting'

const INSTANTLY_API_KEY = "ZmVlNjJlZjktNWQwMC00Y2JmLWFiNmItYmU4YTk1YWEyMGE0OlFFeFVoYk9Ra1FXbw=="

// Create rate limiter for campaign additions
const campaignAdditionLimiter = new RateLimiter({
  windowMs: 300000, // 5 minutes
  maxRequests: 10, // 10 campaign additions per 5 minutes
  keyGenerator: (req) => {
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown'
    return `campaign_addition:${ip}`
  }
})

async function addToCampaignHandler(request: NextRequest, authResult: AuthResult) {
  try {
    // Apply rate limiting
    const rateLimitResult = await campaignAdditionLimiter.checkLimit(request)
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        retryAfter: rateLimitResult.retryAfter
      }, { 
        status: 429,
        headers: RateLimitUtils.getRateLimitHeaders(rateLimitResult)
      })
    }

    const { contactIds, campaignId, campaignName, runId } = await request.json()
    
    // Enhanced validation for required fields
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Contact IDs array is required and must not be empty',
        code: 'MISSING_CONTACT_IDS'
      }, { status: 400 })
    }
    
    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Valid Campaign ID is required',
        code: 'MISSING_CAMPAIGN_ID'
      }, { status: 400 })
    }

    if (!runId || typeof runId !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Valid Run ID is required',
        code: 'MISSING_RUN_ID'
      }, { status: 400 })
    }

    // Enhanced contact selection limits (increased to 200 as per requirements)
    if (contactIds.length > 200) {
      return NextResponse.json({
        success: false,
        error: 'Batch size cannot exceed 200 contacts',
        code: 'BATCH_SIZE_EXCEEDED',
        maxAllowed: 200,
        requested: contactIds.length
      }, { status: 400 })
    }

    const uniqueContactIds = [...new Set(contactIds)]
    
    // Enhanced contact validation with better error messages
    const { data: contacts, error: contactsError } = await authResult.supabase
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
        company_id,
        qualification_status,
        campaign_id,
        campaign_name,
        companies(
          name,
          website,
          category_size
        )
      `)
      .in('id', uniqueContactIds)
    
    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contacts from database', code: 'DATABASE_ERROR', details: contactsError.message || contactsError },
        { status: 500 }
      )
    }

    // Get regio_platform from apify_runs table using runId
    const { data: apifyRun, error: apifyRunError } = await authResult.supabase
      .from('apify_runs')
      .select(`
        region_id,
        regions(
          regio_platform
        )
      `)
      .eq('id', runId)
      .single()

    if (apifyRunError) {
      console.error('Error fetching apify run:', apifyRunError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch apify run data', code: 'APIFY_RUN_ERROR', details: apifyRunError.message || apifyRunError },
        { status: 500 }
      )
    }

    console.log('Apify run data:', {
      runId,
      apifyRun,
      regionId: apifyRun?.region_id,
      regions: apifyRun?.regions,
      regioPlatform: apifyRun?.regions?.regio_platform
    })

    const regioPlatform = apifyRun?.regions?.regio_platform || null
    
    // Test Instantly API key
    console.log('Testing Instantly API key...')
    try {
      const testResponse = await fetch("https://api.instantly.ai/api/v2/campaigns", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${INSTANTLY_API_KEY}`,
          "Content-Type": "application/json",
        },
      })
      
      console.log('Instantly API test response:', {
        status: testResponse.status,
        statusText: testResponse.statusText
      })
      
      if (!testResponse.ok) {
        console.error('Instantly API key test failed')
        return NextResponse.json(
          { success: false, error: 'Instantly API key is invalid or expired', code: 'INSTANTLY_API_KEY_ERROR' },
          { status: 401 }
        )
      }
    } catch (error) {
      console.error('Error testing Instantly API key:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to connect to Instantly API', code: 'INSTANTLY_API_CONNECTION_ERROR' },
        { status: 500 }
      )
    }
    
    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No contacts found with provided IDs', code: 'NO_CONTACTS_FOUND' },
        { status: 404 }
      )
    }

    console.log('Raw contact data:', contacts.map(c => ({
      id: c.id,
      email: c.email,
      company_id: c.company_id,
      companies: c.companies,
      hasCompanyId: !!c.company_id,
      hasCompaniesData: !!c.companies && Array.isArray(c.companies) && c.companies.length > 0
    })))

    // If companies data is missing, let's fetch it separately
    const contactIdsWithCompanyData = contacts.filter(c => c.company_id).map(c => c.id)
    const contactIdsWithoutCompanyData = contacts.filter(c => !c.company_id).map(c => c.id)
    
    console.log('Contact analysis:', {
      totalContacts: contacts.length,
      withCompanyId: contactIdsWithCompanyData.length,
      withoutCompanyId: contactIdsWithoutCompanyData.length,
      contactIdsWithoutCompanyId: contactIdsWithoutCompanyData
    })

    // Fetch company data separately for contacts that have company_id
    let companyDataMap = {}
    if (contactIdsWithCompanyData.length > 0) {
      const { data: companiesData, error: companiesError } = await authResult.supabase
        .from('companies')
        .select('id, name, website, category_size')
        .in('id', contacts.filter(c => c.company_id).map(c => c.company_id))
      
      if (companiesError) {
        console.error('Error fetching companies data:', companiesError)
      } else {
        companyDataMap = Object.fromEntries(
          (companiesData || []).map(company => [company.id, company])
        )
        console.log('Company data map:', companyDataMap)
      }
    }

    // Check if all requested contacts were found
    if (contacts.length !== uniqueContactIds.length) {
      const foundIds = contacts.map(c => c.id)
      const missingIds = uniqueContactIds.filter(id => !foundIds.includes(id))
      
      return NextResponse.json({
        success: false,
        error: 'Some contacts were not found',
        code: 'PARTIAL_CONTACTS_FOUND',
        found: contacts.length,
        requested: uniqueContactIds.length,
        missingIds
      }, { status: 404 })
    }
    
    const results = []
    const processedContactIds = new Set()
    
    // Step 1: Create leads in Instantly (without campaign assignment)
    console.log(`Starting Step 1: Creating ${contacts.length} leads in Instantly...`)
    
    for (const contact of contacts) {
      // Skip duplicates
      if (processedContactIds.has(contact.id)) {
        continue
      }
      processedContactIds.add(contact.id)
      
      // Enhanced email validation
      if (!contact.email || contact.email.trim() === '') {
        results.push({
          contactId: contact.id,
          contactName: contact.name || contact.id,
          error: 'Contact has no valid email address',
          code: 'MISSING_EMAIL',
          status: 'error',
          step: 'creation'
        })
        continue
      }
      
      // Enhanced email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(contact.email)) {
        results.push({
          contactId: contact.id,
          contactName: contact.name || contact.id,
          error: `Invalid email format: ${contact.email}`,
          code: 'INVALID_EMAIL_FORMAT',
          status: 'error',
          step: 'creation'
        })
        continue
      }

      // Check if contact is already in a campaign
      if (contact.campaign_id) {
        results.push({
          contactId: contact.id,
          contactName: contact.name || contact.id,
          error: `Contact is already in campaign: ${contact.campaign_name || contact.campaign_id}`,
          code: 'ALREADY_IN_CAMPAIGN',
          existingCampaign: contact.campaign_name || contact.campaign_id,
          status: 'skipped',
          step: 'validation'
        })
        continue
      }
      
      // Step 1: Build payload for lead creation with direct campaign assignment
      const company = contact.companies?.[0] || companyDataMap[contact.company_id] // Use join data or fallback to separate fetch
      
      console.log(`Company data for contact ${contact.email}:`, {
        companyId: contact.company_id,
        companyName: company?.name,
        companyWebsite: company?.website,
        companyCategorySize: company?.category_size,
        regioPlatform: regioPlatform,
        source: contact.companies?.[0] ? 'join' : 'separate_fetch'
      })
      
      const leadCreationPayload = {
        email: contact.email.trim(),
        personalization: "",
        website: company?.website || "",
        first_name: contact.first_name || contact.name?.split(" ").slice(0, -1).join(" ") || contact.name || "",
        last_name: contact.last_name || contact.name?.split(" ").slice(-1)[0] || "",
        phone: contact.phone || "",
        company_name: company?.name || "",
        campaign: campaignId, // Only campaign, no list_id
        custom_variables: {
          linkedIn: contact.linkedin_url || "",
          jobTitle: contact.title || "",
          regio_platform: regioPlatform,
          company_size: company?.category_size || null
        },
        lt_interest_status: 1,
        assigned_to: "f191f0de-3753-4ce6-ace1-c1ed1b8a903e",
        skip_if_in_workspace: true,
        skip_if_in_campaign: true,
        skip_if_in_list: true,
        verify_leads_for_lead_finder: false,
        verify_leads_on_import: false
      }
      
      console.log(`Creating lead for contact: ${contact.email}`)
      console.log('Lead creation payload:', JSON.stringify(leadCreationPayload, null, 2))
      
      try {
        
        // Step 1: Create lead in Instantly (without campaign)
        const leadCreationResponse = await fetch("https://api.instantly.ai/api/v2/leads", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${INSTANTLY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(leadCreationPayload),
        })
        
        const leadCreationData = await leadCreationResponse.json()
        
        console.log(`Instantly API response for ${contact.email}:`, {
          status: leadCreationResponse.status,
          statusText: leadCreationResponse.statusText,
          data: leadCreationData
        })
        
        if (leadCreationResponse.ok && leadCreationData.id) {
          console.log(`Successfully created lead: ${leadCreationData.id} for contact: ${contact.email}`)
          
          // Update contact in Supabase with lead info and campaign assignment
          const { error: updateError } = await authResult.supabase
            .from('contacts')
            .update({
              instantly_id: leadCreationData.id,
              campaign_id: campaignId,
              campaign_name: campaignName || "",
              last_touch: new Date().toISOString()
            })
            .eq('id', contact.id)
          
          if (updateError) {
            console.error('Error updating contact in database:', updateError)
            results.push({
              contactId: contact.id,
              contactName: contact.name || contact.email,
              error: 'Created lead but failed to update database',
              code: 'DATABASE_UPDATE_FAILED',
              status: 'partial_success',
              instantlyId: leadCreationData.id,
              step: 'creation'
            })
          } else {
            results.push({
              contactId: contact.id,
              contactName: contact.name || contact.email,
              status: 'success',
              instantlyId: leadCreationData.id,
              step: 'creation'
            })
          }
        } else {
          console.error(`Failed to create lead for ${contact.email}:`, leadCreationData)
          results.push({
            contactId: contact.id,
            contactName: contact.name || contact.email,
            error: leadCreationData.message || leadCreationData.error || 'Failed to create lead in Instantly',
            code: 'INSTANTLY_API_ERROR',
            status: 'error',
            step: 'creation'
          })
        }
      } catch (error) {
        console.error('Error calling Instantly API for lead creation:', error)
        results.push({
          contactId: contact.id,
          contactName: contact.name || contact.email,
          error: 'Failed to communicate with Instantly API during lead creation',
          code: 'INSTANTLY_API_COMMUNICATION_ERROR',
          status: 'error',
          step: 'creation'
        })
      }
    }
    
    console.log(`Step 1 completed. Created ${results.filter(r => r.status === 'success').length} leads out of ${contacts.length} contacts.`)
    
    // Process results and handle skipped leads
    const successful = results.filter(r => r.status === 'success').length
    const failed = results.filter(r => r.status === 'error').length
    const skipped = results.filter(r => r.code === 'ALREADY_IN_CAMPAIGN').length
    const partial = results.filter(r => r.status === 'partial_success').length
    
    // Error categorization for better user feedback
    const errorCategories = {
      validation: results.filter(r => r.code === 'MISSING_EMAIL' || r.code === 'INVALID_EMAIL_FORMAT' || r.code === 'ALREADY_IN_CAMPAIGN').length,
      creation: results.filter(r => r.code === 'INSTANTLY_API_ERROR' && r.step === 'creation').length,
      database: results.filter(r => r.code === 'DATABASE_UPDATE_FAILED').length,
      communication: results.filter(r => r.code === 'INSTANTLY_API_COMMUNICATION_ERROR').length
    }
    
    // Generate appropriate message based on results
    let message = ''
    let severity = 'success'
    const retryRecommendations = []
    
    if (successful > 0 && failed === 0) {
      message = `✅ Successfully added ${successful} contact${successful !== 1 ? 's' : ''} to campaign "${campaignName}"`
      severity = 'success'
    } else if (successful > 0 && failed > 0) {
      message = `⚠️ ${successful} contact${successful !== 1 ? 's' : ''} added to "${campaignName}", ${failed} failed.`
      severity = 'warning'
      
      // Add retry recommendations for partial failures
      if (errorCategories.communication > 0) {
        retryRecommendations.push('Network issues detected. Please try again.')
      }
      if (errorCategories.database > 0) {
        retryRecommendations.push('Database update issues. Contact support if problem persists.')
      }
    } else if (failed > 0) {
      const errorTypes = []
      if (errorCategories.validation > 0) errorTypes.push(`${errorCategories.validation} validation error${errorCategories.validation !== 1 ? 's' : ''}`)
      if (errorCategories.creation > 0) errorTypes.push(`${errorCategories.creation} creation error${errorCategories.creation !== 1 ? 's' : ''}`)
      if (errorCategories.database > 0) errorTypes.push(`${errorCategories.database} database error${errorCategories.database !== 1 ? 's' : ''}`)
      if (errorCategories.communication > 0) errorTypes.push(`${errorCategories.communication} communication error${errorCategories.communication !== 1 ? 's' : ''}`)
      
      message = `❌ Failed to add contacts to campaign. Issues: ${errorTypes.join(', ')}.`
      severity = 'error'
      
      // Add specific retry recommendations based on error types
      if (errorCategories.validation > 0) {
        retryRecommendations.push('Please check email addresses and ensure contacts are not already in campaigns.')
      }
      if (errorCategories.creation > 0) {
        retryRecommendations.push('Lead creation failed. Please verify contact information and try again.')
      }
      if (errorCategories.communication > 0) {
        retryRecommendations.push('Network communication issues. Please check your connection and try again.')
      }
      if (errorCategories.database > 0) {
        retryRecommendations.push('Database update issues. Contact support if problem persists.')
      }
    }
    
    // Calculate progress percentages (single step now)
    const totalSteps = 1
    const completedSteps = successful > 0 ? 1 : 0
    const progressPercentage = Math.round((completedSteps / totalSteps) * 100)
    
    return NextResponse.json({
      success: successful > 0,
      data: {
        results,
        summary: {
          total: results.length,
          successful,
          failed,
          skipped,
          partial,
          errorCategories
        },
        message,
        severity,
        retryRecommendations,
        progress: {
          percentage: progressPercentage,
          completedSteps,
          totalSteps,
          currentStep: successful > 0 ? 'completed' : 'creation'
        },
        campaignId,
        campaignName: campaignName,
        steps: {
          step1: {
            name: 'Lead Creation & Campaign Assignment',
            completed: successful > 0,
            created: successful,
            total: contacts.length,
            status: successful > 0 ? 'success' : 'failed'
          }
        }
      }
    }, {
      headers: RateLimitUtils.getRateLimitHeaders(rateLimitResult)
    })
    
  } catch (error) {
    console.error('Error in add-to-campaign API:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    }, { status: 500 })
  }
}

export const POST = withAuth(addToCampaignHandler)