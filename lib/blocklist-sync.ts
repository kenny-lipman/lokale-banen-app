/**
 * Blocklist Synchronization Logic
 * Handles syncing blocked contacts from Supabase to Instantly.ai and Pipedrive
 */

import { createServiceRoleClient } from './supabase-server'
import { instantlyClient } from './instantly-client'
import { pipedriveClient } from './pipedrive-client'

export interface SyncResult {
  success: number
  failed: number
  skipped: number
  total: number
  errors: Array<{
    email: string
    error: string
  }>
}

export interface BlockedEntry {
  id: string
  type: 'email' | 'domain'
  value: string
  reason?: string
  is_active: boolean
  instantly_synced: boolean
  instantly_synced_at: string | null
  instantly_error: string | null
  instantly_id: string | null
  blocklist_level?: 'organization' | 'contact' | 'domain'
  company_id?: string
  contact_id?: string
  pipedrive_synced?: boolean
  pipedrive_synced_at?: string | null
  pipedrive_error?: string | null
}

/**
 * Get all active blocklist entries from Supabase
 */
async function getBlockedEntries(): Promise<BlockedEntry[]> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('blocklist_entries')
    .select('id, type, value, reason, is_active, instantly_synced, instantly_synced_at, instantly_error, instantly_id, blocklist_level, company_id, contact_id, pipedrive_synced, pipedrive_synced_at, pipedrive_error')
    .eq('is_active', true)

  if (error) {
    throw new Error(`Failed to fetch blocklist entries: ${error.message}`)
  }

  return (data || []) as BlockedEntry[]
}

/**
 * Validate email format
 * Allows & and other special characters in email addresses
 */
function isValidEmail(email: string): boolean {
  // Simple check: contains @ and has characters before and after it
  const parts = email.trim().split('@')
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0
}

/**
 * Sync blocklist entries to Pipedrive
 */
