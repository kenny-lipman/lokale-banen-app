import { NextRequest, NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"
import { sendToPipedriveWebhook } from "@/lib/pipedrive-webhook"

export async function GET(req: NextRequest) {
  try {
    // Use service role for dashboard access
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '15')
    const search = searchParams.get('search') || ''
    const inCampaign = searchParams.get('inCampaign') || ''
    const hasEmail = searchParams.get('hasEmail') || ''
    const companyStatus = searchParams.get('companyStatus') || ''
    const companyStart = searchParams.get('companyStart') || ''
    const companySize = searchParams.get('companySize') || ''
    const categoryStatus = searchParams.get('categoryStatus') || ''
    const status = searchParams.get('status') || ''

    console.log("API: Starting to fetch contacts with filters:", { 
      page, limit, search, inCampaign, hasEmail, companyStatus, companyStart, companySize, categoryStatus, status 
    })
    
    const filters = {
      search: search || undefined,
      inCampaign: inCampaign || undefined,
      hasEmail: hasEmail || undefined,
      companyStatus: companyStatus || undefined,
      companyStart: companyStart || undefined,
      companySize: companySize || undefined,
      categoryStatus: categoryStatus || undefined,
      status: status || undefined
    }

    // Remove empty filters
    Object.keys(filters).forEach(key => {
      if (!filters[key as keyof typeof filters]) {
        delete filters[key as keyof typeof filters]
      }
    })
    
    // Check if we need to use inner join for company filters
    const needsCompanyJoin = !!(
      filters.companyStatus ||
      filters.companyStart ||
      filters.companySize
    )

    // Build query with service role client
    let query = supabaseService.serviceClient
      .from("contacts")
      .select(`
        id,
        first_name,
        last_name,
        title,
        email,
        phone,
        email_status,
        source,
        qualification_status,
        linkedin_url,
        created_at,
        campaign_name,
        campaign_id,
        company_id,
        companies${needsCompanyJoin ? '!inner' : ''} (
          id,
          name,
          website,
          category_size,
          status,
          start
        )
      `, { count: 'exact' })

    // Apply search filter
    if (filters.search) {
      // Escape special characters that might cause SQL issues
      const searchTerm = filters.search.replace(/[%_]/g, '\\$&')
      query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,companies.name.ilike.%${searchTerm}%`)
    }

    // Apply hasEmail filter
    if (filters.hasEmail === 'with') {
      query = query.not('email', 'is', null).neq('email', '')
    } else if (filters.hasEmail === 'without') {
      query = query.or('email.is.null,email.eq.')
    }

    // Apply inCampaign filter
    if (filters.inCampaign === 'with') {
      query = query.not('campaign_id', 'is', null)
    } else if (filters.inCampaign === 'without') {
      query = query.is('campaign_id', null)
    }

    // Apply qualification status filter
    if (filters.categoryStatus) {
      const statuses = filters.categoryStatus.split(',')
      query = query.in('qualification_status', statuses)
    }

    // Apply company filters - these need the companies table
    if (filters.companyStatus) {
      const statuses = filters.companyStatus.split(',').map(s =>
        s === 'null' ? null : s
      )
      query = query.in('companies.status', statuses)
    }

    if (filters.companyStart) {
      const starts = filters.companyStart.split(',').map(s => {
        if (s === 'null') return null
        if (s === 'true') return true
        if (s === 'false') return false
        return s
      })
      query = query.in('companies.start', starts)
    }

    if (filters.companySize) {
      const sizes = filters.companySize.split(',').map(s =>
        s === 'null' ? null : s
      )
      query = query.in('companies.category_size', sizes)
    }

    // Execute query with pagination
    console.log("API: Executing query with filters:", {
      search: filters.search,
      needsCompanyJoin,
      page,
      limit,
      range: [(page - 1) * limit, page * limit - 1]
    })

    const { data: contacts, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (error) {
      console.error("API: Supabase query error:", {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        filters: filters
      })
      throw error
    }

    // Format contacts to match frontend expectations
    const formattedContacts = (contacts || []).map(contact => ({
      ...contact,
      companies_name: contact.companies?.name || null,
      companies_size: contact.companies?.category_size || null,
      companies_status: contact.companies?.status || null,
      companies_start: contact.companies?.start || null,
      // Keep the companies object for backward compatibility
      companies: contact.companies
    }))

    const result = {
      data: formattedContacts,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }

    console.log("API: Successfully fetched contacts:", result.data?.length || 0, "contacts")
    return NextResponse.json(result)
  } catch (e) {
    console.error("API: Error fetching contacts:", e)
    const errorMessage = e instanceof Error ? e.message : "Unknown error"
    const errorStack = e instanceof Error ? e.stack : undefined

    // Better error serialization to avoid [object Object]
    let errorDetails = "Unknown error"
    if (e instanceof Error) {
      errorDetails = e.message
    } else if (typeof e === 'string') {
      errorDetails = e
    } else if (e && typeof e === 'object') {
      errorDetails = JSON.stringify(e)
    }

    return NextResponse.json({
      error: errorMessage,
      details: errorDetails,
      stack: errorStack
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Handle fetching contacts by company IDs
    if (body.companyIds) {
      const { companyIds } = body

      if (!companyIds || !Array.isArray(companyIds)) {
        return NextResponse.json(
          { error: "companyIds array is required" },
          { status: 400 }
        )
      }

      console.log("API: Fetching contacts for companies:", companyIds)

      const { data, error } = await supabaseService.serviceClient
        .from("contacts")
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
          companies (
            name,
            website
          )
        `)
        .in("company_id", companyIds)
        .not("company_id", "is", null)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("API: Error fetching contacts by company IDs:", error)
        return NextResponse.json(
          { error: "Failed to fetch contacts" },
          { status: 500 }
        )
      }

      console.log("API: Successfully fetched contacts for companies:", data?.length || 0, "contacts")
      return NextResponse.json(data || [])
    }
    
    // Handle adding contacts to campaigns
    if (body.contactIds && body.campaignId) {
      const { contactIds, campaignId, campaignName } = body
      
      if (!Array.isArray(contactIds) || !campaignId) {
        return NextResponse.json({ error: "contactIds[] and campaignId required" }, { status: 400 })
      }
      
      // Deduplicate contactIds to prevent duplicate processing
      const uniqueContactIds = [...new Set(contactIds)]
      console.log(`Original contactIds: ${contactIds.length}, after deduplication: ${uniqueContactIds.length}`)
      
      // Get all contacts from Supabase with company details
      const { data: selectedContacts, error: contactsError } = await supabaseService.serviceClient
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
          campaign_id,
          campaign_name,
          pipedrive_synced,
          pipedrive_synced_at,
          companies(
            id,
            name,
            website,
            category_size,
            city
          )
        `)
        .in('id', uniqueContactIds)
      
      if (contactsError) {
        console.error('Error fetching contacts:', contactsError)
        return NextResponse.json(
          { error: 'Failed to fetch contacts from database' },
          { status: 500 }
        )
      }
      
      if (!selectedContacts || selectedContacts.length === 0) {
        return NextResponse.json(
          { error: 'No contacts found with provided IDs' },
          { status: 404 }
        )
      }
      
      console.log(`Found contacts: ${selectedContacts.length} of ${uniqueContactIds.length} requested IDs`)
      
      // Get regio_platform from companies table if we have company_ids
      const companyIds = selectedContacts
        .filter(c => c.company_id)
        .map(c => c.company_id)
        .filter((id, index, self) => self.indexOf(id) === index) // unique company IDs
      
      let regioPlatformMap = {}
      if (companyIds.length > 0) {
        const { data: companiesWithRegions, error: regionsError } = await supabaseService.serviceClient
          .from('companies')
          .select(`
            id,
            regions(
              regio_platform
            )
          `)
          .in('id', companyIds)
        
        if (regionsError) {
          console.error('Error fetching regions:', regionsError)
        } else if (companiesWithRegions) {
          regioPlatformMap = Object.fromEntries(
            companiesWithRegions.map(company => [
              company.id,
              company.regions?.regio_platform || null
            ])
          )
          console.log('Regio platform mapping:', regioPlatformMap)
        }
      }
      
      const results = []
      const processedContactIds = new Set() // Track processed contacts to prevent duplicates
      
      for (const contact of selectedContacts) {
        // Skip if we've already processed this contact
        if (processedContactIds.has(contact.id)) {
          console.log(`Skipping duplicate contact: ${contact.id}`)
          continue
        }
        processedContactIds.add(contact.id)
        
        // Validate email before making API call
        if (!contact.email || contact.email.trim() === '') {
          results.push({ 
            contactId: contact.id, 
            error: `Contact ${contact.name || contact.id} has no valid email address`, 
            status: "error" 
          })
          continue
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(contact.email)) {
          results.push({ 
            contactId: contact.id, 
            error: `Contact ${contact.name || contact.id} has invalid email: ${contact.email}`, 
            status: "error" 
          })
          continue
        }

        // Check if contact is already in a campaign
        if (contact.campaign_id) {
          results.push({
            contactId: contact.id,
            contactName: contact.name || contact.email,
            error: `Contact is already in campaign: ${contact.campaign_name || contact.campaign_id}`,
            status: 'skipped'
          })
          continue
        }
        
        // Get regio_platform for this contact's company
        const regioPlatform = contact.company_id ? regioPlatformMap[contact.company_id] : null
        
        console.log(`Company data for contact ${contact.email}:`, {
          companyId: contact.company_id,
          companyName: contact.companies?.name,
          companyWebsite: contact.companies?.website,
          companyCategorySize: contact.companies?.category_size,
          regioPlatform: regioPlatform
        })
        
        // Build body for Instantly (matching /api/otis/contacts/add-to-campaign structure)
        const body = {
          email: contact.email.trim(),
          personalization: "",
          website: contact.companies?.website || "",
          first_name: contact.first_name || contact.name?.split(" ").slice(0, -1).join(" ") || contact.name || "",
          last_name: contact.last_name || contact.name?.split(" ").slice(-1)[0] || "",
          phone: contact.phone || "",
          company_name: contact.companies?.name || "",
          campaign: campaignId, // Only campaign, no list_id
          custom_variables: {
            linkedIn: contact.linkedin_url || "",
            jobTitle: contact.title || "",
            regio_platform: regioPlatform,
            company_size: contact.companies?.category_size || null
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
        console.log('Lead creation payload:', JSON.stringify(body, null, 2))
        
        // POST to Instantly
        let instantlyId = null
        let instantlyResponse = null
        try {
          const res = await fetch("https://api.instantly.ai/api/v2/leads", {
            method: "POST",
            headers: {
              "Authorization": "Bearer ZmVlNjJlZjktNWQwMC00Y2JmLWFiNmItYmU4YTk1YWEyMGE0OlFFeFVoYk9Ra1FXbw==",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          })
          instantlyResponse = await res.json()
          
          console.log(`Instantly API response for ${contact.email}:`, {
            status: res.status,
            statusText: res.statusText,
            data: instantlyResponse
          })
          
          if (res.ok && instantlyResponse.id) {
            instantlyId = instantlyResponse.id
            console.log(`Successfully created lead: ${instantlyId} for contact: ${contact.email}`)
            
            // Update contact in Supabase with lead info and campaign assignment
            const { error: updateError } = await supabaseService.serviceClient
              .from('contacts')
              .update({
                instantly_id: instantlyId,
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
                status: 'partial_success',
                instantlyId
              })
            } else {
              // Send to Pipedrive webhook after successful Instantly sync
              const webhookResult = await sendToPipedriveWebhook(contact, campaignName || "")
              
              // Update contact with Pipedrive sync status
              if (webhookResult.success) {
                await supabaseService.serviceClient
                  .from('contacts')
                  .update({
                    pipedrive_synced: true,
                    pipedrive_synced_at: new Date().toISOString()
                  })
                  .eq('id', contact.id)
                
                console.log(`[Pipedrive] Contact ${contact.email} synced successfully`)
              } else {
                console.log(`[Pipedrive] Failed to sync contact ${contact.email}:`, webhookResult.error)
              }
              
              results.push({ 
                contactId: contact.id, 
                instantlyId, 
                status: "success", 
                contactName: contact.name || contact.email 
              })
            }
          } else {
            console.error(`Failed to create lead for ${contact.email}:`, instantlyResponse)
            results.push({ 
              contactId: contact.id, 
              error: instantlyResponse?.message || instantlyResponse?.error || "Unknown error from Instantly API", 
              status: "error",
              contactName: contact.name || contact.email
            })
          }
        } catch (err) {
          results.push({ 
            contactId: contact.id, 
            error: `Network error: ${err?.toString()}`, 
            status: "error",
            contactName: contact.name || contact.email
          })
        }
      }
      
      // Show clear success or error message
      const successCount = results.filter(r => r.status === "success").length
      const errorCount = results.filter(r => r.status === "error").length
      
      if (successCount > 0 && errorCount === 0) {
        return NextResponse.json({ 
          results, 
          message: `✅ All ${successCount} contacts successfully added to campaign "${campaignName}".` 
        })
      } else if (successCount > 0 && errorCount > 0) {
        return NextResponse.json({ 
          results, 
          message: `⚠️ ${successCount} contacts added to "${campaignName}", ${errorCount} failed.`,
          warning: true
        })
      } else {
        // Give more details about why all contacts failed
        const errorMessages = results.map(r => r.error).filter(Boolean)
        const uniqueErrors = [...new Set(errorMessages)]
        return NextResponse.json({ 
          results, 
          error: `❌ Adding failed for all ${results.length} contacts. Main causes: ${uniqueErrors.slice(0, 2).join(', ')}.` 
        }, { status: 400 })
      }
    }
    
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })

  } catch (e) {
    console.error("API: Error in POST /api/contacts:", e)
    const errorMessage = e instanceof Error ? e.message : "Unknown error"

    // Better error serialization to avoid [object Object]
    let errorDetails = "Unknown error"
    if (e instanceof Error) {
      errorDetails = e.message
    } else if (typeof e === 'string') {
      errorDetails = e
    } else if (e && typeof e === 'object') {
      errorDetails = JSON.stringify(e)
    }

    return NextResponse.json({
      error: errorMessage,
      details: errorDetails
    }, { status: 500 })
  }
}

// Exports are defined inline above 