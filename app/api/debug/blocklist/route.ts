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

    // Also get company details for entries with company_id
    const companiesData = await Promise.all(
      entries
        .filter(entry => entry.company_id)
        .map(async (entry) => {
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
        entries,
        companies: companiesData,
        summary: {
          total: entries.length,
          active: entries.filter(e => e.is_active).length,
          instantly_synced: entries.filter(e => e.instantly_synced).length,
          pipedrive_synced: entries.filter(e => e.pipedrive_synced === true).length,
          company_blocks: entries.filter(e => e.blocklist_level === 'organization').length
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