async function syncToPipedrive(entries: BlockedEntry[]): Promise<void> {
  const supabase = createServiceRoleClient()

  console.log(`🔄 Starting Pipedrive sync for ${entries.length} entries`)

  for (const entry of entries) {
    try {
      // Skip if already synced to Pipedrive
      if (entry.pipedrive_synced === true) {
        continue
      }

      // Helper function to check if a value is a valid email
      // Allows & and other special characters in email addresses
      const isValidEmail = (email: string): boolean => {
        // Simple check: contains @ and has characters before and after it
        const parts = email.split('@')
        return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0
      }

      // Check if the value is an email address, regardless of blocklist_level
      if (isValidEmail(entry.value)) {
        // Handle email with linked contact
        if (entry.contact_id) {
          const pipedrivePersonId = await pipedriveClient.syncContactToPipedrive(entry.contact_id)

          if (pipedrivePersonId) {
            try {
              await pipedriveClient.blockPerson(pipedrivePersonId)
            } catch (blockError) {
              // Continue with note even if blocking fails
            }

            const noteContent = `Person blocked via blocklist. Email: ${entry.value}. Reason: ${entry.reason || 'No reason specified'}. Blocked on: ${new Date().toISOString()}`
            await pipedriveClient.addPersonNote(pipedrivePersonId, noteContent)

            await supabase
              .from('blocklist_entries')
              .update({
                pipedrive_synced: true,
                pipedrive_synced_at: new Date().toISOString(),
                pipedrive_error: null
              })
              .eq('id', entry.id)
          }
        } else {
          // Handle standalone email (no linked contact)
          const pipedrivePersonId = await pipedriveClient.findOrCreatePersonByEmail(entry.value)

          if (pipedrivePersonId) {
            try {
              await pipedriveClient.blockPerson(pipedrivePersonId)
            } catch (blockError) {
              // Continue with note even if blocking fails
            }

            const noteContent = `Person blocked via blocklist. Email: ${entry.value}. Reason: ${entry.reason || 'No reason specified'}. Blocked on: ${new Date().toISOString()}`
            await pipedriveClient.addPersonNote(pipedrivePersonId, noteContent)

            await supabase
              .from('blocklist_entries')
              .update({
                pipedrive_synced: true,
                pipedrive_synced_at: new Date().toISOString(),
                pipedrive_error: null
              })
              .eq('id', entry.id)
          }
        }
        continue // Skip the rest of the logic for this entry
      }

      if (entry.blocklist_level === 'organization' && entry.company_id) {
        // Sync company and block organization
        const pipedriveOrgId = await pipedriveClient.syncCompanyToPipedrive(entry.company_id)

        if (pipedriveOrgId) {
          try {
            await pipedriveClient.blockOrganization(pipedriveOrgId)
          } catch (blockError) {
            // Continue with note even if blocking fails
          }

          // Add a note explaining the block
          const noteContent = `Organization blocked via blocklist. Reason: ${entry.reason || 'No reason specified'}. Blocked on: ${new Date().toISOString()}`
          await pipedriveClient.addOrganizationNote(pipedriveOrgId, noteContent)

          // Update sync status
          await supabase
            .from('blocklist_entries')
            .update({
              pipedrive_synced: true,
              pipedrive_synced_at: new Date().toISOString(),
              pipedrive_error: null
            })
            .eq('id', entry.id)
        }
      }
    } catch (error) {
      console.error(`Failed to sync blocklist entry ${entry.id} to Pipedrive:`, error)

      // Update error status
      await supabase
        .from('blocklist_entries')
        .update({
          pipedrive_synced: false,
          pipedrive_error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', entry.id)
    }
  }
}

/**
 * Sync blocked entries from Supabase to Instantly.ai blocklist and Pipedrive
 */
export async function syncBlockedContacts(): Promise<SyncResult> {
  console.log('Starting blocklist sync...')

  const supabase = createServiceRoleClient()

  try {
    // Get all active blocklist entries from Supabase
    const blockedEntries = await getBlockedEntries()
    console.log(`Found ${blockedEntries.length} active blocklist entries`)

    if (blockedEntries.length === 0) {
      return {
        success: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        errors: []
      }
    }

    // Filter for emails and domains, validate them
    const validEntries = blockedEntries
      .filter(entry => {
        if (entry.type === 'email') {
          return entry.value && isValidEmail(entry.value)
        } else if (entry.type === 'domain') {
          // Basic domain validation - allows multiple dots for subdomains (e.g. b.v.golfbaanrijswijk.nl)
          const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]{0,253}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/
          return entry.value && domainRegex.test(entry.value)
        }
        return false
      })
      .map(entry => ({
        id: entry.id,
        value: entry.value.trim().toLowerCase()
      }))

    // Remove duplicates
    const uniqueValues = [...new Map(validEntries.map(e => [e.value, e])).values()]
    console.log(`Processing ${uniqueValues.length} unique valid entries`)

    const result = await instantlyClient.addMultipleToBlocklist(uniqueValues.map(e => e.value))

    // Update sync status for successful entries in database
    for (const successEntry of result.success) {
      const entry = uniqueValues.find(e => e.value === successEntry.bl_value)
      if (entry) {
        await supabase
          .from('blocklist_entries')
          .update({
            instantly_synced: true,
            instantly_synced_at: new Date().toISOString(),
            instantly_error: null,
            instantly_id: successEntry.id
          })
          .eq('id', entry.id)
      }
    }

    // Update sync status for entries that already exist in Instantly
    const alreadyExistsIds = uniqueValues
      .filter(entry => result.alreadyExists?.includes(entry.value))
      .map(e => e.id)

    if (alreadyExistsIds.length > 0) {
      await supabase
        .from('blocklist_entries')
        .update({
          instantly_synced: true,
          instantly_synced_at: new Date().toISOString(),
          instantly_error: null
        })
        .in('id', alreadyExistsIds)

      console.log(`Updated ${alreadyExistsIds.length} entries that already exist in Instantly`)
    }

    // Update sync status for failed entries in database
    for (const failed of result.failed) {
      const entry = uniqueValues.find(e => e.value === failed.value)
      if (entry) {
        await supabase
          .from('blocklist_entries')
          .update({
            instantly_synced: false,
            instantly_error: failed.error
          })
          .eq('id', entry.id)
      }
    }

    // Sync to Pipedrive
    console.log('Starting Pipedrive sync...')
    await syncToPipedrive(blockedEntries)
    console.log('Pipedrive sync completed')

    const syncResult: SyncResult = {
      success: result.success.length + (result.alreadyExists?.length || 0),
      failed: result.failed.length,
      skipped: blockedEntries.length - validEntries.length,
      total: blockedEntries.length,
      errors: result.failed.map(f => ({
        email: f.value,
        error: f.error
      }))
    }

    console.log('Blocklist sync completed:', {
      success: syncResult.success,
      failed: syncResult.failed,
      skipped: syncResult.skipped,
      total: syncResult.total
    })

    return syncResult

  } catch (error) {
    console.error('Blocklist sync failed:', error)
    throw new Error(`Blocklist sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Add a single contact to blocklist (both Supabase and Instantly.ai)
 */
export async function addContactToBlocklist(contactId: string): Promise<void> {
  const supabase = createServiceRoleClient()

  // First, update Supabase
  const { data: contact, error: fetchError } = await supabase
    .from('contacts')
    .select('email')
    .eq('id', contactId)
    .single()

  if (fetchError || !contact) {
    throw new Error(`Contact not found: ${contactId}`)
  }

  if (!contact.email || !isValidEmail(contact.email)) {
    throw new Error(`Contact has invalid email: ${contact.email}`)
  }

  // Update the contact in Supabase
  const { error: updateError } = await supabase
    .from('contacts')
    .update({ is_blocked: true })
    .eq('id', contactId)

  if (updateError) {
    throw new Error(`Failed to update contact in Supabase: ${updateError.message}`)
  }

  // Add to Instantly.ai blocklist
  try {
    const instantlyEntry = await instantlyClient.addToBlocklist(contact.email.trim().toLowerCase())

    // Store the Instantly ID (Note: this is for the legacy contact-based blocklist)
    // For the new blocklist_entries system, the ID is stored in the main sync function
    console.log(`Added ${contact.email} to Instantly with ID ${instantlyEntry.id}`)
  } catch (instantlyError) {
    // Rollback Supabase change if Instantly.ai fails
    await supabase
      .from('contacts')
      .update({ is_blocked: false })
      .eq('id', contactId)

    throw new Error(`Failed to add to Instantly.ai blocklist: ${instantlyError instanceof Error ? instantlyError.message : 'Unknown error'}`)
  }
}

/**
 * Remove an entry from blocklist (both Supabase and Instantly.ai)
 */
export async function removeEntryFromBlocklist(entryId: string): Promise<void> {
  const supabase = createServiceRoleClient()

  // First, get the entry from Supabase
  const { data: entry, error: fetchError } = await supabase
    .from('blocklist_entries')
    .select('value, instantly_synced, instantly_id')
    .eq('id', entryId)
    .single()

  if (fetchError || !entry) {
    throw new Error(`Blocklist entry not found: ${entryId}`)
  }

  // If it was synced to Instantly, remove it from there too
  if (entry.instantly_synced && entry.instantly_id) {
    try {
      await instantlyClient.deleteFromBlocklistByInstantlyId(entry.instantly_id)
      console.log(`Removed ${entry.value} from Instantly blocklist using ID ${entry.instantly_id}`)
    } catch (instantlyError) {
      console.error('Failed to remove from Instantly, but continuing with local deletion:', instantlyError)
      // Continue with local deletion even if Instantly fails
    }
  }

  // Delete from Supabase
  const { error: deleteError } = await supabase
    .from('blocklist_entries')
    .delete()
    .eq('id', entryId)

  if (deleteError) {
    throw new Error(`Failed to delete blocklist entry: ${deleteError.message}`)
  }
}

/**
 * Deactivate an entry in blocklist (set is_active to false and remove from Instantly)
 */
export async function deactivateBlocklistEntry(entryId: string): Promise<void> {
  const supabase = createServiceRoleClient()

  // First, get the entry from Supabase
  const { data: entry, error: fetchError } = await supabase
    .from('blocklist_entries')
    .select('value, instantly_synced, is_active, instantly_id')
    .eq('id', entryId)
    .single()

  if (fetchError || !entry) {
    throw new Error(`Blocklist entry not found: ${entryId}`)
  }

  if (!entry.is_active) {
    console.log('Entry is already inactive')
    return
  }

  // If it was synced to Instantly, remove it from there
  if (entry.instantly_synced && entry.instantly_id) {
    try {
      await instantlyClient.deleteFromBlocklistByInstantlyId(entry.instantly_id)
      console.log(`Removed ${entry.value} from Instantly blocklist due to deactivation using ID ${entry.instantly_id}`)
    } catch (instantlyError) {
      console.error('Failed to remove from Instantly:', instantlyError)
      throw new Error(`Failed to remove from Instantly: ${instantlyError instanceof Error ? instantlyError.message : 'Unknown error'}`)
    }
  }

  // Update in Supabase - mark as inactive and not synced
  const { error: updateError } = await supabase
    .from('blocklist_entries')
    .update({
      is_active: false,
      instantly_synced: false,
      instantly_synced_at: null,
      instantly_id: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', entryId)

  if (updateError) {
    throw new Error(`Failed to deactivate blocklist entry: ${updateError.message}`)
  }
}