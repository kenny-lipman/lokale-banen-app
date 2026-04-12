import { NextRequest, NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"

export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseService.serviceClient

    // Get total count
    const { count: totalCount, error: totalError } = await supabase
      .from('blocklist_entries')
      .select('*', { count: 'exact', head: true })

    if (totalError) {
      console.error("Error fetching total count:", totalError)
      throw totalError
    }

    // Get active count
    const { count: activeCount, error: activeError } = await supabase
      .from('blocklist_entries')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    if (activeError) {
      console.error("Error fetching active count:", activeError)
      throw activeError
    }

    // Get inactive count
    const { count: inactiveCount, error: inactiveError } = await supabase
      .from('blocklist_entries')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', false)

    if (inactiveError) {
      console.error("Error fetching inactive count:", inactiveError)
      throw inactiveError
    }

    // Get count by type
    const { data: typeStats, error: typeError } = await supabase
      .from('blocklist_entries')
      .select('type')

    if (typeError) {
      console.error("Error fetching type stats:", typeError)
      throw typeError
    }

    const emailCount = typeStats?.filter(entry => entry.type === 'email').length || 0
    const domainCount = typeStats?.filter(entry => entry.type === 'domain').length || 0

    // Get sync status stats
    const { data: syncStats, error: syncError } = await supabase
      .from('blocklist_entries')
      .select('instantly_synced, pipedrive_synced')
      .eq('is_active', true)

    if (syncError) {
      console.error("Error fetching sync stats:", syncError)
      throw syncError
    }

    const instantlySyncedCount = syncStats?.filter(entry => entry.instantly_synced).length || 0
    const instantlyPendingCount = syncStats?.filter(entry => !entry.instantly_synced).length || 0
    const pipedriveSyncedCount = syncStats?.filter(entry => entry.pipedrive_synced).length || 0
    const pipedrivePendingCount = syncStats?.filter(entry => !entry.pipedrive_synced).length || 0

    // Get recent entries
    const { data: recentEntries, error: recentError } = await supabase
      .from('blocklist_entries')
      .select('id, type, value, reason, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    if (recentError) {
      console.error("Error fetching recent entries:", recentError)
      throw recentError
    }

    // Get entries added in last 24 hours
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    const { count: last24HoursCount, error: last24Error } = await supabase
      .from('blocklist_entries')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo.toISOString())

    if (last24Error) {
      console.error("Error fetching 24 hour count:", last24Error)
      throw last24Error
    }

    // Get entries added in last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { count: last7DaysCount, error: last7Error } = await supabase
      .from('blocklist_entries')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString())

    if (last7Error) {
      console.error("Error fetching 7 day count:", last7Error)
      throw last7Error
    }

    const stats = {
      overview: {
        total: totalCount || 0,
        active: activeCount || 0,
        inactive: inactiveCount || 0
      },
      byType: {
        email: emailCount,
        domain: domainCount
      },
      syncStatus: {
        instantly: {
          synced: instantlySyncedCount,
          pending: instantlyPendingCount
        },
        pipedrive: {
          synced: pipedriveSyncedCount,
          pending: pipedrivePendingCount
        }
      },
      recentActivity: {
        last24Hours: last24HoursCount || 0,
        last7Days: last7DaysCount || 0,
        recentEntries: recentEntries || []
      }
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch blocklist statistics" },
      { status: 500 }
    )
  }
}