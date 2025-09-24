/**
 * Blocklist Synchronization Logic
 * Handles syncing blocked contacts from Supabase to Instantly.ai
 */

import { createServiceRoleClient } from './supabase-server'
import { instantlyClient } from './instantly-client'

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

export interface BlockedContact {
  id: string
  email: string
  is_blocked: boolean
}

/**
 * Get all blocked contacts from Supabase
 */
async function getBlockedContacts(): Promise<BlockedContact[]> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('contacts')
    .select('id, email, is_blocked')
    .eq('is_blocked', true)
    .not('email', 'is', null)

  if (error) {
    throw new Error(`Failed to fetch blocked contacts: ${error.message}`)
  }

  return (data || []) as BlockedContact[]
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Sync blocked contacts from Supabase to Instantly.ai blocklist
 */
export async function syncBlockedContacts(): Promise<SyncResult> {
  console.log('Starting blocklist sync...')

  try {
    // Get all blocked contacts from Supabase
    const blockedContacts = await getBlockedContacts()
    console.log(`Found ${blockedContacts.length} blocked contacts`)

    if (blockedContacts.length === 0) {
      return {
        success: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        errors: []
      }
    }

    // Filter and validate emails
    const validEmails = blockedContacts
      .filter(contact => contact.email && isValidEmail(contact.email))
      .map(contact => contact.email.trim().toLowerCase())

    // Remove duplicates
    const uniqueEmails = [...new Set(validEmails)]
    console.log(`Processing ${uniqueEmails.length} unique valid emails`)

    const result = await instantlyClient.addMultipleToBlocklist(uniqueEmails)

    const syncResult: SyncResult = {
      success: result.success.length,
      failed: result.failed.length,
      skipped: blockedContacts.length - validEmails.length,
      total: blockedContacts.length,
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
    await instantlyClient.addToBlocklist(contact.email.trim().toLowerCase())
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
 * Remove a contact from blocklist (Supabase only - Instantly.ai doesn't support removal via API)
 */
export async function removeContactFromBlocklist(contactId: string): Promise<void> {
  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('contacts')
    .update({ is_blocked: false })
    .eq('id', contactId)

  if (error) {
    throw new Error(`Failed to remove contact from blocklist: ${error.message}`)
  }
}