/**
 * Pipedrive-only Blocklist Sync API Route
 * Syncs blocked contacts from Supabase to Pipedrive only
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { pipedriveClient } from '@/lib/pipedrive-client'

interface BlockedEntry {
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
 * Sync blocklist entries to Pipedrive only
 */
async function syncToPipedriveOnly(entries: BlockedEntry[]): Promise<{ success: number, failed: number, skipped: number }> {
  const supabase = createServiceRoleClient()
  let success = 0
  let failed = 0
  let skipped = 0

  console.log(`🔄 Starting Pipedrive-only sync for ${entries.length} entries`)

  for (const entry of entries) {
    try {
      console.log(`\n📋 Processing entry ${entry.id}:`, {
        value: entry.value,
        blocklist_level: entry.blocklist_level,
        company_id: entry.company_id,
        pipedrive_synced: entry.pipedrive_synced,
        is_active: entry.is_active
      })

      // Skip if already synced to Pipedrive
      if (entry.pipedrive_synced === true) {
        console.log(`⏭️  Skipping entry ${entry.id}: Already synced to Pipedrive`)
        skipped++
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
        console.log(`📧 Processing email block: ${entry.value}`)

        // Handle email with linked contact
        if (entry.contact_id) {
          const pipedrivePersonId = await pipedriveClient.syncContactToPipedrive(entry.contact_id)
          console.log(`📞 Pipedrive person ID from contact: ${pipedrivePersonId}`)

          if (pipedrivePersonId) {
            // Get person details to find organization
            const personDetails = await pipedriveClient.getPerson(pipedrivePersonId)
            const orgId = personDetails?.org_id

            // Set organization status to "Niet meer benaderen" if organization exists
            if (orgId) {
              try {
                console.log(`🚫 Blocking organization ${orgId}`)
                await pipedriveClient.blockOrganization(orgId)
                console.log(`✅ Set organization ${orgId} status to "Niet meer benaderen" for blocked email ${entry.value}`)
              } catch (blockError) {
                console.log(`⚠️  Could not block organization ${orgId}:`, blockError.message)
              }
            }

            const noteContent = `Person blocked via blocklist. Email: ${entry.value}. Reason: ${entry.reason || 'No reason specified'}. Blocked on: ${new Date().toISOString()}`
            console.log(`📝 Adding note to person ${pipedrivePersonId}`)
            await pipedriveClient.addPersonNote(pipedrivePersonId, noteContent)

            await supabase
              .from('blocklist_entries')
              .update({
                pipedrive_synced: true,
                pipedrive_synced_at: new Date().toISOString(),
                pipedrive_error: null
              })
              .eq('id', entry.id)

            success++
          } else {
            console.log(`❌ Failed to get Pipedrive person ID for contact ${entry.contact_id}`)
            failed++
          }
        } else {
          // Handle standalone email (no linked contact)
          // First try to find existing organization by email domain
          const emailDomain = entry.value.split('@')[1]
          let orgId: number | null = null

          if (emailDomain) {
            const existingOrgs = await pipedriveClient.searchOrganizationByDomain(emailDomain)
            if (existingOrgs.length > 0) {
              orgId = existingOrgs[0].id
            }
          }

          // Find or create person (linked to organization if found)
          const pipedrivePersonId = await pipedriveClient.findOrCreatePersonByEmail(entry.value, orgId || undefined)
          console.log(`📞 Pipedrive person ID for standalone email: ${pipedrivePersonId}`)

          if (pipedrivePersonId) {
            // If we didn't find org before, try to get it from the person
            if (!orgId) {
              const personDetails = await pipedriveClient.getPerson(pipedrivePersonId)
              orgId = personDetails?.org_id || null
            }

            // Set organization status to "Niet meer benaderen" if organization exists
            if (orgId) {
              try {
                console.log(`🚫 Blocking organization ${orgId}`)
                await pipedriveClient.blockOrganization(orgId)
                console.log(`✅ Set organization ${orgId} status to "Niet meer benaderen" for blocked email ${entry.value}`)
              } catch (blockError) {
                console.log(`⚠️  Could not block organization ${orgId}:`, blockError.message)
              }
            }

            const noteContent = `Person blocked via blocklist. Email: ${entry.value}. Reason: ${entry.reason || 'No reason specified'}. Blocked on: ${new Date().toISOString()}`
            console.log(`📝 Adding note to person ${pipedrivePersonId}`)
            await pipedriveClient.addPersonNote(pipedrivePersonId, noteContent)

            await supabase
              .from('blocklist_entries')
              .update({
                pipedrive_synced: true,
                pipedrive_synced_at: new Date().toISOString(),
                pipedrive_error: null
              })
              .eq('id', entry.id)

            success++
          } else {
            console.log(`❌ Failed to find/create Pipedrive person for email ${entry.value}`)
            failed++
          }
        }
      } else if (entry.blocklist_level === 'organization' && entry.company_id) {
        console.log(`🏢 Processing organization block for company ${entry.company_id}`)

        // Sync company and block organization
        const pipedriveOrgId = await pipedriveClient.syncCompanyToPipedrive(entry.company_id)
        console.log(`📞 Pipedrive org ID result: ${pipedriveOrgId}`)

        if (pipedriveOrgId) {
          try {
            console.log(`🚫 Blocking organization ${pipedriveOrgId}`)
            // Block the organization
            await pipedriveClient.blockOrganization(pipedriveOrgId)
            console.log(`✅ Successfully blocked organization ${pipedriveOrgId}`)
          } catch (blockError) {
            console.log(`⚠️  Failed to block organization ${pipedriveOrgId}, but continuing with note:`, blockError.message)
          }

          // Add a note explaining the block
          const noteContent = `Organization blocked via blocklist. Reason: ${entry.reason || 'No reason specified'}. Blocked on: ${new Date().toISOString()}`
          console.log(`📝 Adding note to organization ${pipedriveOrgId}`)
          await pipedriveClient.addOrganizationNote(pipedriveOrgId, noteContent)

          // Update sync status
          console.log(`✅ Updating Pipedrive sync status for entry ${entry.id}`)
          await supabase
            .from('blocklist_entries')
            .update({
              pipedrive_synced: true,
              pipedrive_synced_at: new Date().toISOString(),
              pipedrive_error: null
            })
            .eq('id', entry.id)

          success++
        } else {
          console.log(`❌ Failed to get Pipedrive org ID for company ${entry.company_id}`)
          failed++
        }
      } else {
        console.log(`⏭️  Skipping entry ${entry.id}: Unsupported type (${entry.value}) or missing data`)
        skipped++
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

      failed++
    }
  }

  console.log(`🏁 Pipedrive sync completed: ${success} success, ${failed} failed, ${skipped} skipped`)
  return { success, failed, skipped }
}

async function syncHandler(req: NextRequest, authResult: AuthResult) {
  try {
    console.log(`User ${authResult.user.email} initiated Pipedrive-only blocklist sync`)

    // Get all active blocklist entries
    const blockedEntries = await getBlockedEntries()
    console.log(`Found ${blockedEntries.length} active blocklist entries`)

    if (blockedEntries.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No entries to sync to Pipedrive',
        data: {
          success: 0,
          failed: 0,
          skipped: 0,
          total: 0
        },
        timestamp: new Date().toISOString()
      })
    }

    // Sync only to Pipedrive
    const result = await syncToPipedriveOnly(blockedEntries)

    return NextResponse.json({
      success: true,
      message: 'Pipedrive sync completed',
      data: {
        success: result.success,
        failed: result.failed,
        skipped: result.skipped,
        total: blockedEntries.length
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Pipedrive sync failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      code: 'PIPEDRIVE_SYNC_FAILED'
    }, { status: 500 })
  }
}

export const POST = withAuth(syncHandler)