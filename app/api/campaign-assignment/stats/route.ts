import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()
    const searchParams = request.nextUrl.searchParams

    // Parse date range (defaults to today)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dateFrom = searchParams.get('dateFrom') || today.toISOString()
    const dateTo = searchParams.get('dateTo') || new Date().toISOString()

    // Get overall stats for the period
    const { data: logs, error: logsError } = await supabase
      .from('campaign_assignment_logs')
      .select('status, platform_name, created_at')
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo)

    if (logsError) {
      console.error('Error fetching stats:', logsError)
      return NextResponse.json(
        { error: 'Failed to fetch stats', details: logsError.message },
        { status: 500 }
      )
    }

    // Calculate stats
    const stats = {
      total: logs?.length || 0,
      added: 0,
      skipped: 0,
      skippedKlant: 0,
      skippedAiError: 0,
      skippedDuplicate: 0,
      errors: 0,
      successRate: 0
    }

    const platformStats: Record<string, { added: number; skipped: number; errors: number }> = {}

    logs?.forEach(log => {
      const platform = log.platform_name || 'Unknown'
      if (!platformStats[platform]) {
        platformStats[platform] = { added: 0, skipped: 0, errors: 0 }
      }

      switch (log.status) {
        case 'added':
          stats.added++
          platformStats[platform].added++
          break
        case 'skipped_klant':
          stats.skipped++
          stats.skippedKlant++
          platformStats[platform].skipped++
          break
        case 'skipped_ai_error':
          stats.skipped++
          stats.skippedAiError++
          platformStats[platform].skipped++
          break
        case 'skipped_duplicate':
          stats.skipped++
          stats.skippedDuplicate++
          platformStats[platform].skipped++
          break
        case 'error':
          stats.errors++
          platformStats[platform].errors++
          break
      }
    })

    // Calculate success rate
    if (stats.total > 0) {
      stats.successRate = Math.round((stats.added / stats.total) * 100)
    }

    // Get recent batches
    const { data: batches, error: batchesError } = await supabase
      .from('campaign_assignment_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (batchesError) {
      console.error('Error fetching batches:', batchesError)
    }

    // Get daily trend (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: trendLogs, error: trendError } = await supabase
      .from('campaign_assignment_logs')
      .select('status, created_at')
      .gte('created_at', sevenDaysAgo.toISOString())

    const dailyTrend: Record<string, { added: number; skipped: number; errors: number }> = {}

    if (!trendError && trendLogs) {
      trendLogs.forEach(log => {
        const date = new Date(log.created_at).toISOString().split('T')[0]
        if (!dailyTrend[date]) {
          dailyTrend[date] = { added: 0, skipped: 0, errors: 0 }
        }

        if (log.status === 'added') {
          dailyTrend[date].added++
        } else if (log.status === 'error') {
          dailyTrend[date].errors++
        } else {
          dailyTrend[date].skipped++
        }
      })
    }

    return NextResponse.json({
      success: true,
      period: {
        from: dateFrom,
        to: dateTo
      },
      stats,
      platformStats,
      recentBatches: batches || [],
      dailyTrend
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Unexpected error fetching stats:', errorMessage)

    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    )
  }
}
