/**
 * Pipedrive sync utility
 * Replaces the n8n webhook workflow with direct Pipedrive API calls.
 * Uses pipedriveClient which has built-in rate limit handling (exponential backoff on 429).
 *
 * Flow (mirrors the old n8n "Enter Lead in Pipedrive" workflow):
 * 1. Search organization by company name → use existing or create new
 * 2. Update company in Supabase with pipedrive_synced
 * 3. Search person by email → update existing or create new
 * 4. Update contact in Supabase with pipedrive_synced
 */

import { pipedriveClient, PipedrivePerson } from './pipedrive-client'
import { supabaseService } from './supabase-service'

interface ContactData {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  title: string | null
  company_id?: string | null
  companies?: {
    id?: string | null
    name: string | null
    website: string | null
    category_size: string | null
    city: string | null
  } | null
}

/**
 * Syncs a contact + company to Pipedrive directly (no n8n webhook).
 * Fails silently to not disrupt main campaign workflow.
 */
export async function sendToPipedriveWebhook(
  contactData: ContactData,
  campaignName: string
): Promise<{ success: boolean; error?: string; organizationId?: number; personId?: number }> {
  try {
    // Validate required fields
    if (!contactData.email || !contactData.companies?.name) {
      console.log('[Pipedrive] Skipping sync - missing required fields (email or company name)')
      return { success: false, error: 'Missing required fields' }
    }

    const companyName = contactData.companies.name
    const contactName = `${contactData.first_name || ''} ${contactData.last_name || ''}`.trim() || 'Unknown'
    const contactEmail = contactData.email

    console.log(`[Pipedrive] Syncing: ${contactEmail} / ${companyName}`)

    // Step 1: Search or create organization
    let orgId: number

    const searchResults = await pipedriveClient.searchOrganization(companyName)

    if (searchResults.length > 0 && searchResults[0].item?.id) {
      orgId = searchResults[0].item.id
      console.log(`[Pipedrive] Found existing organization: ${companyName} (ID: ${orgId})`)
    } else {
      const newOrg = await pipedriveClient.createOrganization({ name: companyName })
      orgId = newOrg.id
      console.log(`[Pipedrive] Created new organization: ${companyName} (ID: ${orgId})`)
    }

    // Step 2: Update company in Supabase
    const companyId = contactData.companies.id || contactData.company_id
    if (companyId) {
      await supabaseService.serviceClient
        .from('companies')
        .update({
          pipedrive_id: orgId.toString(),
          pipedrive_synced: true,
          pipedrive_synced_at: new Date().toISOString()
        })
        .eq('id', companyId)
    }

    // Step 3: Search or create/update person
    let personId: number

    const existingPersons = await pipedriveClient.searchPersonByEmail(contactEmail)

    if (existingPersons.length > 0 && existingPersons[0].item?.id) {
      personId = existingPersons[0].item.id
      console.log(`[Pipedrive] Found existing person: ${contactEmail} (ID: ${personId})`)

      // Update existing person with latest data
      await pipedriveClient.updatePerson(personId, {
        name: contactName,
        org_id: orgId,
        email: [{ value: contactEmail, primary: true }],
        phone: contactData.phone ? [{ value: contactData.phone, primary: true }] : undefined
      })
    } else {
      const personData: PipedrivePerson = {
        name: contactName,
        org_id: orgId,
        email: [{ value: contactEmail, primary: true }],
        visible_to: 3
      }

      if (contactData.phone) {
        personData.phone = [{ value: contactData.phone, primary: true }]
      }

      const newPerson = await pipedriveClient.createPerson(personData)
      personId = newPerson.id
      console.log(`[Pipedrive] Created new person: ${contactName} (ID: ${personId})`)
    }

    // Step 4: Update contact in Supabase
    await supabaseService.serviceClient
      .from('contacts')
      .update({
        pipedrive_person_id: personId.toString(),
        pipedrive_synced: true,
        pipedrive_synced_at: new Date().toISOString()
      })
      .eq('id', contactData.id)

    console.log(`[Pipedrive] Sync complete: org=${orgId}, person=${personId}`)
    return { success: true, organizationId: orgId, personId }

  } catch (error) {
    console.error('[Pipedrive] Sync error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
