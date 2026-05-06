/**
 * Debug API for blocklist entries
 * Shows current entries and their sync status
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'

async function debugHandler(req: NextRequest, authResult: AuthResult) {
  try {
    console.log(`🔍 Debug blocklist requested by user: ${authResult.user.email}`)

    // Get all blocklist entries
    const { data: entries, error } = await authResult.supabase
      .from('blocklist_entries')
      .select(`
        id,
        block_type,
        value,
        reason,
        company_id,
        contact_id,
        blocklist_level,
        is_active,
        instantly_synced,
        instantly_synced_at,
        instantly_error,
        pipedrive_synced,
        pipedrive_synced_at,
        pipedrive_error,
        created_at
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('🔥 Error fetching blocklist entries:', error)
      throw error
    }

    type BlocklistEntryRow = {
      id: string;
      block_type: string | null;
      value: string | null;
      reason: string | null;
      company_id: string | null;
      contact_id: string | null;
      blocklist_level: string | null;
      is_active: boolean | null;
      instantly_synced: boolean | null;
      instantly_synced_at: string | null;
      instantly_error: string | null;
      pipedrive_synced: boolean | null;
      pipedrive_synced_at: string | null;
      pipedrive_error: string | null;
      created_at: string | null;
    };
    const typedEntries = (entries ?? []) as BlocklistEntryRow[];

    // Also get company details for entries with company_id
    const companiesData = await Promise.all(
      typedEntries
        .filter((entry: BlocklistEntryRow) => entry.company_id)
        .map(async (entry: BlocklistEntryRow) => {
          const { data: company, error: companyError } = await authResult.supabase
            .from('companies')
            .select('id, name, pipedrive_id, pipedrive_synced')
            .eq('id', entry.company_id)
            .single()

          return {
            entryId: entry.id,
            company: companyError ? null : company
          }
        })
    )

    return NextResponse.json({
      success: true,
      data: {
        entries: typedEntries,
        companies: companiesData,
        summary: {
          total: typedEntries.length,
          active: typedEntries.filter((e: BlocklistEntryRow) => e.is_active).length,
          instantly_synced: typedEntries.filter((e: BlocklistEntryRow) => e.instantly_synced).length,
          pipedrive_synced: typedEntries.filter((e: BlocklistEntryRow) => e.pipedrive_synced === true).length,
          company_blocks: typedEntries.filter((e: BlocklistEntryRow) => e.blocklist_level === 'organization').length
        }
      }
    })

  } catch (error) {
    console.error('Debug blocklist failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

export const GET = withAuth(debugHandler)