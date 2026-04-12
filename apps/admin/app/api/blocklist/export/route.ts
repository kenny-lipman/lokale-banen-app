import { NextRequest, NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"

export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseService.serviceClient

    // Note: Authentication temporarily disabled to match other API routes
    // TODO: Implement proper server-side auth when needed

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'json'
    const includeInactive = searchParams.get('include_inactive') === 'true'

    // Build the query
    let query = supabase
      .from('blocklist_entries')
      .select('type, value, reason, is_active, created_at, updated_at, instantly_synced, pipedrive_synced')
      .order('created_at', { ascending: false })

    // Filter by active status unless including inactive
    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching blocklist entries:", error)
      return NextResponse.json(
        { error: "Failed to export blocklist entries" },
        { status: 500 }
      )
    }

    // Format the response based on requested format
    if (format === 'csv') {
      // Generate CSV content
      const csvRows = [
        // Header row
        'Type,Value,Reason,Active,Created At,Updated At,Instantly Synced,Pipedrive Synced'
      ]

      data?.forEach(entry => {
        const row = [
          entry.type,
          entry.value,
          `"${entry.reason.replace(/"/g, '""')}"`, // Escape quotes in reason
          entry.is_active ? 'Yes' : 'No',
          entry.created_at,
          entry.updated_at,
          entry.instantly_synced ? 'Yes' : 'No',
          entry.pipedrive_synced ? 'Yes' : 'No'
        ].join(',')
        csvRows.push(row)
      })

      const csvContent = csvRows.join('\n')

      // Return CSV with appropriate headers
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="blocklist_export_${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    } else {
      // Return JSON format
      return NextResponse.json({
        entries: data || [],
        metadata: {
          exported_at: new Date().toISOString(),
          total_entries: data?.length || 0,
          include_inactive: includeInactive
        }
      })
    }
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}