import { NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"

export async function GET() {
  try {
    console.log("API: Starting to fetch contacts...")
    
    // Eerst een count query om te zien hoeveel contacten er zijn
    const { count } = await supabaseService.client.from("contacts").select("*", { count: 'exact', head: true })
    console.log("API: Total contacts in database:", count)
    
    const data = await supabaseService.getContacts()
    console.log("API: Successfully fetched contacts:", data?.length || 0, "contacts")
    return NextResponse.json(data)
  } catch (e) {
    console.error("API: Error fetching contacts:", e)
    const errorMessage = e instanceof Error ? e.message : "Unknown error"
    const errorStack = e instanceof Error ? e.stack : undefined
    return NextResponse.json({ 
      error: errorMessage, 
      details: String(e),
      stack: errorStack 
    }, { status: 500 })
  }
}

export async function POST(req: Request) {
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

      const { data, error } = await supabaseService.client
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
      
      // Get all contacts from Supabase
      const contacts = await supabaseService.getContacts()
      const selectedContacts = contacts.filter(c => uniqueContactIds.includes(c.id))
      
      console.log(`Found contacts: ${selectedContacts.length} of ${uniqueContactIds.length} requested IDs`)
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

        // Build body for Instantly
        const body = {
          campaign: campaignId,
          email: contact.email.trim(),
          personalization: "", // Fill in if desired
          website: contact.companies?.website || "",
          first_name: contact.first_name || contact.name?.split(" ").slice(0, -1).join(" ") || contact.name || "",
          last_name: contact.last_name || contact.name?.split(" ").slice(-1)[0] || "",
          phone: contact.phone || "",
          company_name: contact.companies?.name || "",
          custom_variables: {
            linkedIn: contact.linkedin_url || "",
            jobTitle: contact.title || ""
          },
          lt_interest_status: 1,
          pl_value_lead: "High",
          list_id: "560405f8-7aad-49c0-87ad-d9f023f734c9", // <-- Accessible list
          assigned_to: "f191f0de-3753-4ce6-ace1-c1ed1b8a903e", // Fill in if desired
          skip_if_in_workspace: true,
          skip_if_in_campaign: true,
          skip_if_in_list: true,
          blocklist_id: "0197f015-b9b3-73e0-bfb1-0436a519afbb",
          verify_leads_for_lead_finder: false,
          verify_leads_on_import: false
        }
        
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
          if (res.ok && instantlyResponse.id) {
            instantlyId = instantlyResponse.id
            // Update contact in Supabase
            await supabaseService.updateContactCampaignInfo(contact.id, instantlyId, campaignName || "")
            results.push({ contactId: contact.id, instantlyId, status: "success", contactName: contact.name || contact.email })
          } else {
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
    return NextResponse.json({ 
      error: errorMessage, 
      details: String(e)
    }, { status: 500 })
  }
} 